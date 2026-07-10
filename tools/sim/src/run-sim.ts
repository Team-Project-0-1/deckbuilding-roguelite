import { CONTENT_VERSION, contentDb } from '@game/content';
import {
  RUN_ENCOUNTERS,
  chooseCoinReward,
  chooseSkillReward,
  createRun,
  legalCommands,
  resolveCoinRemoval,
  settleRunCombat,
  skipSkillReward,
  startRunCombat,
  step,
  zoneCoinCount
} from '@game/core';
import type {
  CharacterId,
  CoinDefId,
  Command,
  CombatState,
  RunState,
  SkillId
} from '@game/core';

const character = (value: string): CharacterId => value as CharacterId;

const ATTACK_SKILL_PRIORITY = [
  'ignite-sword',
  'burning-strike',
  'smash',
  'slash',
  'ignite',
  'fire-infusion',
  'furnace'
];
const REWARD_SKILL_PRIORITY = ['smash', 'fire-infusion', 'furnace'];
const REPLACEMENT_PRIORITY = ['flame-rampage', 'furnace', 'ignite', 'fire-infusion', 'slash'];

export interface CombatRunRecord {
  combatIndex: number;
  encounter: string[];
  startingHp: number;
  endingHp: number;
  turns: number;
  result: 'victory' | 'defeat';
  startingBag: string[];
  permanentCoinsAtStart: string[];
  temporaryCoinsAtStart: number;
}

export interface RunSummary {
  seed: string;
  result: 'victory' | 'defeat';
  combatsCompleted: number;
  turnsPerCombat: number[];
  carriedHp: number;
  finalBag: string[];
  finalEquippedSkills: string[];
  encounterOrder: string[][];
}

export interface RunSimulation {
  summary: RunSummary;
  combats: CombatRunRecord[];
}

const incomingDamage = (state: CombatState): number =>
  state.enemies.reduce(
    (total, enemy) =>
      total +
      (enemy.hp <= 0
        ? 0
        : enemy.intent.actions.reduce(
            (sum, action) => sum + (action.kind === 'attack' ? action.damage * (action.hits ?? 1) : 0),
            0
          )),
    0
  );

const skillIdFor = (state: CombatState, command: Command): string | undefined => {
  if (command.type !== 'useFlipSkill' && command.type !== 'useConsumeSkill' && command.type !== 'placeCoin') {
    return undefined;
  }
  return state.slots[Number(command.slot)] === undefined
    ? undefined
    : String(state.slots[Number(command.slot)]?.skillId);
};

const coinPriority = (state: CombatState, command: Extract<Command, { type: 'placeCoin' }>, skillId: string): number => {
  const defId = String(state.coins[Number(command.coin)]?.defId ?? '');
  const ordered = skillId === 'guard' ? ['mana', 'fire', 'basic'] : ['fire', 'mana', 'basic'];
  const rank = ordered.indexOf(defId);
  return rank < 0 ? ordered.length : rank;
};

const firstUseForSkill = (state: CombatState, commands: readonly Command[], skillId: string): Command | undefined =>
  commands.find(
    (command) =>
      (command.type === 'useFlipSkill' || command.type === 'useConsumeSkill') &&
      skillIdFor(state, command) === skillId
  );

const firstPlacementForSkill = (
  state: CombatState,
  commands: readonly Command[],
  skillId: string
): Command | undefined => {
  const placements = commands.filter(
    (command): command is Extract<Command, { type: 'placeCoin' }> =>
      command.type === 'placeCoin' && skillIdFor(state, command) === skillId
  );
  return placements.sort(
    (left, right) => coinPriority(state, left, skillId) - coinPriority(state, right, skillId)
  )[0];
};

export const chooseRunCommand = (state: CombatState): Command => {
  const commands = legalCommands(state, contentDb);
  const needsGuard = incomingDamage(state) > state.player.block;
  const priorities = needsGuard ? ['guard', ...ATTACK_SKILL_PRIORITY] : ATTACK_SKILL_PRIORITY;

  for (const skillId of priorities) {
    const use = firstUseForSkill(state, commands, skillId);
    if (use !== undefined) return use;
  }
  for (const skillId of priorities) {
    const place = firstPlacementForSkill(state, commands, skillId);
    if (place !== undefined) return place;
  }
  return { type: 'endTurn' };
};

const assertCombatInvariants = (state: CombatState, expectedCoins: number): void => {
  if (zoneCoinCount(state.zones) !== Object.keys(state.coins).length) {
    throw new Error('zone coin count mismatch');
  }
  if (Object.keys(state.coins).length !== expectedCoins) throw new Error('coin ledger mismatch');
  if (state.player.hp < 0 || state.player.hp > state.player.maxHp) throw new Error('player HP out of range');
  for (const enemy of state.enemies) {
    if (enemy.hp < 0 || enemy.hp > enemy.maxHp) throw new Error('enemy HP out of range');
  }
};

const playCombat = (initial: CombatState): CombatState => {
  let state = initial;
  let expectedCoins = Object.keys(state.coins).length;
  for (let commandIndex = 0; commandIndex < 500 && state.phase === 'player'; commandIndex += 1) {
    const command = chooseRunCommand(state);
    const result = step(state, command, contentDb);
    if (!result.ok) throw new Error(`illegal baseline command: ${result.error}`);
    state = result.state;
    expectedCoins += result.events.filter((event) => event.type === 'coinCreated').length;
    assertCombatInvariants(state, expectedCoins);
  }
  if (state.phase !== 'victory' && state.phase !== 'defeat') {
    throw new Error('baseline policy did not finish combat within 500 commands');
  }
  return state;
};

const preferredCoinReward = (run: RunState): CoinDefId | null => {
  const options = run.pendingRewards?.coinOptions ?? [];
  return (
    options.find((coin) => String(coin) === 'fire') ??
    options.find((coin) => String(coin) === 'mana') ??
    options[0] ??
    null
  );
};

const replacementSlot = (run: RunState): number => {
  for (const skillId of REPLACEMENT_PRIORITY) {
    const index = run.equippedSkills.findIndex((skill) => String(skill) === skillId);
    if (index >= 0) return index;
  }
  return run.equippedSkills.length - 1;
};

const resolveRewards = (input: RunState): RunState => {
  let run = chooseCoinReward(input, preferredCoinReward(input));
  const removableBasic = run.bag.findIndex((coin) => String(coin) === 'basic');
  run = resolveCoinRemoval(run, removableBasic >= 0 ? removableBasic : null);
  if (run.phase !== 'rewards' || run.pendingRewards?.skillChoiceResolved !== false) return run;

  const offered = run.pendingRewards.skillOptions;
  const selected = REWARD_SKILL_PRIORITY
    .map((skillId) => offered.find((skill) => String(skill) === skillId))
    .find((skill): skill is SkillId => skill !== undefined);
  return selected === undefined ? skipSkillReward(run) : chooseSkillReward(run, selected, replacementSlot(run));
};

const permanentCoinIds = (combat: CombatState): string[] =>
  Object.values(combat.coins)
    .filter((coin) => coin.permanent)
    .map((coin) => String(coin.defId));

export const simulateRun = (seed: string): RunSimulation => {
  let run = createRun(
    { contentVersion: CONTENT_VERSION, runSeed: seed, character: character('warrior') },
    contentDb
  );
  const combats: CombatRunRecord[] = [];

  while (run.phase !== 'victory' && run.phase !== 'defeat') {
    if (run.phase !== 'ready') throw new Error(`unexpected run phase before combat: ${run.phase}`);
    const startingBag = run.bag.map(String);
    const started = startRunCombat(run, contentDb);
    const permanentAtStart = permanentCoinIds(started.combat);
    const temporaryAtStart = Object.values(started.combat.coins).filter((coin) => !coin.permanent).length;
    const finished = playCombat(started.combat);
    const combatResult = finished.phase;
    if (combatResult !== 'victory' && combatResult !== 'defeat') throw new Error('combat did not terminate');
    combats.push({
      combatIndex: run.combatIndex,
      encounter: finished.enemies.map((enemy) => String(enemy.defId)),
      startingHp: started.combat.player.hp,
      endingHp: finished.player.hp,
      turns: finished.turn,
      result: combatResult,
      startingBag,
      permanentCoinsAtStart: permanentAtStart,
      temporaryCoinsAtStart: temporaryAtStart
    });
    run = settleRunCombat(started.run, finished, contentDb);
    if (run.phase === 'rewards') run = resolveRewards(run);
  }

  const result = run.phase;
  if (result !== 'victory' && result !== 'defeat') throw new Error('run did not reach a terminal result');
  return {
    summary: {
      seed,
      result,
      combatsCompleted: combats.length,
      turnsPerCombat: combats.map((combat) => combat.turns),
      carriedHp: run.currentHp,
      finalBag: run.bag.map(String),
      finalEquippedSkills: run.equippedSkills.map(String),
      encounterOrder: combats.map((combat) => combat.encounter)
    },
    combats
  };
};

export const expectedEncounterOrder = (): string[][] =>
  RUN_ENCOUNTERS.map((encounter) => encounter.map(String));

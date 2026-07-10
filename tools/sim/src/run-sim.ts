import { CONTENT_VERSION, contentDb } from "@game/content";
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
} from "@game/core";
import type {
  CharacterId,
  CoinDefId,
  CombatState,
  Command,
  RunState,
  SkillId,
} from "@game/core";

import {
  M6_TRACE_SCHEMA_VERSION,
  type M6CombatTrace,
  type M6RunResult,
  type M6RunTrace,
} from "./metrics";
import { createPolicy, type PolicyId } from "./policies";
import {
  M6_TRANSCRIPT_SCHEMA_VERSION,
  type M6CombatTranscript,
  type M6EpisodeTranscript,
  type M6RewardDecisionTrace,
  type M6VariantConfig,
  type M6VariantId,
} from "./bulk/types";
import {
  combatInvariantViolations,
  playPolicyCombat,
} from "./bulk/trace";

const character = (value: string): CharacterId => value as CharacterId;

const ATTACK_SKILL_PRIORITY = [
  "ignite-sword",
  "burning-strike",
  "smash",
  "slash",
  "ignite",
  "fire-infusion",
  "furnace",
];
const REWARD_SKILL_PRIORITY = ["smash", "fire-infusion", "furnace"];
const REPLACEMENT_PRIORITY = [
  "flame-rampage",
  "furnace",
  "ignite",
  "fire-infusion",
  "slash",
];

export const M6_VARIANTS: Readonly<Record<M6VariantId, M6VariantConfig>> =
  Object.freeze({
    baseline: Object.freeze({
      id: "baseline",
      coinRewardPriority: Object.freeze(["fire", "mana", "basic"]),
    }),
    "basic-first": Object.freeze({
      id: "basic-first",
      coinRewardPriority: Object.freeze(["basic", "mana", "fire"]),
    }),
  });

export interface CombatRunRecord {
  combatIndex: number;
  encounter: string[];
  startingHp: number;
  endingHp: number;
  turns: number;
  result: "victory" | "defeat";
  startingBag: string[];
  permanentCoinsAtStart: string[];
  temporaryCoinsAtStart: number;
}

export interface RunSummary {
  seed: string;
  result: "victory" | "defeat";
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

export interface M6PolicyRunOptions {
  readonly baseSeed: string;
  readonly runSeed: string;
  readonly episodeId: string;
  readonly episodeIndex: number;
  readonly policyId: PolicyId;
  readonly variantId?: M6VariantId;
  readonly maxCommandsPerCombat?: number;
}

export interface M6PolicyRunSimulation {
  readonly trace: M6RunTrace;
  readonly transcript: M6EpisodeTranscript;
}

interface RewardResolution {
  readonly run: RunState;
  readonly trace: M6RewardDecisionTrace;
}

const incomingDamage = (state: CombatState): number =>
  state.enemies.reduce(
    (total, enemy) =>
      total +
      (enemy.hp <= 0
        ? 0
        : enemy.intent.actions.reduce(
            (sum, action) =>
              sum +
              (action.kind === "attack"
                ? action.damage * (action.hits ?? 1)
                : 0),
            0,
          )),
    0,
  );

const skillIdFor = (
  state: CombatState,
  command: Command,
): string | undefined => {
  if (
    command.type !== "useFlipSkill" &&
    command.type !== "useConsumeSkill" &&
    command.type !== "placeCoin"
  ) {
    return undefined;
  }
  return state.slots[Number(command.slot)] === undefined
    ? undefined
    : String(state.slots[Number(command.slot)]?.skillId);
};

const coinPriority = (
  state: CombatState,
  command: Extract<Command, { type: "placeCoin" }>,
  skillId: string,
): number => {
  const defId = String(state.coins[Number(command.coin)]?.defId ?? "");
  const ordered =
    skillId === "guard"
      ? ["mana", "fire", "basic"]
      : ["fire", "mana", "basic"];
  const rank = ordered.indexOf(defId);
  return rank < 0 ? ordered.length : rank;
};

const firstUseForSkill = (
  state: CombatState,
  commands: readonly Command[],
  skillId: string,
): Command | undefined =>
  commands.find(
    (command) =>
      (command.type === "useFlipSkill" ||
        command.type === "useConsumeSkill") &&
      skillIdFor(state, command) === skillId,
  );

const firstPlacementForSkill = (
  state: CombatState,
  commands: readonly Command[],
  skillId: string,
): Command | undefined => {
  const placements = commands.filter(
    (command): command is Extract<Command, { type: "placeCoin" }> =>
      command.type === "placeCoin" &&
      skillIdFor(state, command) === skillId,
  );
  return placements.sort(
    (left, right) =>
      coinPriority(state, left, skillId) - coinPriority(state, right, skillId),
  )[0];
};

export const chooseRunCommand = (state: CombatState): Command => {
  const commands = legalCommands(state, contentDb);
  const needsGuard = incomingDamage(state) > state.player.block;
  const priorities = needsGuard
    ? ["guard", ...ATTACK_SKILL_PRIORITY]
    : ATTACK_SKILL_PRIORITY;

  for (const skillId of priorities) {
    const use = firstUseForSkill(state, commands, skillId);
    if (use !== undefined) return use;
  }
  for (const skillId of priorities) {
    const place = firstPlacementForSkill(state, commands, skillId);
    if (place !== undefined) return place;
  }
  return { type: "endTurn" };
};

const assertCombatInvariants = (
  state: CombatState,
  expectedCoins: number,
): void => {
  const violations = combatInvariantViolations(state, expectedCoins);
  if (violations.length > 0) throw new Error(violations.join("; "));
};

const runInvariantViolations = (run: RunState): string[] => {
  const violations: string[] = [];
  if (run.currentHp < 0 || run.currentHp > run.maxHp) {
    violations.push("run HP out of range");
  }
  if (run.equippedSkills.length !== 6) {
    violations.push("run must have exactly six equipped skills");
  }
  if (run.bag.some((coin) => contentDb.coins[String(coin)] === undefined)) {
    violations.push("run bag contains an unknown coin");
  }
  if (
    run.equippedSkills.some(
      (skill) => contentDb.skills[String(skill)] === undefined,
    )
  ) {
    violations.push("run loadout contains an unknown skill");
  }
  return violations;
};

const playCombat = (initial: CombatState): CombatState => {
  let state = initial;
  let expectedCoins = Object.keys(state.coins).length;
  for (
    let commandIndex = 0;
    commandIndex < 500 && state.phase === "player";
    commandIndex += 1
  ) {
    const command = chooseRunCommand(state);
    const result = step(state, command, contentDb);
    if (!result.ok)
      throw new Error(`illegal baseline command: ${result.error}`);
    state = result.state;
    expectedCoins += result.events.filter(
      (event) => event.type === "coinCreated",
    ).length;
    assertCombatInvariants(state, expectedCoins);
  }
  if (state.phase !== "victory" && state.phase !== "defeat") {
    throw new Error("baseline policy did not finish combat within 500 commands");
  }
  return state;
};

const preferredCoinReward = (
  run: RunState,
  variant: M6VariantConfig,
): CoinDefId | null => {
  const options = run.pendingRewards?.coinOptions ?? [];
  for (const coinId of variant.coinRewardPriority) {
    const selected = options.find((coin) => String(coin) === coinId);
    if (selected !== undefined) return selected;
  }
  return options[0] ?? null;
};

const replacementSlot = (run: RunState): number => {
  for (const skillId of REPLACEMENT_PRIORITY) {
    const index = run.equippedSkills.findIndex(
      (skill) => String(skill) === skillId,
    );
    if (index >= 0) return index;
  }
  return run.equippedSkills.length - 1;
};

const resolveRewardsDetailed = (
  input: RunState,
  variant: M6VariantConfig,
): RewardResolution => {
  const completedCombatIndex = input.combatIndex - 1;
  const coinOptions = (input.pendingRewards?.coinOptions ?? []).map(String);
  const selectedCoin = preferredCoinReward(input, variant);
  let run = chooseCoinReward(input, selectedCoin);
  const removableBasic = run.bag.findIndex(
    (coin) => String(coin) === "basic",
  );
  const removedBagIndex = removableBasic >= 0 ? removableBasic : null;
  const removedCoin =
    removedBagIndex === null ? null : String(run.bag[removedBagIndex]);
  run = resolveCoinRemoval(run, removedBagIndex);

  let fallbackCoinOptions: string[] = [];
  let selectedFallbackCoin: CoinDefId | null = null;
  if (
    run.phase === "rewards" &&
    run.pendingRewards?.coinChoiceResolved === false &&
    run.pendingRewards.coinRemovalResolved
  ) {
    fallbackCoinOptions = run.pendingRewards.coinOptions.map(String);
    selectedFallbackCoin = preferredCoinReward(run, variant);
    run = chooseCoinReward(run, selectedFallbackCoin);
  }

  const skillOptions = (run.pendingRewards?.skillOptions ?? []).map(String);
  let selectedSkill: SkillId | null = null;
  let replacedSlot: number | null = null;
  if (
    run.phase === "rewards" &&
    run.pendingRewards?.skillChoiceResolved === false
  ) {
    const offered = run.pendingRewards.skillOptions;
    selectedSkill =
      REWARD_SKILL_PRIORITY.map((skillId) =>
        offered.find((skill) => String(skill) === skillId),
      ).find((skill): skill is SkillId => skill !== undefined) ?? null;
    if (selectedSkill === null) {
      run = skipSkillReward(run);
    } else {
      replacedSlot = replacementSlot(run);
      run = chooseSkillReward(run, selectedSkill, replacedSlot);
    }
  }

  return {
    run,
    trace: {
      schemaVersion: M6_TRANSCRIPT_SCHEMA_VERSION,
      completedCombatIndex,
      coinOptions,
      selectedCoin: selectedCoin === null ? null : String(selectedCoin),
      removedBagIndex,
      removedCoin,
      skillOptions,
      selectedSkill: selectedSkill === null ? null : String(selectedSkill),
      replacedSlot,
      fallbackCoinOptions,
      selectedFallbackCoin:
        selectedFallbackCoin === null ? null : String(selectedFallbackCoin),
    },
  };
};

const resolveRewards = (input: RunState): RunState =>
  resolveRewardsDetailed(input, M6_VARIANTS.baseline).run;

const permanentCoinIds = (combat: CombatState): string[] =>
  Object.values(combat.coins)
    .filter((coin) => coin.permanent)
    .map((coin) => String(coin.defId));

export const simulateRun = (seed: string): RunSimulation => {
  let run = createRun(
    {
      contentVersion: CONTENT_VERSION,
      runSeed: seed,
      character: character("warrior"),
    },
    contentDb,
  );
  const combats: CombatRunRecord[] = [];

  while (run.phase !== "victory" && run.phase !== "defeat") {
    if (run.phase !== "ready")
      throw new Error(`unexpected run phase before combat: ${run.phase}`);
    const startingBag = run.bag.map(String);
    const started = startRunCombat(run, contentDb);
    const permanentAtStart = permanentCoinIds(started.combat);
    const temporaryAtStart = Object.values(started.combat.coins).filter(
      (coin) => !coin.permanent,
    ).length;
    const finished = playCombat(started.combat);
    const combatResult = finished.phase;
    if (combatResult !== "victory" && combatResult !== "defeat")
      throw new Error("combat did not terminate");
    combats.push({
      combatIndex: run.combatIndex,
      encounter: finished.enemies.map((enemy) => String(enemy.defId)),
      startingHp: started.combat.player.hp,
      endingHp: finished.player.hp,
      turns: finished.turn,
      result: combatResult,
      startingBag,
      permanentCoinsAtStart: permanentAtStart,
      temporaryCoinsAtStart: temporaryAtStart,
    });
    run = settleRunCombat(started.run, finished, contentDb);
    if (run.phase === "rewards") run = resolveRewards(run);
  }

  const result = run.phase;
  if (result !== "victory" && result !== "defeat")
    throw new Error("run did not reach a terminal result");
  return {
    summary: {
      seed,
      result,
      combatsCompleted: combats.length,
      turnsPerCombat: combats.map((combat) => combat.turns),
      carriedHp: run.currentHp,
      finalBag: run.bag.map(String),
      finalEquippedSkills: run.equippedSkills.map(String),
      encounterOrder: combats.map((combat) => combat.encounter),
    },
    combats,
  };
};

const crashCode = (error: unknown): string => {
  if (!(error instanceof Error)) return "UNKNOWN_THROW";
  if (error.message.includes("reward")) return "REWARD_RESOLUTION_ERROR";
  if (error.message.includes("phase")) return "RUN_PHASE_ERROR";
  return "RUN_THROW";
};

export const simulatePolicyRun = (
  options: M6PolicyRunOptions,
): M6PolicyRunSimulation => {
  const variant = M6_VARIANTS[options.variantId ?? "baseline"];
  const maxCommands = options.maxCommandsPerCombat ?? 500;
  if (!Number.isSafeInteger(options.episodeIndex) || options.episodeIndex < 0) {
    throw new RangeError("episodeIndex must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(maxCommands) || maxCommands <= 0) {
    throw new RangeError("maxCommandsPerCombat must be a positive safe integer");
  }
  const traceId = `${variant.id}/${options.policyId}/${String(options.episodeIndex).padStart(8, "0")}`;
  const combatTraces: M6CombatTrace[] = [];
  const combatTranscripts: M6CombatTranscript[] = [];
  const rewardTraces: M6RewardDecisionTrace[] = [];
  const runViolations: string[] = [];
  let result: M6RunResult = "crash";
  let crash: { code: string } | null = null;

  try {
    let run = createRun(
      {
        contentVersion: CONTENT_VERSION,
        runSeed: options.runSeed,
        character: character("warrior"),
      },
      contentDb,
    );
    const policy = createPolicy(options.policyId, {
      runSeed: options.runSeed,
      episodeIndex: options.episodeIndex,
    });

    while (run.phase !== "victory" && run.phase !== "defeat") {
      if (run.phase !== "ready") {
        throw new Error(`unexpected run phase before combat: ${run.phase}`);
      }
      const combatIndex = run.combatIndex;
      const started = startRunCombat(run, contentDb);
      const combat = playPolicyCombat(
        started.combat,
        combatIndex,
        policy,
        maxCommands,
      );
      combatTraces.push(combat.trace);
      combatTranscripts.push(combat.transcript);
      if (combat.crash !== null) {
        crash = combat.crash;
        result = "crash";
        break;
      }
      if (
        combat.state.phase !== "victory" &&
        combat.state.phase !== "defeat"
      ) {
        result = "nonterminal";
        break;
      }
      run = settleRunCombat(started.run, combat.state, contentDb);
      if (run.phase === "rewards") {
        const reward = resolveRewardsDetailed(run, variant);
        run = reward.run;
        rewardTraces.push(reward.trace);
      }
      const violations = runInvariantViolations(run);
      runViolations.push(...violations);
      if (violations.length > 0) {
        crash = { code: "RUN_INVARIANT_VIOLATION" };
        result = "crash";
        break;
      }
    }

    if (crash === null && result !== "nonterminal") {
      if (run.phase === "victory" || run.phase === "defeat") {
        result = run.phase;
      } else {
        result = "nonterminal";
      }
    }
  } catch (error) {
    crash = { code: crashCode(error) };
    result = "crash";
  }

  const trace: M6RunTrace = {
    schemaVersion: M6_TRACE_SCHEMA_VERSION,
    traceId,
    episodeId: options.episodeId,
    episodeIndex: options.episodeIndex,
    baseSeed: options.baseSeed,
    runSeed: options.runSeed,
    contentVersion: CONTENT_VERSION,
    variantId: variant.id,
    policyId: options.policyId,
    expectedCombatCount: RUN_ENCOUNTERS.length,
    result,
    crash,
    invariantViolations: runViolations,
    combats: combatTraces,
  };
  return {
    trace,
    transcript: {
      schemaVersion: M6_TRANSCRIPT_SCHEMA_VERSION,
      traceId,
      episodeId: options.episodeId,
      baseSeed: options.baseSeed,
      runSeed: options.runSeed,
      episodeIndex: options.episodeIndex,
      policyId: options.policyId,
      variantId: variant.id,
      combats: combatTranscripts,
      rewards: rewardTraces,
    },
  };
};

export const expectedEncounterOrder = (): string[][] =>
  RUN_ENCOUNTERS.map((encounter) => encounter.map(String));

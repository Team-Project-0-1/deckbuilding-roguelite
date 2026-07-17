import type { ContentDb, FlipSkillDef } from "../content-types";
import { flipSkillEffects, isSuccessLadderFlipSkill } from "../content-types";
import type { CoinUid, Face, SlotId } from "../ids";
import type { Rng, RngSnapshot } from "../rng";
import type { CombatEvent } from "./events";
import { resolveFlip } from "./resolve/flip";
import { cloneState } from "./state";
import type { CombatState } from "./state";

export interface PreviewBranch {
  faces: Face[];
  probability: number;
  damage: number;
  block: number;
  selfDamage: number;
  heal: number;
  burn: number;
  coinsCreated: number;
}

export interface PreviewFlipResult {
  branches: PreviewBranch[];
  byAxis: {
    damage: { min: number; max: number };
    block: { min: number; max: number };
    selfDamage: { min: number; max: number };
    heal: { min: number; max: number };
    burn: { min: number; max: number };
    coinsCreated: { min: number; max: number };
  };
  expected: {
    damage: number;
    block: number;
    selfDamage: number;
    heal: number;
    burn: number;
    coinsCreated: number;
  };
}

const permanentEnchant = (
  state: CombatState,
  coin: CoinUid | undefined,
): string | undefined => {
  if (coin === undefined) return undefined;
  const instance = state.coins[Number(coin)];
  return instance?.permanent === true ? instance.enchant : undefined;
};

const scriptedFlips = (
  faces: readonly Face[],
  state: CombatState,
  placed: readonly CoinUid[],
): Rng => {
  let index = 0;
  const nextFace = (): Face => {
    const face = faces[index];
    if (face === undefined) throw new Error("scripted flip exhausted");
    index += 1;
    return face;
  };
  return {
    float: () => {
      const face = nextFace();
      const coin = placed.length === 0 ? undefined : placed[(index - 1) % placed.length];
      const favoredFace = permanentEnchant(state, coin) === "tails-polish" ? "tails" : "heads";
      return face === favoredFace ? 0 : 0.999_999;
    },
    int: () => 0,
    flip: nextFace,
    shuffle: <T>(xs: readonly T[]) => [...xs],
    snapshot: (): RngSnapshot => ({ s: [index, 0, 0, 0] }),
  };
};

interface WeightedFaces {
  faces: Face[];
  probability: number;
}

const faceOptions = (
  state: CombatState,
  coin: CoinUid,
  skill: FlipSkillDef,
  repeat: boolean,
): readonly { face: Face; probability: number }[] => {
  const enchant = permanentEnchant(state, coin);
  if (
    !repeat &&
    enchant === "pendulum" &&
    state.coins[Number(coin)]?.enchantUsed !== true &&
    isSuccessLadderFlipSkill(skill)
  ) {
    return [{ face: skill.successFace, probability: 1 }];
  }
  let headsProbability = 0.5;
  if (enchant === "heads-polish") headsProbability = 0.6;
  if (enchant === "tails-polish") headsProbability = 0.4;
  return [
    { face: "heads", probability: headsProbability },
    { face: "tails", probability: 1 - headsProbability },
  ];
};

const enumerateWeightedFaces = (
  state: CombatState,
  coins: readonly CoinUid[],
  skill: FlipSkillDef,
  repeat: boolean,
): WeightedFaces[] => {
  if (coins.length > 15) throw new Error("preview supports up to 15 flip outcomes");
  return coins.reduce<WeightedFaces[]>(
    (branches, coin) =>
      branches.flatMap((branch) =>
        faceOptions(state, coin, skill, repeat).map((option) => ({
          faces: [...branch.faces, option.face],
          probability: branch.probability * option.probability,
        })),
      ),
    [{ faces: [], probability: 1 }],
  );
};

const sumBranch = (
  events: readonly CombatEvent[],
): Omit<PreviewBranch, "faces" | "probability"> =>
  events.reduce(
    (total, event) => {
      if (event.type === "damageDealt" && (event.source === "skill" || event.source === "coin")) {
        return { ...total, damage: total.damage + event.amount };
      }
      if (event.type === "damageDealt" && event.source === "self") {
        return { ...total, selfDamage: total.selfDamage + event.amount };
      }
      if (event.type === "blockGained" && event.target.type === "player") {
        return { ...total, block: total.block + event.amount };
      }
      if (event.type === "statusApplied" && event.status === "burn") {
        return { ...total, burn: total.burn + event.stacks };
      }
      if (event.type === "healed" && event.target.type === "player") {
        return { ...total, heal: total.heal + event.amount };
      }
      if (event.type === "coinCreated") {
        return { ...total, coinsCreated: total.coinsCreated + 1 };
      }
      return total;
    },
    { damage: 0, block: 0, selfDamage: 0, heal: 0, burn: 0, coinsCreated: 0 },
  );

const minMax = (values: readonly number[]): { min: number; max: number } => ({
  min: Math.min(...values),
  max: Math.max(...values),
});

const isBasicCoinInHand = (
  state: CombatState,
  coin: CoinUid,
  db: ContentDb,
): boolean => {
  const instance = state.coins[Number(coin)];
  const def = instance === undefined ? undefined : db.coins[String(instance.defId)];
  return instance !== undefined && def?.element === null && instance.grants.length === 0;
};

const hasChooseBasicInHand = (skill: FlipSkillDef): boolean =>
  flipSkillEffects(skill).some(
    (effect) => effect.kind === "grantElement" && effect.scope === "chooseBasicInHand",
  );

const suggestedChosen = (
  state: CombatState,
  db: ContentDb,
): CoinUid[] | undefined => {
  const coin = state.zones.hand.find((candidate) =>
    isBasicCoinInHand(state, candidate, db),
  );
  return coin === undefined ? undefined : [coin];
};

export const previewFlip = (
  state: CombatState,
  slot: SlotId,
  db: ContentDb,
): PreviewFlipResult => {
  const slotState = state.slots[Number(slot)];
  if (slotState === undefined) throw new Error("slot does not exist");
  const skill = db.skills[String(slotState.skillId)];
  if (skill === undefined || skill.type !== "flip")
    throw new Error("slot is not a flip skill");

  const placed = state.zones.placed[slot] ?? [];
  const character = db.characters[String(state.characterId)];
  const canRemiseRepeat =
    character?.trait.mechanic === "remise" &&
    state.player.remiseCharges > 0 &&
    skill.tags.includes("attack") &&
    placed.length > 0;
  const originalBranches = enumerateWeightedFaces(state, placed, skill, false);
  const faceBranches = originalBranches.flatMap((original) =>
    canRemiseRepeat && original.faces[0] === "heads"
      ? enumerateWeightedFaces(state, placed, skill, true).map((repeat) => ({
          faces: [...original.faces, ...repeat.faces],
          probability: original.probability * repeat.probability,
        }))
      : [original],
  );
  const chosen = hasChooseBasicInHand(skill) ? suggestedChosen(state, db) : undefined;
  const firstLivingTarget = state.enemies.findIndex((enemy) => enemy.hp > 0);

  const branches = faceBranches.map((branch): PreviewBranch => {
    const branchState = cloneState(state);
    const result = resolveFlip(
      {
        ...branchState,
        rngImpl: {
          ...branchState.rngImpl,
          flip: scriptedFlips(branch.faces, branchState, placed),
        },
      },
      slot,
      skill,
      firstLivingTarget >= 0 ? firstLivingTarget : undefined,
      db,
      chosen,
    );
    return { faces: branch.faces, probability: branch.probability, ...sumBranch(result.events) };
  });

  return {
    branches,
    byAxis: {
      damage: minMax(branches.map((branch) => branch.damage)),
      block: minMax(branches.map((branch) => branch.block)),
      selfDamage: minMax(branches.map((branch) => branch.selfDamage)),
      heal: minMax(branches.map((branch) => branch.heal)),
      burn: minMax(branches.map((branch) => branch.burn)),
      coinsCreated: minMax(branches.map((branch) => branch.coinsCreated)),
    },
    expected: {
      damage: branches.reduce(
        (sum, branch) => sum + branch.damage * branch.probability,
        0,
      ),
      block: branches.reduce(
        (sum, branch) => sum + branch.block * branch.probability,
        0,
      ),
      selfDamage: branches.reduce(
        (sum, branch) => sum + branch.selfDamage * branch.probability,
        0,
      ),
      heal: branches.reduce(
        (sum, branch) => sum + branch.heal * branch.probability,
        0,
      ),
      burn: branches.reduce(
        (sum, branch) => sum + branch.burn * branch.probability,
        0,
      ),
      coinsCreated: branches.reduce(
        (sum, branch) => sum + branch.coinsCreated * branch.probability,
        0,
      ),
    },
  };
};

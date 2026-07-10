import type { CombatPolicy, PolicyFactoryOptions } from "./types";
import {
  chooseEvaluatedCommand,
  type OutcomeComparator,
  type PublicOutcome,
} from "./evaluation";

const EPSILON = 1e-9;

const compareNumber = (candidate: number, incumbent: number): number =>
  candidate > incumbent + EPSILON
    ? 1
    : candidate < incumbent - EPSILON
      ? -1
      : 0;

const aggroDamage = (outcome: PublicOutcome): number =>
  outcome.expectedDamage + outcome.expectedBurn;

const compareAggro: OutcomeComparator = (candidate, incumbent) =>
  compareNumber(aggroDamage(candidate), aggroDamage(incumbent));

const compareTurtle: OutcomeComparator = (candidate, incumbent) => {
  const hpLoss = compareNumber(
    incumbent.expectedHpLoss,
    candidate.expectedHpLoss,
  );
  if (hpLoss !== 0) return hpLoss;

  const prevention = compareNumber(
    candidate.preventedIncomingDamage,
    incumbent.preventedIncomingDamage,
  );
  if (prevention !== 0) return prevention;

  const selfDamage = compareNumber(
    incumbent.expectedSelfDamage,
    candidate.expectedSelfDamage,
  );
  if (selfDamage !== 0) return selfDamage;

  return compareNumber(aggroDamage(candidate), aggroDamage(incumbent));
};

export const GREEDY_EV_WEIGHTS = Object.freeze({
  expectedDamage: 1,
  preventedIncomingDamage: 0.9,
  selfDamage: -1.5,
  burnMarginalValue: 0.75,
  unusedResourcePenalty: -0.1,
} as const);

const greedyEvScore = (outcome: PublicOutcome): number =>
  outcome.expectedDamage * GREEDY_EV_WEIGHTS.expectedDamage +
  outcome.preventedIncomingDamage * GREEDY_EV_WEIGHTS.preventedIncomingDamage +
  outcome.expectedSelfDamage * GREEDY_EV_WEIGHTS.selfDamage +
  outcome.expectedBurn * GREEDY_EV_WEIGHTS.burnMarginalValue +
  outcome.unusedResources * GREEDY_EV_WEIGHTS.unusedResourcePenalty;

const compareGreedy: OutcomeComparator = (candidate, incumbent) =>
  compareNumber(greedyEvScore(candidate), greedyEvScore(incumbent));

export const createAggroPolicy = (
  options: PolicyFactoryOptions,
): CombatPolicy => {
  void options;
  return {
    id: "aggro",
    choose: (state, db) =>
      chooseEvaluatedCommand("aggro", state, db, compareAggro),
  };
};

export const createTurtlePolicy = (
  options: PolicyFactoryOptions,
): CombatPolicy => {
  void options;
  return {
    id: "turtle",
    choose: (state, db) =>
      chooseEvaluatedCommand("turtle", state, db, compareTurtle),
  };
};

export const createGreedyEvPolicy = (
  options: PolicyFactoryOptions,
): CombatPolicy => {
  void options;
  return {
    id: "greedy",
    choose: (state, db) =>
      chooseEvaluatedCommand("greedy", state, db, compareGreedy),
  };
};

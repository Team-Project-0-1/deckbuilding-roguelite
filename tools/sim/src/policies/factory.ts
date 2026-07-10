import { createRandomPolicy } from "./random";
import {
  createAggroPolicy,
  createGreedyEvPolicy,
  createTurtlePolicy,
} from "./strategies";
import type { CombatPolicy, PolicyFactoryOptions, PolicyId } from "./types";

export const createPolicy = (
  policyId: PolicyId,
  options: PolicyFactoryOptions,
): CombatPolicy => {
  switch (policyId) {
    case "random":
      return createRandomPolicy(options);
    case "aggro":
      return createAggroPolicy(options);
    case "turtle":
      return createTurtlePolicy(options);
    case "greedy":
      return createGreedyEvPolicy(options);
  }
};

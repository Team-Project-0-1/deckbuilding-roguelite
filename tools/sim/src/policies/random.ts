import { derive, legalCommands, rngFrom, seedFromString } from "@game/core";
import type { Rng } from "@game/core";

import { canonicalFallbackCommand, stableCommandOrder } from "./command-key";
import type { CombatPolicy, PolicyFactoryOptions, PolicyId } from "./types";
import { PolicyDecisionError } from "./types";

export const createPolicyRng = (
  runSeed: string,
  policyId: PolicyId,
  episodeIndex = 0,
): Rng => {
  if (!Number.isSafeInteger(episodeIndex) || episodeIndex < 0) {
    throw new RangeError("episodeIndex must be a non-negative safe integer");
  }
  return rngFrom(
    derive(seedFromString(runSeed), `policy:${policyId}`, episodeIndex),
  );
};

export const createRandomPolicy = (
  options: PolicyFactoryOptions,
): CombatPolicy => {
  const rng =
    options.rng ??
    createPolicyRng(options.runSeed, "random", options.episodeIndex ?? 0);

  return {
    id: "random",
    choose: (state, db) => {
      const commands = stableCommandOrder(legalCommands(state, db));
      if (commands.length === 0) {
        throw new PolicyDecisionError(
          "NO_LEGAL_COMMANDS",
          "random",
          state.phase,
        );
      }

      const selected = commands[rng.int(commands.length)];
      const fallback = canonicalFallbackCommand(commands);
      if (selected !== undefined) return selected;
      if (fallback !== undefined) return fallback;
      throw new PolicyDecisionError("NO_LEGAL_COMMANDS", "random", state.phase);
    },
  };
};

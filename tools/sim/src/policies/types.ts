import type { Command, CombatState, ContentDb, Rng } from "@game/core";

export const POLICY_IDS = ["random", "aggro", "turtle", "greedy"] as const;

export type PolicyId = (typeof POLICY_IDS)[number];

export interface CombatPolicy {
  readonly id: PolicyId;
  choose(state: CombatState, db: ContentDb): Command;
}

export interface PolicyFactoryOptions {
  readonly runSeed: string;
  readonly episodeIndex?: number;
  readonly rng?: Rng;
}

export type PolicyDecisionErrorCode = "NO_LEGAL_COMMANDS";

export class PolicyDecisionError extends Error {
  readonly name = "PolicyDecisionError";

  constructor(
    readonly code: PolicyDecisionErrorCode,
    readonly policyId: PolicyId,
    readonly phase: CombatState["phase"],
  ) {
    super(
      `policy ${policyId} cannot choose a command: ${code} (phase=${phase})`,
    );
  }
}

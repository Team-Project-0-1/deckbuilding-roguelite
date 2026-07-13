import type { ConsumeSkillDef } from "../content-types";
import type { CombatState } from "./state";

export interface ConsumeRequirement {
  mode: "exact" | "upTo" | "all";
  min: number;
  max: number;
}

/**
 * Returns the effective fuel contract for the current combat state.
 *
 * Blood Offering becomes Blood Release at weapon stage 5 and caps its fuel at
 * three coins. Stage 4 discounts the first consuming Blood Sword technique by
 * one coin (minimum one) without changing the content definition or save id.
 */
export const consumeRequirementFor = (
  state: CombatState,
  skill: ConsumeSkillDef,
): ConsumeRequirement => {
  if (skill.bloodOffering === true && state.player.bloodSwordPower >= 5) {
    return { mode: "upTo", min: 1, max: Math.min(3, skill.consume.count) };
  }
  if (skill.consume.mode === "all") {
    return {
      mode: "all",
      min: skill.consume.count,
      max: Number.POSITIVE_INFINITY,
    };
  }
  if (skill.consume.mode === "upTo") {
    return { mode: "upTo", min: 1, max: skill.consume.count };
  }
  const discount =
    skill.bloodSword === true &&
    state.player.bloodSwordPower >= 4 &&
    !state.player.bloodSwordDiscountUsedThisTurn
      ? 1
      : 0;
  const count = Math.max(1, skill.consume.count - discount);
  return { mode: "exact", min: count, max: count };
};

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CombatEvent, CombatState, EnemyIntent } from "@game/core";

import { combatEventLogSummary, IntentBadge } from "./App";
import { feedbackCuesFor } from "./feedback-cues";
import { sfxCuesFor } from "./combat-sfx";

const intent = (overrides: Partial<EnemyIntent> = {}): EnemyIntent => ({
  id: "coronation",
  actions: [{ kind: "adjustEnemyResource", resource: "furnaceTemperature", amount: 1, reason: "enemyActionResolved" }],
  windup: { turns: 1, revealAtStart: true },
  cancelOn: { kind: "enemyResourceAtMost", resource: "furnaceTemperature", value: 5 },
  ...overrides,
});

const enemy = (overrides: Partial<CombatState["enemies"][number]> = {}): CombatState["enemies"][number] => ({
  block: 0,
  defId: "ash-duke-valdemar" as never,
  enemyUid: 42,
  furnaceMaxTemperature: 6,
  furnaceTemperature: 6,
  hp: 120,
  intent: intent(),
  intentIndex: 0,
  maxHp: 120,
  nextAttackBonus: 0,
  slot: 0,
  statuses: {},
  windup: { intent: intent(), turnsLeft: 1, startHp: 120 },
  ...overrides,
});

describe("Directive 17 furnace combat UI", () => {
  it("renders the 0..6 furnace chip and a resource-gated coronation cancel telegraph", () => {
    const html = renderToStaticMarkup(createElement(IntentBadge, { enemy: enemy() }));

    expect(html).toContain('data-testid="enemy-furnace-status"');
    expect(html).toContain("용광로 6/6");
    expect(html).toContain('data-testid="enemy-furnace-cancel-condition"');
    expect(html).toContain("용광로 5 이하 시 취소");
    expect(html).toContain('data-testid="enemy-furnace-intent"');
  });

  it("adds furnace transitions to the Korean event log", () => {
    const summary = combatEventLogSummary([
      { type: "enemyFurnaceChanged", enemy: 0, before: 6, after: 3, reason: "coronationCancelled" },
    ] satisfies CombatEvent[]);

    expect(summary?.triggerLines).toEqual(["적 1 용광로 온도 6→3 — 대관식 취소"]);
    expect(
      combatEventLogSummary([{ type: "enemyPhaseChanged", enemy: 0 }] satisfies CombatEvent[])?.triggerLines,
    ).toEqual(["적 1 페이즈 전환"]);
  });

  it("targets furnace feedback and differentiates heating from cooling sounds", () => {
    const cooled = { type: "enemyFurnaceChanged", enemy: 1, before: 6, after: 3, reason: "coronationCancelled" } satisfies CombatEvent;
    const heated = { type: "enemyFurnaceChanged", enemy: 1, before: 3, after: 4, reason: "enemyActionResolved" } satisfies CombatEvent;

    expect(feedbackCuesFor(cooled).map((cue) => cue.key)).toEqual(["unit-enemy-1"]);
    expect(sfxCuesFor(cooled)).toEqual(["cooldown"]);
    expect(sfxCuesFor(heated)).toEqual(["overheat-enter"]);
  });
});

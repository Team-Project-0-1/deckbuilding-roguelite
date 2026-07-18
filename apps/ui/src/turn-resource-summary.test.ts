import { contentDb } from "@game/content";
import type { CoinUid, CombatState, SlotId } from "@game/core";
import { createCombat } from "@game/core";
import { describe, expect, it } from "vitest";

import {
  executionQueueSnapshot,
  type ExecutionReservation,
} from "./auto-turn-end";
import { summarizeTurnResources } from "./turn-resource-summary";

const slot = (value: number): SlotId => value as SlotId;

describe("turn resource summary", () => {
  it("separates queued coins from coins that will remain for end-turn discard", () => {
    const initial = createCombat(
      { character: "warrior" as never, enemies: ["raider" as never] },
      contentDb,
      "turn-summary",
    );
    const first = initial.zones.hand[0];
    const second = initial.zones.hand[1];
    if (first === undefined || second === undefined) throw new Error("missing test coins");

    const state: CombatState = {
      ...initial,
      zones: {
        ...initial.zones,
        hand: initial.zones.hand.filter(
          (coinUid) => coinUid !== first && coinUid !== second,
        ),
        placed: {
          ...initial.zones.placed,
          [slot(2)]: [second],
        },
      },
    };
    const reservations: ExecutionReservation[] = [
      {
        id: "slot-0:first",
        slot: slot(0),
        coinUids: [first],
      },
    ];
    const queue = executionQueueSnapshot([], reservations);

    expect(summarizeTurnResources(state, queue)).toEqual({
      usable: 1,
      loaded: 2,
      queued: 1,
      discardedOnEnd: 2,
    });
  });

  it("does not count explicitly preserved coins as discarded", () => {
    const state = createCombat(
      { character: "warrior" as never, enemies: ["raider" as never] },
      contentDb,
      "turn-summary-preserve",
    );
    const preserved = state.zones.hand[0];
    if (preserved === undefined) throw new Error("missing preserved coin");

    expect(
      summarizeTurnResources(state, executionQueueSnapshot([], []), [preserved]),
    ).toEqual({
      usable: state.zones.hand.length,
      loaded: 0,
      queued: 0,
      discardedOnEnd: state.zones.hand.length - 1,
    });
  });

  it("excludes already-preserved coins in both hand and placed zones", () => {
    const initial = createCombat(
      { character: "warrior" as never, enemies: ["raider" as never] },
      contentDb,
      "turn-summary-preserved-state",
    );
    const preservedInHand = initial.zones.hand[0];
    const preservedPlaced = initial.zones.hand[1];
    if (preservedInHand === undefined || preservedPlaced === undefined) {
      throw new Error("missing preserved test coins");
    }
    const placed: CombatState = {
      ...initial,
      zones: {
        ...initial.zones,
        hand: initial.zones.hand.filter((coinUid) => coinUid !== preservedPlaced),
        placed: { ...initial.zones.placed, [slot(2)]: [preservedPlaced] },
      },
    };
    const state: CombatState = {
      ...placed,
      coins: {
        ...placed.coins,
        [Number(preservedInHand)]: {
          ...placed.coins[Number(preservedInHand)]!,
          preserved: true,
        },
        [Number(preservedPlaced)]: {
          ...placed.coins[Number(preservedPlaced)]!,
          preserved: true,
        },
      },
    };

    const summary = summarizeTurnResources(
      state,
      executionQueueSnapshot([], []),
    );
    expect(summary).toEqual({
      usable: state.zones.hand.length,
      loaded: 1,
      queued: 0,
      discardedOnEnd: state.zones.hand.length - 1,
    });

  });

  it("deduplicates stale queue entries and never returns negative counts", () => {
    const state = createCombat(
      { character: "warrior" as never, enemies: ["raider" as never] },
      contentDb,
      "turn-summary-stale",
    );
    const staleQueue = executionQueueSnapshot(["missing"], [
      {
        id: "missing",
        slot: slot(0),
        coinUids: [999 as CoinUid],
      },
    ]);

    expect(summarizeTurnResources(state, staleQueue)).toMatchObject({
      loaded: 1,
      queued: 1,
      discardedOnEnd: state.zones.hand.length,
    });
  });

  it("counts the exact reserved coin UIDs instead of every coin in a slot", () => {
    const initial = createCombat(
      { character: "warrior" as never, enemies: ["raider" as never] },
      contentDb,
      "turn-summary-reservation-uids",
    );
    const first = initial.zones.hand[0];
    const second = initial.zones.hand[1];
    if (first === undefined || second === undefined) throw new Error("missing test coins");

    const state: CombatState = {
      ...initial,
      zones: {
        ...initial.zones,
        hand: initial.zones.hand.filter(
          (coinUid) => coinUid !== first && coinUid !== second,
        ),
        placed: { ...initial.zones.placed },
      },
    };
    const queue = executionQueueSnapshot([], [
      {
        id: "slot-0:first",
        slot: slot(0),
        coinUids: [first],
      },
      {
        id: "slot-0:second",
        slot: slot(0),
        coinUids: [second],
      },
    ]);

    expect(summarizeTurnResources(state, queue)).toMatchObject({
      loaded: 2,
      queued: 2,
    });
  });

  it("does not count an unreserved coin merely because it shares a reserved slot", () => {
    const initial = createCombat(
      { character: "warrior" as never, enemies: ["raider" as never] },
      contentDb,
      "turn-summary-partial-reservation",
    );
    const first = initial.zones.hand[0];
    const second = initial.zones.hand[1];
    if (first === undefined || second === undefined) throw new Error("missing test coins");

    const state: CombatState = {
      ...initial,
      zones: {
        ...initial.zones,
        hand: initial.zones.hand.filter(
          (coinUid) => coinUid !== first && coinUid !== second,
        ),
        placed: { ...initial.zones.placed, [slot(0)]: [second] },
      },
    };
    const queue = executionQueueSnapshot([], [
      {
        id: "slot-0:first",
        slot: slot(0),
        coinUids: [first],
      },
    ]);

    expect(summarizeTurnResources(state, queue)).toMatchObject({
      loaded: 2,
      queued: 1,
      discardedOnEnd: initial.zones.hand.length - 1,
    });
  });
});

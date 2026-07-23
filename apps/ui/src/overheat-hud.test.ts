import type { CharacterId } from "@game/core";
import { describe, expect, it } from "vitest";

import { shouldShowOverheatBadges } from "./App";

const id = <T extends string>(value: string): T => value as T;

describe("overheat HUD projection", () => {
  it("keeps overheat badges scoped to the fire character", () => {
    expect(shouldShowOverheatBadges(id<CharacterId>("warrior"))).toBe(true);
    expect(shouldShowOverheatBadges(id<CharacterId>("arcanist"))).toBe(false);
    expect(shouldShowOverheatBadges(id<CharacterId>("sorcerer"))).toBe(false);
  });
});

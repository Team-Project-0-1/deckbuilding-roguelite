import { describe, expect, it } from "vitest";

import type { ContentDb } from "../content-types";
import type { CharacterId, CoinDefId, EnemyDefId, SkillId } from "../ids";
import { derive, rngFrom, seedFromString } from "../rng";
import {
  createRun,
  resolveCoinRemoval,
  settleRunCombat,
  signatureElement,
  startRunCombat,
  weightedCoinOptions,
} from "./run";
import type { RunState } from "./types";

const id = <T extends string>(value: string): T => value as T;

const simpleSkill = (value: string) => ({
  id: id<SkillId>(value),
  name: value,
  type: "flip" as const,
  rarity: "common" as const,
  tags: ["attack"] as const,
  targetType: "single-enemy" as const,
  cost: 1,
  base: [{ kind: "damage" as const, amount: 1 }],
});

const baseCoins = {
  basic: { id: id<CoinDefId>("basic"), element: null },
  fire: { id: id<CoinDefId>("fire"), element: "fire" as const },
  mana: { id: id<CoinDefId>("mana"), element: "mana" as const },
};

const wideCoins = {
  ...baseCoins,
  frost: { id: id<CoinDefId>("frost"), element: "frost" as const },
  lightning: { id: id<CoinDefId>("lightning"), element: "lightning" as const },
};

const db = (coins: ContentDb["coins"]): ContentDb => ({
  coins,
  skills: Object.fromEntries(
    ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((skill) => [skill, simpleSkill(skill)]),
  ) as ContentDb["skills"],
  enemies: Object.fromEntries(
    [
      "raider",
      "shaman",
      "gatekeeper",
      "raider-plus",
      "gatekeeper-plus",
      "goblin",
      "thief",
      "ghoul",
      "slime",
      "ember-archmage",
    ].map((enemy) => [
      enemy,
      {
        id: id(enemy),
        name: enemy,
        maxHp: 10,
        intents: [{ id: "hit", actions: [{ kind: "attack" as const, damage: 1 }] }],
      },
    ]),
  ),
  characters: {
    warrior: {
      id: id<CharacterId>("warrior"),
      name: "warrior",
      maxHp: 70,
      startingBag: [
        ...Array.from({ length: 8 }, () => id<CoinDefId>("basic")),
        id<CoinDefId>("fire"),
        id<CoinDefId>("fire"),
      ],
      startingSkills: ["s1", "s2", "s3", "s4", "s5", "s6"].map((skill) => id<SkillId>(skill)),
      trait: { id: "none", name: "none", hook: "combatStart", effects: [] },
    },
  },
  validate: () => [],
});

const rewardsAt = (state: RunState, database: ContentDb): RunState => {
  const started = startRunCombat(state, database);
  const finished = {
    ...started.combat,
    phase: "victory" as const,
    enemies: started.combat.enemies.map((enemy) => ({ ...enemy, hp: 0 })),
  };
  return settleRunCombat(started.run, finished, database);
};

const newRun = (database: ContentDb, seed = "WEIGHTED"): RunState =>
  createRun({ contentVersion: "test", runSeed: seed, character: id<CharacterId>("warrior") }, database);

describe("signature-locked coin rewards (P12)", () => {
  it("offers only basic and the current character's signature element", () => {
    for (const coins of [baseCoins, wideCoins]) {
      const database = db(coins);
      const options = rewardsAt(newRun(database), database).pendingRewards?.coinOptions.map(String) ?? [];

      expect(options).toHaveLength(2);
      expect(new Set(options)).toEqual(new Set(["basic", "fire"]));
    }
  });

  it("is deterministic for the same seed and diverges across seeds", () => {
    const wide = db(wideCoins);
    const first = rewardsAt(newRun(wide, "DET"), wide).pendingRewards?.coinOptions;
    const second = rewardsAt(newRun(wide, "DET"), wide).pendingRewards?.coinOptions;
    expect(first).toEqual(second);
    // 순서는 reward 스트림을 사용한다. 서로 다른 고정 시드 중 최소 한 쌍은 달라야 한다.
    const a = rewardsAt(newRun(wide, "DIV-A"), wide).pendingRewards?.coinOptions?.map(String);
    const b = rewardsAt(newRun(wide, "DIV-B"), wide).pendingRewards?.coinOptions?.map(String);
    const c = rewardsAt(newRun(wide, "DIV-C"), wide).pendingRewards?.coinOptions?.map(String);
    expect(JSON.stringify(a) !== JSON.stringify(b) || JSON.stringify(b) !== JSON.stringify(c)).toBe(true);
  });

  it("routes the exhausted-pool fallback through the same weighted canon", () => {
    // P6 신스펙 보상은 제거 단계를 만들지 않으므로(coinRemovalResolved:true 고정)
    // fallback은 레거시 v5 저장(acts 없는 그래프 + 미해결 제거 단계)에서만 도달한다.
    // 스킬 풀 소진 db(장착 6종 외 없음) + 코인 5종 수제 상태로 경로를 직접 검증한다.
    const wide = db(wideCoins);
    const exhausted: ContentDb = {
      ...wide,
      skills: Object.fromEntries(
        Object.entries(wide.skills).filter(([skill]) => ["s1", "s2", "s3", "s4", "s5", "s6"].includes(skill)),
      ),
    };
    const combatNode = (nodeId: string, enemy: string) => ({
      id: nodeId,
      kind: "combat" as const,
      encounter: [id<EnemyDefId>(enemy)],
    });
    // 전투 2 완료(completedCombatCount=2) 후 제거 단계 직전의 v5 보상 상태
    const fallbackState = (): RunState => ({
      ...newRun(exhausted, "FALLBACK"),
      graph: {
        layers: [[combatNode("l0", "raider")], [combatNode("l1", "shaman")], [combatNode("l2", "gatekeeper")]],
      },
      nodeChoices: [0, 0, 0],
      combatIndex: 2,
      phase: "rewards",
      pendingRewards: {
        coinOptions: [],
        coinChoiceResolved: true,
        coinRemovalResolved: false,
        skillOptions: [],
        skillChoiceResolved: true,
      },
    });
    const resolved = resolveCoinRemoval(fallbackState(), null, exhausted);
    const fallback = resolved.pendingRewards?.coinOptions.map(String) ?? [];

    expect(resolved.phase).toBe("rewards");
    expect(resolved.pendingRewards?.coinChoiceResolved).toBe(false);
    expect(new Set(fallback)).toEqual(new Set(["basic", "fire"]));
    // 대표 속성 제한 정본 공유: fallback도 weightedCoinOptions와 완전 동일
    const expected = weightedCoinOptions(
      exhausted,
      id<CharacterId>("warrior"),
      fallbackState().bag,
      rngFrom(derive(seedFromString("FALLBACK"), "reward-fallback", 1)),
    );
    expect(fallback).toEqual(expected.map(String));
    // 결정론: 같은 수제 상태 재구성이 동일한 fallback을 낸다
    expect(resolveCoinRemoval(fallbackState(), null, exhausted).pendingRewards?.coinOptions.map(String)).toEqual(
      fallback,
    );
  });

  it("derives the signature element from the starting bag majority", () => {
    const wide = db(wideCoins);
    expect(signatureElement(wide, id<CharacterId>("warrior"))).toBe("fire");
  });

  it("does not widen the pool when the run acquired another element", () => {
    const wide = db(wideCoins);
    const manaBag = [
      ...Array.from({ length: 8 }, () => id<CoinDefId>("basic")),
      id<CoinDefId>("mana"),
      id<CoinDefId>("mana"),
    ];
    const picks = weightedCoinOptions(
      wide,
      id<CharacterId>("warrior"),
      manaBag,
      rngFrom(derive(seedFromString("off-element-owned"), "reward", 0)),
    );
    expect(new Set(picks.map(String))).toEqual(new Set(["basic", "fire"]));
  });
});

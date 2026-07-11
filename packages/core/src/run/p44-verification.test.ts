// P4.4 페이블 직접 적대 검증 — 검증 워커가 Codex usage limit로 즉사해 (2/2 done은
// 재위임 상태 표기일 뿐 검증 PASS가 아님) 필수 7항목을 여기서 직접 고정한다.
// 항목: ① 공짜 금지 ② 결정론·스트림 격리 ③ 경계 ④ 매복 ⑤ 저장(별도 파일) ⑥ replay ⑦ ci:sim 2회(셸)
import { describe, expect, it } from "vitest";

import type { ContentDb, EventDef, SkillDef } from "../content-types";
import type {
  CharacterId,
  CoinDefId,
  EnemyDefId,
  EventDefId,
  SkillId,
} from "../ids";
import type { CombatState } from "../combat/state";
import {
  acceptEvent,
  chooseCoinReward,
  chooseRunNode,
  createRun,
  declineEvent,
  leaveShop,
  resolveCoinRemoval,
  settleRunCombat,
  skipSkillReward,
  startRunCombat,
} from "./run";
import type { RunState } from "./types";

const id = <T extends string>(value: string): T => value as T;

const simpleSkill = (value: string, rarity: SkillDef["rarity"] = "common"): SkillDef => ({
  id: id<SkillId>(value),
  name: value,
  type: "flip",
  rarity,
  tags: ["attack"],
  targetType: "single-enemy",
  cost: 1,
  base: [{ kind: "damage", amount: 1 }],
});

const enemyDef = (value: string) => ({
  id: id<EnemyDefId>(value),
  name: value,
  maxHp: 10,
  intents: [{ id: "hit", actions: [{ kind: "attack" as const, damage: 1 }] }],
});

const EVENTS: Record<string, EventDef> = {
  "ambush-bounty": {
    id: id<EventDefId>("ambush-bounty"),
    name: "매복 현상금",
    prompt: "p",
    risk: "combat",
    elitePool: [[id<EnemyDefId>("raider-plus")], [id<EnemyDefId>("gatekeeper-plus")]],
    goldReward: 70,
    rareSkillOptions: 2,
  },
  "blood-offering": {
    id: id<EventDefId>("blood-offering"),
    name: "피의 제물",
    prompt: "p",
    risk: "hp",
    hpCost: 5,
    requireCurrentHpAbove: 5,
    reward: { kind: "signatureCoin", count: 1 },
  },
  "transmute-altar": {
    id: id<EventDefId>("transmute-altar"),
    name: "변환 제단",
    prompt: "p",
    risk: "gold",
    goldCost: 100,
    transform: { from: id<CoinDefId>("basic"), to: "signatureCoin" },
  },
  "coin-sacrifice": {
    id: id<EventDefId>("coin-sacrifice"),
    name: "동전 희생",
    prompt: "p",
    risk: "coin",
    sacrifice: { coin: id<CoinDefId>("basic"), reward: "signatureCoin", minimumBagSize: 1 },
  },
};

const eventDb = (): ContentDb => {
  const skillIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"];
  const skills = Object.fromEntries(
    skillIds.map((skill) => [skill, simpleSkill(skill)]),
  ) as Record<string, SkillDef>;
  skills.r1 = simpleSkill("r1", "rare");
  skills.r2 = simpleSkill("r2", "rare");
  return {
    coins: {
      basic: { id: id<CoinDefId>("basic"), element: null },
      fire: { id: id<CoinDefId>("fire"), element: "fire" },
      mana: { id: id<CoinDefId>("mana"), element: "mana" },
    },
    skills,
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
      ].map((enemy) => [enemy, enemyDef(enemy)]),
    ),
    characters: {
      warrior: {
        id: id<CharacterId>("warrior"),
        name: "warrior",
        maxHp: 70,
        startingBag: [
          id<CoinDefId>("basic"),
          id<CoinDefId>("basic"),
          id<CoinDefId>("fire"),
          id<CoinDefId>("fire"),
        ],
        startingSkills: ["s1", "s2", "s3", "s4", "s5", "s6"].map((skill) =>
          id<SkillId>(skill),
        ),
        trait: {
          id: "ember-pouch",
          name: "ember pouch",
          hook: "combatStart",
          effects: [
            { kind: "addCoin", coin: id<CoinDefId>("fire"), zone: "draw", count: 1 },
          ],
        },
      },
    },
    events: EVENTS,
    validate: () => [],
  };
};

const newRun = (seed: string, db: ContentDb): RunState =>
  createRun(
    { contentVersion: "test-p44", runSeed: seed, character: id<CharacterId>("warrior") },
    db,
  );

const endedCombat = (combat: CombatState, phase: "victory" | "defeat"): CombatState => ({
  ...combat,
  phase,
  player: { ...combat.player, hp: combat.player.hp },
  enemies: combat.enemies.map((enemy) => ({
    ...enemy,
    hp: phase === "victory" ? 0 : enemy.hp,
  })),
});

// 직접 구성한 단일 이벤트 노드 런 — acceptEvent 경계 검증용 (pendingEvent는 롤이 아닌
// 저장된 사실이므로 직접 주입이 유효한 상태다)
const runAtEvent = (
  db: ContentDb,
  eventKey: string,
  extra: Partial<RunState> = {},
): RunState => ({
  ...newRun("P44-EVENT-UNIT", db),
  graph: {
    layers: [
      [{ id: "e0", kind: "event" }],
      [{ id: "c1", kind: "combat", encounter: [id<EnemyDefId>("raider")] }],
    ],
  },
  nodeChoices: [0, 0],
  combatIndex: 0,
  phase: "event",
  pendingEvent: { eventId: id<EventDefId>(eventKey) },
  ...extra,
});

// fight-first로 rewards를 전부 스킵하며 다음 상태로 — 격리 검증용 공용 트래버설
const resolveAllRewards = (run: RunState, db: ContentDb): RunState => {
  let next = run;
  while (next.phase === "rewards") {
    if (next.pendingRewards?.coinChoiceResolved === false)
      next = chooseCoinReward(next, null, db);
    else if (next.pendingRewards?.coinRemovalResolved === false)
      next = resolveCoinRemoval(next, null, db);
    else next = skipSkillReward(next, db);
  }
  return next;
};

const advanceToFirstEvent = (seed: string, db: ContentDb): RunState => {
  let run = newRun(seed, db);
  let guard = 0;
  while (run.phase !== "event" && guard < 40) {
    guard += 1;
    if (run.phase === "ready") {
      const started = startRunCombat(run, db);
      run = settleRunCombat(started.run, endedCombat(started.combat, "victory"), db);
    } else if (run.phase === "rewards") {
      run = resolveAllRewards(run, db);
    } else if (run.phase === "choose-node") {
      const layer = run.graph.layers[run.combatIndex] ?? [];
      const eventIndex = layer.findIndex((node) => node.kind === "event");
      run = chooseRunNode(run, eventIndex >= 0 ? eventIndex : 0, db);
    } else if (run.phase === "shop") {
      run = leaveShop(run, db);
    } else {
      throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  if (run.phase !== "event") throw new Error("event layer unreachable");
  return run;
};

describe("P4.4 페이블 적대 검증 — 공짜 금지 (①)", () => {
  it("blood-offering은 HP 5를 실제로 지불한다", () => {
    const db = eventDb();
    const run = runAtEvent(db, "blood-offering");
    const after = acceptEvent(run, db);
    expect(after.currentHp).toBe(run.currentHp - 5);
    expect(after.bag.length).toBe(run.bag.length + 1);
    expect(String(after.bag.at(-1))).toBe("fire");
    expect(after.eventCoinGains).toBe(1);
  });

  it("transmute-altar는 100골드를 지불하고 가방 크기가 늘지 않는다 (교체)", () => {
    const db = eventDb();
    const run = runAtEvent(db, "transmute-altar", { gold: 120 });
    const basicIndex = run.bag.findIndex((coin) => String(coin) === "basic");
    const after = acceptEvent(run, db, basicIndex);
    expect(after.gold).toBe(20);
    expect(after.bag.length).toBe(run.bag.length);
    expect(String(after.bag[basicIndex])).toBe("fire");
    expect(after.eventCoinGains).toBe(1);
    expect(after.eventCoinLosses).toBe(1);
  });

  it("coin-sacrifice는 기본 코인을 실제로 제거한다 (순 크기 불변 트레이드)", () => {
    const db = eventDb();
    const run = runAtEvent(db, "coin-sacrifice");
    const basicBefore = run.bag.filter((coin) => String(coin) === "basic").length;
    const basicIndex = run.bag.findIndex((coin) => String(coin) === "basic");
    const after = acceptEvent(run, db, basicIndex);
    expect(after.bag.filter((coin) => String(coin) === "basic").length).toBe(
      basicBefore - 1,
    );
    expect(after.bag.length).toBe(run.bag.length);
  });
});

describe("P4.4 페이블 적대 검증 — 경계 (③)", () => {
  it("HP 하한·골드 부족·비기본 코인·비이벤트 페이즈를 거부한다", () => {
    const db = eventDb();
    expect(() =>
      acceptEvent(runAtEvent(db, "blood-offering", { currentHp: 5 }), db),
    ).toThrow("not enough HP");
    expect(() =>
      acceptEvent(runAtEvent(db, "transmute-altar", { gold: 99 }), db, 0),
    ).toThrow("not enough gold");
    const run = runAtEvent(db, "coin-sacrifice");
    const fireIndex = run.bag.findIndex((coin) => String(coin) === "fire");
    expect(() => acceptEvent(run, db, fireIndex)).toThrow(
      "event requires a basic coin",
    );
    expect(() => acceptEvent(run, db, 99)).toThrow("bag index is out of range");
    expect(() => acceptEvent(run, db)).toThrow("bagIndex is required");
    const ready = { ...run, phase: "ready" as const, pendingEvent: undefined };
    expect(() => acceptEvent(ready, db)).toThrow("run is not resolving an event");
    expect(() => declineEvent(ready, db)).toThrow("run is not resolving an event");
  });

  it("가방이 하한이면 희생을 거부한다", () => {
    const db = eventDb();
    const run = runAtEvent(db, "coin-sacrifice", {
      bag: [id<CoinDefId>("basic")],
    });
    expect(() => acceptEvent(run, db, 0)).toThrow("cannot sacrifice the last coin");
  });
});

describe("P4.4 페이블 적대 검증 — 매복 (④)", () => {
  it("수락→엘리트 전투→승리 시 골드 70·희귀 전용 진열·eventCombats 증가", () => {
    const db = eventDb();
    const run = runAtEvent(db, "ambush-bounty");
    const accepted = acceptEvent(run, db);
    expect(accepted.phase).toBe("ready");
    expect(accepted.pendingEventCombat?.eventId).toBe("ambush-bounty");

    const started = startRunCombat(accepted, db);
    const enemies = started.combat.enemies.map((enemy) => String(enemy.defId));
    expect([["raider-plus"], ["gatekeeper-plus"]]).toContainEqual(enemies);

    const settled = settleRunCombat(
      started.run,
      endedCombat(started.combat, "victory"),
      db,
    );
    expect(settled.gold).toBe(run.gold + 70);
    expect(settled.eventCombats).toBe(1);
    const options = settled.pendingRewards?.skillOptions.map(String) ?? [];
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(2);
    for (const skill of options) {
      expect(db.skills[skill]?.rarity).toBe("rare");
    }
  });

  it("패배는 일반 패배로 정산된다", () => {
    const db = eventDb();
    const accepted = acceptEvent(runAtEvent(db, "ambush-bounty"), db);
    const started = startRunCombat(accepted, db);
    const settled = settleRunCombat(
      started.run,
      { ...endedCombat(started.combat, "defeat"), player: { ...started.combat.player, hp: 0 } },
      db,
    );
    expect(settled.phase).toBe("defeat");
  });
});

describe("P4.4 페이블 적대 검증 — 결정론·스트림 격리 (②)", () => {
  it("같은 시드는 같은 이벤트, 수락/거절이 이후 전투·보상 스트림을 오염하지 않는다", () => {
    const dbA = eventDb();
    const dbB = eventDb();
    const atEventA = advanceToFirstEvent("P44-ISOLATION", dbA);
    const atEventB = advanceToFirstEvent("P44-ISOLATION", dbB);
    expect(atEventA.pendingEvent).toEqual(atEventB.pendingEvent);

    // A는 거절, B는 무전투 이벤트면 수락(매복이면 격리 비교를 위해 거절로 통일)
    const eventKind = (dbA.events ?? {})[String(atEventA.pendingEvent?.eventId)]?.risk;
    const proceedA = declineEvent(atEventA, dbA);
    let proceedB: RunState;
    if (eventKind === "hp") proceedB = acceptEvent(atEventB, dbB);
    else if (eventKind === "coin")
      proceedB = acceptEvent(
        atEventB,
        dbB,
        atEventB.bag.findIndex((coin) => String(coin) === "basic"),
      );
    else proceedB = declineEvent(atEventB, dbB);

    const toNextCombat = (run: RunState, db: ContentDb): RunState => {
      let next = run;
      let guard = 0;
      while (next.phase !== "ready" && guard < 10) {
        guard += 1;
        if (next.phase === "choose-node") {
          const layer = next.graph.layers[next.combatIndex] ?? [];
          const combatIndex = layer.findIndex(
            (node) => node.kind === "combat" || node.kind === "elite",
          );
          next = chooseRunNode(next, combatIndex >= 0 ? combatIndex : 0, db);
        } else if (next.phase === "shop") {
          next = leaveShop(next, db);
        } else {
          throw new Error(`unexpected phase ${next.phase}`);
        }
      }
      return next;
    };
    const readyA = toNextCombat(proceedA, dbA);
    const readyB = toNextCombat(proceedB, dbB);
    const combatA = startRunCombat(readyA, dbA);
    const combatB = startRunCombat(readyB, dbB);
    // 같은 레이어의 전투 조우·전투 스트림은 이벤트 선택과 무관하게 동일해야 한다
    expect(combatA.combat.enemies.map((enemy) => String(enemy.defId))).toEqual(
      combatB.combat.enemies.map((enemy) => String(enemy.defId)),
    );
    const rewardsA = settleRunCombat(
      combatA.run,
      endedCombat(combatA.combat, "victory"),
      dbA,
    );
    const rewardsB = settleRunCombat(
      combatB.run,
      endedCombat(combatB.combat, "victory"),
      dbB,
    );
    // 보상 스트림 격리: 첫 코인 옵션 exact equality (CRN 계약과 같은 강도)
    expect(rewardsA.pendingRewards?.coinOptions.map(String)).toEqual(
      rewardsB.pendingRewards?.coinOptions.map(String),
    );
  });

  it("다른 시드는 이벤트 롤이 발산할 수 있다 (관측 고정)", () => {
    const db = eventDb();
    const rolls = new Set(
      ["P44-DIV-A", "P44-DIV-B", "P44-DIV-C", "P44-DIV-D", "P44-DIV-E"].map(
        (seed) => String(advanceToFirstEvent(seed, eventDb()).pendingEvent?.eventId),
      ),
    );
    expect(db.events).toBeDefined();
    expect(rolls.size).toBeGreaterThan(1);
  });
});

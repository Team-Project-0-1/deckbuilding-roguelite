import { runBulk } from "./bulk";
import { POLICY_IDS } from "./policies";
import { simulateRun } from "./run-sim";

const BASE_SEED = "1";
const GAMES_PER_POLICY = 125;
const EXPECTED_RUNS = GAMES_PER_POLICY * POLICY_IDS.length;

// P3.3 R2: 공용 보상 풀에 flame-sword/heart-of-flame/conflagration 3종을 추가하며
// seed42 보상 셔플과 fire-build 선택 결과가 의도적으로 바뀌어 재고정했다.
// P3.4 재고정 (0.8.0-p3.4 결속): 코인 풀 5종 진입으로 §825 가중 경로가 활성화되어
// 보상 코인 옵션과 후속 스킬 셔플(공유 reward 스트림 소비량 변화)이 의도 변경됨.
// P4.2b/P4.3 재고정 (0.9.0-p4, 본 라운드 결속): D9 10레이어 그래프 활성화로
// fight-first 경로가 5전투 레거시에서 6전투 도중 패배로 의도 변경됨. graph/shop 전용
// 스트림 추가 후에도 첫 reward 스트림 index 0과 A=A·격리 계약은 ci:sim CRN 게이트가 유지한다.
const SEED_42_GOLDEN = {
  seed: "42",
  result: "defeat",
  combatsCompleted: 6,
  turnsPerCombat: [4, 4, 4, 4, 6, 3],
  carriedHp: 0,
  finalBag: [
    "basic",
    "basic",
    "basic",
    "fire",
    "fire",
    "fire",
    "fire",
    "basic",
    "fire",
    "fire",
  ],
  finalEquippedSkills: [
    "fire-infusion",
    "guard",
    "burning-strike",
    "flame-sword",
    "ignite-sword",
    "conflagration",
  ],
  encounterOrder: [
    ["raider"],
    ["goblin", "ghoul"],
    ["goblin", "ghoul"],
    ["thief", "goblin"],
    ["raider-plus"],
    ["ghoul", "goblin", "slime"],
  ],
} as const;

const bulk = runBulk({
  baseSeed: BASE_SEED,
  games: GAMES_PER_POLICY,
  policyIds: POLICY_IDS,
});
const outcomes = bulk.report.metrics.outcomes;
const seed42Actual = simulateRun("42").summary;

const gates = {
  allRunsTerminal:
    outcomes.runs === EXPECTED_RUNS &&
    outcomes.terminalRuns === EXPECTED_RUNS,
  noCrashes: outcomes.crashRuns === 0,
  noInvariantViolations:
    outcomes.invariantViolationRuns === 0 &&
    outcomes.invariantViolationCount === 0,
  seed42GoldenUnchanged:
    JSON.stringify(seed42Actual) === JSON.stringify(SEED_42_GOLDEN),
};

const report = {
  schemaVersion: "m6-ci-smoke-v1",
  configuration: {
    baseSeed: BASE_SEED,
    gamesPerPolicy: GAMES_PER_POLICY,
    expectedRuns: EXPECTED_RUNS,
    policyIds: POLICY_IDS,
  },
  gates,
  outcomes,
  balanceReportOnly: {
    isCiGate: false,
    policyOutcomes: bulk.report.metrics.policyOutcomes,
    turns: bulk.report.metrics.turns,
    damage: bulk.report.metrics.damage,
    hpLossPerCombat: bulk.report.metrics.hpLossPerCombat,
    opportunities: bulk.report.metrics.opportunities,
    consumeVsFlip: bulk.report.metrics.consumeVsFlip,
    anomalySeedCount: bulk.report.anomalySeeds.length,
    globalAnomalyCount: bulk.report.globalAnomalies.length,
  },
  seed42: {
    expected: SEED_42_GOLDEN,
    actual: seed42Actual,
  },
};

console.log(JSON.stringify(report));

const failedGates = Object.entries(gates)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

if (failedGates.length > 0) {
  throw new Error(`M6 CI smoke failed: ${failedGates.join(", ")}`);
}

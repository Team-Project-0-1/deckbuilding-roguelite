import type { CombatEvent, CombatState, Command } from "@game/core";

export const HUMAN_RUN_SCHEMA_VERSION = 1 as const;
export const UI_BUILD_IDENTIFIER = "m6-ui-local-telemetry";

type RunResult = "in-progress" | "victory" | "defeat";
type RewardStage = "coin" | "removal" | "fallback-coin" | "skill";
type RewardResolution = "selected" | "skipped" | "declined";

export type TelemetryCommand =
  | { type: "placeCoin"; coin: number; slot: number }
  | { type: "unplaceCoin"; coin: number }
  | { type: "useFlipSkill"; slot: number; target?: number }
  | {
      type: "useConsumeSkill";
      slot: number;
      coins: number[];
      target?: number;
    }
  | { type: "endTurn" };

export interface HumanDamageFact {
  target: "player" | "enemy";
  enemyIndex?: number;
  amount: number;
  blocked: number;
  source: "skill" | "burn" | "enemy" | "self";
}

export interface HumanDecisionFact {
  turn: number;
  commands: TelemetryCommand[];
  skills: Array<{
    slot: number;
    skill: string;
    kind: "flip" | "consume";
  }>;
  flips: Array<{ coin: number; face: "heads" | "tails" }>;
  damage: HumanDamageFact[];
  hp: {
    playerBefore: number;
    playerAfter: number;
    enemiesBefore: number[];
    enemiesAfter: number[];
  };
}

export interface HumanCombatTrace {
  combatIndex: number;
  attempt: number;
  enemyIds: string[];
  startingHp: number;
  maxHp: number;
  decisions: HumanDecisionFact[];
  outcome?: {
    result: "victory" | "defeat";
    turns: number;
    playerHp: number;
    enemyHp: number[];
  };
}

export interface HumanRewardFact {
  combatIndex: number;
  stage: RewardStage;
  options: string[];
  choice: string | null;
  resolution: RewardResolution;
  bagIndex?: number;
  replacedSlot?: number;
}

export interface HumanRunTrace {
  schemaVersion: typeof HUMAN_RUN_SCHEMA_VERSION;
  source: "human";
  runSeed: string;
  contentVersion: string;
  buildId: string;
  startedAtLocal: string;
  maxHp: number;
  combats: HumanCombatTrace[];
  rewards: HumanRewardFact[];
  result: RunResult;
  endedAtLocal?: string;
  finalHp?: number;
}

export interface LocalDownloadPort {
  createObjectUrl: (blob: Blob) => string;
  clickDownload: (href: string, filename: string) => void;
  revokeObjectUrl: (href: string) => void;
}

interface CreateHumanRunTraceInput {
  runSeed: string;
  contentVersion: string;
  maxHp: number;
  buildId?: string;
  startedAt?: Date;
}

interface BeginHumanCombatInput {
  combatIndex: number;
  attempt: number;
  combat: CombatState;
}

interface RecordHumanDecisionInput {
  combatIndex: number;
  attempt: number;
  before: CombatState;
  commands: readonly Command[];
  after: CombatState;
  events: readonly CombatEvent[];
}

export interface RecordHumanRewardInput {
  combatIndex: number;
  stage: RewardStage;
  options: readonly string[];
  choice: string | null;
  resolution: RewardResolution;
  bagIndex?: number;
  replacedSlot?: number;
}

interface FinishHumanRunInput {
  result: "victory" | "defeat";
  finalHp: number;
  maxHp: number;
  endedAt?: Date;
}

const pad = (value: number, width = 2): string =>
  String(value).padStart(width, "0");

export const localTimestamp = (date: Date): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}.${pad(date.getMilliseconds(), 3)}`;

const hpList = (state: CombatState): number[] =>
  state.enemies.map((enemy) => enemy.hp);

const commandFact = (command: Command): TelemetryCommand => {
  if (command.type === "placeCoin") {
    return {
      type: command.type,
      coin: Number(command.coin),
      slot: Number(command.slot),
    };
  }
  if (command.type === "unplaceCoin") {
    return { type: command.type, coin: Number(command.coin) };
  }
  if (command.type === "useFlipSkill") {
    return command.target === undefined
      ? { type: command.type, slot: Number(command.slot) }
      : {
          type: command.type,
          slot: Number(command.slot),
          target: command.target,
        };
  }
  if (command.type === "useConsumeSkill") {
    const fact: TelemetryCommand = {
      type: command.type,
      slot: Number(command.slot),
      coins: command.coins.map(Number),
    };
    return command.target === undefined
      ? fact
      : { ...fact, target: command.target };
  }
  return { type: "endTurn" };
};

export const createHumanRunTrace = (
  input: CreateHumanRunTraceInput,
): HumanRunTrace => ({
  schemaVersion: HUMAN_RUN_SCHEMA_VERSION,
  source: "human",
  runSeed: input.runSeed,
  contentVersion: input.contentVersion,
  buildId: input.buildId ?? UI_BUILD_IDENTIFIER,
  startedAtLocal: localTimestamp(input.startedAt ?? new Date()),
  maxHp: input.maxHp,
  combats: [],
  rewards: [],
  result: "in-progress",
});

export const beginHumanCombat = (
  trace: HumanRunTrace,
  input: BeginHumanCombatInput,
): HumanRunTrace => {
  const alreadyStarted = trace.combats.some(
    (combat) =>
      combat.combatIndex === input.combatIndex &&
      combat.attempt === input.attempt,
  );
  if (alreadyStarted) return trace;
  return {
    ...trace,
    combats: [
      ...trace.combats,
      {
        combatIndex: input.combatIndex,
        attempt: input.attempt,
        enemyIds: input.combat.enemies.map((enemy) => String(enemy.defId)),
        startingHp: input.combat.player.hp,
        maxHp: input.combat.player.maxHp,
        decisions: [],
      },
    ],
  };
};

export const recordHumanDecision = (
  trace: HumanRunTrace,
  input: RecordHumanDecisionInput,
): HumanRunTrace => {
  const combatPosition = trace.combats.findIndex(
    (combat) =>
      combat.combatIndex === input.combatIndex &&
      combat.attempt === input.attempt,
  );
  if (combatPosition < 0) {
    throw new Error("human telemetry combat must be started before a decision");
  }

  const fact: HumanDecisionFact = {
    turn: input.before.turn,
    commands: input.commands.map(commandFact),
    skills: input.events.flatMap((event) =>
      event.type === "skillUsed"
        ? [
            {
              slot: Number(event.slot),
              skill: String(event.skill),
              kind: event.kind,
            },
          ]
        : [],
    ),
    flips: input.events.flatMap((event) =>
      event.type === "coinFlipped"
        ? [{ coin: Number(event.coin), face: event.face }]
        : [],
    ),
    damage: input.events.flatMap((event) => {
      if (event.type !== "damageDealt") return [];
      const target =
        event.target.type === "player"
          ? ({ target: "player" } as const)
          : ({ target: "enemy", enemyIndex: event.target.index } as const);
      return [
        {
          ...target,
          amount: event.amount,
          blocked: event.blocked,
          source: event.source,
        },
      ];
    }),
    hp: {
      playerBefore: input.before.player.hp,
      playerAfter: input.after.player.hp,
      enemiesBefore: hpList(input.before),
      enemiesAfter: hpList(input.after),
    },
  };

  return {
    ...trace,
    combats: trace.combats.map((combat, index) =>
      index === combatPosition
        ? { ...combat, decisions: [...combat.decisions, fact] }
        : combat,
    ),
  };
};

export const finishHumanCombat = (
  trace: HumanRunTrace,
  combatIndex: number,
  attempt: number,
  combat: CombatState,
): HumanRunTrace => {
  if (combat.phase !== "victory" && combat.phase !== "defeat") {
    throw new Error("human telemetry combat outcome must be terminal");
  }
  const result = combat.phase;
  return {
    ...trace,
    combats: trace.combats.map((entry) =>
      entry.combatIndex === combatIndex && entry.attempt === attempt
        ? {
            ...entry,
            outcome: {
              result,
              turns: combat.turn,
              playerHp: combat.player.hp,
              enemyHp: hpList(combat),
            },
          }
        : entry,
    ),
  };
};

export const recordHumanReward = (
  trace: HumanRunTrace,
  input: RecordHumanRewardInput,
): HumanRunTrace => ({
  ...trace,
  rewards: [
    ...trace.rewards,
    {
      combatIndex: input.combatIndex,
      stage: input.stage,
      options: [...input.options],
      choice: input.choice,
      resolution: input.resolution,
      ...(input.bagIndex === undefined ? {} : { bagIndex: input.bagIndex }),
      ...(input.replacedSlot === undefined
        ? {}
        : { replacedSlot: input.replacedSlot }),
    },
  ],
});

export const finishHumanRun = (
  trace: HumanRunTrace,
  input: FinishHumanRunInput,
): HumanRunTrace => {
  if (input.maxHp !== trace.maxHp) {
    throw new Error("human telemetry max HP changed during the run");
  }
  if (trace.result !== "in-progress") return trace;
  return {
    ...trace,
    result: input.result,
    endedAtLocal: localTimestamp(input.endedAt ?? new Date()),
    finalHp: input.finalHp,
  };
};

type JsonObject = Record<string, unknown>;

const objectValue = (value: unknown, label: string): JsonObject => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
};

const stringValue = (
  object: JsonObject,
  key: string,
  label: string,
  maxLength = 160,
): string => {
  const value = object[key];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw new Error(`${label}.${key} must be a non-empty string`);
  }
  return value;
};

const integerValue = (
  object: JsonObject,
  key: string,
  label: string,
): number => {
  const value = object[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${label}.${key} must be an integer`);
  }
  return value;
};

const nonNegativeInteger = (
  object: JsonObject,
  key: string,
  label: string,
): number => {
  const value = integerValue(object, key, label);
  if (value < 0) throw new Error(`${label}.${key} must be non-negative`);
  return value;
};

const stringArray = (
  value: unknown,
  label: string,
  maxLength = 64,
): string[] => {
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new Error(`${label} must be a bounded array`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string" || item.length === 0 || item.length > 160) {
      throw new Error(`${label}[${index}] must be a non-empty string`);
    }
    return item;
  });
};

const numberArray = (value: unknown, label: string): number[] => {
  if (!Array.isArray(value) || value.length > 64) {
    throw new Error(`${label} must be a bounded array`);
  }
  return value.map((item, index) => {
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 0) {
      throw new Error(`${label}[${index}] must be a non-negative integer`);
    }
    return item;
  });
};

const literalValue = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${label} is invalid`);
  }
  return value as T;
};

const optionalIndex = (
  object: JsonObject,
  key: string,
  label: string,
): number | undefined =>
  object[key] === undefined
    ? undefined
    : nonNegativeInteger(object, key, label);

const sanitizeCommand = (value: unknown, label: string): TelemetryCommand => {
  const object = objectValue(value, label);
  const type = literalValue(
    object.type,
    [
      "placeCoin",
      "unplaceCoin",
      "useFlipSkill",
      "useConsumeSkill",
      "endTurn",
    ] as const,
    `${label}.type`,
  );
  if (type === "placeCoin") {
    return {
      type,
      coin: nonNegativeInteger(object, "coin", label),
      slot: nonNegativeInteger(object, "slot", label),
    };
  }
  if (type === "unplaceCoin") {
    return { type, coin: nonNegativeInteger(object, "coin", label) };
  }
  if (type === "useFlipSkill") {
    const target = optionalIndex(object, "target", label);
    return target === undefined
      ? { type, slot: nonNegativeInteger(object, "slot", label) }
      : {
          type,
          slot: nonNegativeInteger(object, "slot", label),
          target,
        };
  }
  if (type === "useConsumeSkill") {
    const target = optionalIndex(object, "target", label);
    const command: TelemetryCommand = {
      type,
      slot: nonNegativeInteger(object, "slot", label),
      coins: numberArray(object.coins, `${label}.coins`),
    };
    return target === undefined ? command : { ...command, target };
  }
  return { type: "endTurn" };
};

const sanitizeDecision = (value: unknown, label: string): HumanDecisionFact => {
  const object = objectValue(value, label);
  if (!Array.isArray(object.commands) || object.commands.length > 32) {
    throw new Error(`${label}.commands must be a bounded array`);
  }
  if (!Array.isArray(object.skills) || object.skills.length > 16) {
    throw new Error(`${label}.skills must be a bounded array`);
  }
  if (!Array.isArray(object.flips) || object.flips.length > 64) {
    throw new Error(`${label}.flips must be a bounded array`);
  }
  if (!Array.isArray(object.damage) || object.damage.length > 64) {
    throw new Error(`${label}.damage must be a bounded array`);
  }
  const hp = objectValue(object.hp, `${label}.hp`);
  return {
    turn: nonNegativeInteger(object, "turn", label),
    commands: object.commands.map((command, index) =>
      sanitizeCommand(command, `${label}.commands[${index}]`),
    ),
    skills: object.skills.map((skill, index) => {
      const entry = objectValue(skill, `${label}.skills[${index}]`);
      return {
        slot: nonNegativeInteger(entry, "slot", `${label}.skills[${index}]`),
        skill: stringValue(entry, "skill", `${label}.skills[${index}]`),
        kind: literalValue(
          entry.kind,
          ["flip", "consume"] as const,
          `${label}.skills[${index}].kind`,
        ),
      };
    }),
    flips: object.flips.map((flip, index) => {
      const entry = objectValue(flip, `${label}.flips[${index}]`);
      return {
        coin: nonNegativeInteger(entry, "coin", `${label}.flips[${index}]`),
        face: literalValue(
          entry.face,
          ["heads", "tails"] as const,
          `${label}.flips[${index}].face`,
        ),
      };
    }),
    damage: object.damage.map((damage, index) => {
      const entry = objectValue(damage, `${label}.damage[${index}]`);
      const target = literalValue(
        entry.target,
        ["player", "enemy"] as const,
        `${label}.damage[${index}].target`,
      );
      const enemyIndex = optionalIndex(
        entry,
        "enemyIndex",
        `${label}.damage[${index}]`,
      );
      if (target === "enemy" && enemyIndex === undefined) {
        throw new Error(`${label}.damage[${index}] needs enemyIndex`);
      }
      const common = {
        amount: nonNegativeInteger(
          entry,
          "amount",
          `${label}.damage[${index}]`,
        ),
        blocked: nonNegativeInteger(
          entry,
          "blocked",
          `${label}.damage[${index}]`,
        ),
        source: literalValue(
          entry.source,
          ["skill", "burn", "enemy", "self"] as const,
          `${label}.damage[${index}].source`,
        ),
      };
      return target === "player"
        ? { target, ...common }
        : { target, enemyIndex, ...common };
    }),
    hp: {
      playerBefore: nonNegativeInteger(hp, "playerBefore", `${label}.hp`),
      playerAfter: nonNegativeInteger(hp, "playerAfter", `${label}.hp`),
      enemiesBefore: numberArray(hp.enemiesBefore, `${label}.hp.enemiesBefore`),
      enemiesAfter: numberArray(hp.enemiesAfter, `${label}.hp.enemiesAfter`),
    },
  };
};

const sanitizeCombat = (value: unknown, label: string): HumanCombatTrace => {
  const object = objectValue(value, label);
  if (!Array.isArray(object.decisions) || object.decisions.length > 10_000) {
    throw new Error(`${label}.decisions must be a bounded array`);
  }
  const base: HumanCombatTrace = {
    combatIndex: nonNegativeInteger(object, "combatIndex", label),
    attempt: nonNegativeInteger(object, "attempt", label),
    enemyIds: stringArray(object.enemyIds, `${label}.enemyIds`),
    startingHp: nonNegativeInteger(object, "startingHp", label),
    maxHp: nonNegativeInteger(object, "maxHp", label),
    decisions: object.decisions.map((decision, index) =>
      sanitizeDecision(decision, `${label}.decisions[${index}]`),
    ),
  };
  if (object.outcome === undefined) return base;
  const outcome = objectValue(object.outcome, `${label}.outcome`);
  return {
    ...base,
    outcome: {
      result: literalValue(
        outcome.result,
        ["victory", "defeat"] as const,
        `${label}.outcome.result`,
      ),
      turns: nonNegativeInteger(outcome, "turns", `${label}.outcome`),
      playerHp: nonNegativeInteger(outcome, "playerHp", `${label}.outcome`),
      enemyHp: numberArray(outcome.enemyHp, `${label}.outcome.enemyHp`),
    },
  };
};

const sanitizeReward = (value: unknown, label: string): HumanRewardFact => {
  const object = objectValue(value, label);
  const choice = object.choice;
  if (choice !== null && typeof choice !== "string") {
    throw new Error(`${label}.choice must be a string or null`);
  }
  const bagIndex = optionalIndex(object, "bagIndex", label);
  const replacedSlot = optionalIndex(object, "replacedSlot", label);
  return {
    combatIndex: nonNegativeInteger(object, "combatIndex", label),
    stage: literalValue(
      object.stage,
      ["coin", "removal", "fallback-coin", "skill"] as const,
      `${label}.stage`,
    ),
    options: stringArray(object.options, `${label}.options`),
    choice,
    resolution: literalValue(
      object.resolution,
      ["selected", "skipped", "declined"] as const,
      `${label}.resolution`,
    ),
    ...(bagIndex === undefined ? {} : { bagIndex }),
    ...(replacedSlot === undefined ? {} : { replacedSlot }),
  };
};

const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/;

const timestampValue = (
  object: JsonObject,
  key: string,
  label: string,
): string => {
  const value = stringValue(object, key, label, 23);
  if (!TIMESTAMP_PATTERN.test(value)) {
    throw new Error(`${label}.${key} must be a local timestamp`);
  }
  return value;
};

export const sanitizeHumanRunTrace = (input: unknown): HumanRunTrace => {
  const object = objectValue(input, "trace");
  if (object.schemaVersion !== HUMAN_RUN_SCHEMA_VERSION) {
    throw new Error("trace.schemaVersion is unsupported");
  }
  if (object.source !== "human") throw new Error("trace.source must be human");
  if (!Array.isArray(object.combats) || object.combats.length > 64) {
    throw new Error("trace.combats must be a bounded array");
  }
  if (!Array.isArray(object.rewards) || object.rewards.length > 256) {
    throw new Error("trace.rewards must be a bounded array");
  }
  const result = literalValue(
    object.result,
    ["in-progress", "victory", "defeat"] as const,
    "trace.result",
  );
  const base: HumanRunTrace = {
    schemaVersion: HUMAN_RUN_SCHEMA_VERSION,
    source: "human",
    runSeed: stringValue(object, "runSeed", "trace"),
    contentVersion: stringValue(object, "contentVersion", "trace"),
    buildId: stringValue(object, "buildId", "trace"),
    startedAtLocal: timestampValue(object, "startedAtLocal", "trace"),
    maxHp: nonNegativeInteger(object, "maxHp", "trace"),
    combats: object.combats.map((combat, index) =>
      sanitizeCombat(combat, `trace.combats[${index}]`),
    ),
    rewards: object.rewards.map((reward, index) =>
      sanitizeReward(reward, `trace.rewards[${index}]`),
    ),
    result,
  };
  if (result === "in-progress") return base;
  return {
    ...base,
    endedAtLocal: timestampValue(object, "endedAtLocal", "trace"),
    finalHp: nonNegativeInteger(object, "finalHp", "trace"),
  };
};

const safeFilenamePart = (value: string): string => {
  const safe = value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return safe.length === 0 ? "run" : safe;
};

const browserDownloadPort = (): LocalDownloadPort => ({
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  clickDownload: (href, filename) => {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  },
  revokeObjectUrl: (href) => URL.revokeObjectURL(href),
});

export const downloadHumanRunTrace = (
  trace: HumanRunTrace,
  port: LocalDownloadPort = browserDownloadPort(),
): { filename: string; json: string } => {
  const sanitized = sanitizeHumanRunTrace(trace);
  if (sanitized.result === "in-progress") {
    throw new Error("only a terminal human run can be exported");
  }
  const json = `${JSON.stringify(sanitized, null, 2)}\n`;
  const filename = `play-log-${safeFilenamePart(sanitized.runSeed)}-${sanitized.startedAtLocal.replace(/[:.]/g, "-")}.json`;
  const href = port.createObjectUrl(
    new Blob([json], { type: "application/json;charset=utf-8" }),
  );
  try {
    port.clickDownload(href, filename);
  } finally {
    port.revokeObjectUrl(href);
  }
  return { filename, json };
};

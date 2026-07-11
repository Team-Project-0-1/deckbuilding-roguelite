import type { CharacterId, CoinDefId, EventDefId, SkillId } from '../ids';
import type { RunGraph } from './graph';

// v5 (2026-07-12, P4.4): 이벤트 pending 상태·진행 카운터를 추가한다.
// 의미는 선형 전투 번호에서 "현재 런 그래프 레이어 인덱스"로 일반화한다.
export const RUN_SAVE_VERSION = 5 as const;
export const LEGACY_RUN_SAVE_VERSIONS = [1, 2, 3, 4] as const;

export type RunPhase =
  | 'ready'
  | 'choose-node'
  | 'combat'
  | 'rewards'
  | 'shop'
  | 'event'
  | 'victory'
  | 'defeat';

export type EquippedSkills = [SkillId, SkillId, SkillId, SkillId, SkillId, SkillId];

export interface PendingRewards {
  coinOptions: CoinDefId[];
  coinChoiceResolved: boolean;
  coinRemovalResolved: boolean;
  skillOptions: SkillId[];
  skillChoiceResolved: boolean;
}

export interface PendingShop {
  coinOptions: CoinDefId[];
  coinPrices: number[];
  skillOptions: SkillId[];
  skillPrices: number[];
}

export interface PendingEvent {
  eventId: EventDefId;
}

export interface PendingEventCombat {
  eventId: EventDefId;
}

export interface RunSave {
  version: typeof RUN_SAVE_VERSION;
  contentVersion: string;
  runSeed: string;
  character: CharacterId;
  currentHp: number;
  maxHp: number;
  bag: CoinDefId[];
  equippedSkills: EquippedSkills;
  gold: number;
  graph: RunGraph;
  nodeChoices: number[];
  shopRemovals: number;
  shopPurchasedCoins: number;
  shopPurchasedSkills: number;
  eventCombats: number;
  eventCoinGains: number;
  eventCoinLosses: number;
  combatIndex: number;
  attempt: number;
  phase: RunPhase;
  pendingRewards?: PendingRewards;
  pendingShop?: PendingShop;
  pendingEvent?: PendingEvent;
  pendingEventCombat?: PendingEventCombat;
}

export interface RunState extends RunSave {}

export interface CreateRunConfig {
  contentVersion: string;
  runSeed: string;
  character: CharacterId;
}

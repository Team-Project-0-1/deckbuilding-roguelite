import type { CharacterId, CoinDefId, SkillId } from '../ids';

export const RUN_SAVE_VERSION = 1 as const;

export type RunPhase = 'ready' | 'combat' | 'rewards' | 'victory' | 'defeat';

export type EquippedSkills = [SkillId, SkillId, SkillId, SkillId, SkillId, SkillId];

export interface PendingRewards {
  coinOptions: CoinDefId[];
  coinChoiceResolved: boolean;
  coinRemovalResolved: boolean;
  skillOptions: SkillId[];
  skillChoiceResolved: boolean;
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
  combatIndex: number;
  attempt: number;
  phase: RunPhase;
  pendingRewards?: PendingRewards;
}

export interface RunState extends RunSave {}

export interface CreateRunConfig {
  contentVersion: string;
  runSeed: string;
  character: CharacterId;
}

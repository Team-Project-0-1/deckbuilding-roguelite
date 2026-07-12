import type {
  CharacterId,
  CoinDefId,
  CoinUid,
  Element,
  EventDefId,
  EnemyDefId,
  Face,
  SkillId
} from './ids';

// 확정 어휘 (docs/implementation-plan.md §6): 화상 burn(M3), 동상 frostbite·감전 shock(포스트 MVP 예약)
export type StatusId = 'burn' | 'frostbite' | 'shock';

export type TargetRef = { type: 'player' } | { type: 'enemy'; index: number };

export interface CoinDef {
  id: CoinDefId;
  element: Element | null;
  proc?: { face: Face; effects: EffectAtom[] };
}

export interface CoinInstance {
  uid: CoinUid;
  defId: CoinDefId;
  permanent: boolean;
  grants: Element[];
}

export interface SkillDefBase {
  id: SkillId;
  name: string;
  rarity: 'common' | 'advanced' | 'rare';
  tags: readonly ('attack' | 'defense' | 'utility' | 'ultimate')[];
  targetType: 'single-enemy' | 'all-enemies' | 'self' | 'none';
  oncePerCombat?: boolean;
  // 캐릭터 전용 스킬 — 공용 보상 풀에서 제외되고 해당 캐릭터 런에서만 노출된다.
  // 숨김 프로퍼티 같은 암묵 경계 대신 명시적 데이터로 풀 경계를 표현한다 (P3.2 결정).
  exclusiveTo?: CharacterId;
}

export interface FlipSkillDef extends SkillDefBase {
  type: 'flip';
  cost: number;
  base: EffectAtom[];
  heads?: { mode: 'any' | 'per'; effects: EffectAtom[] };
  tails?: { mode: 'any' | 'per'; effects: EffectAtom[] };
}

export interface ConsumeSkillDef extends SkillDefBase {
  type: 'consume';
  consume: { element: Element; count: number };
  effects: EffectAtom[];
}

export type SkillDef = FlipSkillDef | ConsumeSkillDef;

export interface TurnTriggerDef {
  id: string;
  hook: 'onDamageDealt' | 'onAttackSkillResolved';
  effects: EffectAtom[];
}

export type EffectAtom =
  | { kind: 'damage'; amount: number }
  | { kind: 'block'; amount: number }
  | { kind: 'selfDamage'; amount: number }
  | { kind: 'applyStatus'; status: StatusId; stacks: number; to: 'target' | 'self' }
  | { kind: 'addCoin'; coin: CoinDefId; zone: 'draw' | 'discard' | 'hand'; count: number }
  | { kind: 'grantElement'; element: Element; scope: 'allBasicInHand' | 'chooseBasicInHand' }
  | { kind: 'addTurnTrigger'; trigger: TurnTriggerDef };

export interface CharacterDef {
  id: CharacterId;
  name: string;
  maxHp: number;
  startingBag: CoinDefId[];
  startingSkills: SkillId[];
  trait: {
    id: string;
    name: string;
    hook: 'combatStart' | 'turnStart';
    effects: EffectAtom[];
  };
}

export type EnemyAction =
  | { kind: 'attack'; damage: number; hits?: number }
  | { kind: 'block'; amount: number }
  | { kind: 'nextDrawPenalty'; amount: number }
  | { kind: 'applyStatus'; status: StatusId; stacks: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'buffNextAttack'; amount: number };

export interface EnemyIntent {
  id: string;
  actions: EnemyAction[];
}

// 몬스터 패시브 — 설계 가이드 §3 패시브 원칙 준용: 자동 조건 발동 최대 1개.
// 의도(intent)로 예고되지 않으므로 자기 대상 원자(heal/block/buffNextAttack)만
// 허용한다 — 플레이어 대상 원자는 "매 턴 의도 공개" 계약(§5 원칙 2)과 충돌.
export interface EnemyPassiveDef {
  id: string;
  name: string;
  description: string;
  hook: 'enemyTurnStart';
  effects: EnemyAction[];
}

export interface EnemyDef {
  id: EnemyDefId;
  name: string;
  maxHp: number;
  intents: EnemyIntent[];
  passive?: EnemyPassiveDef;
}

export type EventRisk = 'combat' | 'hp' | 'gold' | 'coin';

export type EventDef =
  | {
      id: EventDefId;
      name: string;
      prompt: string;
      risk: 'combat';
      elitePool: EnemyDefId[][];
      goldReward: number;
      rareSkillOptions: number;
    }
  | {
      id: EventDefId;
      name: string;
      prompt: string;
      risk: 'hp';
      hpCost: number;
      requireCurrentHpAbove: number;
      reward: { kind: 'signatureCoin'; count: number };
    }
  | {
      id: EventDefId;
      name: string;
      prompt: string;
      risk: 'gold';
      goldCost: number;
      transform: { from: CoinDefId; to: 'signatureCoin' };
    }
  | {
      id: EventDefId;
      name: string;
      prompt: string;
      risk: 'coin';
      sacrifice: { coin: CoinDefId; reward: 'signatureCoin'; minimumBagSize: number };
    };

export interface ContentDb {
  coins: Record<string, CoinDef>;
  skills: Record<string, SkillDef>;
  enemies: Record<string, EnemyDef>;
  characters: Record<string, CharacterDef>;
  events?: Record<string, EventDef>;
  validate: () => string[];
}

const duplicateIds = <T extends { id: string | number }>(items: readonly T[], label: string): string[] => {
  const seen = new Set<string | number>();
  const errors: string[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      errors.push(`duplicate ${label} id: ${String(item.id)}`);
    }
    seen.add(item.id);
  }
  return errors;
};

const validateSkillCosts = (skills: readonly SkillDef[]): string[] => {
  const errors: string[] = [];

  for (const skill of skills) {
    if (skill.type === 'consume') {
      if (!Number.isInteger(skill.consume.count) || skill.consume.count < 1 || skill.consume.count > 3) {
        errors.push(`skill ${String(skill.id)}: consume count must be an integer from 1 to 3`);
      }
      continue;
    }

    if (!Number.isInteger(skill.cost) || skill.cost < 1) {
      errors.push(`skill ${String(skill.id)}: flip cost must be a positive integer`);
      continue;
    }

    if (skill.cost > 5) {
      errors.push(`skill ${String(skill.id)}: flip cost ${skill.cost} exceeds the maximum of 5`);
      continue;
    }

    const isExceptionalCost =
      skill.rarity === 'rare' && (skill.oncePerCombat === true || skill.tags.includes('ultimate'));
    if (skill.cost === 5 && !isExceptionalCost) {
      errors.push(`skill ${String(skill.id)}: flip cost 5 requires rare rarity and oncePerCombat or ultimate`);
    }
  }

  return errors;
};

// addTurnTrigger 재귀 검증 — 잘못된 id/hook/빈 효과, 그리고 트리거 효과 안의
// 중첩 addTurnTrigger(순환 폭주 표면)를 콘텐츠 단계에서 거부한다 (P3.3 감사).
const TURN_TRIGGER_HOOKS = ['onDamageDealt', 'onAttackSkillResolved'] as const;

const validateTriggerAtoms = (
  atoms: readonly EffectAtom[],
  owner: string,
  insideTrigger: boolean,
  errors: string[]
): void => {
  for (const atom of atoms) {
    if (atom.kind !== 'addTurnTrigger') continue;
    if (insideTrigger) {
      errors.push(`${owner}: nested addTurnTrigger inside a trigger is not allowed`);
      continue;
    }
    const trigger = atom.trigger;
    if (typeof trigger.id !== 'string' || trigger.id.length === 0) {
      errors.push(`${owner}: turn trigger id must be a non-empty string`);
    }
    if (!TURN_TRIGGER_HOOKS.includes(trigger.hook)) {
      errors.push(`${owner}: unknown turn trigger hook ${String(trigger.hook)}`);
    }
    if (!Array.isArray(trigger.effects) || trigger.effects.length === 0) {
      errors.push(`${owner}: turn trigger ${trigger.id} must declare at least one effect`);
    } else {
      validateTriggerAtoms(trigger.effects, `${owner} trigger ${trigger.id}`, true, errors);
    }
  }
};

// attack 태그 스킬이 self/none 대상을 갖으면 onAttackSkillResolved류 트리거가
// 플레이어를 대상으로 발동하는 셀프 피해 함정이 된다 — 구조적으로 금지 (P3.3 감사)
const validateAttackTargets = (skills: readonly SkillDef[]): string[] => {
  const errors: string[] = [];
  for (const skill of skills) {
    if (
      skill.tags.includes('attack') &&
      skill.targetType !== 'single-enemy' &&
      skill.targetType !== 'all-enemies'
    ) {
      errors.push(
        `skill ${String(skill.id)}: attack tag requires an enemy targetType (got ${skill.targetType})`
      );
    }
  }
  return errors;
};

const validateTurnTriggers = (db: Omit<ContentDb, 'validate'>): string[] => {
  const errors: string[] = [];
  for (const skill of Object.values(db.skills)) {
    const owner = `skill ${String(skill.id)}`;
    if (skill.type === 'consume') {
      validateTriggerAtoms(skill.effects, owner, false, errors);
    } else {
      validateTriggerAtoms(skill.base, owner, false, errors);
      if (skill.heads) validateTriggerAtoms(skill.heads.effects, owner, false, errors);
      if (skill.tails) validateTriggerAtoms(skill.tails.effects, owner, false, errors);
    }
  }
  for (const character of Object.values(db.characters)) {
    validateTriggerAtoms(character.trait.effects, `character ${String(character.id)}`, false, errors);
  }
  return errors;
};

const validateEvents = (events: readonly EventDef[], enemies: Record<string, EnemyDef>): string[] => {
  const errors: string[] = [];
  for (const event of events) {
    if (event.risk !== 'combat') continue;
    if (event.elitePool.length === 0) {
      errors.push(`event ${String(event.id)}: elitePool must not be empty`);
    }
    for (const encounter of event.elitePool) {
      if (encounter.length === 0) {
        errors.push(`event ${String(event.id)}: elitePool encounter must not be empty`);
      }
      for (const enemyId of encounter) {
        if (enemies[String(enemyId)] === undefined) {
          errors.push(`event ${String(event.id)}: unknown enemy ${String(enemyId)}`);
        }
      }
    }
  }
  return errors;
};

const validateEnemyPassives = (enemies: Record<string, EnemyDef>): string[] => {
  const errors: string[] = [];
  const SELF_ONLY = new Set(['heal', 'block', 'buffNextAttack']);
  for (const enemy of Object.values(enemies)) {
    const passive = enemy.passive;
    if (passive === undefined) continue;
    const owner = `enemy ${String(enemy.id)} passive ${passive.id}`;
    if (passive.effects.length === 0) errors.push(`${owner}: must declare at least one effect`);
    for (const action of passive.effects) {
      if (!SELF_ONLY.has(action.kind)) {
        errors.push(`${owner}: only self-target actions are allowed (got ${action.kind})`);
      } else if ('amount' in action && (!Number.isInteger(action.amount) || action.amount <= 0)) {
        errors.push(`${owner}: ${action.kind} amount must be a positive integer`);
      }
    }
  }
  return errors;
};

export const validateContentDb = (db: Omit<ContentDb, 'validate'>): string[] => [
  ...duplicateIds(Object.values(db.coins), 'coin'),
  ...duplicateIds(Object.values(db.skills), 'skill'),
  ...duplicateIds(Object.values(db.enemies), 'enemy'),
  ...duplicateIds(Object.values(db.characters), 'character'),
  ...duplicateIds(Object.values(db.events ?? {}), 'event'),
  ...validateSkillCosts(Object.values(db.skills)),
  ...validateTurnTriggers(db),
  ...validateAttackTargets(Object.values(db.skills)),
  ...validateEvents(Object.values(db.events ?? {}), db.enemies),
  ...validateEnemyPassives(db.enemies)
];

export const effectiveElements = (coin: CoinInstance, db: ContentDb): Element[] => {
  const def = db.coins[String(coin.defId)];
  const elements = new Set<Element>(coin.grants);
  if (def?.element != null) {
    elements.add(def.element);
  }
  return [...elements];
};

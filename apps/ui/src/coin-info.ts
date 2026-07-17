// 코인 보상 카드의 이름·부가 효과 문구 — proc 정의에서 파생하는 단일 정본.
// 상태 이름은 결산 티켓과 동일한 statusKo를 공유해 표기 드리프트를 막는다.
import type { ContentDb } from '@game/core';

import { statusKo } from './resolution-summary';

export const coinNameFor = (db: ContentDb, coin: string): string => {
  const element = db.coins[coin]?.element;
  return element === null || element === undefined
    ? '기본 코인'
    : `${elementLabel(element)} 코인`;
};

const elementLabel = (value: string): string =>
  ({
    fire: '화염',
    mana: '마나',
    frost: '냉기',
    lightning: '전기',
    blood: '혈액'
  })[value] ?? value;

// P7 D4 — 양면 proc: 면별 효과를 각각 서술 ("앞면 화상 +1 · 뒷면 피해 1" 형식)
const procEffectText = (effect: { kind: string } & Record<string, unknown>): string => {
  if (effect.kind === 'block') return `방어 +${effect.amount as number}`;
  if (effect.kind === 'damage') return `피해 ${effect.amount as number}`;
  if (effect.kind === 'coinDamage') return `피해 ${effect.amount as number}`;
  if (effect.kind === 'loseHp') return `체력 ${effect.amount as number} 상실`;
  if (effect.kind === 'heal') return `회복 ${effect.amount as number}`;
  if (effect.kind === 'applyStatus') {
    const name = statusKo(effect.status as never);
    // statusKo가 원문을 되돌리면 미등록 상태 — 일반 문구로 폴백
    if (name !== effect.status) return `${name} +${effect.stacks as number}`;
  }
  return '속성 효과';
};

export const coinRewardDetailFor = (db: ContentDb, coin: string): string => {
  const procs = db.coins[coin]?.procs;
  if (procs === undefined) return '속성 효과 없음';
  const parts: string[] = [];
  const heads = procs.heads ?? [];
  const tails = procs.tails ?? [];
  if (heads.length > 0) parts.push(`앞면 ${heads.map(procEffectText).join(' + ')}`);
  if (tails.length > 0) parts.push(`뒷면 ${tails.map(procEffectText).join(' + ')}`);
  return parts.length === 0 ? '속성 효과 없음' : parts.join(' · ');
};

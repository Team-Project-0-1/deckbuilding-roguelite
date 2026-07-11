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

export const coinRewardDetailFor = (db: ContentDb, coin: string): string => {
  const proc = db.coins[coin]?.proc;
  if (proc === undefined) return '속성 효과 없음';
  const effect = proc.effects[0];
  const face = proc.face === 'heads' ? '앞면' : '뒷면';
  if (effect?.kind === 'block') return `${face} · 방어 +${effect.amount}`;
  if (effect?.kind === 'applyStatus') {
    const name = statusKo(effect.status);
    // statusKo가 원문을 되돌리면 미등록 상태 — 일반 문구로 폴백
    if (name !== effect.status) return `${face} · ${name} +${effect.stacks}`;
  }
  return `${face} · 속성 효과`;
};

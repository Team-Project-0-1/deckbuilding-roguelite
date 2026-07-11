// 코인 보상 문구 회귀 — 감사: frostbite/shock proc이 "속성 효과"로 뭉개지지 않는다.
import { contentDb } from '@game/content';
import { describe, expect, it } from 'vitest';

import { coinNameFor, coinRewardDetailFor } from './coin-info';

describe('coinRewardDetailFor', () => {
  it('냉기 코인은 앞면 · 동상 +1로 명시한다', () => {
    expect(coinRewardDetailFor(contentDb, 'frost')).toBe('앞면 · 동상 +1');
  });

  it('전기 코인은 앞면 · 감전 +1로 명시한다', () => {
    expect(coinRewardDetailFor(contentDb, 'lightning')).toBe('앞면 · 감전 +1');
  });

  it('기존 문구는 불변 — 화염/마나/기본', () => {
    expect(coinRewardDetailFor(contentDb, 'fire')).toBe('앞면 · 화상 +1');
    expect(coinRewardDetailFor(contentDb, 'mana')).toBe('앞면 · 방어 +2');
    expect(coinRewardDetailFor(contentDb, 'basic')).toBe('속성 효과 없음');
  });

  it('미등록 상태 proc은 일반 문구로 폴백한다', () => {
    const db = {
      ...contentDb,
      coins: {
        ...contentDb.coins,
        mystery: {
          id: 'mystery',
          element: 'blood',
          proc: {
            face: 'tails',
            effects: [
              { kind: 'applyStatus', status: 'petrify', stacks: 2, to: 'target' }
            ]
          }
        }
      }
    };
    expect(coinRewardDetailFor(db as never, 'mystery')).toBe('뒷면 · 속성 효과');
  });
});

describe('coinNameFor', () => {
  it('신규 원소 이름을 렌더한다', () => {
    expect(coinNameFor(contentDb, 'frost')).toBe('냉기 코인');
    expect(coinNameFor(contentDb, 'lightning')).toBe('전기 코인');
    expect(coinNameFor(contentDb, 'basic')).toBe('기본 코인');
  });
});

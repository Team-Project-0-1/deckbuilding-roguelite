// 코인 보상 문구 회귀 — P7 D4 양면 proc: 모든 속성 코인이 앞면·뒷면 효과를 각각 명시한다.
import { contentDb } from '@game/content';
import { describe, expect, it } from 'vitest';

import { coinNameFor, coinRewardDetailFor } from './coin-info';

describe('coinRewardDetailFor', () => {
  it('냉기 코인은 앞면 동상 · 뒷면 방어를 명시한다', () => {
    expect(coinRewardDetailFor(contentDb, 'frost')).toBe('앞면 동상 +1 · 뒷면 방어 +1');
  });

  it('전기 코인은 앞면 감전 · 뒷면 피해를 명시한다', () => {
    expect(coinRewardDetailFor(contentDb, 'lightning')).toBe('앞면 감전 +1 · 뒷면 피해 1');
  });

  it('화염/마나/기본 — 양면 문구와 무속성 폴백', () => {
    expect(coinRewardDetailFor(contentDb, 'fire')).toBe('앞면 화상 +1 · 뒷면 피해 1');
    expect(coinRewardDetailFor(contentDb, 'mana')).toBe('앞면 방어 +1 · 뒷면 방어 +2');
    expect(coinRewardDetailFor(contentDb, 'basic')).toBe('속성 효과 없음');
  });

  it('혈액 코인은 앞면 지정 피해 · 뒷면 체력 상실과 강화 피해를 명시한다', () => {
    expect(coinRewardDetailFor(contentDb, 'blood')).toBe('앞면 피해 1 · 뒷면 체력 1 상실 + 피해 2');
  });

  it('미등록 상태 proc은 면별 일반 문구로 폴백한다', () => {
    const db = {
      ...contentDb,
      coins: {
        ...contentDb.coins,
        mystery: {
          id: 'mystery',
          element: 'blood',
          procs: {
            tails: [
              { kind: 'applyStatus', status: 'petrify', stacks: 2, to: 'target' }
            ]
          }
        }
      }
    };
    expect(coinRewardDetailFor(db as never, 'mystery')).toBe('뒷면 속성 효과');
  });
});

describe('coinNameFor', () => {
  it('신규 원소 이름을 렌더한다', () => {
    expect(coinNameFor(contentDb, 'frost')).toBe('냉기 코인');
    expect(coinNameFor(contentDb, 'lightning')).toBe('전기 코인');
    expect(coinNameFor(contentDb, 'blood')).toBe('혈액 코인');
    expect(coinNameFor(contentDb, 'basic')).toBe('기본 코인');
  });
});

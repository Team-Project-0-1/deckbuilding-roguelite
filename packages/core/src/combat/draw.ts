import type { CoinUid } from '../ids';
import { rngFrom } from '../rng';
import type { CombatEvent } from './events';
import type { CombatState } from './state';

// 손 상한 — addCoin(zone hand)과 드로우가 공유하는 단일 한계 (P7 감사 보정)
export const HAND_LIMIT = 10;

// P7 D3 — reducer(턴 시작 드로우)와 resolve(draw 원자)가 공유하는 단일 드로우 구현.
// 손 상한 10을 넘겨 뽑지 않는다 (초과분은 뽑기 더미에 남는다).
export const drawCards = (input: CombatState, count: number): { state: CombatState; events: CombatEvent[] } => {
  const events: CombatEvent[] = [];
  let state = input;
  let draw = [...state.zones.draw];
  let discard = [...state.zones.discard];
  const rng = state.rngImpl?.shuffle ?? rngFrom(state.rng.shuffle);
  const drawn: CoinUid[] = [];
  let remaining = Math.min(count, Math.max(0, HAND_LIMIT - state.zones.hand.length));

  while (remaining > 0) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      events.push({ type: 'pileShuffled', count: discard.length });
      draw = rng.shuffle(discard);
      discard = [];
    }
    const coin = draw.shift();
    if (coin === undefined) break;
    drawn.push(coin);
    remaining -= 1;
  }

  if (drawn.length > 0) events.push({ type: 'coinsDrawn', coins: drawn });
  state = {
    ...state,
    rng: { ...state.rng, shuffle: rng.snapshot() },
    zones: { ...state.zones, draw, discard, hand: [...state.zones.hand, ...drawn] }
  };
  return { state, events };
};

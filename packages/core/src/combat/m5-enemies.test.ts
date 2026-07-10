import { describe, expect, it } from 'vitest';

import type { ContentDb } from '../content-types';
import type { CharacterId, CoinDefId, EnemyDefId } from '../ids';
import { createCombat, step } from './reducer';
import type { CombatState } from './state';

const id = <T extends string>(value: string) => value as T;

const testDb = (): ContentDb => ({
  coins: {
    basic: { id: id<CoinDefId>('basic'), element: null }
  },
  skills: {},
  enemies: {
    shaman: {
      id: id<EnemyDefId>('shaman'),
      name: '주술사',
      maxHp: 60,
      intents: [
        { id: 'wither', actions: [{ kind: 'nextDrawPenalty', amount: 1 }] },
        { id: 'hex-strike', actions: [{ kind: 'attack', damage: 9 }] }
      ]
    },
    gatekeeper: {
      id: id<EnemyDefId>('gatekeeper'),
      name: '수문장',
      maxHp: 70,
      intents: [
        {
          id: 'guarded-strike',
          actions: [
            { kind: 'block', amount: 8 },
            { kind: 'attack', damage: 5 }
          ]
        },
        {
          id: 'guarded-strike-2',
          actions: [
            { kind: 'block', amount: 8 },
            { kind: 'attack', damage: 5 }
          ]
        },
        {
          id: 'fortified-strike',
          actions: [
            { kind: 'block', amount: 12 },
            { kind: 'attack', damage: 5 }
          ]
        }
      ]
    }
  },
  characters: {
    warrior: {
      id: id<CharacterId>('warrior'),
      name: '전사',
      maxHp: 70,
      startingBag: Array.from({ length: 10 }, () => id<CoinDefId>('basic')),
      startingSkills: [],
      trait: { id: 'none', name: '없음', hook: 'combatStart', effects: [] }
    }
  },
  validate: () => []
});

const endTurn = (state: CombatState, db: ContentDb) => {
  const result = step(state, { type: 'endTurn' }, db);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe('M5 enemy actions', () => {
  it('consumes Shaman Wither on the next draw only', () => {
    const db = testDb();
    const initial = createCombat(
      { character: id<CharacterId>('warrior'), enemies: [id<EnemyDefId>('shaman')] },
      db,
      'm5-shaman-wither'
    );

    const withered = endTurn(initial, db);
    expect(withered.state.zones.hand).toHaveLength(4);
    expect(withered.state.player.nextDrawPenalty).toBe(0);
    expect(withered.events).toContainEqual({
      type: 'witherApplied',
      enemy: 0,
      amount: 1,
      nextDrawPenalty: 1
    });
    expect(withered.state.enemies[0]?.intent.id).toBe('hex-strike');

    const recovered = endTurn(withered.state, db);
    expect(recovered.state.zones.hand).toHaveLength(5);
    expect(recovered.state.player.nextDrawPenalty).toBe(0);
    expect(recovered.state.player.hp).toBe(61);
    expect(recovered.events.some((event) => event.type === 'witherApplied')).toBe(false);
    expect(recovered.state.enemies[0]?.intent.id).toBe('wither');
  });

  it('clears Gatekeeper block immediately before its next deterministic action', () => {
    const run = () => {
      const db = testDb();
      let state = createCombat(
        { character: id<CharacterId>('warrior'), enemies: [id<EnemyDefId>('gatekeeper')] },
        db,
        'm5-gatekeeper-loop'
      );
      const trace: Array<{ block: number; revealed?: string; events: typeof state.events }> = [];

      for (let turn = 0; turn < 4; turn += 1) {
        const result = endTurn(state, db);
        state = result.state;
        const revealed = result.events.find((event) => event.type === 'intentRevealed');
        trace.push({
          block: state.enemies[0]?.block ?? -1,
          revealed: revealed?.type === 'intentRevealed' ? revealed.intent.id : undefined,
          events: result.events
        });
      }
      return trace;
    };

    const first = run();
    expect(first.map(({ block }) => block)).toEqual([8, 8, 12, 8]);
    expect(first.map(({ revealed }) => revealed)).toEqual([
      'guarded-strike-2',
      'fortified-strike',
      'guarded-strike',
      'guarded-strike-2'
    ]);

    for (const [index, expectedAmount] of [8, 8, 12].entries()) {
      const events = first[index + 1]?.events ?? [];
      const clearedAt = events.findIndex((event) => event.type === 'blockCleared');
      const gainedAt = events.findIndex((event) => event.type === 'blockGained');
      expect(events[clearedAt]).toMatchObject({ type: 'blockCleared', amount: expectedAmount });
      expect(clearedAt).toBeGreaterThanOrEqual(0);
      expect(gainedAt).toBeGreaterThan(clearedAt);
    }

    expect(run()).toEqual(first);
  });
});

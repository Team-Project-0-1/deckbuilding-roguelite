import { describe, expect, it } from 'vitest';

import type { ContentDb, FlipSkillDef } from '../content-types';
import type { CharacterId, CoinDefId, EnemyDefId, SkillId, SlotId } from '../ids';
import type { Rng, RngSnapshot } from '../rng';
import { legalCommands } from './commands';
import { createCombat, step } from './reducer';
import { assertCombatCoinZoneInvariant } from './state';
import type { CombatState } from './state';

const id = <T extends string>(value: string) => value as T;
const slot = (value: number) => value as SlotId;

const scriptedFlips = (faces: readonly ('heads' | 'tails')[]): Rng => {
  let index = 0;
  return {
    float: () => 0,
    int: () => 0,
    flip: () => faces[index++] ?? 'tails',
    shuffle: <T>(items: readonly T[]) => [...items],
    snapshot: (): RngSnapshot => ({ s: [index, 0, 0, 0] })
  };
};

const dbFor = (skill: FlipSkillDef): ContentDb => ({
  coins: { basic: { id: id<CoinDefId>('basic'), element: null } },
  skills: { [String(skill.id)]: skill },
  enemies: {
    dummy: { id: id<EnemyDefId>('dummy'), name: 'dummy', maxHp: 20, intents: [{ id: 'wait', actions: [] }] }
  },
  characters: {
    hero: {
      id: id<CharacterId>('hero'),
      name: 'hero',
      maxHp: 20,
      startingBag: Array.from({ length: 6 }, () => id<CoinDefId>('basic')),
      startingSkills: [skill.id],
      trait: { id: 'none', name: 'none', hook: 'combatStart', effects: [] }
    }
  },
  validate: () => []
});

const flip = (overrides: Partial<FlipSkillDef> = {}): FlipSkillDef => ({
  id: id<SkillId>('flip'),
  name: 'flip',
  type: 'flip',
  rarity: 'common',
  tags: ['attack'],
  targetType: 'single-enemy',
  cost: 1,
  cooldown: 0,
  successFace: 'heads',
  successLadder: [[], [{ kind: 'damage', amount: 3 }]],
  ...overrides
});

const combat = (skill: FlipSkillDef, faces: readonly ('heads' | 'tails')[] = ['heads', 'tails']): [CombatState, ContentDb] => {
  const db = dbFor(skill);
  const state = createCombat({ character: id<CharacterId>('hero'), enemies: [id<EnemyDefId>('dummy'), id<EnemyDefId>('dummy')] }, db, 'd22');
  return [{ ...state, rngImpl: { ...state.rngImpl, flip: scriptedFlips(faces) } }, db];
};

const place = (state: CombatState, db: ContentDb, coin = state.zones.hand[0]!) => {
  const result = step(state, { type: 'placeCoin', coin, slot: slot(0) }, db);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

describe('D22 flip reservations', () => {
  it('keeps repeat reservations on distinct UIDs and resolves each ID against its own target and RNG outcome', () => {
    const [initial, db] = combat(flip());
    const firstCoin = initial.zones.hand[0]!;
    const first = place(initial, db, firstCoin);
    const secondCoin = first.zones.hand[0]!;
    const planned = place(first, db, secondCoin);

    expect(planned.flipReservations.map((reservation) => reservation.coinUids)).toEqual([[firstCoin], [secondCoin]]);
    const commands = legalCommands(planned, db).filter((command) => command.type === 'useFlipSkill');
    expect(commands).toHaveLength(4);
    const firstReservation = planned.flipReservations[0]!;
    const secondReservation = planned.flipReservations[1]!;
    const firstUse = step(planned, { type: 'useFlipSkill', slot: slot(0), reservationId: firstReservation.id, target: 1 }, db);
    expect(firstUse).toMatchObject({ ok: true });
    if (!firstUse.ok) return;
    expect(firstUse.state.enemies[1]?.hp).toBe(17);
    expect(firstUse.state.enemies[0]?.hp).toBe(20);
    expect(firstUse.state.zones.discard).toContain(firstCoin);
    expect(firstUse.state.flipReservations).toEqual([secondReservation]);

    const secondUse = step(firstUse.state, { type: 'useFlipSkill', slot: slot(0), reservationId: secondReservation.id, target: 0 }, db);
    expect(secondUse).toMatchObject({ ok: true });
    if (!secondUse.ok) return;
    expect(secondUse.state.enemies[0]?.hp).toBe(20);
    expect(secondUse.state.zones.discard).toContain(secondCoin);
  });

  it('dissolves only the reservation containing an unplaced coin without rebinding another package', () => {
    const [initial, db] = combat(flip({ cost: 2, successLadder: [[], [], [{ kind: 'damage', amount: 3 }]] }));
    const initialWithFour = {
      ...initial,
      zones: { ...initial.zones, hand: [...initial.zones.hand, initial.zones.draw[0]!], draw: initial.zones.draw.slice(1) }
    };
    const first = place(initialWithFour, db);
    const firstPackage = place(first, db);
    const second = place(firstPackage, db);
    const planned = place(second, db);
    const [firstReservation, secondReservation] = planned.flipReservations;
    expect(firstReservation).toBeDefined();
    expect(secondReservation).toBeDefined();
    const removedCoin = secondReservation!.coinUids[0]!;

    const result = step(planned, { type: 'unplaceCoin', coin: removedCoin }, db);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.state.flipReservations).toEqual([firstReservation]);
    expect(result.state.zones.hand).toContain(removedCoin);
    expect(result.state.zones.placed[slot(0)]).toEqual([secondReservation!.coinUids[1]!]);
    expect(() => assertCombatCoinZoneInvariant(result.state)).not.toThrow();
  });

  it('offers each reserved coin as a legal unplace command', () => {
    const [initial, db] = combat(flip());
    const planned = place(initial, db);
    const reservedCoin = planned.flipReservations[0]?.coinUids[0];
    expect(reservedCoin).toBeDefined();
    expect(legalCommands(planned, db)).toContainEqual({ type: 'unplaceCoin', coin: reservedCoin });
  });

  it('consumes flip RNG strictly in execution order rather than reservation creation order', () => {
    const [initial, db] = combat(flip(), ['heads', 'tails']);
    const first = place(initial, db);
    const planned = place(first, db);
    const [firstReservation, secondReservation] = planned.flipReservations;
    expect(firstReservation).toBeDefined();
    expect(secondReservation).toBeDefined();

    const secondFirst = step(
      planned,
      { type: 'useFlipSkill', slot: slot(0), reservationId: secondReservation!.id, target: 1 },
      db
    );
    expect(secondFirst).toMatchObject({ ok: true });
    if (!secondFirst.ok) return;
    expect(secondFirst.state.enemies[1]?.hp).toBe(17);

    const firstSecond = step(
      secondFirst.state,
      { type: 'useFlipSkill', slot: slot(0), reservationId: firstReservation!.id, target: 0 },
      db
    );
    expect(firstSecond).toMatchObject({ ok: true });
    if (!firstSecond.ok) return;
    expect(firstSecond.state.enemies[0]?.hp).toBe(20);
  });

  it('does not consume flip RNG when a reservation is dissolved', () => {
    const [initial, db] = combat(flip(), ['heads']);
    const first = place(initial, db);
    const planned = place(first, db);
    const [dissolved, surviving] = planned.flipReservations;
    expect(dissolved).toBeDefined();
    expect(surviving).toBeDefined();

    const unplaced = step(planned, { type: 'unplaceCoin', coin: dissolved!.coinUids[0]! }, db);
    expect(unplaced).toMatchObject({ ok: true });
    if (!unplaced.ok) return;
    const resolved = step(
      unplaced.state,
      { type: 'useFlipSkill', slot: slot(0), reservationId: surviving!.id, target: 0 },
      db
    );
    expect(resolved).toMatchObject({ ok: true });
    if (!resolved.ok) return;
    expect(resolved.state.enemies[0]?.hp).toBe(17);
  });

  it('never exposes or resolves a partial draft', () => {
    const [initial, db] = combat(flip({ cost: 2, successLadder: [[], [], [{ kind: 'damage', amount: 3 }]] }));
    const partial = place(initial, db);
    expect(partial.flipReservations).toEqual([]);
    expect(legalCommands(partial, db).some((command) => command.type === 'useFlipSkill')).toBe(false);
    expect(step(partial, { type: 'useFlipSkill', slot: slot(0), target: 0 }, db)).toMatchObject({ ok: false });
  });

  it('keeps a preserved reservation within legal end-turn preserve capacity', () => {
    const [initial, db] = combat(flip({ nonRepeatable: true }));
    const reservedCoin = initial.zones.hand[0]!;
    const preserveDb: ContentDb = {
      ...db,
      characters: {
        ...db.characters,
        hero: {
          ...db.characters.hero!,
          trait: { ...db.characters.hero!.trait, mechanic: 'preserveHand' }
        }
      }
    };
    const prepared: CombatState = {
      ...initial,
      coins: {
        ...initial.coins,
        [Number(reservedCoin)]: { ...initial.coins[Number(reservedCoin)]!, preserved: true }
      },
      player: { ...initial.player, additionalPreserveThisTurn: 2 }
    };
    const planned = place(prepared, preserveDb, reservedCoin);
    const endTurn = legalCommands(planned, preserveDb).find((command) => command.type === 'endTurn');
    expect(endTurn).toMatchObject({ type: 'endTurn', preserve: expect.arrayContaining([reservedCoin]) });
    if (endTurn === undefined) return;
    expect(step(planned, endTurn, preserveDb)).toMatchObject({ ok: true });
  });

  it.each([
    ['default cooldown', flip({ cooldown: undefined })],
    ['positive cooldown', flip({ cooldown: 1 })],
    ['once per combat', flip({ oncePerCombat: true })],
    ['non-repeatable', flip({ nonRepeatable: true })]
  ])('admits exactly one reservation for %s', (_label, skill) => {
    const [initial, db] = combat(skill);
    const planned = place(initial, db);
    expect(planned.flipReservations).toHaveLength(1);
    expect(legalCommands(planned, db).some((command) => command.type === 'placeCoin' && command.slot === slot(0))).toBe(false);
    expect(step(planned, { type: 'placeCoin', coin: planned.zones.hand[0]!, slot: slot(0) }, db)).toMatchObject({ ok: false });
  });
});

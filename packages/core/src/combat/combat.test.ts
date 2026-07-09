import { describe, expect, it } from 'vitest';

import type { Rng, RngSnapshot } from '../rng';
import type { CoinDefId, CoinUid, SkillId, SlotId } from '../ids';
import type { ContentDb, FlipSkillDef } from '../content-types';
import { createCombat, step, zoneCoinCount } from './reducer';
import { legalCommands } from './commands';
import type { Command } from './commands';
import type { CombatState } from './state';

const id = <T extends string>(value: string) => value as T;
const slot = (value: number) => value as SlotId;

const scriptedFlips = (faces: readonly ('heads' | 'tails')[]): Rng => {
  let index = 0;
  return {
    float: () => 0,
    int: () => 0,
    flip: () => {
      const face = faces[index];
      if (face === undefined) {
        throw new Error('scripted flip exhausted');
      }
      index += 1;
      return face;
    },
    shuffle: <T>(xs: readonly T[]) => [...xs],
    snapshot: (): RngSnapshot => ({ s: [index, 0, 0, 0] })
  };
};

const testDb = (): ContentDb => ({
  coins: {
    basic: { id: id<CoinDefId>('basic'), element: null },
    fire: {
      id: id<CoinDefId>('fire'),
      element: 'fire',
      proc: { face: 'heads', effects: [{ kind: 'applyStatus', status: 'burn', stacks: 1, to: 'target' }] }
    }
  },
  skills: {
    slash: {
      id: id<SkillId>('slash'),
      name: '베기',
      type: 'flip',
      rarity: 'common',
      tags: ['attack'],
      targetType: 'single-enemy',
      cost: 1,
      base: [{ kind: 'damage', amount: 6 }],
      heads: { mode: 'any', effects: [{ kind: 'damage', amount: 4 }] }
    },
    guard: {
      id: id<SkillId>('guard'),
      name: '방어',
      type: 'flip',
      rarity: 'common',
      tags: ['defense'],
      targetType: 'self',
      cost: 1,
      base: [{ kind: 'block', amount: 5 }],
      tails: { mode: 'any', effects: [{ kind: 'block', amount: 3 }] }
    },
    'burning-strike': {
      id: id<SkillId>('burning-strike'),
      name: '불타는 일격',
      type: 'flip',
      rarity: 'common',
      tags: ['attack'],
      targetType: 'single-enemy',
      cost: 2,
      base: [
        { kind: 'damage', amount: 8 },
        { kind: 'addCoin', coin: id<CoinDefId>('fire'), zone: 'discard', count: 1 }
      ],
      heads: { mode: 'per', effects: [{ kind: 'damage', amount: 3 }] }
    },
    ignite: {
      id: id<SkillId>('ignite'),
      name: '점화',
      type: 'flip',
      rarity: 'common',
      tags: ['attack'],
      targetType: 'single-enemy',
      cost: 1,
      base: [{ kind: 'applyStatus', status: 'burn', stacks: 1, to: 'target' }],
      heads: { mode: 'any', effects: [{ kind: 'applyStatus', status: 'burn', stacks: 1, to: 'target' }] },
      tails: { mode: 'any', effects: [{ kind: 'damage', amount: 3 }] }
    }
  },
  enemies: {
    raider: {
      id: id('raider'),
      name: '약탈자',
      maxHp: 75,
      intents: [
        { id: 'slam', actions: [{ kind: 'attack', damage: 11 }] },
        { id: 'double', actions: [{ kind: 'attack', damage: 4 }, { kind: 'attack', damage: 4 }] }
      ]
    }
  },
  characters: {
    warrior: {
      id: id('warrior'),
      name: '전사',
      maxHp: 70,
      startingBag: Array.from({ length: 10 }, () => id<CoinDefId>('basic')),
      startingSkills: [id<SkillId>('slash'), id<SkillId>('guard'), id<SkillId>('burning-strike'), id<SkillId>('ignite')],
      trait: {
        id: 'ember-pouch',
        name: '불씨 주머니',
        hook: 'combatStart',
        effects: []
      }
    }
  },
  validate: () => []
});

const replaceFlipRng = (state: CombatState, faces: readonly ('heads' | 'tails')[]): CombatState => ({
  ...state,
  rngImpl: { ...state.rngImpl, flip: scriptedFlips(faces) }
});

const firstHandCoin = (state: CombatState): CoinUid => {
  const coin = state.zones.hand[0];
  if (coin === undefined) throw new Error('missing hand coin');
  return coin;
};

const useFirstCoin = (state: CombatState, slotIndex: number, target = 0, db = testDb()) => {
  const placed = step(state, { type: 'placeCoin', coin: firstHandCoin(state), slot: slot(slotIndex) }, db);
  if (!placed.ok) throw new Error(placed.error);
  const used = step(placed.state, { type: 'useFlipSkill', slot: slot(slotIndex), target }, db);
  if (!used.ok) throw new Error(used.error);
  return used;
};

const useHandCoins = (state: CombatState, slotIndex: number, coins: readonly CoinUid[], target = 0, db = testDb()) => {
  let current = state;
  for (const coin of coins) {
    const placed = step(current, { type: 'placeCoin', coin, slot: slot(slotIndex) }, db);
    if (!placed.ok) throw new Error(placed.error);
    current = placed.state;
  }
  const used = step(current, { type: 'useFlipSkill', slot: slot(slotIndex), target }, db);
  if (!used.ok) throw new Error(used.error);
  return used;
};

const withHandDefs = (state: CombatState, defs: readonly string[]): CombatState => {
  const updates = Object.fromEntries(
    defs.map((defId, index) => {
      const coin = state.zones.hand[index];
      if (coin === undefined) throw new Error('missing hand coin');
      return [Number(coin), { ...state.coins[Number(coin)]!, defId: id<CoinDefId>(defId) }];
    })
  );
  return { ...state, coins: { ...state.coins, ...updates } };
};

describe('combat golden traces', () => {
  it('slash deals 10 on heads and 6 on tails', () => {
    const db = testDb();
    const headsState = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'golden'), [
      'heads'
    ]);
    expect(useFirstCoin(headsState, 0).state.enemies[0]?.hp).toBe(65);

    const tailsState = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'golden'), [
      'tails'
    ]);
    expect(useFirstCoin(tailsState, 0).state.enemies[0]?.hp).toBe(69);
  });

  it('slash with a fire coin applies burn only on heads', () => {
    const db = testDb();
    const headsState = withHandDefs(
      replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'slash-fire'), ['heads']),
      ['fire']
    );
    const heads = useFirstCoin(headsState, 0);
    expect(heads.state.enemies[0]?.hp).toBe(65);
    expect(heads.state.enemies[0]?.statuses.burn).toBe(1);

    const tailsState = withHandDefs(
      replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'slash-fire'), ['tails']),
      ['fire']
    );
    const tails = useFirstCoin(tailsState, 0);
    expect(tails.state.enemies[0]?.hp).toBe(69);
    expect(tails.state.enemies[0]?.statuses.burn ?? 0).toBe(0);
  });

  it('guard gains 5 on heads and 8 on tails', () => {
    const db = testDb();
    const headsState = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'golden'), [
      'heads'
    ]);
    expect(useFirstCoin(headsState, 1).state.player.block).toBe(5);

    const tailsState = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'golden'), [
      'tails'
    ]);
    expect(useFirstCoin(tailsState, 1).state.player.block).toBe(8);
  });

  it('burning strike deals per-head damage and creates a temporary fire coin in discard', () => {
    const db = testDb();
    const cases: Array<[readonly ('heads' | 'tails')[], number]> = [
      [['heads', 'heads'], 61],
      [['heads', 'tails'], 64],
      [['tails', 'tails'], 67]
    ];

    for (const [faces, hp] of cases) {
      const state = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, `burning-${faces.join('')}`), faces);
      const result = useHandCoins(state, 2, state.zones.hand.slice(0, 2));
      expect(result.state.enemies[0]?.hp).toBe(hp);
      const created = result.events.find((event) => event.type === 'coinCreated');
      expect(created).toMatchObject({ type: 'coinCreated', defId: 'fire', zone: 'discard' });
      if (created?.type === 'coinCreated') {
        expect(result.state.coins[Number(created.coin)]?.permanent).toBe(false);
        expect(result.state.zones.discard).toContain(created.coin);
      }
    }
  });

  it('burning strike with two fire coins applies burn per coin', () => {
    const db = testDb();
    const state = withHandDefs(
      replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'burning-fire'), [
        'heads',
        'heads'
      ]),
      ['fire', 'fire']
    );
    const result = useHandCoins(state, 2, state.zones.hand.slice(0, 2));
    expect(result.state.enemies[0]?.hp).toBe(61);
    expect(result.state.enemies[0]?.statuses.burn).toBe(2);
  });

  it('ignite applies base burn, face effects, and fire coin proc', () => {
    const db = testDb();
    const headsState = withHandDefs(
      replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'ignite'), ['heads']),
      ['fire']
    );
    const heads = useFirstCoin(headsState, 3);
    expect(heads.state.enemies[0]?.statuses.burn).toBe(3);

    const tailsState = withHandDefs(
      replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'ignite'), ['tails']),
      ['fire']
    );
    const tails = useFirstCoin(tailsState, 3);
    expect(tails.state.enemies[0]?.statuses.burn).toBe(1);
    expect(tails.state.enemies[0]?.hp).toBe(72);
  });
});

describe('combat determinism and D0', () => {
  it('replays identical events for the same seed and commands', () => {
    const db = testDb();
    const run = () => {
      let state = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'same-seed');
      const coin = firstHandCoin(state);
      const commands: Command[] = [
        { type: 'placeCoin', coin, slot: slot(0) },
        { type: 'useFlipSkill', slot: slot(0), target: 0 },
        { type: 'endTurn' }
      ];
      return commands.flatMap((cmd) => {
        const result = step(state, cmd, db);
        expect(result.ok).toBe(true);
        if (!result.ok) return [];
        state = result.state;
        return result.events;
      });
    };

    expect(run()).toEqual(run());
  });

  it('rejects same skill twice and fourth skill use, then resets next turn', () => {
    const db = testDb();
    let state = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'd0'), [
      'heads',
      'heads',
      'heads'
    ]);
    const first = useFirstCoin(state, 0);
    state = first.state;

    const sameSkill = step(state, { type: 'placeCoin', coin: firstHandCoin(state), slot: slot(0) }, db);
    expect(sameSkill.ok && step(sameSkill.state, { type: 'useFlipSkill', slot: slot(0), target: 0 }, db).ok).toBe(
      false
    );

    const second = useFirstCoin(state, 1);
    state = second.state;
    state.slots[2] = { skillId: id<SkillId>('slash'), usedThisTurn: false, usedThisCombat: false };
    state.slots[3] = { skillId: id<SkillId>('guard'), usedThisTurn: false, usedThisCombat: false };
    state = useFirstCoin(state, 2).state;
    const fourthPlaced = step(state, { type: 'placeCoin', coin: firstHandCoin(state), slot: slot(3) }, db);
    expect(fourthPlaced.ok).toBe(true);
    if (fourthPlaced.ok) {
      expect(step(fourthPlaced.state, { type: 'useFlipSkill', slot: slot(3), target: 0 }, db).ok).toBe(false);
    }

    const ended = step(state, { type: 'endTurn' }, db);
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.state.skillUsesThisTurn).toBe(0);
      expect(ended.state.slots.every((s) => !s.usedThisTurn)).toBe(true);
    }
  });
});

describe('draw and win loss', () => {
  it('draws 5, reshuffles discard when draw is depleted, and permits partial draw', () => {
    const db = testDb();
    let state = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'draw');
    expect(state.zones.hand).toHaveLength(5);

    state = {
      ...state,
      zones: { ...state.zones, hand: [], draw: [], discard: [1 as CoinUid, 2 as CoinUid, 3 as CoinUid], exhausted: [] }
    };
    const ended = step(state, { type: 'endTurn' }, db);
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.state.zones.hand).toHaveLength(3);
    }
  });

  it('ends on enemy hp zero, player hp zero, and checks after each atom', () => {
    const db = testDb();
    const state = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'win'), [
      'heads'
    ]);
    state.enemies[0]!.hp = 10;
    expect(useFirstCoin(state, 0).state.phase).toBe('victory');

    const losing = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'loss');
    const lost = step({ ...losing, player: { ...losing.player, hp: 1 } }, { type: 'endTurn' }, db);
    expect(lost.ok).toBe(true);
    if (lost.ok) expect(lost.state.phase).toBe('defeat');
  });

  it('enemy burn ticks through block and decays by one', () => {
    const db = testDb();
    db.enemies.raider = {
      ...db.enemies.raider!,
      intents: [{ id: 'brace', actions: [{ kind: 'block', amount: 99 }] }]
    };
    const state = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'burn-tick');
    state.enemies[0] = { ...state.enemies[0]!, statuses: { burn: 3 } };
    const ended = step(state, { type: 'endTurn' }, db);
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.state.enemies[0]?.hp).toBe(72);
      expect(ended.state.enemies[0]?.block).toBe(99);
      expect(ended.state.enemies[0]?.statuses.burn).toBe(2);
    }
  });

  it('ember pouch adds one temporary fire coin to draw before the opening draw and emits an event', () => {
    const db = testDb();
    db.characters.warrior = {
      ...db.characters.warrior!,
      startingBag: [...Array.from({ length: 8 }, () => id<CoinDefId>('basic')), id<CoinDefId>('fire'), id<CoinDefId>('fire')],
      trait: {
        id: 'ember-pouch',
        name: '불씨 주머니',
        hook: 'combatStart',
        effects: [{ kind: 'addCoin', coin: id<CoinDefId>('fire'), zone: 'draw', count: 1 }]
      }
    };
    const state = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'ember');
    const allCoins = [...state.zones.draw, ...state.zones.hand];
    const fireCoins = allCoins.filter((coin) => state.coins[Number(coin)]?.defId === 'fire');
    const temporaryFire = fireCoins.filter((coin) => state.coins[Number(coin)]?.permanent === false);

    expect(allCoins).toHaveLength(11);
    expect(fireCoins).toHaveLength(3);
    expect(temporaryFire).toHaveLength(1);
    expect(state.events.some((event) => event.type === 'traitTriggered' && event.trait === 'ember-pouch')).toBe(true);
  });

  it('addCoin to hand over the cap sends overflow to discard', () => {
    const db = testDb();
    db.skills.slash = {
      ...(db.skills.slash as FlipSkillDef),
      base: [{ kind: 'addCoin', coin: id<CoinDefId>('fire'), zone: 'hand', count: 1 }],
      heads: undefined
    };
    const state = replaceFlipRng(createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'hand-cap'), [
      'tails'
    ]);
    const extra = [11, 12, 13, 14, 15, 16].map((value) => value as CoinUid);
    const capped = {
      ...state,
      nextUid: 17,
      zones: { ...state.zones, hand: [...state.zones.hand, ...extra] },
      coins: {
        ...state.coins,
        ...Object.fromEntries(extra.map((coin) => [Number(coin), { uid: coin, defId: id<CoinDefId>('basic'), permanent: true, grants: [] }]))
      }
    };
    const result = useFirstCoin(capped, 0, 0, db);
    expect(result.state.zones.hand).toHaveLength(10);
    const created = result.events.find((event) => event.type === 'coinCreated');
    expect(created).toMatchObject({ type: 'coinCreated', zone: 'discard' });
  });

  it('addCoin to draw consumes the shuffle stream deterministically', () => {
    const db = testDb();
    db.characters.warrior = {
      ...db.characters.warrior!,
      trait: {
        id: 'ember-pouch',
        name: '불씨 주머니',
        hook: 'combatStart',
        effects: [{ kind: 'addCoin', coin: id<CoinDefId>('fire'), zone: 'draw', count: 1 }]
      }
    };

    const first = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'shuffle-consume');
    const second = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, 'shuffle-consume');
    expect(first.rng.shuffle).toEqual(second.rng.shuffle);
    expect(first.zones.draw).toEqual(second.zones.draw);
    expect(first.rng.shuffle).not.toEqual(createCombat({ character: id('warrior'), enemies: [id('raider')] }, testDb(), 'shuffle-consume').rng.shuffle);
  });
});

describe('combat fuzz smoke', () => {
  it('keeps core invariants for 100 deterministic games', () => {
    const db = testDb();
    for (let game = 0; game < 100; game += 1) {
      let state = createCombat({ character: id('warrior'), enemies: [id('raider')] }, db, `fuzz-${game}`);
      for (let i = 0; i < 50 && state.phase === 'player'; i += 1) {
        const legal = legalCommands(state, db);
        const cmd =
          legal.find((candidate) => candidate.type === 'useFlipSkill') ??
          legal.find((candidate) => candidate.type === 'placeCoin') ??
          ({ type: 'endTurn' } as Command);
        const result = step(state, cmd, db);
        expect(result.ok).toBe(true);
        if (!result.ok) break;
        state = result.state;
        expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
        expect(state.player.block).toBeGreaterThanOrEqual(0);
        expect(Object.keys(state.coins).length).toBeGreaterThanOrEqual(10);
        expect(zoneCoinCount(state.zones)).toBe(Object.keys(state.coins).length);
      }
    }
  });
});

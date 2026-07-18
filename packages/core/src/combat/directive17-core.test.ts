import { describe, expect, it } from 'vitest';

import { validateContentDb } from '../content-types';
import type { ContentDb, EnemyDef } from '../content-types';
import type { CharacterId, CoinDefId, EnemyDefId } from '../ids';
import { runEnemyPhase } from './enemy';
import { setFurnaceTemperature } from './furnace';
import { applyDamage, applyEffectAtom } from './resolve/flip';
import { createCombat } from './reducer';
import type { CombatEvent } from './events';
import type { CombatState } from './state';

const id = <T extends string>(value: string) => value as T;

const enemy = (value: string, overrides: Partial<EnemyDef> = {}): EnemyDef => ({
  id: id<EnemyDefId>(value),
  name: value,
  maxHp: 100,
  intents: [{ id: 'idle', actions: [] }],
  ...overrides
});

const db = (enemies: Record<string, EnemyDef>): ContentDb => ({
  coins: { basic: { id: id<CoinDefId>('basic'), element: null } },
  skills: {},
  enemies,
  characters: {
    hero: {
      id: id<CharacterId>('hero'), name: 'Hero', maxHp: 70,
      startingBag: Array.from({ length: 10 }, () => id<CoinDefId>('basic')),
      startingSkills: [],
      trait: { id: 'none', name: 'None', hook: 'combatStart', effects: [] }
    }
  },
  validate: () => []
});

const combat = (content: ContentDb, enemyIds: readonly string[]): CombatState =>
  createCombat({ character: id<CharacterId>('hero'), enemies: enemyIds.map((value) => id<EnemyDefId>(value)) }, content, 'd17-core');

describe('Directive 17 core contracts', () => {
  it('clamps furnace mutations, records their reason, and cancels a resource-gated windup immediately', () => {
    const content = db({
      duke: enemy('duke', {
        furnace: {
          initialTemperature: 6, maxTemperature: 6, playerBurnClearLoss: 2,
          atMaxIntent: {
            id: 'coronation', windup: { turns: 1, revealAtStart: true },
            cancelOn: { kind: 'enemyResourceAtMost', resource: 'furnaceTemperature', value: 5 },
            onCancelActions: [{ kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 3, reason: 'coronationCancelled' }],
            actions: [{ kind: 'attack', damage: 24 }]
          }
        },
        intents: [{
          id: 'idle',
          actions: []
        }]
      })
    });
    const selected = runEnemyPhase(combat(content, ['duke']), content).state;
    expect(selected.enemies[0]?.intent.id).toBe('coronation');
    const started = runEnemyPhase(selected, content).state;
    const events: CombatEvent[] = [];
    const cooled = applyEffectAtom(
      { ...started, player: { ...started.player, statuses: { burn: { kind: 'stack', stacks: 1 } } } },
      { kind: 'removeStatus', status: 'burn', stacks: 1, to: 'self' },
      { type: 'player' }, content, events
    );

    expect(cooled.enemies[0]).toMatchObject({ furnaceTemperature: 3, windup: undefined, cancelledWindupIntentId: 'coronation' });
    expect(events).toContainEqual({ type: 'enemyFurnaceChanged', enemy: 0, before: 6, after: 4, reason: 'playerBurnCleared' });
    expect(events).toContainEqual({ type: 'enemyFurnaceChanged', enemy: 0, before: 4, after: 3, reason: 'coronationCancelled' });
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemyWindupCancelled', enemy: 0 }));
    expect(runEnemyPhase(cooled, content).state.enemies[0]?.intent.id).toBe('idle');
  });

  it('binds vassal guards to the summoning source UID and applies the capped reduction at target damage modification', () => {
    const content = db({
      duke: enemy('duke', { intents: [{ id: 'call', actions: [{ kind: 'summonEnemies', enemy: id<EnemyDefId>('vassal'), maxCount: 2 }] }] }),
      vassal: enemy('vassal', { vassalGuard: { source: id<EnemyDefId>('duke'), damageReductionPercent: 0.15, maxSources: 2 } })
    });
    const summoned = runEnemyPhase(combat(content, ['duke']), content).state;
    const events: CombatEvent[] = [];
    const damaged = applyDamage(summoned, { type: 'enemy', index: 0 }, 100, 'skill', events, { type: 'player' });

    expect(damaged.enemies[0]?.hp).toBe(30);
    expect(damaged.enemies.slice(1).every((unit) => unit.vassalGuard?.sourceEnemyUid === damaged.enemies[0]?.enemyUid)).toBe(true);
  });

  it('applies the same additive vassal guard reduction to burn and poison damage', () => {
    const content = db({
      duke: enemy('duke', { intents: [{ id: 'call', actions: [{ kind: 'summonEnemies', enemy: id<EnemyDefId>('vassal'), maxCount: 2 }] }] }),
      vassal: enemy('vassal', { vassalGuard: { source: id<EnemyDefId>('duke'), damageReductionPercent: 0.15, maxSources: 2 } })
    });
    const summoned = runEnemyPhase(combat(content, ['duke']), content).state;
    const events: CombatEvent[] = [];
    const burned = applyDamage(summoned, { type: 'enemy', index: 0 }, 10, 'burn', events);
    const poisoned = applyDamage(burned, { type: 'enemy', index: 0 }, 10, 'poison', events);

    expect(burned.enemies[0]?.hp).toBe(93);
    expect(poisoned.enemies[0]?.hp).toBe(86);
  });

  it('breaks an armed Coronation before phase resolution and reveals the new phase without attacking', () => {
    const coronation = {
      id: 'coronation',
      windup: { turns: 1 as const, revealAtStart: true as const },
      cancelOn: { kind: 'enemyResourceAtMost' as const, resource: 'furnaceTemperature' as const, value: 5 },
      onCancelActions: [{ kind: 'setEnemyResource' as const, resource: 'furnaceTemperature' as const, value: 3, reason: 'coronationCancelled' as const }],
      actions: [{ kind: 'attack' as const, damage: 24 }, { kind: 'applyStatus' as const, status: 'burn' as const, stacks: 3 }]
    };
    const content = db({ duke: enemy('duke', {
      furnace: {
        initialTemperature: 6,
        maxTemperature: 6,
        playerDamageThreshold: { phaseEntryHpFraction: 0.15, loss: 1 },
        atMaxIntent: coronation
      },
      intents: [{ id: 'phase-one', actions: [] }],
      phases: [{
        hpBelowFraction: 0.7,
        transitionBeforeAction: true,
        intents: [{ id: 'phase-two', actions: [] }],
        onEnterActions: [{ kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 2, reason: 'phaseEntered' }]
      }]
    }) });
    const selected = runEnemyPhase(combat(content, ['duke']), content).state;
    const armed = runEnemyPhase(selected, content).state;
    const crossedEvents: CombatEvent[] = [];
    const crossed = applyDamage(
      { ...armed, enemies: armed.enemies.map((unit) => ({ ...unit, hp: 71 })) },
      { type: 'enemy', index: 0 }, 2, 'skill', crossedEvents, { type: 'player' }
    );
    const transitioned = runEnemyPhase(crossed, content);

    expect(transitioned.state.player).toMatchObject({ hp: 70, statuses: {} });
    expect(transitioned.state.enemies[0]).toMatchObject({ phaseIndex: 0, furnaceTemperature: 2, windup: undefined, intent: { id: 'phase-two' } });
    expect(transitioned.events).toContainEqual(expect.objectContaining({ type: 'enemyWindupCancelled', enemy: 0, intent: expect.objectContaining({ id: 'coronation' }) }));
    expect(transitioned.events.filter((event) => event.type === 'enemyFurnaceChanged' && event.reason === 'phaseEntered')).toHaveLength(1);
    expect(transitioned.events.some((event) => event.type === 'damageDealt' && event.target.type === 'player')).toBe(false);
  });

  it('keeps ordinary phased enemies on legacy resolve-then-transition ordering', () => {
    const content = db({
      bruiser: enemy('bruiser', {
        intents: [{ id: 'current-swing', actions: [{ kind: 'attack', damage: 5 }] }],
        phases: [{ hpBelowFraction: 0.7, intents: [{ id: 'phase-two', actions: [] }] }]
      })
    });
    const initial = combat(content, ['bruiser']);
    const crossed = { ...initial, enemies: initial.enemies.map((unit) => ({ ...unit, hp: 69 })) };
    const resolved = runEnemyPhase(crossed, content);

    expect(resolved.state.player.hp).toBe(65);
    expect(resolved.state.enemies[0]).toMatchObject({ phaseIndex: 0, intent: { id: 'phase-two' } });
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'damageDealt', target: { type: 'player' }, amount: 5 }));
    expect(resolved.events).toContainEqual({ type: 'enemyPhaseChanged', enemy: 0 });
  });

  it('runs phase entry actions once and pins the phase-entry furnace cap for later threshold calculations', () => {
    const content = db({
      duke: enemy('duke', {
        furnace: { initialTemperature: 0, maxTemperature: 6 },
        phases: [{
          hpBelowFraction: 0.7,
          transitionBeforeAction: true,
          intents: [{ id: 'phase-two', actions: [] }],
          onEnterActions: [{ kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 2, reason: 'phaseEntered' }]
        }, {
          hpBelowFraction: 0.35,
          transitionBeforeAction: true,
          intents: [{ id: 'phase-three', actions: [] }],
          growthOnActionResolved: { amount: 1, maxStacks: 5 },
          onEnterActions: [{ kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 2, reason: 'phaseEntered' }]
        }]
      })
    });
    const initial = combat(content, ['duke']);
    const crossed = { ...initial, enemies: initial.enemies.map((unit) => ({ ...unit, hp: 69 })) };
    const changed = runEnemyPhase(crossed, content);
    const repeated = runEnemyPhase(changed.state, content);

    expect(changed.state.enemies[0]).toMatchObject({ phaseIndex: 0, furnaceTemperature: 2, furnacePhaseEntryHp: 70 });
    expect(changed.events.filter((event) => event.type === 'enemyFurnaceChanged' && event.reason === 'phaseEntered')).toHaveLength(1);
    expect(repeated.events.filter((event) => event.type === 'enemyFurnaceChanged' && event.reason === 'phaseEntered')).toHaveLength(0);
    const third = runEnemyPhase({ ...changed.state, enemies: changed.state.enemies.map((unit) => ({ ...unit, hp: 34 })) }, content);
    const grown = runEnemyPhase(third.state, content);
    expect(third.state.enemies[0]).toMatchObject({ phaseIndex: 1, furnacePhaseEntryHp: 35 });
    expect(grown.state.enemies[0]?.growthStacks).toBe(1);
  });

  it('applies furnace burn gains and burn-clear losses at most once per player turn', () => {
    const content = db({ duke: enemy('duke', { furnace: { initialTemperature: 3, maxTemperature: 6, playerBurnDamageGain: 1, playerBurnClearLoss: 2 } }) });
    const events: CombatEvent[] = [];
    const onceBurned = applyDamage(combat(content, ['duke']), { type: 'player' }, 1, 'burn', events);
    const twiceBurned = applyDamage(onceBurned, { type: 'player' }, 1, 'burn', events);
    const onceCleared = applyEffectAtom(
      { ...twiceBurned, player: { ...twiceBurned.player, statuses: { burn: { kind: 'stack', stacks: 2 } } } },
      { kind: 'removeStatus', status: 'burn', stacks: 1, to: 'self' }, { type: 'player' }, content, events
    );
    const twiceCleared = applyEffectAtom(
      { ...onceCleared, player: { ...onceCleared.player, statuses: { burn: { kind: 'stack', stacks: 1 } } } },
      { kind: 'removeStatus', status: 'burn', stacks: 1, to: 'self' }, { type: 'player' }, content, events
    );

    expect(twiceCleared.enemies[0]?.furnaceTemperature).toBe(2);
    expect(events.filter((event) => event.type === 'enemyFurnaceChanged' && event.reason === 'playerBurnDamaged')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'enemyFurnaceChanged' && event.reason === 'playerBurnCleared')).toHaveLength(1);
  });

  it('applies automatic furnace gain before an intent-level temperature pin', () => {
    const coronation = { id: 'coronation', windup: { turns: 1 as const, revealAtStart: true as const }, actions: [{ kind: 'attack' as const, damage: 1 }, { kind: 'setEnemyResource' as const, resource: 'furnaceTemperature' as const, value: 3, reason: 'coronationCancelled' as const }] };
    const content = db({ duke: enemy('duke', { furnace: { initialTemperature: 6, maxTemperature: 6, actionResolvedGain: 1 }, intents: [coronation] }) });
    const initial = combat(content, ['duke']);
    const resolved = runEnemyPhase({ ...initial, enemies: initial.enemies.map((unit) => ({ ...unit, windup: { intent: coronation, turnsLeft: 1, startHp: unit.hp } })) }, content);

    expect(resolved.state.enemies[0]?.furnaceTemperature).toBe(3);
    expect(resolved.events).not.toContainEqual({ type: 'enemyFurnaceChanged', enemy: 0, before: 6, after: 6, reason: 'enemyActionResolved' });
    expect(resolved.events).toContainEqual({ type: 'enemyFurnaceChanged', enemy: 0, before: 6, after: 3, reason: 'coronationCancelled' });
  });

  it('suppresses clamped no-op furnace events while still evaluating resource cancellation', () => {
    const intent = {
      id: 'resource-gated',
      actions: [],
      cancelOn: { kind: 'enemyResourceAtMost' as const, resource: 'furnaceTemperature' as const, value: 6 }
    };
    const content = db({ duke: enemy('duke', { furnace: { initialTemperature: 6, maxTemperature: 6 }, intents: [intent] }) });
    const initial = combat(content, ['duke']);
    const armed = { ...initial, enemies: initial.enemies.map((unit) => ({ ...unit, windup: { intent, turnsLeft: 1, startHp: unit.hp } })) };
    const events: CombatEvent[] = [];
    const unchanged = setFurnaceTemperature(armed, 0, 6, 'enemyActionResolved', events);

    expect(events.filter((event) => event.type === 'enemyFurnaceChanged')).toHaveLength(0);
    expect(events).toContainEqual(expect.objectContaining({ type: 'enemyWindupCancelled', enemy: 0 }));
    expect(unchanged.enemies[0]?.windup).toBeUndefined();
  });

  it('materializes runtime cancelThreshold from a skillDamage predicate inside an OR list', () => {
    const intent = {
      id: 'charged-hit',
      windup: { turns: 1 as const, revealAtStart: true as const },
      cancelOn: [
        { kind: 'enemyResourceAtMost' as const, resource: 'furnaceTemperature' as const, value: 0 },
        { kind: 'skillDamage' as const, threshold: 6 }
      ],
      actions: [{ kind: 'attack' as const, damage: 8 }]
    };
    const content = db({ duke: enemy('duke', { furnace: { initialTemperature: 1, maxTemperature: 6 }, intents: [intent] }) });
    const started = runEnemyPhase(combat(content, ['duke']), content);

    expect(started.state.enemies[0]?.windup?.cancelThreshold).toBe(6);
    expect(started.events).toContainEqual({ type: 'enemyWindupStarted', enemy: 0, intent, turnsLeft: 1, cancelThreshold: 6 });
  });

  it('accumulates actual skill HP damage across a player turn before applying the phase-cap threshold once', () => {
    const content = db({ duke: enemy('duke', { furnace: { initialTemperature: 3, maxTemperature: 6, playerDamageThreshold: { phaseEntryHpFraction: 0.15, loss: 1 } } }) });
    const events: CombatEvent[] = [];
    const initial = combat(content, ['duke']);
    const crossed = applyDamage(applyDamage(initial, { type: 'enemy', index: 0 }, 14, 'skill', events, { type: 'player' }), { type: 'enemy', index: 0 }, 13, 'skill', events, { type: 'player' });
    const belowEvents: CombatEvent[] = [];
    const below = applyDamage(applyDamage(combat(content, ['duke']), { type: 'enemy', index: 0 }, 7, 'skill', belowEvents, { type: 'player' }), { type: 'enemy', index: 0 }, 7, 'skill', belowEvents, { type: 'player' });

    expect(crossed.enemies[0]?.furnaceTemperature).toBe(2);
    expect(events.filter((event) => event.type === 'enemyFurnaceChanged' && event.reason === 'playerDamageThreshold')).toHaveLength(1);
    expect(below.enemies[0]?.furnaceTemperature).toBe(3);
  });

  it('rejects the legacy untagged cancelOn shape at validation boundaries', () => {
    const invalid = db({ duke: enemy('duke', { intents: [{ id: 'legacy', actions: [], cancelOn: { kind: 'skillDamage', threshold: 1 } }] }) });
    (invalid.enemies.duke!.intents[0] as { cancelOn: unknown }).cancelOn = { damageThreshold: 1 };

    expect(validateContentDb(invalid)).toContain('enemy duke intent legacy: cancelOn must use a discriminated predicate');
  });
});

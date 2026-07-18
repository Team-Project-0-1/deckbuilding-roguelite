import { generateRunGraph, nodeGoldReward } from '@game/core';
import { describe, expect, it } from 'vitest';

import { contentDb, enemies } from './index';

const directive17Enemies = enemies as Record<string, unknown>;

describe('Directive 17 Ash Duke Valdemar content contract', () => {
  it('declares the approved furnace, phase-one attacks, and cancellable Coronation', () => {
    expect(directive17Enemies['ash-duke-valdemar']).toMatchObject({
      id: 'ash-duke-valdemar',
      maxHp: 180,
      furnace: {
        initialTemperature: 0,
        maxTemperature: 6,
        actionResolvedGain: 1,
        playerBurnDamageGain: 1,
        playerBurnClearLoss: 2,
        playerDamageThreshold: { phaseEntryHpFraction: 0.15, loss: 1 },
        atMaxIntent: {
          id: 'coronation',
          windup: { turns: 1, revealAtStart: true },
          cancelOn: { kind: 'enemyResourceAtMost', resource: 'furnaceTemperature', value: 5 },
          actions: [
            { kind: 'attack', damage: 24, damagePerGrowthPercent: 0.08 },
            { kind: 'applyStatus', status: 'burn', stacks: 3 },
            { kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 3, reason: 'coronationResolved' }
          ],
          onCancelActions: [
            { kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 3 },
            { kind: 'reduceGrowthStacks', amount: 2 }
          ]
        }
      },
      intents: [
        {
          id: 'burning-slash',
          actions: [
            { kind: 'attack', damage: 10 },
            { kind: 'applyStatus', status: 'burn', stacks: 1, requiresLastAttackHpDamage: true }
          ]
        },
        {
          id: 'ember-brand',
          windup: { turns: 1, revealAtStart: true },
          actions: [{ kind: 'applyStatus', status: 'burn', stacks: 2 }]
        }
      ]
    });
  });

  it('declares the phase-entry effects, ash-vassal guard, and final ember cap', () => {
    expect(directive17Enemies['ash-duke-valdemar']).toMatchObject({
      phases: [
        {
          hpBelowFraction: 0.7,
          transitionBeforeAction: true,
          onEnterActions: [
            { kind: 'removePlayerStatus', status: 'burn', stacks: 1 },
            { kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 2 },
            { kind: 'summonEnemies', enemy: 'ash-vassal', maxCount: 2 }
          ]
        },
        {
          hpBelowFraction: 0.35,
          transitionBeforeAction: true,
          onEnterActions: [{ kind: 'setEnemyResource', resource: 'furnaceTemperature', value: 2 }],
          growthOnActionResolved: { amount: 1, maxStacks: 5 },
          intents: [
            {
              id: 'burning-slash',
              actions: [
                { kind: 'attack', damage: 10, damagePerGrowthPercent: 0.08 },
                { kind: 'applyStatus', status: 'burn', stacks: 1, requiresLastAttackHpDamage: true }
              ]
            },
            {
              id: 'ember-brand',
              windup: { turns: 1, revealAtStart: true },
              actions: [{ kind: 'applyStatus', status: 'burn', stacks: 2 }]
            }
          ]
        }
      ]
    });
    expect(directive17Enemies['ash-vassal']).toMatchObject({
      id: 'ash-vassal',
      maxHp: 24,
      vassalGuard: { source: 'ash-duke-valdemar', damageReductionPercent: 0.15, maxSources: 2 },
      intents: [
        { id: 'ash-swipe', actions: [{ kind: 'attack', damage: 6 }] },
        {
          id: 'cinder-rake',
          actions: [
            { kind: 'attack', damage: 4 },
            { kind: 'applyStatus', status: 'burn', stacks: 1 }
          ]
        }
      ]
    });
    expect(contentDb.validate()).toEqual([]);
  });

  it('uses Valdemar at Act 3 visit 10 while retaining Ember Archmage as data and leaving the boss reward unchanged', () => {
    const graph = generateRunGraph('D17-VALDEMAR-GRAPH', contentDb);

    expect(graph.layers[29]?.[0]).toMatchObject({
      id: 'a3-v10-boss',
      kind: 'boss',
      encounter: ['ash-duke-valdemar']
    });
    expect(directive17Enemies['ember-archmage']).toBeDefined();
    expect(nodeGoldReward('boss')).toBe(100);
  });
});

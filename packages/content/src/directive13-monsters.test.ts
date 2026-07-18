import { describe, expect, it } from 'vitest';

import { generateRunGraph } from '@game/core';

import { contentDb, enemies } from './index';

describe('Directive 13 Batch C monster content', () => {
  it('defines M05 fortress guard with the approved highest-threat protection contract', () => {
    expect(enemies['fortress-guard']).toMatchObject({
      maxHp: 78,
      threat: 4,
      protectionLink: {
        target: 'highestThreatAlly',
        redirectFraction: 0.4,
        durability: 3,
        restoreDurability: 2,
        brokenTurns: 2,
        damageTakenMultiplierWhileBroken: 1.2
      }
    });
  });

  it('defines M06 gargoyle petrify, raw-damage shatter, cracked exposure, and falling assault', () => {
    expect(enemies['cathedral-gargoyle']).toMatchObject({
      maxHp: 68,
      petrify: {
        damageReduction: 0.7,
        shatterRawDamageFraction: 0.2,
        crackedTurns: 1,
        crackedDamageTakenMultiplier: 1.3,
        cancelWindupIntentId: 'falling-assault'
      },
      intents: expect.arrayContaining([
        { id: 'claw', actions: [{ kind: 'attack', damage: 7 }] },
        { id: 'petrify', entersPetrify: true, actions: [] },
        {
          id: 'falling-assault',
          windup: { turns: 1, revealAtStart: true },
          actions: [{ kind: 'attack', damage: 17 }]
        }
      ])
    });
  });

  it('defines M08 rider aura and two-turn royal march with an eight-percent ally shield', () => {
    expect(enemies['war-banner-rider']).toMatchObject({
      maxHp: 48,
      threat: 3,
      warBanner: {
        attackAuraPercent: 0.1,
        march: { attackPercent: 0.2, turns: 2, shieldMaxHpFraction: 0.08 }
      },
      intents: expect.arrayContaining([
        { id: 'banner-strike', actions: [{ kind: 'attack', damage: 6 }] },
        {
          id: 'royal-march',
          windup: { turns: 1, revealAtStart: true },
          groupMarch: true,
          actions: []
        }
      ])
    });
  });

  it('keeps Directive 13 Batch C monster content schema-valid', () => {
    expect(contentDb.validate()).toEqual([]);
  });

  it('offers Batch C only after Act 1 and never exceeds three enemies per encounter', () => {
    const batchC = new Set(['fortress-guard', 'cathedral-gargoyle', 'war-banner-rider']);
    const seen = new Set<string>();

    for (let seed = 0; seed < 160; seed += 1) {
      const graph = generateRunGraph(`directive13-batch-c-${seed}`, contentDb);
      for (const [layerIndex, layer] of graph.layers.entries()) {
        for (const node of layer) {
          if (node.kind !== 'combat' || node.encounter === undefined) continue;
          expect(node.encounter.length).toBeLessThanOrEqual(3);
          for (const enemy of node.encounter) {
            if (batchC.has(String(enemy))) {
              expect(layerIndex).toBeGreaterThanOrEqual(10);
              seen.add(String(enemy));
            }
          }
        }
      }
    }

    expect(seen).toEqual(batchC);
  });
});

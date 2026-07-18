import { describe, expect, it } from 'vitest';

import { generateRunGraph } from '@game/core';

import { contentDb, enemies } from './index';

describe('Directive 15 elite content contract', () => {
  it('declares M17 repeat pressure entirely through generic enemy data', () => {
    expect(enemies['blackthorn-inquisitor-roderick']).toMatchObject({
      id: 'blackthorn-inquisitor-roderick',
      name: '검은가시 심문관 로데릭',
      maxHp: 96,
      repeatSkillPressure: {
        threshold: 3,
        maxZeal: 3,
        sameSkillGain: 1,
        differentSkillReset: 0,
        singleUsableZealEveryUses: 2,
        sealTurns: 1,
        executionIntent: {
          id: 'zeal-execution',
          windup: { turns: 1, revealAtStart: true },
          cancelOn: { damageThreshold: 15 },
          actions: [{ kind: 'attack', damage: 18 }, { kind: 'sealTriggeredSkill', turns: 1 }, { kind: 'resetRepeatSkillPressure' }]
        }
      },
      intents: [
        { id: 'warden-strike', actions: [{ kind: 'attack', damage: 8 }] },
        { id: 'warden-slash', actions: [{ kind: 'attack', damage: 10 }] }
      ]
    });
  });

  it('declares M18 tax, counterfeit, and seizure behavior through generic enemy data', () => {
    expect(enemies['fallen-kings-treasurer-marcel']).toMatchObject({
      id: 'fallen-kings-treasurer-marcel',
      name: '무너진 왕의 재무관 마르셀',
      maxHp: 92,
      coinSeizure: { target: 'mostNumerousPublicElementInHand', maxCoins: 2, capFraction: 0.5 },
      royalTax: {
        denomination: 2,
        deadline: 'endNextPlayerTurn',
        counterfeitCount: 2,
        defaultShield: 8,
        seizureAfterDefaults: 2,
        seizureIntent: {
          id: 'royal-seizure',
          windup: { turns: 1, revealAtStart: true },
          actions: [{ kind: 'seizeCustody' }, { kind: 'attack', damage: 4 }, { kind: 'resetRoyalTaxDefaults' }]
        }
      },
      intents: [
        { id: 'royal-tax', actions: [{ kind: 'royalTax', degradedDamage: 8 }] },
        { id: 'audit-eight', actions: [{ kind: 'attack', damage: 8 }] },
        { id: 'royal-tax-repeat', actions: [{ kind: 'royalTax', degradedDamage: 8 }] },
        { id: 'audit-six', actions: [{ kind: 'attack', damage: 6 }] }
      ]
    });
    expect(contentDb.validate()).toEqual([]);
  });

  it('offers the new elites only from Act 2 onward', () => {
    const batch = new Set(['blackthorn-inquisitor-roderick', 'fallen-kings-treasurer-marcel']);
    const seen = new Set<string>();
    for (let seed = 0; seed < 320; seed += 1) {
      for (const [layer, nodes] of generateRunGraph(`directive15-${seed}`, contentDb).layers.entries()) {
        for (const node of nodes) for (const enemy of node.encounter ?? []) {
          if (!batch.has(String(enemy))) continue;
          expect(layer).toBeGreaterThanOrEqual(10);
          seen.add(String(enemy));
        }
      }
    }
    expect(seen).toEqual(batch);
  });
});

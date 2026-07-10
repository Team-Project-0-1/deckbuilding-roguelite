import { describe, expect, it } from 'vitest';

import { expectedEncounterOrder, simulateRun } from './run-sim';

describe('M5 full-run simulator', () => {
  it('produces a byte-equivalent normalized summary for the same seed', () => {
    const first = JSON.stringify(simulateRun('42').summary);
    const second = JSON.stringify(simulateRun('42').summary);

    expect(second).toBe(first);
  });

  it('completes the deterministic five-combat run with boundary state intact', () => {
    const simulation = simulateRun('42');

    expect(simulation.summary.result).toBe('victory');
    expect(simulation.summary.combatsCompleted).toBe(5);
    expect(simulation.summary.encounterOrder).toEqual(expectedEncounterOrder());
    expect(simulation.combats).toHaveLength(5);
    for (let index = 0; index < simulation.combats.length; index += 1) {
      const combat = simulation.combats[index];
      if (combat === undefined) throw new Error('missing combat record');
      expect([...combat.permanentCoinsAtStart].sort()).toEqual([...combat.startingBag].sort());
      expect(combat.temporaryCoinsAtStart).toBe(1);
      if (index > 0) {
        expect(combat.startingHp).toBe(simulation.combats[index - 1]?.endingHp);
      }
    }

    expect(simulation.combats[1]?.startingBag.filter((coin) => coin === 'fire')).toHaveLength(3);
    expect(simulation.combats[1]?.startingBag.filter((coin) => coin === 'basic')).toHaveLength(7);
    expect(simulation.summary.finalBag).toHaveLength(10);
    expect(simulation.summary.finalEquippedSkills).toHaveLength(6);
    expect(simulation.summary.carriedHp).toBeGreaterThan(0);
    expect(simulation.summary).toEqual({
      seed: '42',
      result: 'victory',
      combatsCompleted: 5,
      turnsPerCombat: [4, 3, 4, 4, 5],
      carriedHp: 41,
      finalBag: ['basic', 'basic', 'basic', 'basic', 'fire', 'fire', 'fire', 'fire', 'fire', 'fire'],
      finalEquippedSkills: ['slash', 'guard', 'burning-strike', 'furnace', 'ignite-sword', 'smash'],
      encounterOrder: [['raider'], ['shaman'], ['gatekeeper'], ['raider-plus'], ['gatekeeper-plus']]
    });
  });
});

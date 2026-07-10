import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { derive, rngFrom, seedFromString } from './rng';

const flips = (seed: ReturnType<typeof seedFromString>, count: number) => {
  const rng = rngFrom(seed);
  return Array.from({ length: count }, () => rng.flip());
};

describe('rng', () => {
  it('replays the same seed', () => {
    const seed = seedFromString('BRAVE-EMBER-42');

    expect(flips(seed, 1_000)).toEqual(flips(seed, 1_000));
  });

  it('resumes from snapshots', () => {
    const original = rngFrom(seedFromString('BRAVE-EMBER-42'));
    for (let i = 0; i < 500; i += 1) {
      original.flip();
    }

    const resumed = rngFrom(original.snapshot());
    const originalNext = Array.from({ length: 500 }, () => original.flip());
    const resumedNext = Array.from({ length: 500 }, () => resumed.flip());

    expect(resumedNext).toEqual(originalNext);
  });

  it('keeps derived streams independent', () => {
    const seed = seedFromString('BRAVE-EMBER-42');
    const shuffleBefore = rngFrom(derive(seed, 'shuffle')).shuffle([1, 2, 3, 4, 5]);

    const flipRng = rngFrom(derive(seed, 'flip'));
    for (let i = 0; i < 1_000; i += 1) {
      flipRng.flip();
    }

    const shuffleAfter = rngFrom(derive(seed, 'shuffle')).shuffle([1, 2, 3, 4, 5]);
    expect(shuffleAfter).toEqual(shuffleBefore);
  });

  it('separates streams by label and index', () => {
    const seed = seedFromString('BRAVE-EMBER-42');

    expect(flips(derive(seed, 'flip'), 100)).not.toEqual(flips(derive(seed, 'ai'), 100));
    expect(flips(derive(seed, 'combat', 0), 100)).not.toEqual(
      flips(derive(seed, 'combat', 1), 100)
    );
  });

  it('uses attempt salt', () => {
    const combat = derive(seedFromString('BRAVE-EMBER-42'), 'combat', 0);

    expect(flips(derive(combat, 'attempt', 0), 100)).not.toEqual(
      flips(derive(combat, 'attempt', 1), 100)
    );
  });

  it('derives combat attempts without contaminating the reward stream', () => {
    const run = seedFromString('BRAVE-EMBER-42');
    const rewardBefore = rngFrom(derive(run, 'reward', 2)).shuffle(['basic', 'fire', 'mana']);

    expect(flips(derive(run, 'combat', 2, 0), 100)).not.toEqual(
      flips(derive(run, 'combat', 2, 1), 100)
    );

    const rewardAfter = rngFrom(derive(run, 'reward', 2)).shuffle(['basic', 'fire', 'mana']);
    expect(rewardAfter).toEqual(rewardBefore);
  });

  it('keeps int in range and shuffle preserves multisets', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 1, max: 1_000 }),
        fc.array(fc.integer({ min: -20, max: 20 }), { maxLength: 40 }),
        (seedText, n, xs) => {
          const rng = rngFrom(seedFromString(seedText));
          const value = rng.int(n);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(n);

          const shuffled = rng.shuffle(xs);
          expect([...shuffled].sort((a, b) => a - b)).toEqual([...xs].sort((a, b) => a - b));
        }
      )
    );
  });

  it('has a plausible flip distribution', () => {
    const rng = rngFrom(seedFromString('BRAVE-EMBER-42'));
    let heads = 0;

    for (let i = 0; i < 10_000; i += 1) {
      if (rng.flip() === 'heads') {
        heads += 1;
      }
    }

    const ratio = heads / 10_000;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });
});

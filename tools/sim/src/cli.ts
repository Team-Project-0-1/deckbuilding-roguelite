import { rngFrom, seedFromString } from '@game/core';

declare const process: {
  argv: string[];
};

const seedArgIndex = process.argv.indexOf('--seed');
const seedCandidate = seedArgIndex >= 0 ? process.argv[seedArgIndex + 1] : undefined;
const seed = seedCandidate ?? 'BRAVE-EMBER-42';

const rng = rngFrom(seedFromString(seed));
const flips = Array.from({ length: 20 }, () => rng.flip());
const shuffled = rng.shuffle(['copper', 'ember', 'frost', 'spark', 'blood']);

// M1 will extend this entry point into the combat simulation loop.
console.log(`seed: ${seed}`);
console.log(`flips: ${flips.join(', ')}`);
console.log(`shuffle: ${shuffled.join(', ')}`);

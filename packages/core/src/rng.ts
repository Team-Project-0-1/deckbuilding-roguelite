import type { Face } from './ids';

export interface RngSnapshot {
  readonly s: readonly [number, number, number, number];
}

export interface Rng {
  float(): number;
  int(nExclusive: number): number;
  flip(): Face;
  shuffle<T>(xs: readonly T[]): T[];
  snapshot(): RngSnapshot;
}

const UINT32_SIZE = 0x1_0000_0000;

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

const fnv1a = (s: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const splitmix32 = (seed: number): (() => number) => {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
};

const normalizeSnapshot = (snap: RngSnapshot): [number, number, number, number] => [
  snap.s[0] >>> 0,
  snap.s[1] >>> 0,
  snap.s[2] >>> 0,
  snap.s[3] >>> 0
];

export const seedFromString = (s: string): RngSnapshot => {
  const next = splitmix32(fnv1a(s));
  const state: [number, number, number, number] = [next(), next(), next(), next()];

  if (state.every((x) => x === 0)) {
    state[0] = 0x9e3779b9;
  }

  return { s: state };
};

export const rngFrom = (snap: RngSnapshot): Rng => {
  const state = normalizeSnapshot(snap);

  const nextUint32 = (): number => {
    const result = Math.imul(rotl(Math.imul(state[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (state[1] << 9) >>> 0;

    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = rotl(state[3], 11);

    state[0] >>>= 0;
    state[1] >>>= 0;
    state[2] >>>= 0;
    state[3] >>>= 0;

    return result;
  };

  const int = (nExclusive: number): number => {
    if (!Number.isSafeInteger(nExclusive) || nExclusive <= 0 || nExclusive > UINT32_SIZE) {
      throw new RangeError('nExclusive must be an integer in [1, 2^32]');
    }

    const limit = Math.floor(UINT32_SIZE / nExclusive) * nExclusive;
    let x = nextUint32();
    while (x >= limit) {
      x = nextUint32();
    }
    return x % nExclusive;
  };

  return {
    float: () => nextUint32() / UINT32_SIZE,
    int,
    flip: () => (nextUint32() < UINT32_SIZE / 2 ? 'heads' : 'tails'),
    shuffle: <T>(xs: readonly T[]): T[] => {
      const result = [...xs];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = int(i + 1);
        const tmp = result[i] as T;
        result[i] = result[j] as T;
        result[j] = tmp;
      }
      return result;
    },
    snapshot: () => ({ s: [...state] as [number, number, number, number] })
  };
};

/**
 * Derive independent deterministic streams in layers:
 * runSeed -> combat(index, attempt) -> flip/shuffle/ai.
 * Existing one-index calls retain their original serialized seed input.
 */
export const derive = (parent: RngSnapshot, label: string, index = 0, ...salts: number[]): RngSnapshot =>
  seedFromString(
    `${parent.s.map((x) => x >>> 0).join(':')}|${label}|${[index, ...salts].join('|')}`
  );

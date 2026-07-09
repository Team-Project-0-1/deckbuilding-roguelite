import { rngFrom, seedFromString } from '@game/core';

const seed = 'BRAVE-EMBER-42';
const rng = rngFrom(seedFromString(seed));
const flips = Array.from({ length: 10 }, (_, index) => ({
  index: index + 1,
  face: rng.flip()
}));

export const App = () => (
  <main>
    <h1>코인플립 로그라이크 — M0</h1>
    <p>Seed: {seed}</p>
    <ol>
      {flips.map((flip) => (
        <li key={flip.index}>
          #{flip.index}: {flip.face}
        </li>
      ))}
    </ol>
  </main>
);

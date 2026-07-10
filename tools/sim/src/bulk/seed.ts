import { derive, seedFromString } from "@game/core";

const assertEpisodeIndex = (episodeIndex: number): void => {
  if (!Number.isSafeInteger(episodeIndex) || episodeIndex < 0) {
    throw new RangeError("episodeIndex must be a non-negative safe integer");
  }
};

export const fingerprintText = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

export const deriveEpisodeSeed = (
  baseSeed: string,
  episodeIndex: number,
): string => {
  if (baseSeed.length === 0) throw new Error("baseSeed is required");
  assertEpisodeIndex(episodeIndex);
  const snapshot = derive(seedFromString(baseSeed), "episode", episodeIndex);
  return `m6:${snapshot.s.map((value) => value >>> 0).join(":")}`;
};

export const episodeIdFor = (
  baseSeed: string,
  episodeIndex: number,
): string => {
  const runSeed = deriveEpisodeSeed(baseSeed, episodeIndex);
  return `episode-${String(episodeIndex).padStart(8, "0")}-${fingerprintText(runSeed)}`;
};

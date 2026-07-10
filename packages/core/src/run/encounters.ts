import type { EnemyDefId } from '../ids';

const enemy = (value: string): EnemyDefId => value as EnemyDefId;

export const RUN_ENCOUNTERS: readonly (readonly EnemyDefId[])[] = [
  [enemy('raider')],
  [enemy('shaman')],
  [enemy('gatekeeper')],
  [enemy('raider-plus')],
  [enemy('gatekeeper-plus')]
];

export const RUN_ENCOUNTER_COUNT = RUN_ENCOUNTERS.length;

import { isCoinEnchantId } from '../content-types';
import type { CoinUid, Face } from '../ids';
import type { Rng } from '../rng';
import type { CombatEvent } from './events';
import type { CombatState } from './state';

export const assertCoinEnchantEligibility = (
  state: CombatState,
  coins: readonly CoinUid[],
): void => {
  for (const coin of coins) {
    const instance = state.coins[Number(coin)];
    if (instance?.counterfeit === true) throw new Error('counterfeit coin cannot be enchanted or used');
    const enchant = instance?.enchant;
    if (enchant === undefined) continue;
    if (instance?.permanent !== true) {
      throw new Error('temporary coin cannot carry an enchant');
    }
    if (!isCoinEnchantId(enchant)) {
      throw new Error(`unknown coin enchant: ${String(enchant)}`);
    }
  }
};

const markEnchantUsed = (state: CombatState, coin: CoinUid): CombatState => {
  const instance = state.coins[Number(coin)];
  if (instance?.permanent !== true || instance.enchantUsed === true) return state;
  return {
    ...state,
    coins: {
      ...state.coins,
      [Number(coin)]: { ...instance, enchantUsed: true },
    },
  };
};

export const rollEnchantedFace = (
  input: CombatState,
  coin: CoinUid,
  rng: Rng,
  successFace: Face | undefined,
  events: CombatEvent[],
): { state: CombatState; face: Face } => {
  const instance = input.coins[Number(coin)];
  if (instance?.permanent !== true || instance.enchant === undefined) {
    return { state: input, face: rng.flip() };
  }
  const enchant = instance.enchant;

  if (
    enchant === 'pendulum' &&
    successFace !== undefined &&
    instance.enchantUsed !== true
  ) {
    // Consume the ordinary face sample so adding Pendulum does not shift later
    // deterministic results in the combat stream.
    rng.flip();
    events.push({
      type: 'enchantTriggered',
      coin,
      enchant: instance.enchant,
      effect: 'face',
    });
    return { state: markEnchantUsed(input, coin), face: successFace };
  }

  if (enchant === 'heads-polish' || enchant === 'tails-polish') {
    const favorsHeads = enchant === 'heads-polish';
    const face: Face = (rng.float() < 0.6) === favorsHeads ? 'heads' : 'tails';
    events.push({
      type: 'enchantTriggered',
      coin,
      enchant: instance.enchant,
      effect: 'face',
    });
    return { state: input, face };
  }

  return { state: input, face: rng.flip() };
};

export const firstUseEchoCoins = (
  input: CombatState,
  coins: readonly CoinUid[],
  events: CombatEvent[],
): { state: CombatState; coins: CoinUid[] } => {
  let state = input;
  const returned: CoinUid[] = [];
  for (const coin of coins) {
    const instance = state.coins[Number(coin)];
    if (
      instance?.permanent !== true ||
      instance.enchant !== 'echo' ||
      instance.enchantUsed === true
    ) {
      continue;
    }
    state = markEnchantUsed(state, coin);
    returned.push(coin);
    events.push({
      type: 'enchantTriggered',
      coin,
      enchant: instance.enchant!,
      effect: 'return',
    });
  }
  return { state, coins: returned };
};

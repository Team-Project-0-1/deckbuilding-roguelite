# Directive 17 — Ash Duke Valdemar Design Sync

Status: implemented content contract; balance-provisional / experience-unverified.

## Scope

M-19 `ash-duke-valdemar` replaces `ember-archmage` only as the Act 3 visit-10
boss. The Ember Archmage definition remains in the database for compatibility;
the final-boss reward path is unchanged.

## Approved combat contract

- Valdemar has 180 HP. His furnace starts at 0, caps at 6, gains 1 after each
  boss action, gains 1 once when player burn deals HP damage, and loses 2 once
  when burn is cleared.
- A player phase-cap burst removes 1 furnace temperature at the phase-specific
  actual-damage thresholds: phase 1 = 27, phase 2 = 19, phase 3 = 10.
- Phase 1 cycles Burning Slash (10 damage, then burn 1 only when that attack
  dealt HP damage) and one-turn Ember Brand (burn 2).
- At furnace maximum, Coronation overrides the ordinary intent rotation as a
  telegraphed windup. It resolves as 24 damage, burn 3, and furnace set to 3
  with reason `coronationResolved`. If the
  furnace is at most 5, it cancels instead, sets furnace to 3, and in phase 3
  also removes 2 growth stacks.
- At below 70% HP, phase 2 removes 1 player burn, sets furnace to 2, and
  summons up to two `ash-vassal` units (24 HP). Each vassal cycles 6 damage,
  then 4 damage plus burn 1.
- Each vassal protects only its summon-time-bound Valdemar source UID: 15%
  reduction per source guard, capped at 30% total. It never protects a
  different Valdemar instance solely because the definition ID matches.
- At below 35% HP, phase 3 sets furnace to 2 and enables Final Ember: one
  bounded growth stack after each resolved boss intent (maximum five), with
  Valdemar attacks using +8% per stack.
- Both phase declarations explicitly use `transitionBeforeAction: true`.
  Crossing either threshold cancels and skips the prior intent before phase
  entry actions set furnace temperature to 2, so an armed Coronation cannot
  immediately resolve an attack on that transition.

## Graph and reward boundary

- Production Act 3 visit 10 is Valdemar. Minimal legacy graph fixtures may use
  the retained Ember Archmage only when Valdemar is absent from their test DB.
- The existing final-boss reward and act-transition behavior are intentionally
  unchanged.

## Balance note

All numeric values are approved but remain **balance-provisional** pending
dedicated boss playtests. This directive adds no new reward, UI, or persistence
surface.

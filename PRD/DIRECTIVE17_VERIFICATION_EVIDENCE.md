# Directive 17 Verification Evidence - M19 Ash Duke Valdemar

Status: implementation and release verification passed on 2026-07-18. Numeric
balance remains balance-provisional and requires experience playtesting.

## Acceptance gates

1. **Content and graph:** Valdemar replaces Ember Archmage at Act 3 visit 10,
   retains the final reward, and keeps Ember Archmage available as data-only
   content. Compact graph fixtures retain their explicit legacy fallback.
2. **Furnace rules:** the generic `0..6` furnace resource implements action,
   burn-damage, burn-clear, and cumulative phase-relative skill-damage changes.
   No-op mutations are suppressed and replay facts retain before/after values.
3. **Coronation:** reaching six arms a one-turn `Ash Coronation`; resolving it
   deals 24 damage, applies Burn 3, and resets the furnace to 3. Cooling to five
   or lower cancels it, resets the furnace to 3, and removes up to two Final
   Ember stacks in phase 3.
4. **Phases and summons:** the 70% transition clears Burn 1, sets furnace 2,
   and summons up to two Ash Vassals. The 35% transition sets furnace 2 and
   enables capped Final Ember growth. Explicit `transitionBeforeAction` makes
   only these phases cancel an in-flight Coronation before it resolves.
5. **Guard and statuses:** each live vassal supplies 15% UID-bound guard.
   Additive guard is applied before the multiplicative modifier, including Burn
   and Poison damage. Vassal death removes only its own source.
6. **Schema compatibility:** `cancelOn` is discriminated, invalid legacy shapes
   are rejected, and unflagged phased enemies preserve the legacy
   resolve-then-transition ordering.
7. **UI and feedback:** furnace, phase, growth, guard, cancellation predicates,
   cancellation results, SFX, and combat log reasons are visible without relying
   on colour alone.
8. **Replay and telemetry:** human replay, reader, telemetry, and UI tests record
   furnace changes with source, reason, and before/after values.
9. **Deterministic browser proof:** browser playtest covers non-cancelled
   Coronation, pre-action cancellation without player damage, phase-2 vassal
   entry, phase-3 Final Ember growth, and the victory boundary without browser
   errors.
10. **Regression and simulation:** the full unit suite and 500-run CI simulation
    remain deterministic with zero crashes and zero invariant violations.
11. **Performance and review:** the production bundle stays inside the adjusted
    four-dimensional budget, runtime LCP/CLS/long-task gates pass, whitespace is
    clean, and an independent reviewer returned `APPROVE` after the phase-order,
    status-guard, telegraph, no-op-event, schema, and legacy-order regressions
    were fixed.

## Verification record

- `pnpm test`: 90 files, 835 tests passed.
- `pnpm ci:sim`: 500/500 terminal runs; 0 crashes; 0 invariant violations;
  seed 42 golden unchanged. Combat completion remains a report-only balance
  signal at 786/2500 (31.44%), because the current bots do not reach the Act 3
  boss reliably.
- `pnpm check:perf`: passed at total 3,139,660 B, JavaScript 591,665 B, CSS
  86,689 B, and largest asset 651,044 B. Remaining headroom is 73,652 B total,
  10,447 B JavaScript, 3,423 B CSS, and 65,756 B largest asset.
- Runtime performance in the successful integrated run: median TTI 416 ms,
  median LCP 548 ms, worst CLS 0.000469, and no long task above the 200 ms
  blocking threshold (measured maxima 170/189/141 ms). Command round-trip is
  retained as a report-only metric at 1,750 ms median.
- Performance stability: two discarded boots plus a 500 ms quiet window retain
  the strict per-measured-run 200 ms gate. Three additional standalone checks
  passed before the successful integrated run; no retry-on-failure or threshold
  relaxation was introduced.
- Focused D17 verification: core/content/UI/telemetry/telegraph suites passed,
  content typecheck passed, and the deterministic browser scenarios passed.
- `git diff --check`: passed; line-ending conversion notices are informational.
- Independent review: `APPROVE`.

The repository-wide `pnpm release:verify` passed with exit code 0 before the
Directive 17 commits were created.

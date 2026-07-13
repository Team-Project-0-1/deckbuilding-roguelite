# P8.1 Overlay Layer Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move tooltips and interactive popovers out of clipped combat containers into a viewport-aware portal layer with one z-index contract.

**Architecture:** A pure placement function computes a fixed-position overlay rectangle from anchor, overlay, and viewport dimensions. `AnchoredOverlay` renders through `createPortal` into a body-level layer root and owns resize/scroll observation. Existing keyword, turn-buff, preview, and pile surfaces keep their interaction semantics while replacing nested absolute content with the shared primitive.

**Tech Stack:** React 18, TypeScript, CSS custom properties, Vitest, Playwright, Vite; no new dependencies.

## Global Constraints

- Do not change combat rules, content data, save data, damage values, or timing locks.
- Do not add packages or image/audio assets.
- Do not solve clipping with arbitrary large local z-index values.
- Preserve hover, focus, touch click, outside click, and Escape behavior.
- Preserve `aria-describedby`, `role="tooltip"`, `role="dialog"`, `aria-expanded`, and `aria-controls` relationships.
- Respect `prefers-reduced-motion`, 390×844 mobile layout, and the existing bundle budget.
- Keep the user-owned untracked `.superpowers/` directory untouched.

---

### Task 1: Deterministic anchored-overlay placement

**Files:**
- Create: `apps/ui/src/overlay-position.ts`
- Create: `apps/ui/src/overlay-position.test.ts`

**Interfaces:**
- Produces: `type OverlayPlacement = "top" | "bottom"`
- Produces: `placeAnchoredOverlay(input: OverlayPositionInput): OverlayPosition`
- `OverlayPositionInput` contains `anchor`, `overlayWidth`, `overlayHeight`, `viewportWidth`, `viewportHeight`, `gap`, and `padding` numbers.
- `OverlayPosition` contains `left`, `top`, and final `placement`.

- [ ] **Step 1: Write failing placement tests**

```ts
import { describe, expect, it } from "vitest";
import { placeAnchoredOverlay } from "./overlay-position";

describe("placeAnchoredOverlay", () => {
  it("centers above the anchor when there is room", () => {
    expect(placeAnchoredOverlay({
      anchor: { left: 100, right: 140, top: 100, bottom: 120 },
      overlayWidth: 80,
      overlayHeight: 40,
      viewportWidth: 320,
      viewportHeight: 240,
      gap: 8,
      padding: 8,
    })).toEqual({ left: 80, top: 52, placement: "top" });
  });

  it("flips below when the top would cross viewport padding", () => {
    expect(placeAnchoredOverlay({
      anchor: { left: 20, right: 60, top: 12, bottom: 32 },
      overlayWidth: 100,
      overlayHeight: 60,
      viewportWidth: 320,
      viewportHeight: 240,
      gap: 8,
      padding: 8,
    })).toEqual({ left: 8, top: 40, placement: "bottom" });
  });

  it("clamps the right edge inside viewport padding", () => {
    expect(placeAnchoredOverlay({
      anchor: { left: 290, right: 310, top: 150, bottom: 170 },
      overlayWidth: 120,
      overlayHeight: 40,
      viewportWidth: 320,
      viewportHeight: 240,
      gap: 8,
      padding: 8,
    }).left).toBe(192);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run apps/ui/src/overlay-position.test.ts`  
Expected: FAIL because `./overlay-position` does not exist.

- [ ] **Step 3: Implement the minimal pure placement function**

Clamp horizontal position to `[padding, viewportWidth - padding - overlayWidth]`. Prefer top; use bottom if top crosses padding and bottom fits or provides more visible space. Clamp final vertical position to viewport padding as a defensive fallback.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `pnpm vitest run apps/ui/src/overlay-position.test.ts`  
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/overlay-position.ts apps/ui/src/overlay-position.test.ts
git commit -m "test: define viewport-aware overlay placement"
```

---

### Task 2: Shared portal and layer contract

**Files:**
- Create: `apps/ui/src/overlay.tsx`
- Create: `apps/ui/src/overlay.css`
- Modify: `apps/ui/src/App.css`
- Modify: `apps/ui/src/main.tsx`

**Interfaces:**
- Produces: `OverlayLayer = "popover" | "tooltip" | "drag" | "modal" | "notice"`
- Produces: `OverlayPortal({ layer, children, className? })`
- Produces: `AnchoredOverlay({ anchorRef, className, id, open, role, interactive?, preferredPlacement?, children })`
- Consumes: `placeAnchoredOverlay` from Task 1.

- [ ] **Step 1: Add CSS contract assertions to the browser check before implementation**

Extend `apps/ui/scripts/run-navigation-check.mjs` to assert the root computed style exposes exact non-empty values for `--z-world`, `--z-stage`, `--z-controls`, `--z-popover`, `--z-tooltip`, `--z-drag`, `--z-modal`, and `--z-notice`.

- [ ] **Step 2: Run focused browser check and verify RED**

Run: `pnpm build && node apps/ui/scripts/run-navigation-check.mjs`  
Expected: FAIL because the layer custom properties are absent.

- [ ] **Step 3: Add the portal root and tokenized layers**

`main.tsx` renders a sibling `<div id="overlay-root" />` after `#root`. `overlay.css` defines fixed layer containers with `pointer-events: none`; interactive descendants opt into pointer events. `App.css :root` defines the eight values from the approved spec. Replace existing global z-index values for menu, drag proxy, popover, and persistent controls with `var(...)` tokens.

- [ ] **Step 4: Implement `OverlayPortal` and `AnchoredOverlay`**

Use `createPortal`. Measure in `useLayoutEffect`, schedule one `requestAnimationFrame`, update on resize, capture-stage scroll, `ResizeObserver`, and anchor disappearance. Add `data-overlay-layer` and `data-placement` attributes for browser evidence.

- [ ] **Step 5: Run typecheck and focused browser check**

Run: `pnpm --filter @game/ui typecheck && pnpm build && node apps/ui/scripts/run-navigation-check.mjs`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/overlay.tsx apps/ui/src/overlay.css apps/ui/src/App.css apps/ui/src/main.tsx apps/ui/scripts/run-navigation-check.mjs
git commit -m "feat: add shared overlay layer contract"
```

---

### Task 3: Migrate keyword and turn-buff tooltips

**Files:**
- Modify: `apps/ui/src/keywords.tsx`
- Modify: `apps/ui/src/keywords.css`
- Modify: `apps/ui/src/turn-buff.tsx`
- Modify: `apps/ui/src/App.css`
- Modify: `apps/ui/scripts/playtest.mjs`

**Interfaces:**
- Consumes: `AnchoredOverlay` from Task 2.
- Preserves: `Keyword` and `TurnBuffBar` public props.

- [ ] **Step 1: Add failing visual-layer assertions**

Add browser helpers that verify an open tooltip:

```js
const tooltipGeometry = (page, id) => page.evaluate((tooltipId) => {
  const tip = document.getElementById(tooltipId);
  if (!(tip instanceof HTMLElement)) return null;
  const rect = tip.getBoundingClientRect();
  const center = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {
    rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    viewport: { width: innerWidth, height: innerHeight },
    topmost: center.includes(tip),
    parentLayer: tip.parentElement?.dataset.overlayLayer ?? null,
  };
}, id);
```

Assert card-effect and unit-chip tooltips have `parentLayer === "tooltip"`, remain inside viewport padding, and are in the topmost hit-test chain.

- [ ] **Step 2: Run the tooltip scenarios and verify RED**

Run: `pnpm build && pnpm --filter @game/ui playtest`  
Expected: FAIL because tooltips remain nested without `data-overlay-layer="tooltip"`.

- [ ] **Step 3: Migrate `Keyword`**

Keep the trigger span and button in place. Render `.kw-tip` through `AnchoredOverlay`, using the host ref as anchor. Replace CSS descendant display rules with React open state that is set by mouse enter/leave, focus/blur, click, outside pointer, and Escape.

- [ ] **Step 4: Migrate `TurnBuffChip`**

Use the same primitive and preserve its nested `Keyword term="trigger"`. Because the outer tooltip is portaled, the nested keyword tooltip must also portal above it without clipping.

- [ ] **Step 5: Run unit, browser, accessibility checks**

Run: `pnpm vitest run apps/ui/src/keywords.test.ts apps/ui/src/turn-buff.test.ts && pnpm build && pnpm --filter @game/ui playtest && pnpm check:a11y`  
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/keywords.tsx apps/ui/src/keywords.css apps/ui/src/turn-buff.tsx apps/ui/src/App.css apps/ui/scripts/playtest.mjs
git commit -m "fix: portal combat tooltips above clipped UI"
```

---

### Task 4: Migrate preview and pile overlays

**Files:**
- Modify: `apps/ui/src/App.tsx`
- Modify: `apps/ui/src/App.css`
- Modify: `apps/ui/scripts/playtest.mjs`

**Interfaces:**
- Consumes: `AnchoredOverlay` from Task 2.
- `PilePopover` gains `anchorRef` and remains an interactive `role="dialog"`.
- Skill preview anchors to the relevant `.skill-card` article.

- [ ] **Step 1: Add failing preview and pile layer assertions**

For a fully loaded skill, assert `.preview-tip` is inside the tooltip layer and its rectangle is inside the viewport. For draw/discard/exhaust pile dialogs, assert each is inside the popover layer and receives pointer events.

- [ ] **Step 2: Run affected browser scenarios and verify RED**

Run: `pnpm build && pnpm --filter @game/ui playtest`  
Expected: FAIL because preview and pile overlays are still nested.

- [ ] **Step 3: Migrate preview**

Create one ref per card through a focused `SkillCard` extraction or a ref map keyed by slot id. Render preview through `AnchoredOverlay` with `role="tooltip"`, `interactive=false`, and the card as anchor.

- [ ] **Step 4: Migrate pile dialogs**

Anchor draw pile to `.pouch-circle` and discard/exhaust to their `.pile-button`. Preserve open state, outside click, Escape, `aria-controls`, and `aria-expanded`. Use `interactive=true` and preferred top placement.

- [ ] **Step 5: Run focused and full browser verification**

Run: `pnpm build && node apps/ui/scripts/run-navigation-check.mjs && pnpm --filter @game/ui playtest`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/App.tsx apps/ui/src/App.css apps/ui/scripts/playtest.mjs
git commit -m "fix: lift previews and pile dialogs into overlay layers"
```

---

### Task 5: P8.1 visual and release verification

**Files:**
- Modify: `PRD/PROGRESS.md`
- Modify: `.omx/state/p8-overlay/ralph-progress.json` (ignored verification state only)

**Interfaces:**
- Consumes all earlier tasks.
- Produces P8.1 evidence and updates the progress ledger without claiming P8.2–P8.5 completion.

- [ ] **Step 1: Capture representative screenshots**

Capture desktop 1280×720 and mobile 390×844 screenshots for card keyword, unit status, pile dialog, and a nested turn-buff keyword. Save temporary screenshots outside tracked source.

- [ ] **Step 2: Run visual verdict**

Record strict JSON with score, verdict, clipping/occlusion differences, suggestions, and next actions in `.omx/state/p8-overlay/ralph-progress.json`. A score below 90 requires another edit-and-verdict iteration before proceeding.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm ci:sim
pnpm build
pnpm check:assets
pnpm check:a11y
pnpm check:perf
node apps/ui/scripts/run-navigation-check.mjs
pnpm check:mobile
```

Expected: every command exits 0; Linux CI remains the authoritative check for the known Windows extensionless `tsx` launcher limitation if it recurs unchanged.

- [ ] **Step 4: Update progress evidence**

Add a P8.1 completion entry containing the exact tests, viewports, visual score, and remaining P8.2–P8.5 work. Do not mark P8 complete.

- [ ] **Step 5: Commit**

```bash
git add PRD/PROGRESS.md
git commit -m "docs: record P8 overlay recovery evidence"
```

- [ ] **Step 6: Push and verify CI/deploy**

Push the feature branch, inspect the exact-head CI run, merge only after all required jobs pass, and verify the deployed Pages SHA plus live tooltip smoke path.

---

## Plan Self-Review

- Spec coverage: P8.1 portal, token hierarchy, viewport placement, migrated surfaces, accessibility, responsive behavior, performance, and completion evidence are each assigned to a task.
- Scope boundary: VFX and SFX implementation are intentionally excluded; they receive separate P8.2–P8.4 plans after P8.1 passes.
- Type consistency: all tasks consume `OverlayPortal`, `AnchoredOverlay`, and `placeAnchoredOverlay` with one naming contract.
- Placeholder scan: no TBD, TODO, or unspecified implementation step remains.

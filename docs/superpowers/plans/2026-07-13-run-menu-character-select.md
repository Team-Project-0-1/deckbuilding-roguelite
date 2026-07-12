# Run Menu and Character Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit title/continue flow, an in-run management menu, and existing character sprites to the new-run character selector.

**Architecture:** `App` remains the owner of boot modes and save transitions, while two focused DOM components (`TitleScreen`, `RunMenu`) own presentation and focus behavior. `RunGame` owns only whether its menu is open and delegates destructive navigation back to `App`; `CharacterSelect` receives sprite assets instead of importing run creation logic.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright, existing atlas sprite renderer and localStorage run-save contract.

## Global Constraints

- A new run always follows `title or run menu -> character select -> combat`.
- Query-driven test boots (`seed`, `encounter`, `skills`, `character`) retain their direct boot behavior; `select=1` retains direct character selection.
- `Exit to title` preserves the run save; only confirmed `New run` clears it.
- Mid-combat decisions are not persisted, so loading a save restarts the current combat after confirmation.
- Reuse existing character atlases; add no image assets.
- Keep JS at or below 400 KiB, CSS at or below 70 KiB, and every file at or below 700 KiB.
- Raise the total bundle gate by no more than 16 KiB and only to the measured amount required by this feature.
- Preserve UTF-8 Korean text and do not touch the unrelated untracked `.superpowers/` directory.

---

## File Map

- Create `apps/ui/src/title-screen.tsx`: title actions and saved-run summary presentation.
- Create `apps/ui/src/run-menu.tsx`: in-run menu, confirmation state, focus and Escape handling.
- Create `apps/ui/scripts/run-navigation-check.mjs`: focused browser regression for title, continue, new-run, exit, reload and character art.
- Modify `apps/ui/src/App.tsx`: boot-state transitions, shared save loader, callbacks, menu host and sprite map plumbing.
- Modify `apps/ui/src/character-select.tsx`: render the supplied idle sprite inside each character card.
- Modify `apps/ui/src/App.css`: title/menu/card-art layout and responsive behavior.
- Modify `scripts/check-budget.mjs`: measured total-only budget adjustment after the production build.
- Modify `.github/workflows/ci.yml`: run the focused navigation browser check after the UI build.
- Modify `apps/ui/scripts/playtest.mjs`: retain broad regression coverage and add selector-level checks where the full-run harness already owns character selection.

---

### Task 1: Lock the New Navigation Contract with a Focused Browser Test

**Files:**
- Create: `apps/ui/scripts/run-navigation-check.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: production UI served by Vite preview.
- Produces: selectors `title-screen`, `title-continue`, `title-new-run`, `run-menu-open`, `run-menu`, `run-menu-load`, `run-menu-new`, `run-menu-exit`, `confirm-action`, and `character-portrait`.

- [ ] **Step 1: Write the failing browser contract**

Create a Playwright script that starts Vite preview, opens a context with no save, and asserts:

```js
check("title shown without save", await page.locator('[data-testid="title-screen"]').count() === 1);
check("continue disabled without save", await page.locator('[data-testid="title-continue"]').isDisabled());
await page.locator('[data-testid="title-new-run"]').click();
check("new run opens character select", await page.locator('[data-testid="character-select"]').count() === 1);
check(
  "each character has a portrait",
  await page.locator('[data-testid="character-portrait"]').count() ===
    await page.locator('[data-testid^="character-select-"]').count(),
);
```

Add a second context with a valid save created by starting a character, reloading the root URL, continuing, opening the run menu, exiting to title, and reloading the save.

- [ ] **Step 2: Run it and verify RED**

Run:

```powershell
corepack pnpm -F @game/ui build
node apps/ui/scripts/run-navigation-check.mjs
```

Expected: FAIL because `title-screen` and `run-menu-open` do not exist.

- [ ] **Step 3: Add the CI invocation**

After the existing `pnpm -F @game/ui build` step in the playtest job, add:

```yaml
- run: node apps/ui/scripts/run-navigation-check.mjs
```

- [ ] **Step 4: Commit the failing contract**

```powershell
git add apps/ui/scripts/run-navigation-check.mjs .github/workflows/ci.yml
git commit -m "test: define run navigation browser contract"
```

---

### Task 2: Add Explicit Title and Save Loading States

**Files:**
- Create: `apps/ui/src/title-screen.tsx`
- Modify: `apps/ui/src/App.tsx`
- Modify: `apps/ui/src/App.css`
- Test: `apps/ui/scripts/run-navigation-check.mjs`

**Interfaces:**
- Produces `TitleSaveSummary`:

```ts
export interface TitleSaveSummary {
  characterName: string;
  currentHp: number;
  maxHp: number;
  progress: string;
}
```

- Produces `TitleScreen({ save, onContinue, onNewRun })`.
- Produces `loadSavedSession(): { mode: "run"; session: RunSession } | { mode: "corrupt-save" } | { mode: "title"; save: null }` inside `App.tsx`.

- [ ] **Step 1: Extend the failing test for title save summary**

Assert that a saved run enables `title-continue`, exposes the saved character name and HP, and that clicking continue reaches `run-progress`.

- [ ] **Step 2: Run the focused check and verify RED**

Expected: FAIL on missing title selectors.

- [ ] **Step 3: Implement the title component**

Render a `result-overlay`/`result-panel`-styled title with:

```tsx
<button data-testid="title-continue" disabled={save === null} onClick={onContinue}>
  이어하기
</button>
<button data-testid="title-new-run" onClick={onNewRun}>
  새 런 시작
</button>
```

- [ ] **Step 4: Change boot behavior without breaking test URLs**

Add `title` to `BootState`. Preserve the current early direct-test return. After storage validation, return title with a summary instead of automatically resuming a valid save. Keep `select=1` as the explicit selection bypass.

- [ ] **Step 5: Implement title transitions**

- Continue: re-read the save and use the existing `resumeAbandonedCombat`/`startRunCombat` behavior.
- New run: if a save exists, show a confirmation; otherwise go directly to `select` with a new seed.
- Corrupt load: route to `corrupt-save`.

- [ ] **Step 6: Run focused check, typecheck and lint**

```powershell
node apps/ui/scripts/run-navigation-check.mjs
corepack pnpm -r run typecheck
corepack pnpm exec eslint .
```

Expected: title-related checks PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/ui/src/title-screen.tsx apps/ui/src/App.tsx apps/ui/src/App.css apps/ui/scripts/run-navigation-check.mjs
git commit -m "feat: add explicit title and continue flow"
```

---

### Task 3: Add the In-Run Management Menu

**Files:**
- Create: `apps/ui/src/run-menu.tsx`
- Modify: `apps/ui/src/App.tsx`
- Modify: `apps/ui/src/App.css`
- Test: `apps/ui/scripts/run-navigation-check.mjs`

**Interfaces:**
- Produces:

```ts
interface RunMenuProps {
  open: boolean;
  hasSave: boolean;
  onClose: () => void;
  onLoad: () => void;
  onNewRun: () => void;
  onExitToTitle: () => void;
}
```

- `RunGame` receives `onLoadSaved`, `onStartNewRun`, and `onExitToTitle` callbacks from `App`.

- [ ] **Step 1: Extend the browser contract**

Assert the menu opens during combat, `Escape` closes it, exit preserves the save, load restores it, and new run does not clear storage before confirmation.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the menu selectors do not exist.

- [ ] **Step 3: Implement `RunMenu`**

Use a modal with internal confirmation state:

```ts
type ConfirmAction = "load" | "new-run" | null;
```

`load` copy states that current combat actions will be discarded. `new-run` copy states that the current run save will be deleted. The final destructive button uses `data-testid="confirm-action"`.

- [ ] **Step 4: Host the menu in `RunGame`**

Render one small `메뉴` button in `RunMeta` and a sibling `RunMenu` for both combat and non-combat branches. While open, the modal layer must intercept pointer and keyboard input.

- [ ] **Step 5: Wire transitions in `App`**

- Exit: persist current `run`, then set title state.
- Load: call the shared save loader and replace `RunGame` through `BootState`.
- New run: clear storage after confirmation and set `select` with a new seed.

- [ ] **Step 6: Run focused and broad checks**

```powershell
node apps/ui/scripts/run-navigation-check.mjs
corepack pnpm -r run typecheck
corepack pnpm exec eslint .
```

Expected: menu contract PASS, zero console/page errors.

- [ ] **Step 7: Commit**

```powershell
git add apps/ui/src/run-menu.tsx apps/ui/src/App.tsx apps/ui/src/App.css apps/ui/scripts/run-navigation-check.mjs
git commit -m "feat: add in-run save and restart menu"
```

---

### Task 4: Show Existing Character Sprites and Fix Compact Layout

**Files:**
- Modify: `apps/ui/src/character-select.tsx`
- Modify: `apps/ui/src/App.tsx`
- Modify: `apps/ui/src/App.css`
- Modify: `apps/ui/scripts/playtest.mjs`
- Test: `apps/ui/scripts/run-navigation-check.mjs`

**Interfaces:**
- Export from `character-select.tsx`:

```ts
export interface CharacterArt {
  atlasUrl: string;
  manifest: SpriteManifest;
}
```

- Add `artByCharacter: Readonly<Record<string, CharacterArt>>` to `CharacterSelectProps`.

- [ ] **Step 1: Verify the portrait contract is RED**

Run the focused check before changing production code. Expected: portrait count is zero.

- [ ] **Step 2: Reuse the existing sprite map**

Pass `playerSprite(character.id)` results from `App` into `CharacterSelect`. Render `AtlasSprite` with `motion="idle"`, `playKey={0}`, and `side="player"` inside a `character-portrait` wrapper.

- [ ] **Step 3: Add responsive card layout**

- Desktop: portrait column plus information column inside the existing two-column grid.
- At or below 700px: one character card per row.
- Keep the panel scrollable and ensure no horizontal overflow at 390×844.

- [ ] **Step 4: Add full-playtest assertions**

In the existing character-select scenario, assert one portrait per card and capture desktop/mobile screenshots.

- [ ] **Step 5: Run visual capture and verdict**

Capture 1280×720 and 390×844. Compare with the existing character-selection screenshot and require visual-verdict score 90 or higher before another CSS edit.

- [ ] **Step 6: Run focused checks**

```powershell
node apps/ui/scripts/run-navigation-check.mjs
corepack pnpm -r run typecheck
corepack pnpm exec eslint .
```

- [ ] **Step 7: Commit**

```powershell
git add apps/ui/src/character-select.tsx apps/ui/src/App.tsx apps/ui/src/App.css apps/ui/scripts/playtest.mjs
git commit -m "feat: show character sprites during run setup"
```

---

### Task 5: Measure Budget, Run Release Gates, and Publish

**Files:**
- Modify: `scripts/check-budget.mjs`
- Modify: `PRD/PROGRESS.md`

**Interfaces:**
- Preserves budget keys `js`, `css`, and `maxFile`.
- Adjusts only `total`, capped at previous total plus 16,384 bytes.

- [ ] **Step 1: Build and measure before changing the budget**

```powershell
corepack pnpm -F @game/ui build
node -e "const fs=require('fs'),p=require('path');let n=0;const w=d=>fs.readdirSync(d,{withFileTypes:true}).forEach(e=>e.isDirectory()?w(p.join(d,e.name)):n+=fs.statSync(p.join(d,e.name)).size);w('apps/ui/dist');console.log(n)"
```

Expected: record the exact byte total.

- [ ] **Step 2: Set the smallest sufficient total budget**

Set `BUDGETS.total` to the measured total rounded up to the next 1,024-byte boundary, while ensuring it is no more than `2,726,297 + 16,384`.

- [ ] **Step 3: Run release verification**

```powershell
corepack pnpm -r run typecheck
corepack pnpm exec eslint .
corepack pnpm exec vitest run
corepack pnpm ci:sim
corepack pnpm -F @game/ui build
node scripts/check-budget.mjs
node apps/ui/scripts/run-navigation-check.mjs
corepack pnpm -F @game/ui playtest -- ../../playtest-artifacts-run-menu
node apps/ui/scripts/feedback-check.mjs
node apps/ui/scripts/a11y-contrast.mjs contrast-report.json
node apps/ui/scripts/perf-check.mjs perf-report.json
```

Expected: all Linux/CI gates PASS; on Windows, document only pre-existing platform-specific child-process failures if reproduced and rely on CI for their Linux proof.

- [ ] **Step 4: Update progress documentation**

Add one entry describing the title flow, run menu, character portraits, save semantics, measured budget and verification evidence.

- [ ] **Step 5: Commit and push**

```powershell
git add scripts/check-budget.mjs PRD/PROGRESS.md .github/workflows/ci.yml apps/ui
git commit -m "feat: add run management and visual character setup"
git push origin main
```

- [ ] **Step 6: Verify CI, deploy and live behavior**

Confirm the final SHA succeeds in both `CI` and `Deploy`. In a fresh live browser context, verify title → new run → character select, title → continue, run menu → exit, and run menu → load with zero page errors or 4xx responses.

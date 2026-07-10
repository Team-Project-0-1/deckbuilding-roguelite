# Shaman sprite QA

- Base lock: PASS on the second base candidate. The first candidate was rejected for a visible floor line and key-color contamination. The accepted anchor is a complete left-facing full body with olive-green skin, skull ornament, rust/ochre robes, hooked staff, attached flame bowl, clean chroma field, and generous padding.
- Prompt compilation: the WSL `gongnyang-prompt-kit/image-prompt` plugin was explicitly loaded. Its installed `SKILL.md` is only a TODO placeholder, so the compiled prompt was additionally checked with the kit's `check_prompt.mjs`; result was `ok: true`, Format A, tier 0, zero errors and warnings.
- `idle` (4 frames, 4 fps, loop): PASS. Planted feet and staff, readable breathing variation, and a close first-to-last seam. Final `visual-verdict` treats the remaining endpoint drift as nonblocking.
- `attack` (4 frames, 8 fps, non-loop): PASS after the visual-review regeneration. Compact setup, decisive forward staff/brazier extension, follow-through, and return are distinct; flame stays attached.
- `hurt` (4 frames, 8 fps, non-loop): PASS after one final-row regeneration removed detached head debris. Upright recoil, deep stagger, partial recovery, and idle settle are distinct and remain left-facing.
- Extraction: PASS through connected components only. `frames/frames-manifest.json.ok=true`; 12/12 non-empty canonical RGBA frames; shared baseline `bbox.y2=232` for every frame; zero chroma-adjacent pixels.
- Curation/export: all four frames in every state are explicitly selected in `curation.json` with pixel-perfect output and identity transforms. Twelve curated PNGs and three transparent GIFs were exported.
- Atlas: `sprite-sheet-alpha.report.json.ok=true`; 1024x768 RGBA 4x3 atlas; `curation_applied=true`; `degraded_static_fallback=false`; zero stale RGB under transparent canonical/curated/atlas pixels.
- Visual verdict: `91`, PASS. Identity, framing, transparent padding, attack, and hurt readability pass. Minor idle endpoint drift and a subtle first hurt beat remain nonblocking.
- Nonblocking metric: the widest attack frame has 8 source-frame edge pixels and 4 final-atlas cell-border pixels. Original-resolution review found no visible crop, cross-cell bleed, overlap, or fringe.

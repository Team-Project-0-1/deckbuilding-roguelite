# Gatekeeper sprite QA

- Base lock: PASS on the first candidate. The accepted anchor is a complete left-facing full body with broad riveted iron armor, closed helmet, large rectangular tower shield, compact mace, clean chroma field, and generous padding.
- Prompt compilation: the WSL `gongnyang-prompt-kit/image-prompt` plugin was explicitly loaded. Its installed `SKILL.md` is only a TODO placeholder, so the compiled prompt was additionally checked with the kit's `check_prompt.mjs`; result was `ok: true`, Format A, tier 0, zero errors and warnings.
- `idle` (4 frames, 4 fps, loop): PASS. Stable feet, shield-forward blocking silhouette, subtle armored weight shift, and a close first-to-last seam.
- `attack` (4 frames, 8 fps, non-loop): PASS. Brace, short shield-bash drive, recoil, and recovery are distinct; the tower shield remains the dominant readable prop.
- `hurt` (4 frames, 8 fps, non-loop): PASS after one regeneration. The first row was rejected for detached debris; the replacement has shield deflection, deep stagger, recovery, and blocking-idle settle with an empty chroma field.
- Extraction: PASS through connected components only. `frames/frames-manifest.json.ok=true`; 12/12 non-empty canonical RGBA frames; shared baseline `bbox.y2=232` for every frame; zero edge and chroma-adjacent pixels.
- Curation/export: all four frames in every state are explicitly selected in `curation.json` with pixel-perfect output and identity transforms. Twelve curated PNGs and three transparent GIFs were exported.
- Atlas: `sprite-sheet-alpha.report.json.ok=true`; 1024x768 RGBA 4x3 atlas; `curation_applied=true`; `degraded_static_fallback=false`; zero stale RGB under transparent canonical/curated/atlas pixels.
- Visual verdict: `92`, PASS. Armor mass, blocking silhouette, runtime padding, shield-bash, and hurt readability pass. Minor idle endpoint drift and simplified small-scale metal detail are nonblocking.

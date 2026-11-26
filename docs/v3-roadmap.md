# v3 Roadmap

Status and remaining polish checklist for the `v3` site upgrade on top of the frozen v1.2/v1.3 scoring data (11 base sites, 91,971 land cells).

## Invariants

- **Data and scoring are frozen:** `pipeline/` and `site/public/data/` do not change. Every number on screen traces directly to `site/public/data/`.
- **Honest scientific framing:** Show `N / 100 match score` (never `% similar` or `% match`). Never label scoring as `"ML"` or `"AI"`. Every match states what matches, where it breaks in real units, and what Earth cannot copy.
- **Self-contained static site:** Zero external font hosts (display, body, and mono faces bundled locally). Only external tile hosts are `gibs.earthdata.nasa.gov` and `trek.nasa.gov`, with local fallbacks. No NASA logos or insignia.
- **Low-CPU verification:** Playwright defaults to `workers: 1`, `reducedMotion: "reduce"`, 1× DPR on phone, memoized binary fixtures, local tile stubs (`LIVE_TILES=1` for live tiles), and a focused phone suite (`PW_ALL_PHONE=1` for every test on phone; `npm --prefix site run test:laptop` for desktop-only).

---

## Completed on `v3`

- [x] **Phase 0 — Foundations (`0e0251e`):** Unified `:root` design tokens, flattened CSS cascade, hash-aware preloader, shared segmented/range controls (`site/src/controls.ts`), iterative 3-way descending quickselect cutoff (`site/src/zones.ts`, bit-for-bit parity), rAF slider coalescing, OG metadata and boot screen.
- [x] **Phase 1 — Home 3D Orbital Stage (`1944fae`):** Dual-shell Earth atmospheric limb halo, two-layer starfield, pulsing reticle, viewport-clamped floating labels, WebGL `pause()`/`resume()` lifecycle.
- [x] **Phase 2 — Finder Orbital HUD (`3e78229`):** MapLibre GL 6 sky atmosphere + starfield canvas, floating glass top HUD with local ARIA search, `Globe | Flat` toggle, `Known analogs` switch, inline overlay opacity slider, collapsible legend with live 36-bin `sqrt` histogram, collapsible target preview card, rank-priority pin z-index, interactive analog/cave markers, CVD-safe challenge chips, mobile sheet & popup fixes.
- [x] **Phase 3 — Place Scorecard (`75dae5d`):** Range-and-gap bullet plots with clamped target ticks, rounded-cap SVG score ring, inline preset and year-round switcher, `Expand all` / `Collapse all`, NASA image compare wipe + overlays toggle + loading skeleton, clean-room CSV / Worldview / Trek export (`site/src/export.ts`), copy link/coords, `@media print`.
- [x] **Phase 4 — Learn, About & Guided Tour (`f3f21b3`):** Learn aligned to Balanced preset, clickable month matrix, 44px analog pins with tooltips and Finder/Place links, NASA photo lightbox; About scroll-spy TOC, scoring strip, folded validation runs, agency filter pills; non-overlapping Guided Tour with step pips and keyboard navigation.
- [x] **Typography, Orbital Palette & Place Dossier (`ef1b296` + follow-up):** Self-hosted `Inter Variable` and `JetBrains Mono Variable`, refined slate-navy surface hierarchy, matched Place Mission Dossier + Imagery cards, fixed lunar crater label edge clamping, connected `Previous | 1 of 20 | Next` capsule, clean tapered card top accents.

---

## Completed: UI Polish Pass

Finalized the visual polish pass addressing team review feedback before Phase 5 sign-off:

- [x] **Minimalist, low-text pass (especially Finder & Learn):** Decluttered the Finder header (single unclipped full-width base-site picker with quiet eyebrow and header utility pills), summary card (3-cell telemetry bar + compact `+ Known sites` pill), single-line rules caption, unified single-row segmented preset strip (`Balanced | Rover | Life support | Habitat`), compact band key, cleaner map HUD, and trimmed Learn headers/captions.
- [x] **Deeper blue accent:** Shifted `--signal` to `#1d64c8` (with `--signal-hover: #246ed4`, `--signal-ink: #f8fafc`, and `--signal-2: #5a9cf2`), harmonized all hardcoded legacy cyan accents across CSS/3D/MapLibre views, and verified WCAG AA contrast across active pills, links, score highlights, and Moon/Mars Learn accents.
- [x] **Finder Guided Tour placement:** Moved `#tour` out from underneath the right zoom capsule into the understated Finder sidebar header beside `All sites`, preserving `id="tour"` and Escape focus return.
- [x] **Finder Heatmap/Legend collapsed by default:** Started `#legend` collapsed by default on desktop and mobile as a compact toggle pill showing the gradient swatch and active land share (`Best 2% of land`), expanding smoothly for the 36-bin histogram and share controls while keeping `data-painted`/`data-ranked`/`data-edges` accurate.
- [x] **Learn Moon/Mars visual upgrade:** Replaced the cramped 3-column `GRAVITY | AIR | RADIATION` text box with proportional Earth-vs-World visual telemetry bars and a consolidated source footer, upgraded the section 03 Air/Radiation comparisons to dual-bar cards, unified section panel widths, added a segmented Moon/Mars switcher, and right-aligned the `02 A year on Earth` `SELECTED MONTH` header over the status pills.
- [x] **Place breakdown heading:** Replaced `"Challenge by challenge"` (`#pl-chs-h`) with `"Score breakdown"`, and fixed narrow-width wrapping on the `.pl-body` badge.
- [x] **Remaining visual bugs:**
  - Replaced curved left-border corner horns on About `#checked` `.ab-tile` cards with a clipped vertical `::before` accent bar.
  - Wired `.pin-tag` decluttering on MapLibre `idle` / `render` / `moveend` / `resize`, fixed inline `opacity` override via `!important`, and added symmetric left-side fallback placement so top-3 labels never collide with nearby pins on initial load.

---

## Completed: Phase 5 — Final QA & Release Sign-off

- [x] **Full verification suite:** `npm --prefix site run build` (clean, 0 errors), full `npm --prefix site test` (75 passed / 2 skipped / 0 failed across laptop and phone at `workers: 1`), `uv run pytest` (139 passed / 1 skipped / 0 failed), and `git diff testing..v3 -- site/public/data/ pipeline/` confirmed empty.
- [x] **Resilience sweep:** Verified GIBS/Trek-blocked fallback (zero unauthorized external calls, `.noimg` and `.eimg.fb` active), `prefers-reduced-motion` (`animation-name: none`, `scroll-behavior: auto`), no-WebGL fallback (`.intro-still` on Home, `.nogl` on Finder with all 20 ranked rows and Place navigation intact), and `@media print` on Place (light print theme, hidden chrome, all challenges expanded).
- [x] **10-number provenance audit:** Verified 10 live rendered numbers across Finder, Place, Learn (Moon & Mars), and About byte-for-byte against `site/public/data/` (`manifest.json`, `cells.bin`, `target-moon-south-pole.bin`, `validation.json`).
- [x] **Fresh README screenshots & submission check:** Refreshed all 7 `docs/images/*.jpg` captures with full NASA imagery, confirmed `AI_NOTE` matches verbatim between `README.md` and `site/src/main.ts`, and verified zero console or page errors.

---

## Completed: Phase 6 — Editorial Design Overhaul & Interactive Polish

Completed visual and interaction overhaul addressing live review feedback across all routes while keeping `pipeline/` and `site/public/data/` frozen and byte-identical:

### 6.1 Bug Fixes & Interactive Polish
- [x] **Fix Place image wipe stacking bug (`site/src/compare.css`, `site/tests/place.spec.ts`):** Isolated `.cmp-p` stacking contexts (`isolation: isolate`), layered `.eimg` (`z-index: 1`) beneath `.timg` (`z-index: 2`) in wipe mode, clipped `.eimg` symmetrically at `--wipe` so Earth's cell outline and badge never cross the handle, and added a Playwright regression check verifying target-layer stacking over Earth on the right half.
- [x] **Balance Place hero left dossier cleanly without clutter (`site/src/card.ts`, `site/src/card.css`):** Replaced the ~250 px empty space in `.pl-hero` with a restrained 2-column hairline `Score overview` (linking straight to each challenge in Score breakdown and auto-opening its accordion) plus a single-line usable-months link above the docked score explainer.
- [x] **Custom styled pickers replacing all native `<select>` dropdowns (`site/src/picker.ts`, `site/src/picker.css`, `site/src/pages/find.ts`, `site/src/card.ts`):** Replaced `#pick-target` (Finder base site, grouped Moon/Mars with planetary dots), `#pick-type` (Finder terrain filter with tabular cell counts), and `#pl-preset` (Place mission preset) with a single accessible obsidian-glass ARIA combobox/listbox component supporting keyboard navigation (`ArrowUp/Down`, `Home/End`, `Enter`, `Escape`, typeahead), viewport-edge flipping, and updated Playwright tests.

### 6.2 Home 3D Lighting, Hero Framing & Known Sites Flow
- [x] **Restrained cinematic 3D planet lighting (`site/src/intro.ts`, `site/src/earth.ts`, `site/src/pages/learn.css`):** Enabled `ACESFilmicToneMapping` (`exposure: 0.8`), moved the key sun light to a grazing side-quarter angle (`(-7.2, 2.6, 3.2)`) with low warm ambient fill (`0.06`) for sculpted terminators, tightened Earth's atmosphere shell radius (`1.18 → 1.07`) with muted realistic horizon scatter, and harmonized Finder's MapLibre sky atmosphere and Learn's planet globes to match.
- [x] **Zero-overlap Home hero composition (`site/src/intro.ts`, `site/src/intro.css`):** Lowered Earth's opening limb to the lower quarter of the viewport and centered the hero lockup and CTA pills cleanly in dark starfield space between the top header and Earth's limb across desktop and mobile viewports.
- [x] **Home Known Sites typography & click-to-open dossier (`site/src/pages/home.ts`, `site/src/intro.css`, `site/tests/flow.spec.ts`):** Unified known-site list typography with `Barlow Condensed` + `JetBrains Mono`, tightened the chapter so the citation card and dossier link fit above the fold, kept hover/focus rotating Earth to preview each site, and made selecting any known site open its matched 0.5° grid cell directly in Place (`#/place?t=...&known=1&c=<cell>`).

### 6.3 Design System Overhaul (Uppercase Display Typography & Non-Blue/Green Obsidian Palette)
- [x] **Active Uppercase Display Typography (`site/package.json`, `site/src/main.ts`, `site/src/style.css`, all page CSS):** Preserved the uppercase editorial heading style while replacing artificially stretched `Archivo` with self-hosted **`Barlow Condensed`** (`@fontsource/barlow-condensed`, weights 500/600/700/800) paired with **`Inter Variable`** and **`JetBrains Mono Variable`**.
- [x] **Active Palette — Option A: Titanium & Oxide (`site/src/style.css`, `site/src/logo.ts`, `assets/logo.svg`, component CSS):** Neutral carbon-obsidian surfaces (`#070709` → `#0d0d10` → `#141419` → `#1c1c23`) with hairline borders, zero card gradient washes, chalk-titanium active controls (`#f2f0eb` / `#070709` ink), burnished solar-gold highlights & links (`#e5aa4c`), lunar bone (`#d8d3c8`) and Mars iron-oxide (`#e0623e`) world accents, muted slate Earth mark, and Inferno-aligned CVD-safe score bands (`#f5ebc4` / `#e5aa4c` / `#df6d47` / `#b87696`) with WCAG AA contrast everywhere.
- **Documented Swappable Alternatives (retained for future swaps):**
  - *Palette B — Helios Amber:* Warm carbon surfaces (`#080706` → `#161410`), burnished kapton-gold primary buttons (`#d9922e` / `#080706` ink) and `#f2b656` highlights, Mars `#df5d3b`, warm Inferno bands (`#fae89e` / `#e8a848` / `#d86840` / `#c4849f`).
  - *Palette C — Copper & Iris:* Cool graphite-obsidian surfaces (`#07070b` → `#14131d`), terracotta primary buttons (`#c9593a` / `#faf8f6` ink), direct 4-stop Inferno bands (`#f4d86c` gold / `#e8893c` tangerine / `#c44d6c` crimson / `#ad92db` iris-violet).
  - *Font 2 — Saira Variable (`@fontsource-variable/saira`):* Squared-off flight-hardware uppercase with continuous `wdth` + `wght` axes, paired with `Inter` + `JetBrains Mono`.
  - *Font 3 — IBM Plex Sans Condensed (`@fontsource/ibm-plex-sans-condensed`):* Full Plex superfamily (`Condensed` + `IBM Plex Sans` + `IBM Plex Mono`) for Apollo technical-manual poise.
  - *Font 4 — Big Shoulders Display (`@fontsource-variable/big-shoulders-display`):* Ultra-tall architectural uppercase for hero H1/H2 only, delegating micro-labels to `Inter` + `JetBrains Mono`.

### 6.4 Finder & Learn Minimalist Refinement
- [x] **Finder cockpit declutter (`site/src/pages/find.ts`, `site/src/ranklist.ts`, `site/src/rank.css`, `site/src/map.css`, `site/src/work.css`):** Tightened the sidebar vertical rhythm so ranked rows start higher with flat obsidian summary/control cards, Inferno-aligned CVD-safe band chips, and calmer map HUD styling while keeping every test contract intact.
- [x] **Learn visual field-guide upgrade (`site/src/pages/learn.ts`, `site/src/pages/learn.css`):** Upgraded `01 Hot and cold` to a shared real-scale °C axis showing Earth vs. Moon/Mars values and exact gap directly, pixel-aligned the `02 A year on Earth` scrubber directly above the 12-month matrix columns, darkened and desaturated `04 First tested on Earth` with a subtle lat/lon graticule, and harmonized all Moon/Mars accents to Titanium & Oxide.

### 6.5 Phase 6 Verification & Sign-off
- [x] **Full automated & visual QA:** `npm --prefix site run build` (clean, 0 errors), full `npm --prefix site test` (75 passed / 2 skipped / 0 failed across laptop and phone), `pytest` (139 passed / 1 skipped / 0 failed), `git diff testing..v3 -- site/public/data/ pipeline/` confirmed empty, live visual verification across desktop (`1440×900`) and phone (`390×844`), all 7 `docs/images/*.jpg` refreshed, and `AI_NOTE` parity confirmed.

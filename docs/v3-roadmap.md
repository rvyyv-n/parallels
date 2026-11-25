# v3 Roadmap

Status and remaining polish checklist for the `v3` site upgrade on top of the frozen v1.2/v1.3 scoring data (11 base sites, 91,971 land cells).

## Invariants

- **Data and scoring are frozen:** `pipeline/` and `site/public/data/` do not change. Every number on screen traces directly to `site/public/data/`.
- **Honest scientific framing:** Show `N / 100 match score` (never `% similar` or `% match`). Never label scoring as `"ML"` or `"AI"`. Every match states what matches, where it breaks in real units, and what Earth cannot copy.
- **Self-contained static site:** Zero external font hosts (`Archivo`, `Inter`, `JetBrains Mono` bundled locally). Only external tile hosts are `gibs.earthdata.nasa.gov` and `trek.nasa.gov`, with local fallbacks. No NASA logos or insignia.
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

## Active: UI Polish Pass

Finalize a cohesive visual design pass addressing team review feedback before Phase 5 sign-off:

- [ ] **Minimalist, low-text pass (especially Finder & Learn):** Cut redundant prose, dense metadata sentences, and visual noise across the sidebar summary card, rules line, preset strip, and Learn headers so scannable telemetry and visuals lead.
- [ ] **Deeper blue accent:** Shift the primary interactive blue (`--accent` / active pills / score highlight / slider fill) from bright cyan-blue to a slightly darker, deeper orbital blue with strong WCAG AA contrast on dark surfaces.
- [ ] **Finder Guided Tour placement:** Move `#tour` off its awkward spot beneath the right zoom capsule into a natural, understated HUD or navigation location (preserving `#tour` ID and keyboard focus return).
- [ ] **Finder Heatmap/Legend collapsed by default:** Start `#legend` minimised by default with a compact toggle pill showing the active land share (`Best 2% of land`), expanding smoothly for the histogram and share controls. Keep `site/tests/map.spec.ts` assertions accurate and honest.
- [ ] **Learn Moon/Mars visual upgrade:** Replace the cramped 3-column `GRAVITY | AIR | RADIATION` text block with clearer visual comparisons / scannable metric cards (and tighter citation formatting), and add stronger visual balance across the Moon & Mars sections. Fix `02 A year on Earth` `SELECTED MONTH` header alignment to match the right-aligned status pills.
- [ ] **Place breakdown heading:** Replace `"Challenge by challenge"` (`#pl-chs-h`) with a clearer, more intuitive heading (e.g., `"Score breakdown"` or `"How it scores by mission need"`).
- [ ] **Remaining visual bugs:**
  - Fix curved left-border corner horns on About `#checked` `.ab-tile` cards (use clipped `::before` bar).
  - Trigger `.pin-tag` declutter after MapLibre `idle` on initial Finder load so top-3 pills do not collide with nearby numbered pins.

---

## Pending: Phase 5 — Final QA & Release Sign-off

- [ ] **Full verification suite:** `npm --prefix site run build`, full `npm --prefix site test` (laptop + phone at `workers: 1`), `uv run pytest`, and `git diff testing..v3 -- site/public/data/ pipeline/` returns empty.
- [ ] **Resilience sweep:** Verify offline/GIBS-blocked fallback, `prefers-reduced-motion`, no-WebGL fallback, and `@media print` on Place.
- [ ] **10-number provenance audit:** Verify 10 live rendered numbers across Finder, Place, Learn, and About byte-for-byte against `site/public/data/`.
- [ ] **Fresh README screenshots & submission check:** Refresh `docs/images/` captures after UI Polish settles, confirm `AI_NOTE` consistency across `README.md` and `site/src/main.ts`, and verify zero console/page errors before merging or tagging.

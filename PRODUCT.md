# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site in `site/`: Vite + TypeScript, no framework. MapLibre GL JS 6 (orbital globe and flat Mercator projection) for Earth, three.js (lazy-loaded) for the 3D Home orbital stage, plain SVG charts and inline Lucide SVG icons, locally bundled self-hosted fonts (`Barlow Condensed` 500–800 via `@fontsource/barlow-condensed`, `Inter Variable` via `@fontsource-variable/inter`, and `JetBrains Mono Variable` via `@fontsource-variable/jetbrains-mono`), and Playwright tests (default 1 worker via `PW_WORKERS`, reduced motion, 1× DPR on phone, local tile stubs). It reads only the frozen pre-computed files in `site/public/data/` described by `site/src/contract.ts`, written by `uv run python -m pipeline.export`.

## Name

**Parallels.** Tagline: "Earth's closest parallels to every part of a Moon or Mars base."

## Users

Space Apps judges and curious newcomers first: they open the link cold, on a laptop or phone, and get a grounded result in under a minute without help. Mission planners and scientists choosing where to test hardware come second.

## Product Purpose

No single place on Earth can simulate a Moon or Mars base. Parallels splits base-building into challenges (surface, resources, dryness, heat swing, shelter, light and power, industrial sites, dust, atmosphere, signs of life) and ranks all 91,971 land cells on Earth (0.5° grid) against eleven Moon and Mars base sites, with a Balanced default preset, three mission presets (Rover mobility, Life support, Habitat structure), and live custom challenge weights. Source of truth for the core idea: `docs/team-plan.md`.

## Positioning

A discovery tool, not a hand-picked list of famous sites: every land cell is scored on 17 traits, and every match shows what is similar, how similar (`N / 100 match score` with its dataset and resolution—never `% similar` or `% match`), where it breaks in real units, and what Earth cannot copy. A public validation check grades known analogs against ordinary places and plain deserts, pass or fail.

## Visual System (`Titanium & Oxide`)

- **Surfaces & borders:** Neutral carbon-obsidian elevation ramp (`#070709` → `#0d0d10` → `#141419` → `#1c1c23`) with subtle hairline rules (`--rule` / `--rule-2`), zero card gradient washes, and uniform `1px` active borders across rounded cards.
- **Accents & bands:** Chalk-titanium primary controls (`#f2f0eb` with `#070709` ink), burnished solar-gold links and highlights (`#e5aa4c`), lunar bone (`#d8d3c8`), Mars iron-oxide (`#e0623e`), muted slate Earth mark, and Inferno-aligned CVD-safe score bands (`#f5ebc4` very close, `#e5aa4c` close, `#df6d47` partly, `#b87696` far off) paired with geometric markers and text labels.
- **Typography:** Uppercase editorial display headings in `Barlow Condensed` (500–800), body and UI labels in `Inter Variable`, and coordinates, ranks, scores, and telemetry in `JetBrains Mono Variable` (`tabular-nums` plus semantic HTML `<sup>` exponents via `fmtSup()`).
- **Display names:** Pure `targetName()` formatting (`site/src/format.ts`) renders all 11 base-site names in clean Title Case (e.g., `Moon's South Pole (Artemis III Regions)`, `Shackleton Rim`, `Arsia Mons Caves`) while preserving authentic IAU/NASA `de Gerlache Rim 2` and keeping `site/public/data/manifest.json` untouched.

## Architecture & Key Modules (`site/src/`)

- **App shell, routing & data:** `main.ts` (font imports, shell, footer), `router.ts` (hash router), `contract.ts` + `data.ts` (binary `.bin` + JSON loaders), `pages/ctx.ts` (shared state & query serialization), `score.ts` (weighted geometric-mean combiner), `zones.ts` (iterative quickselect cutoff & zone outlines), `rank.ts` (spread/top-20 selection & score bands), `format.ts` (`targetName()`, `fmtSup()`, number/coordinate/month formatters).
- **`intro.ts`:** Lazy-loaded three.js 3D orbital stage for Home with `ACESFilmicToneMapping` (`0.94` exposure), grazing side-quarter key sun lighting, dual-shell Rayleigh Earth atmosphere, two-layer starfield, pulsing site reticles, viewport-clamped labels, and WebGL `pause()`/`resume()` lifecycle.
- **`earth.ts`:** MapLibre GL 6 Earth globe & flat projection (`#earth`), dual-zoom canvas heatmap painter, 3-ring concentric feathered GeoJSON polar caps (`84.3°`, `84.68°`, `84.96°` to `±90°`, visible in globe mode and hidden in flat Mercator) eliminating high-latitude polar cone pinch, marker/tag decluttering, and screen-space analog hit fallback.
- **`picker.ts`:** Accessible custom obsidian-glass ARIA combobox/listbox component replacing all native `<select>` dropdowns—supports optional `prefix` labels, one-line option `sub` descriptions, grouped options with planetary dots, tabular cell counts, keyboard navigation (`ArrowUp/Down`, `Home/End`, `Enter`, `Escape`, typeahead), and viewport-edge flipping.
- **`compare.ts`:** Matched 1:1 ground-scale imagery comparator (`70 km | 140 km` with `25 km` / `50 km` scale bar, `Side by side | Wipe`, `Relief | Satellite`, `Overlays` toggle) with blank-tile detection and bundled canvas fallbacks.
- **`card.ts` & `traits.ts`:** Place Mission Dossier (`Score overview`, rounded SVG score ring, `What matches` / `Where it breaks`, `Score breakdown` range-and-gap bullet plots, interactive 12-month `Seasons` calendar strip, `Earth cannot copy` telemetry, and `Check it yourself` actions via `export.ts`).
- **`vitals.ts`:** Shared proportional telemetry model (`Gravity`, `Air`, `Radiation`, Earth-vs-world ratio badges, deduplicated source links) rendered consistently on Place and Learn.
- **Finder HUD & flows:** `finder-hud.ts` (starfield canvas, live 36-bin `sqrt` score histogram, collapsible target preview card, local ARIA place/coordinate search), `ranklist.ts` (summary bar, `Rank | Region` toggle, Top 20 list, sliders, compare table), `hovercard.ts`, `controls.ts`, `tour.ts`, `worlds.ts`, `icons.ts`, `sections.ts`.

## Imagery Stack

All map and surface imagery is display-only (never scored), with bundled local fallbacks (`site/public/img/`) if remote tiles are unavailable:

- **Earth Relief (`ASTER GDEM`):** NASA / METI ASTER GDEM Greyscale Shaded Relief via NASA GIBS (`level 12`, 30 m source)—default on polar lunar targets (`Moon's South Pole`, `Shackleton Rim`, `de Gerlache Rim 2`) so landforms compare directly with LOLA shaded relief; falls back to Blue Marble beyond `±83°`.
- **Earth Satellite (`Sentinel-2 Cloudless`):** ESA Copernicus Sentinel-2 Cloudless 2024 via EOX (`tiles.maps.eox.at`, 10 m source, CC BY 4.0)—default on Mars and non-polar targets, with blank-tile fallback to Blue Marble at high Antarctic latitudes.
- **Earth Base (`Blue Marble`):** NASA GIBS Blue Marble Shaded Relief and Bathymetry (live tiles + bundled 1K/4K/8K copies for Finder backdrop, 3D Home Earth, hover cards, popups, and fallbacks).
- **Moon & Mars (`Moon Trek` / `Mars Trek`):** NASA Moon Trek LOLA south-pole shaded relief (`87.5° S` to pole) and LRO WAC global mosaic (`303 ppd`), NASA Mars Trek Viking MDIM 2.1 colour mosaic, plus bundled CGI Moon Kit and Viking MDIM 2K/4K textures for 3D Home globes, thumbnails, and offline fallbacks.

## Pages and Main Flow

1. **Home (`#/`):** Full-viewport calibrated 3D orbital stage (Earth horizon with Rayleigh limb, Moon, and Mars) leading newcomers through six scroll chapters: hero lockup & Guided Tour launch, all-land counts, Title Case Moon and Mars site pickers with orbital thumbnails, Known Sites chapter (hover rotates Earth; click opens the matched 0.5° grid cell directly in Place), and the Finder entry.
2. **Finder (`#/find`):** Split layout with a scrollable left cockpit sidebar (custom grouped base-site picker, 3-cell summary telemetry bar + `+ Known sites` pill, single-row segmented mission presets, paired `Filters & weights` drawer + `Rank | Region` toggle, quiet 5-band key, Top 20 list with CVD-safe chips and Compare checkboxes) beside the MapLibre orbital globe (feathered polar caps, floating glass top HUD with `/` local search, `Globe | Flat` toggle, `Known analogs` switch, overlay opacity slider, collapsible legend pill with live 36-bin histogram, collapsible target preview card, hover card, and click popup).
3. **Place (`#/place`):** Connected `Previous | N of 20 | Next` navigation bar, Mission Dossier hero (custom `Focus` preset picker with one-line mission descriptions, `Year-round` dot toggle, `Copy link` / `Copy coords`, rounded SVG score ring, clickable 2-column `Score overview`, and folded score/headline notes) paired beside the 1:1 `70 km | 140 km` `Relief | Satellite` & `Side by side | Wipe` imagery comparator; followed by `What matches` / `Where it breaks`, `Score breakdown` (`Expand all` / `Collapse all`, range-and-gap bullet plots), interactive 12-month `Seasons` calendar strip, proportional `Earth cannot copy` telemetry, and `Check it yourself` (CSV export, NASA Worldview, NASA Moon/Mars Trek, Print / Save PDF).
4. **Learn (`#/learn`):** Visual field primer with Moon/Mars switcher: proportional surface vitals (`Gravity`, `Air`, `Radiation`), shared real-scale °C temperature gap axis (`01`), interactive 12-month seasonality matrix (`02`), hardware weight calculator & dual-bar `What Earth cannot copy` (`03`), darkened graticule map of known analogs with 44 px pins (`04`), and NASA photo pairs with lightbox inspection (`05`).
5. **About (`#/about`):** Scroll-spy table of contents, 5-step scoring strip, public validation chart and folded progression/misses across all runs, Challenge Guide 6 benchmarks & 7 questions, agency-filterable 31-dataset and imagery/code catalogue, limits ("Not in this version"), and team credits.

## Capabilities and Constraints

- **Eleven targets:** Six on the Moon (`Moon's South Pole (Artemis III Regions)`, `Haworth`, `Malapert Massif`, `Nobile Rim 1`, `de Gerlache Rim 2`, `Shackleton Rim`) and five on Mars (`Jezero`, `Gale`, `Arcadia Planitia`, `Deuteronilus Mensae`, `Arsia Mons Caves`).
- Only traits measurable on both sides are scored; unmeasured traits appear as labels marked "not scored" with the reason.
- No NASA logos, flags, or insignia. Logo mark: three circles cut by shared parallels.
- Built to run untouched through January 2027: zero API keys, zero backend servers, zero external font CDNs; the only live requests are NASA GIBS, NASA Trek, and EOX Sentinel-2 image tiles, all with Blue Marble and bundled local fallbacks.

## Product Principles

- Every number on screen traces directly to `site/public/data/`; missing data shows "no data" or "not scored" with the reason.
- Never show an overall match score without its breakdown by challenge.
- Show the real-unit gap alongside the rank: Earth never reaches lunar cold.
- Keep interfaces calm, scannable, and visual-first—avoid dense walls of explanatory text where telemetry, charts, or imagery communicate faster.
- One clear flow beats cluttered controls.

## Accessibility & Inclusion

WCAG AA contrast on carbon-obsidian surfaces; colour is never the sole signal (geometric pips + text labels); full keyboard navigation (custom ARIA pickers, Top 20 list, and search combobox always provide a non-map route); tap targets at least 44 px on mobile; `prefers-reduced-motion` disables transitions, starfield animation, and camera flights; graceful fallback without WebGL (`.intro-still` on Home, `.nogl` on Finder) and print-ready Place dossiers (`@media print`).

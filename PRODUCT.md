# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site in `site/`: Vite + TypeScript, no framework. MapLibre GL JS 6 (globe and flat projection) for Earth, three.js (lazy-loaded) for the 3D Home orbital stage, plain SVG charts, locally bundled variable fonts (`Archivo`, `Inter`, `JetBrains Mono` via `@fontsource-variable/*`), and Playwright tests (default 1 worker via `PW_WORKERS`). It reads only the pre-computed files in `site/public/data/` described by `site/src/contract.ts`, written by `python -m pipeline.export`.

## Name

**Parallels.** Tagline: "Earth's closest parallels to every part of a Moon or Mars base."

## Users

Space Apps judges and curious newcomers first: they open the link cold, on a laptop or phone, and get a grounded result in under a minute without help. Mission planners and scientists choosing where to test hardware come second.

## Product Purpose

No single place on Earth can simulate a Moon or Mars base. Parallels splits base-building into challenges (surface, resources, dryness, heat swing, shelter, light and power, industrial sites, dust, atmosphere, signs of life) and ranks all 91,971 land cells on Earth (0.5° grid) against eleven Moon and Mars base sites, with a Balanced default preset, three mission presets (Rover mobility, Life support, Habitat structure), and live custom challenge weights. Source of truth for the core idea: `docs/team-plan.md`.

## Positioning

A discovery tool, not a hand-picked list of famous sites: every land cell is scored, and every match shows what is similar, how similar (`N / 100 match score` with its dataset and resolution), where it breaks (in real units), and what Earth cannot copy. A public validation check grades known analogs against ordinary places and plain deserts, pass or fail.

## Pages and Main Flow

1. **Home (`#/`):** Full-viewport 3D orbital stage (Earth with atmospheric limb halo, Moon, and Mars) walking newcomers directly into picking one of the eleven Moon or Mars base sites, or launching the Guided Tour.
2. **Finder (`#/find`):** Split layout with a scrollable left telemetry sidebar (summary, mission presets, custom challenge weights, terrain/year-round filters, compare picker, and region-grouped Top 20 list with CVD-safe challenge strips) beside an orbital MapLibre globe with a floating HUD (local search, Globe/Flat toggle, known analog overlay, opacity slider, collapsible legend/histogram, hover preview card, and click popup).
3. **Place (`#/place`):** Side-by-side Mission Dossier and NASA ground-scale imagery comparator (Landsat WELD beside LOLA shaded relief or Viking colour, with Side-by-side / Wipe modes and Overlays toggle), rounded SVG score ring, What matches / Where it breaks summary, range-and-gap bullet plots for every trait, seasonal calendar, What Earth can't copy, and CSV / NASA Worldview / Trek export.
4. **Learn (`#/learn`):** Visual primer on the Moon and Mars base sites: measured conditions, what Earth cannot copy, interactive monthly seasonality matrix, gravity weight comparisons, interactive map of known analogs, and NASA photo pairs with lightbox inspection.
5. **About (`#/about`):** Plain-language scoring explanation, public validation results across all runs (pass and fail), filterable dataset/image catalogue with licences, Challenge Guide alignment, limits ("Not in this version"), and credits.

## Capabilities and Constraints

- **Eleven targets:** Six on the Moon (combined south pole, Haworth, Malapert Massif, Nobile Rim 1, de Gerlache Rim 2, Shackleton rim) and five on Mars (Jezero, Gale, Arcadia Planitia, Deuteronilus Mensae, Arsia Mons caves).
- Only traits measurable on both sides are scored; unmeasured traits appear as labels marked "not scored" with the reason.
- No NASA logos, flags, or insignia. No AI-made images except the logo (three circles cut by shared parallels, named in the footer's AI note).
- Built to run untouched through January 2027: zero keys, zero servers, zero external font CDNs; the only live calls are NASA GIBS and NASA Trek image tiles, with bundled local fallbacks.

## Product Principles

- Every number on screen traces directly to `site/public/data/`; missing data shows "no data" or "not scored" with the reason.
- Never show an overall match score without its breakdown by challenge.
- Show the real-unit gap alongside the rank: Earth never reaches lunar cold.
- Keep interfaces calm, scannable, and visual-first—avoid dense walls of explanatory text where telemetry, charts, or imagery communicate faster.
- One clear flow beats cluttered controls.

## Accessibility & Inclusion

WCAG AA contrast on dark slate surfaces; colour never the sole signal (geometric pips + text labels); full keyboard navigation (the Top 20 list and search combobox always provide a non-map route); tap targets at least 44 px on mobile; `prefers-reduced-motion` disables transitions and camera flights; graceful fallback without WebGL.

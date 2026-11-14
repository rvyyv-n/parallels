# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site in `site/`: Vite + TypeScript, no framework. MapLibre GL JS 6 (globe projection) for Earth, three.js (lazy-loaded) for the 3D intro, plain SVG charts, Playwright tests. It reads only the pre-computed files in `site/public/data/` described by `site/src/contract.ts`, written by `python -m pipeline.export`. Vercel builds `site/` on every push to `v1`.

## Name

**Parallels.** Tagline: "Earth's closest parallels to every part of a Moon or Mars base."

## Users

Space Apps judges and curious newcomers first: they open the link cold, on a laptop or phone, and must get a result in under a minute without help. Mission planners and scientists choosing where to test gear come second.

## Product Purpose

No single place on Earth can simulate a Moon or Mars base. Parallels splits base-building into challenges (surface, resources, dryness, heat swing, shelter, light and power, industrial sites, dust, atmosphere, signs of life) and ranks all of Earth's land, cell by cell on a 0.5° grid, against a Moon south-pole or Mars target, for a chosen mission filter (rover mobility, life support, habitat structure) or hand-set weights. Source of truth: `docs/team-plan.md`.

## Positioning

A discovery tool, not a list of famous sites: every land cell is scored, and every match says what is similar, how similar (a number with its dataset and resolution), where it breaks (in real units), and what Earth can't copy. A public check shows known analogs against ordinary places and plain deserts.

## Main flow

1. The page opens on a 3D scene: the logo's Earth, Moon and Mars come alive, joined by a cyan line from Earth to the chosen base site. Beside it, two steps with plain buttons: "Where is the base?" and "What are you testing?". Clicking the Moon or Mars in the scene also picks that world. The best match and its score are already shown, and "See Earth's top 10" (or clicking Earth) drops into the explorer, where the first match's scorecard is already open. A shared link with a place in it skips straight to the explorer.
2. The explorer has two columns: the top 10 on the left and the Earth map, coloured by match, filling the rest. Rows and pins highlight each other.
3. Click a row or any land cell: the map flies there and the full-width match view under the map updates. It opens with the Earth cell and the Moon or Mars site side by side at the same ground scale (with a wipe mode), then the score with a band word, challenge tiles with icons, each trait as a bar against its target, "Where it breaks" and "Earth can't copy".

## Capabilities and Constraints

- Targets in v1: the Moon's south pole (with the nine Artemis III regions) and Jezero crater. More Mars sites later.
- Only what both sides can measure is scored; the rest appears as labels marked "not scored" with the reason.
- While `manifest.sample` is true, a banner says every number is a made-up test value.
- No NASA logos, flags or insignia. No AI-made images except the logo (three circles cut by shared parallels, drawn with AI and named in the footer's AI note), which sits beside the typeset wordmark; a cyan parallel runs through the Moon or Mars circle to match the chosen target. AI-use note in the footer.
- Lasts untouched until 26 January 2027: no keys, no server; the only live calls are NASA GIBS and NASA Trek image tiles, and bundled images take over if they fail.

## Evidence on Hand

Whatever the pipeline exports. Display imagery: NASA GIBS Blue Marble, NASA SVS CGI Moon Kit (LROC colour), Viking MDIM 2.1 colour mosaic (NASA/USGS via Mars Trek), Landsat WELD true colour (via GIBS) and LOLA south-pole shaded relief (via Moon Trek) for the close-ups. No testimonials, users or endorsements exist; don't invent any.

## Product Principles

- Every number on screen comes from the data files; missing shows "no data" or "not scored" with the reason.
- The overall match never appears without its challenge rows.
- Show the gap, not just the rank: Earth never reaches lunar cold.
- Motion only where it explains a change.
- One clear flow beats many features.

## Accessibility & Inclusion

WCAG AA contrast on black; readable on a phone in daylight; keyboard reachable (the top 10 list is the keyboard and screen-reader route, the map is never the only way in); colour never the only signal; tap targets at least 44 px; `prefers-reduced-motion` gives instant states and no camera flights. Without WebGL the list, scorecards and a flat target image still work.

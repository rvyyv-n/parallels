# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site in `site/`: Vite + TypeScript, no framework. MapLibre GL JS 6 (globe projection) for Earth, three.js (lazy-loaded) for the Moon and Mars globes, plain SVG charts, Playwright tests. It reads only the pre-computed files in `site/public/data/` described by `site/src/contract.ts`, written by `python -m pipeline.export`. Vercel builds `site/` on every push to `v1`.

## Name

**Parallels.** Tagline: "Earth's closest parallels to every part of a Moon or Mars base."

## Users

Space Apps judges and curious newcomers first: they open the link cold, on a laptop or phone, and must get a result in under a minute without help. Mission planners and scientists choosing where to test gear come second.

## Product Purpose

No single place on Earth can simulate a Moon or Mars base. Parallels splits base-building into challenges (surface, resources, dryness, heat swing, shelter, light and power, industrial sites, dust, atmosphere, signs of life) and ranks all of Earth's land, cell by cell on a 0.5° grid, against a Moon south-pole or Mars target, for a chosen mission filter (rover mobility, life support, habitat structure) or hand-set weights. Source of truth: `docs/team-plan.md`.

## Positioning

A discovery tool, not a list of famous sites: every land cell is scored, and every match says what is similar, how similar (a number with its dataset and resolution), where it breaks (in real units), and what Earth can't copy. A public check shows known analogs against ordinary places and plain deserts.

## Main flow

1. The page opens on a sentence that is the control: "Earth's best places to test [mission filter] for [target]". The first match's scorecard is already open.
2. Earth's land is coloured by match on a globe; the top 10 are listed beside it; the target world turns to its site.
3. Click a row or any land cell: the Earth globe flies there, a line links it to the target site, and the scorecard opens with each challenge's traits drawn as gap rulers.

## Capabilities and Constraints

- Targets in v1: the Moon's south pole (with the nine Artemis III regions) and Jezero crater. More Mars sites later.
- Only what both sides can measure is scored; the rest appears as labels marked "not scored" with the reason.
- While `manifest.sample` is true, a banner says every number is a made-up test value.
- No NASA logos, flags or insignia. No AI-made images. Typeset wordmark only. AI-use note in the footer.
- Lasts untouched until 26 January 2027: no keys, no server; GIBS tiles are the only live call and a bundled Blue Marble image sits under them.

## Evidence on Hand

Whatever the pipeline exports. Display imagery: NASA GIBS Blue Marble, NASA SVS CGI Moon Kit (LROC colour), Viking MDIM 2.1 colour mosaic (NASA/USGS via Mars Trek). No testimonials, users or endorsements exist; don't invent any.

## Product Principles

- Every number on screen comes from the data files; missing shows "no data" or "not scored" with the reason.
- The overall match never appears without its challenge rows.
- Show the gap, not just the rank: Earth never reaches lunar cold.
- Motion only where it explains a change.
- One clear flow beats many features.

## Accessibility & Inclusion

WCAG AA contrast on black; readable on a phone in daylight; keyboard reachable (the top 10 list is the keyboard and screen-reader route, the map is never the only way in); colour never the only signal; tap targets at least 44 px; `prefers-reduced-motion` gives instant states and no camera flights. Without WebGL the list, scorecards and a flat target image still work.

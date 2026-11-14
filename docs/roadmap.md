# Roadmap: the design rebuild (15 November)

Agreed with the team on 15 November after a review of the live site and a study of competing entries and professional map products. Three builders work in parallel, each in its own checkout and each on its own files. The orchestrator checks every result (build, tests, the real page at 1440 and 390 wide) and merges them in the order below, one commit per group.

## Why

- The small Moon/Mars globe and the Earth globe add little function.
- Clicking a place should show the Earth surface next to the Moon or Mars surface.
- The scorecard is text and sliders with no icons or hierarchy.
- The first screen is full width; the sections below are a narrow centred column.

## Group 1: explorer layout (merged first)

Files: `main.ts`, `style.css`, `earth.ts`, `intro.ts`, `intro.css`, `index.html`, the flow tests.

1. Remove the small Moon/Mars globe and the line that joined it to the map. The 3D worlds stay in the intro.
2. Two columns: the top 10 on the left, the Earth map filling the rest.
3. The picked place opens a full-width match view under the map. The map flies to the place first, and the top of the match view shows above the fold.
4. List and map are linked both ways: hovering a row highlights its pin and the reverse, and a "back to selected" button recentres the map.
5. A map status strip with coordinates and a scale bar.
6. A skip link on the intro.

## Group 2: the match view (merged second)

Files: `card.ts`, `card.css`, new `compare.ts` and `icons.ts`.

1. Side-by-side close-up at the top: the Earth cell and the Moon or Mars site at the same ground scale, with a shared scale bar and a drag divider. Earth from NASA GIBS; Mars from the Viking mosaic and the Moon's south pole from the LOLA shaded relief, both NASA Trek tiles. The bundled images take over if tiles fail.
2. Verdict line first: place, match score, a band word and the limiting trait.
3. Challenges as a grid of tiles with icons and score bars.
4. Each trait as one bullet bar: a bar for "here", a tick for the target, the gap in plain text.
5. One "Sources and notes" fold per trait, with dataset names as chips and a measured or estimated badge.
6. "Where it breaks" and "Earth can't copy" as their own strips with icons, on every match.

## Group 3: sections below the explorer (merged third)

Files: `sections.ts`, `sections.css`, the validation and nav tests.

1. Every section becomes a full-width band that lines up with the intro, with content in grids.
2. "How we checked it" becomes a visual report: the headline count, one marker per run, and each check drawn as a result bar against its pass mark. Failed checks stay open and come first.

## Rules for every group

- Never invent a value. Missing data shows as "no data". Every number keeps its dataset name reachable. Text may fold; it may not disappear. No number or score changes.
- Only files in `site/`, and not `site/public/data/` or `site/src/contract.ts`.
- Keyboard reachable, 2 px cyan focus rings, 44 px tap targets on phones, reduced motion respected, no sideways scroll at 375 px.
- The site must keep working untouched until 26 January 2027: any new live tile source needs a bundled fallback.

## If time runs out

Keep, in this order: the side-by-side close-up, the two-column layout with the match view, the bullet bars, the full-width bands, the visual check report.

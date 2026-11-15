# v1 roadmap: the next round of explorer changes

The build brief for one orchestrator (Opus at xhigh effort) and its Opus builders. It turns the team's notes into feature groups, in build order, with a pass/fail check for each one. Resume at the first unticked box.

The team's notes, in their words:

1. Title pages with different sites to choose from.
2. Site highlight on hover.
3. Ranked on all factors rather than just one, then let the user choose between them.
4. The heat map shows only the places the scoring picks.
5. A menu like the reference when the user hovers on a site.
6. The site is clearly divided across different pages, with the relevant information on each page: nothing misleading, and nothing extra that does not belong on that page.
7. A sidebar on the left of the Finder page, like the reference, with the results ranked and colour-coded on every factor.

Reference screenshots for the notes are listed in the handoff prompt, not in this repo. Take ideas from them at the level of layout and behaviour. Write all code fresh; copy no code, text or images. Name no other project anywhere in the repo.

---

## Settled with the team

| # | Question | Decision |
|---|---|---|
| S1 | Which Moon sites get their own entry? | Four of NASA's nine Artemis III regions as their own targets: Malapert Massif, Haworth, Nobile Rim 1 and de Gerlache Rim 2. Keep the combined south-pole target. Add the Shackleton rim if its USGS gazetteer entry works with the same polar maps. No Marius Hills pit: it needs new near-side Moon maps. |
| S2 | What does the list rank by when the user arrives? | A new "Balanced" preset where every challenge counts the same. The three mission filters are one-click presets. |
| S3 | How much land does the map show? | The best 2% of ranked land, with a switch for 1%, 5%, 10% and all land. |
| S4 | Does the Balanced preset get a validation run? | Yes. Run the existing checks on it and publish the result, pass or fail, as a run designed after the first. |

---

## Ground rules

- **Branch.** Work on `v1-next`, cut from `v1`. Push after each working group; Vercel builds a preview link for it. Merge `v1-next` into `v1` (production) only at a checkpoint the user approves. Pull before each group: the other account may also push to `v1`.
- **Method is frozen.** Don't change trait weights, challenge weights or the three mission filters. New views (the Balanced ranking, the focused map) read the scores we already publish. Pipeline work in group P adds targets and columns; it does not retune anything.
- **No invented numbers.** Every number on screen comes from `site/public/data/`. A badge or label that needs a value we don't publish waits for group P, or is left out.
- **No misleading words.** The match score is a rank-based score from 0 to 100. Show it as "92 / 100 match score", never "92% similar" or "92% match". Our scoring ranks traits against all of Earth's land and combines them with a weighted geometric mean, with k-means clusters as a check. It is not machine learning: don't call it "ML" or "AI" on the site. "New" means "not in our list of known analog sites", and the label says so the first time it appears.
- **Who does what.** The orchestrator owns `site/src/main.ts` (except during group R), `site/src/contract.ts`, `site/src/style.css`, the tests' shared helpers, builds, the full test suite, commits and pushes. Each builder owns only the files listed for its group, runs its own Playwright spec on its own dev port (`npx vite --port 519x --strictPort`, `BASE_URL=http://localhost:519x`), and never commits or builds `dist/`.
- **Models.** Orchestrator: Opus at xhigh. Builders: Opus at medium for ordinary groups, high for groups marked *high*. Checks (running tests, reading numbers back): Sonnet at medium. One builder per group. No more than two builders at once.
- **Commits.** One group per commit, tests green. Short imperative subject in the project's words. No `Co-Authored-By` trailers, no "Generated with" footers.
- **Checkpoint after each pass.** Deploy the preview, take screenshots at 1440×900 and 390×844, and show the user. Ask questions with the popup tool, with suggested options.

---

## The pages

Note 6 is the frame for everything else, so it is built first. The site becomes separate pages, each with one job. Content that doesn't serve a page's job moves to the page it belongs on, or goes.

| Page | Route | Its job | What is on it | What is not on it |
|---|---|---|---|---|
| Home | `#/` | Say what Parallels is and send the user to the Moon or Mars | The opening story (no place on Earth is the Moon or Mars; every patch of land is scored), what Earth can't copy (gravity, air, radiation), two big choices: the Moon, Mars | Site lists, rankings, scores |
| The Moon | `#/moon` | Pick a Moon base site | The title page (note 1): every Moon target with an image and its name, the planet beside it; for the site in focus, its measured values with their datasets, what a base there must solve, and where crews already rehearse on Earth | Earth rankings, the map of Earth |
| Mars | `#/mars` | Pick a Mars base site | Same layout as the Moon page, for the Mars targets | Same as the Moon page |
| Finder | `#/find?t=…&f=…` | Find the Earth places that best match one site | A left sidebar (note 7) with the summary, presets, weights and ranked list; the focused map (note 4) beside it, the hover card (notes 2, 5), the summary, the ranked list with factor strips and weights (note 3), presets, terrain filter, year-round switch | The full scorecard, validation, the dataset list |
| Place | `#/place?t=…&c=…` | Explain one match | Earth and the base site side by side at one scale, the score, what matches, where it breaks, the seasons, what Earth can't copy, and the dataset behind each value | Other places' rankings |
| Checks | `#/checks` | Show how we tested the method | Every validation run, failures included | Anything else |
| About | `#/about` | Method, data and credits | How scoring works in plain words, the challenge, every dataset with its link and licence, limits ("Not in this version"), the "How we used AI" note, team and credits | Results |

A top bar on every page links Home, The Moon, Mars, Finder, Checks and About, and shows the current site once one is picked. The footer with the AI note is on every page. Old shared links (`/?t=…&f=…&c=…`) open the Place page for that cell.

---

## Pass 1: pages and data (two builders in parallel)

### Group R: split the site into pages (*high*)

Owner files: `site/src/main.ts` (during this pass only), a new `site/src/router.ts`, a new `site/src/pages/` folder (one module per page), `site/src/sections.ts`, `site/src/worlds.ts`, `site/tests/pages.spec.ts`, and updates to `site/tests/flow.spec.ts`.

- [x] **R1. Router.** Hash routes, so the site stays static with no server config. Each route renders its page into `#app`, sets the document title, moves focus to the page heading and scrolls to the top. The back button works. Data loads once and is shared between pages.
  → verify: every route in the table opens its page with its heading; Back returns to the previous page.
- [x] **R2. Move the content.** Move each part of today's single page to its page in the table: the opening chapters to Home, the Moon and Mars chapters and the Worlds section to the Moon and Mars pages, the explore stage to Finder, the scorecard to Place, "How we checked it" to Checks, the challenge, data and limits sections to About. The "What are you testing?" chapter becomes the preset row on Finder.
  → verify: no page shows any item from the "What is not on it" column (a test checks for the main selectors).
- [x] **R3. Old links.** `/?t=…&f=…&c=…` redirects to `#/place?t=…&f=…&c=…`; `/?t=…` redirects to `#/find?t=…`.
  → verify: the shared-link test in `flow.spec.ts`, updated for the new route, passes.
- [x] **R4. Nav and footer.** One top bar and one footer, as in the table, on every page. On a phone the nav folds into a menu button.
  → verify: at 390 px every nav item can be reached, and nothing overflows.

Then the orchestrator takes `main.ts` back and commits the stubs for pass 2:

| Module | Exports | Group |
|---|---|---|
| `site/src/zones.ts` | `focus(score, share) → { keep: Uint8Array, outline: number[] }` | B |
| `site/src/hovercard.ts` | `createHoverCard(el, hooks)`, `.show(i, x, y)`, `.hide()` | B |
| `site/src/sitepages.ts` | `sitePage(m, body)`, `wireSitePage(el, hooks)` | A |
| `site/src/rank.ts` | `rankSites(score, cells, opts) → { groups, rows }`, `band(v)` | C |
| `site/src/ranklist.ts` | `renderRankList(el, rows, ctx)`, `renderWeights(el, ctx)` | C |

### Group P: data for the new views (*high*)

Owner files: `pipeline/` (targets, config, export, publish, validate, tests), `site/public/data/`.

- [x] **P1. Moon sites as targets (S1).** The pipeline already scores each Artemis III region on its own (`targets.py`: `targets = [moon_target(regions)] + regions`), but export publishes only `cfg["default_targets"]`. Add the S1 regions to a new config `pipeline/config/v1.3.json` and publish a target file for each. For the Shackleton rim, add it to `MOON` in `targets.py` with its USGS gazetteer position and the same polar maps (LOLA, Diviner, PGDA); drop it if any of them has no value there.
  → verify: `python -m pytest pipeline/tests` passes; `manifest.json` lists each new target with a `.bin`; every value in each new target names a dataset in `manifest.datasets`.
- [x] **P2. Balanced preset (S2).** Add a fourth filter `balanced` with equal challenge weights for both bodies. Export gives it `score:balanced`, `score:balanced:yr` and `stable:balanced`, like the other filters.
  → verify: a test finds the old `score:rover|life_support|habitat` columns unchanged for every existing target.
- [x] **P3. Stability as a share.** Today `stable:<filter>` is 1 or 0. Also export `keep:<filter>` as one byte, 0–100: the percent of robustness runs that kept the cell in the top list (`publish.py` already computes `hits / runs`).
  → verify: cells with `stable = 1` have `keep` at or above the publish threshold.
- [x] **P4. Validation for Balanced (S4).** Run `validate.py` on `balanced` and append the result to `validation.json` under `more_runs`, labelled as designed after the first run, with its pass marks unchanged. New Moon targets with no checks of their own say "not checked on its own; the combined south-pole target is checked".
  → verify: the Checks page shows the new run, including any checks that fail.
- [x] **P5. Publish.** Re-run export, copy the files to `site/public/data/`, check each target file stays near today's 3–4 MB (each loads only when its site is picked), and update `contract.ts` (orchestrator) for the new columns.
  → verify: the full Playwright suite passes on the new data.

**Checkpoint 1.** Preview link and a screenshot of each page. Ask the user whether each page holds the right things.

---

## Pass 2: the Finder map and the Moon and Mars pages (two builders in parallel)

### Group B: focused map, hover card and click popup

Owner files: `site/src/earth.ts`, `site/src/zones.ts`, `site/src/hovercard.ts`, a new `site/src/map.css`, `site/tests/map.spec.ts`.

- [x] **B1. Focused heat map (S3).** Paint only the cells in the best 2% of ranked land (the threshold is the score at that percentile of ranked cells). Outside the zones: no colour, and the Earth image dimmed a little. Draw a thin glowing outline around each zone (marching squares on the 720×360 grid) on the existing canvas sources. Inside, keep the current colour ramp. The legend says "Best 2% of land" and has the 1/2/5/10%/all-land switch. The terrain filter still applies on top.
  → verify: at 2%, the number of painted cells equals `ceil(0.02 × ranked)`, give or take ties; "all land" paints every ranked cell, as today.
- [x] **B2. Hover card.** Hovering a numbered pin, a list row, or a cell inside a zone shows a card next to the pointer: a 2°×2° NASA Blue Marble image around the cell (GIBS tiles, as `groundThumb` already uses) with a square marking the 50 km cell, the image credit, "#rank Name", latitude and longitude, the match score out of 100, a "New candidate" badge when the cell is more than `rare_km` from any known analog (from `nearest_analog_km`), and "click to open". The card never covers the hovered point, stays inside the map, and hides on `mouseleave` or Escape. The top 3 pins also show a small name and score label.
  → verify: hovering pin 1 shows the same name, coordinates and score as list row 1; hovering a list row shows the card at the pin; on a phone nothing shows until a tap.
- [x] **B3. Click popup.** Clicking a pin or a zone cell opens a pinned popup: image, name, coordinates, a score ring, "in the top X% of land" (from `rankOf` over ranked cells), the New candidate badge, and a "Details" button that opens the Place page for that cell. Close with ×, Escape or a click elsewhere. A tap on a phone opens the same popup.
  → verify: "Details" opens `#/place` with that cell, and its heading shows the same name.

### Group A: the Moon and Mars pages

Owner files: `site/src/sitepages.ts`, `site/src/pages/moon.ts`, `site/src/pages/mars.ts`, `site/src/intro.ts`, `site/src/intro.css`, `site/tests/sites.spec.ts`.

- [x] **A1. Title page.** A large "THE MOON" or "MARS" heading, one line ("Choose a lunar site to see how Earth compares"), then a list with a square image and the name of every target on that body, with the planet large on the right half (the existing 3D scene). On a phone the list sits under a smaller planet.
- [x] **A2. Site images.** Each square shows real imagery of that site, cropped from the shipped Moon (LRO) or Mars texture and centred on the target. Use a polar view for the south-pole sites so they don't smear. Credit the imagery on the About page.
- [x] **A3. Hover, focus and pick.** Hovering or focusing a site lights its spot on the planet with a ring, turns the planet towards it, and shows that site's measured values, what a base there must solve, and where crews rehearse on Earth (from the old Worlds section). "Find Earth's matches" opens the Finder for that site. Keyboard: the arrow keys move through the list, Enter picks.
  → verify: the page lists every target of the body in `manifest.targets`; picking the third Moon site opens `#/find?t=<its id>`; at 390 px nothing overflows.

**Checkpoint 2.** Preview link and the flow from Home to a Place on a phone and on a laptop. Ask what to change.

---

## Pass 3: the ranked list

### Group C: ranked on every factor, the user picks the weights (*high*)

Owner files: `site/src/rank.ts`, `site/src/ranklist.ts`, `site/src/score.ts`, a new `site/src/rank.css`, `site/src/pages/find.ts` (layout only), `site/tests/rank.spec.ts`. Needs P2 and P3.

- [ ] **C0. Left sidebar (note 7).** On laptops the Finder page is a fixed-width sidebar on the left (about 400 px) and the map fills the rest. The sidebar scrolls on its own; the map stays put. Top to bottom it holds: the summary card (C1), the rules note (C2), the preset row and the folded "Filters and weights" panel (C4), the colour key (C3), then the ranked list grouped by world region (C2). Dark panel, one rounded border per block, rows split by thin lines: each row has a rank circle on the left, the name, the badges under it, the chip strip under those, and the score on the right. On a phone the sidebar becomes a sheet under the map that can be dragged up. Hovering a row lights its pin on the map (B2).
  → verify: at 1440×900 the sidebar is on the left and the map's canvas fills the rest; scrolling the list doesn't move the map; at 390×844 nothing overflows.

- [ ] **C1. Summary card** at the top of the Finder list: "Best match on Earth: Name, 92 / 100", then "20 sites in 14 countries", "20 are new: not in our list of known analog sites", "N of 20 hold their place in every robustness test". A link "Include known analog sites" adds them back, so a judge can see the method find the places crews already use.
  → verify: every count matches a value worked out from the data files in the test.
- [ ] **C2. Top 20 with spread.** Rank with the current preset (Balanced by default), keep cells at least 800 km apart and at most 2 per country (country = the text after the last comma in `manifest.regions`). Group the rows by world region (a small country-to-region table in `rank.ts`); each group folds open and shows "11 sites · best 92". A note under the summary gives the rules: "Top 20 of {ranked} land cells · new sites only · 800 km apart · 2 per country at most", with the count read from the data.
  → verify: no two rows are closer than 800 km; no country appears more than twice; rows inside a group are in score order.
- [ ] **C3. A strip of factors on every row.** One small chip per challenge for the body (Surface, Resources, Dryness, Heat swing, …), labelled with its short name and filled with its band colour from its `ch:` value: very close (≥ 0.9, green), close (≥ 0.75, lime), partly (≥ 0.5, amber), far off (red). The chips sit in one row and wrap on narrow screens. A key above the list: "Each strip shows how close a site is on every challenge:" then the four colours with their names. The colours pass contrast with the chip text, and the band name is in the tooltip, so colour is never the only cue. Each chip's tooltip gives the challenge name and value. The row also shows the "New" badge and "85% stable" from P3.
  → verify: chip count equals the body's challenge count; each chip's colour band matches its `ch:` value.
- [ ] **C4. Presets and weights.** Balanced and the three mission filters as one row of preset buttons. Under them, a "Filters and weights" panel, folded by default with a chevron, as in the reference, with one slider per challenge (0 to 2×, step 0.1, "1.0×" read-out) and a Reset. Challenges the site has no data for show "n/a: not used for this site" and are disabled. Moving a slider re-ranks at once; rows slide to their new place, and a row that moved shows ▲2 or ▼1 for a few seconds. The year-round switch stays, with the rule already shown in `#yr-note`.
  → verify: with every slider at 1.0× the list equals the Balanced preset; setting one slider to 0 gives the same order as `handScore` without that challenge.
- [ ] **C5. Choose between them.** Each row has a compare tick. With two or three ticked, a compare strip shows their chips and scores side by side, and an "Open" link to each Place page.
  → verify: ticking two rows shows both names in the compare strip; the URL keeps the choice.

---

## Pass 4: check every page, then ship (orchestrator, with a Sonnet checker)

- [ ] **E1. Page audit.** For each page in the table, list what is on screen and check it against the page's job and its "not on it" column. Move or remove anything that doesn't belong. Read every line as a newcomer would: plain words, no "ML", no "% similar", no number without a dataset.
- [ ] **E2. Numbers.** A Sonnet checker reads ten random numbers from each page and matches them to the data files.
- [ ] **E3. Tour.** Update the guided tour (`site/src/tour.ts`) for the new pages: pick a site on the Moon page, the focused map, hover a place, the factor strips, move a weight, open a Place, where it breaks.
- [ ] **E4. README.** New screenshots of each page, the new targets and preset, and the "How we used AI" note. The same note stays in the site footer and goes in the project description.
- [ ] **E5.** Full suite green on laptop and phone; a newcomer gets from Home to a result in under a minute without help.
- [ ] **E6.** With the user's yes: merge `v1-next` into `v1`, check the live site in a private window, and tag the submitted version.

---

## If time runs short

Cut in this order: C5, the polar view in A2 (use the plain crop), B3 (the hover card's "click to open" goes straight to the Place page), the Shackleton rim in P1. Never cut R, B1, B2, C0, C2, C3, C4, A1, A3 or E1: those are the team's notes.

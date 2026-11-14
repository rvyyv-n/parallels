# Plan

Part 1 is the team's idea, from our planning board. Claude checked it against the available data and our local [Challenge Guide](challenge-guide.pdf), suggested refinements, and we kept the ones listed at the end of part 1. Part 2 is how Claude builds version 2 of the site.

## Part 1. The team's idea

### Approach

No single place on Earth can simulate everything about a Moon or Mars base. So we split base-building into specific challenges, and match each challenge to the Earth sites best suited to test it.

Within each challenge we score only what both sides can measure. Parts without data on both sides are shown as labels, marked as not scored, with the reason.

### Mission filters

Users pick what they're testing, and the challenges below are weighted to match:

- **Rover mobility:** Surface, Dust
- **Life support:** Resources, Heat swing, Polar light and power (Moon), Atmosphere and dust (Mars)
- **Habitat structure:** Surface, Heat swing (scored), plus ground strength and Shelter as labels

Users can also set the weights by hand. Dryness, Industrial sites and Signs of life are in no filter and count only under hand-set weights.

**Default set for the build on 15 November; the team can overrule.** Three points above are not yet a team decision: that mission filters weight the challenges (not the traits), the make-up of Habitat structure, and that Dryness, Industrial sites and Signs of life count only under hand-set weights.

### Terrain types

Every Earth match is tagged with a terrain type, worked out from the data so the rule is visible:

- **Arid basin:** very dry (aridity index) and low-lying
- **High-altitude volcanic field:** volcanic rock (rock map) and high ground
- **Salt flat:** evaporite rock (rock map) and very dry
- **Frozen ground:** permafrost
- **Cave or lava tube:** a list of known sites, not mapped (see Shelter)

Users can filter matches by type. A clustering step also groups Earth places with similar values, and we check that the groups line up with the tags.

### Moon

**Surface** (shared)
- Ruggedness: rover ops, construction stability
- Ground strength: load from builds and landers (label only, not scored: no direct data on any of the three worlds)
- Landing safety: slope and rockiness, against NASA's landing limit of slopes under 10°
- Rock type: the pale highland rock of the south pole

**Resources** (shared)
- Water: ice-cemented ground
- Oxygen from local rock

**Dryness** (shared)
- Aridity: rain against evaporation. The Moon is completely dry

**Heat swing** (shared)
- Extreme cold and large day-to-night or seasonal temperature changes
- Thermal inertia: how fast the ground heats and cools

**Shelter** (shared)
- Caves and lava tubes (label only: no global cave map exists for Earth, the Moon or Mars; we list known sites)

**Polar light and power** (Moon only)
- Low sun, long shadows, permanent darkness, and sites for solar power

**Industrial sites** (Moon only)
- Long, flat strips for landing pads, solar farms, roads, or a railgun
- Built from the Surface scores

**Dust** (label only)
- Fine, sharp grains and how they affect designs
- Not scored: Moon dust is known only from Apollo samples, and Earth has no map of grain shape

### Mars

**Surface** (shared)
- Ruggedness: rover ops, construction stability
- Ground strength: load from builds and landers (label only, not scored: no direct data on any of the three worlds)
- Landing safety: slope and rockiness
- Minerals: clays, sulfates, carbonates, olivine

**Resources** (shared)
- Water: buried ground ice
- Hydrated minerals (clays, sulfates)
- Perchlorates (label only: known from a few sites, not mapped)

**Dryness** (shared)
- Aridity: rain against evaporation

**Heat swing** (shared)
- Cold and day-to-night temperature changes
- Thermal inertia: how fast the ground heats and cools

**Shelter** (shared)
- Caves and lava tubes (label only, as on the Moon)

**Atmosphere and dust** (Mars only)
- Wind, dust storms and dust cover
- Effect on surface ops, habitats and design
- Compared by how often dust is lifted, not by wind speed, because Mars air is about 1% as thick as Earth's
- UV: Earth's strongest UV, on high, dry ground, against Mars's unshielded surface

**Signs of life** (Mars only)
- Places to practise searching for past life, built on the hydrated-minerals data

### Every challenge

- **Seasons.** Each site shows its best months to test, its freeze–thaw months and its rainy or monsoon months. A site that's only usable part of the year scores lower for year-round testing.
- **Earth can't copy:** low gravity, the Moon's vacuum, Mars's thin air, and space radiation, which Earth's magnetic field and thick air block.

### Scoring

- **Same scale on both sides.** The global search runs on one 0.5° grid. Terrain is compared at the planet map's own scale. Every value shows its resolution.
- **Per trait:** how close a place gets to the target, ranked against all of Earth's land.
- **Overall:** each challenge's score combines its traits; the mission filter's weights then combine the challenge scores. The total is never shown without the trait bars.
- **Checked on known analogs** before we trust it ([guidelines](guidelines.md#2-doing-the-science-honestly)).

Details: the README's [Scoring model](../README.md#scoring-model).

### To consider

Ancient water landscapes, such as Mars's valley networks.

### Changes from the board

The original board version is in git history. Claude suggested these changes and we accepted them:

- Bearing capacity became ground strength, marked as an estimate, because nothing measures it directly.
- Landing safety added under Surface (our placement).
- Ilmenite became oxygen from local rock, because ilmenite is rare at the Moon's south pole.
- Moon dust became a label, and Mars dust joined Atmosphere, because dust grain data is too thin to score.
- The railgun strip became industrial sites, with the railgun as one example.
- Heat swing, polar light and power, shelter, and signs of life moved up from "to consider".
- Mars wind is compared by dust activity, not speed.

To meet the Challenge Guide's benchmarks:

- Mission filters for rover mobility, life support and habitat structure.
- Terrain types, with clustering; salt flats replace "salts and brines" from "to consider".
- Dryness (aridity), thermal inertia, rock type and minerals, and Mars UV added as traits.
- Seasons: best months, freeze–thaw and monsoons.
- A scoring section, answering the guide's questions on resolution and distance measures.

## Part 2. How we build v2

Written by Claude on Sunday 15 November and kept in step with the site as it is built. Where it differs from part 1, part 1 wins. The method, the data, the limits and the check results are in the [README](../README.md); the test places are in `pipeline/sites.json`.

The site in `site/` is built from scratch for version 2. Every number on screen is read from the files in `dataset/`.

### The sentence

No place on Earth copies a Moon or Mars base whole, but for each part of a base there is a best place on Earth to practise. The site shows where it matches and where it doesn't. Everything on screen serves that sentence.

### The look

Cinematic, with real imagery. Earth, the Moon and Mars are 3D globes made from NASA photo maps. One 3D scene stays on screen while the page scrolls through chapters, and the globes move with the scroll. Gold with "=" means a match. Blue with "≠" means a break. Type: Newsreader for headings, Geist for text, Geist Mono for numbers. The team approved this direction on 15 November.

### Main flow (one page, told by scrolling)

1. **Intro.** Earth's horizon with lit matches, the Moon and Mars above it, and the sentence in large type. Two buttons: "Find a place" and "Take the tour".
2. **Find a place.** Pick a base site and a mission filter. The globe lights the closest 10% of Earth's land and pins the five best distinct places (at least 300 km apart and in different regions). The best place is featured with one number that matches and one that breaks. The Moon's south pole and rover mobility are selected at the start.
3. **Where it matches.** Earth and the base site face each other. Each row pairs the Earth value with the base-site value, joined by a long "=". A row opens to show both datasets, with links.
4. **Where it breaks.** The same rows with "≠", places with no data shown as missing, and what no place on Earth can copy (gravity, air, radiation).
5. **What to test here.** Hardware, tests, why, the best, freeze–thaw and rainy months, coordinates (the middle of a square about 50 km wide), distance to the nearest known analog, terrain type, and the parts we could not score.
6. **How we checked it.** A few honest lines and one chart of the fourth run: known analogs against ordinary places and plain deserts. 10 of 15 checks pass, not all of them.

Also on the site:
- **Guided tour:** plays the page by itself with captions and a progress bar. It never blocks the picker, and anyone can start it again. The demo video records it.
- **3D terrain close-up:** the chosen place as real terrain with satellite imagery and a low sun, like the light at the Moon's south pole.
- **"For judges" view:** the six benchmarks in the guide's words, the seven questions with our answers, every dataset with its link and licence, "Not in this version", how the top places shift when weights change, and the AI note.
- **Terrain filter and year-round switch** next to the picker.
- **"Adjust weights"** (extra): combines the pre-computed challenge scores with the user's weights by the method's own rule. No new data is made.

Only the Moon's south pole and Jezero are checked against test places. The other four base sites are marked "scored, not checked". Jezero's card says that the Mars Surface check misses its pass mark.

### The guide's benchmarks on screen

| # | Benchmark | Where a judge sees it |
|---|---|---|
| 1 | At least 3 open archives | The datasets inside every row, and the full list in "For judges" |
| 2 | At least 4 terrain types | The terrain type on each place, and the terrain filter |
| 3 | Dashboard with rankings, coordinates and data details | The globe, the five best places and the match chapters |
| 4 | Weighting and clustering | Mission filters in the picker; clustering explained in "For judges" |
| 5 | Seasons | Best, freeze–thaw and rainy months in "What to test here"; the year-round switch |
| 6 | Mission filters | The picker |

### Build rules

- Static site in `site/`: Vite, TypeScript, Preact and three.js. It copies `dataset/` in at build time, with no second copy in git, and uses the types in `dataset/contract.ts`.
- `pipeline/` and `dataset/` don't change. The browser selects, groups and displays only what is already computed.
- The browser loads only the columns a screen needs, by asking for byte ranges of the `.bin` files. A first result stays within about 2 MB.
- No keys and no server. The globes use NASA images bundled with the site (`site/scripts/fetch-textures.mjs` builds them; credits are in `site/public/img/CREDITS.md`). The only live calls are open map tiles for the 3D terrain close-up, and the page works without them.
- Budgets: first screen at most 120 words, a collapsed match at most 60, the main page at most 900 with everything collapsed; any base site and filter in two clicks; no sideways scroll at 390 px; reduced motion and keyboard use respected. A Playwright test enforces them.
- Hosting on Vercel. Version 1 stays live and untouched. Version 2 has its own Vercel project, `parallels-v2`, and is deployed from the command line with `vercel deploy --target=preview`; pushes to `v2` start no build in version 1's project. A public version 2 link is the team's call.

### Who builds what

- **The orchestrator** (Claude Fable, the main thread) owns the plan, the 3D scene and the story chapters. It writes each builder's brief, checks the result against tests and screenshots, commits, deploys and shows the team.
- **Builders** (Claude Opus at medium effort, high for the hard groups) each build one group in their own files. They don't commit.
- **Checkers** (Claude Sonnet at medium effort) do mechanical work: running tests and the fresh-eyes check.
- At most three builders run at once. Each group has its own files, so builders don't collide. Shared files (`app.tsx`, `styles.css`, the scene) are changed only by the orchestrator.
- After each wave the orchestrator joins the groups, runs every test, takes screenshots at 390×844 and 1440×900, commits, deploys a preview and shows the team, then starts the next wave without waiting.
- If a session limit stops the work, the next session starts at the first unticked box below.

### Roadmap (Sunday 15 November)

Times are the team's local time. The build machine's clock is 3 hours ahead.

**Done**
- [x] Data loading by byte range, distinct top places, the match model, with unit tests
- [x] 3D scene: Earth, Moon and Mars from NASA imagery, lit matches, pins
- [x] Intro, "Find a place", "Where it matches", "Where it breaks", "What to test here"
- [x] Vercel project `parallels-v2` with preview deploys

**Wave 1: evidence and controls** (by 05:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 1A "How we checked it": honest lines and the fourth-run chart | Opus, medium | `site/src/ui/Checked.tsx`, `checked.css` | every number comes from `validation.json`: 1 of 4, 10 of 15, 6 not counted, used four times |
| [ ] | 1B "For judges" view | Opus, medium | `site/src/ui/Judges.tsx`, `judges.css` | six benchmarks, seven questions, every dataset with link and licence, stability text, AI note |
| [ ] | 1C Playwright tests for the budgets, data and links | Sonnet, medium | `site/e2e/` | the tests run and fail only for real faults |
| [ ] | 1D Terrain filter, year-round switch, terrain type on each place, footer with the AI note and credits | orchestrator | shared files | the filter shows fewer than five places when a type is rare |

**Wave 2: the two big features** (by 10:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 2A 3D terrain close-up from open elevation and imagery tiles, with a low-sun setting | Opus, high | `site/src/terrain/`, `site/src/ui/Terrain.tsx`, `terrain.css` | opens for both headline places; the page still works when tiles are blocked |
| [ ] | 2B Self-playing guided tour with captions, progress, pause and exit | Opus, high | `site/src/ui/Tour.tsx`, `tour.css` | runs start to end in about 28 seconds; any click or scroll by the user takes control back |
| [ ] | 2C Motion and polish: number count-ups, text reveals, hover and pressed states, the phone layout, a fixed top bar | orchestrator | shared files | screenshots at both sizes; nothing moves with reduced motion on |

**Wave 3: make it safe** (by 14:00)

| | Group | Builder | Check |
|---|---|---|---|
| [ ] | 3A A flat picture map when 3D is not available, keyboard reach, colour-blind check, download budget on a phone | orchestrator | budget tests pass |
| [ ] | 3B Independent review of the code for bugs and wrong numbers | Opus, high | findings fixed or listed |
| [ ] | 3C "Adjust weights" (extra, first to cut) | Opus, medium | a hand-set mix equal to a mission filter gives the same top place |

**Wave 4: ship** (freeze at 18:00, submit by 21:59)

| | Step | Who | Check |
|---|---|---|---|
| [ ] | Fresh-eyes check: a model shown only four screenshots says what the site found and where one match breaks | Sonnet, medium | two correct sentences |
| [ ] | README: the new structure is in place (summary, screenshot grid, contents, what it does, how it works, validation). At the end, replace the screenshots in `docs/images/` with final ones, update the Status table, and add the live link and the demo video | Opus, medium | every number matches the data files |
| [ ] | Final plan update; project page text; demo video of the tour with burned-in captions | orchestrator and team | every box in [guidelines](guidelines.md) section 7 |
| [ ] | The team compares version 1 and version 2 and chooses the public link | team | the link opens in a private window |
| [ ] | Final submission | team | the success banner shows |

**Needed from the team:** the TEAM RMD member names for the credits; the choice of public link; a check that the Local Event's deadline is in the same time zone as these times.

### Fallbacks

| Risk | Fallback | Switch by |
|---|---|---|
| 3D terrain not solid | leave it out; "What to test here" keeps the zoomed globe | 10:00 |
| Tour not solid | a short captioned walk-through with "Next" buttons | 12:00 |
| Globe too slow on a phone | a flat picture map on phones | 14:00 |
| Time runs short | cut in this order: "Adjust weights", extra motion, 3D terrain on phones, the year-round switch, polish on the four unchecked base sites | 16:00 |
| Version 2 not ready, or not better | submit version 1's link | the team's call at the end |
| Video fails | 7 slides or fewer | 20:00 |

Never cut: the picker, the five distinct places, the match and break chapters for the two checked base sites, "How we checked it", "For judges", the AI note, the tests.

### Awards, page and demo

| Award | What makes the case |
|---|---|
| Best Use of Science | the "How we checked it" chart, weights fixed before each run, a held-out half, and "where it breaks" on every match |
| Best Use of Data | five open archives on one comparable scale, every number linked to its dataset |
| Best Mission Concept | mission filters, and what to test at each place and in which months |

- **Project page:** lead with the headline and the checked-it chart. Paste in three images: the globe, the "where it breaks" chapter and the chart.
- **Demo (28 seconds):** a screen recording of the guided tour, with captions burned in, in the official timing (team 0:00, challenge 0:02, name and tagline 0:05, how it works with NASA data 0:10, what's next 0:20). Motion graphics go on top of the recording only. If AI makes any graphics, the video carries a visible "Made with AI assistance" mark.

### Our edge

We check the method against known analog sites in public, with the rules fixed before each run, and every match shows where it breaks. We search all of Earth's land, not a hand-picked list.

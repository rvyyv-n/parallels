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
2. **Find a place.** Pick a base site and a mission filter. The globe lights the closest 10% of Earth's land and pins the five best distinct places (at least 300 km apart and in different regions). The best place is featured with one number that matches and one that breaks. The Moon's south pole and rover mobility are selected at the start. Each place shows its terrain type, its distance to the nearest known analog ("new place" when more than 300 km), how much of its data is present, and whether it stays in the top places when the weights change.
3. **Where it matches.** Earth and the base site face each other. Each row pairs the Earth value with the base-site value, joined by a long "=". A row opens to show both datasets, with links.
4. **Where it breaks.** The same rows with "≠", places with no data shown as missing, and what no place on Earth can copy (gravity, air, radiation).
5. **What to test here.** Hardware, tests, why, the best, freeze–thaw and rainy months, coordinates (the middle of a square about 50 km wide), distance to the nearest known analog, terrain type, and the parts we could not score. Links to check it yourself: NASA Worldview at the place, and Moon Trek or Mars Trek for the base site. A field sheet to print or download.
6. **Build the whole base.** The payoff of the sentence: for the chosen base site, the best place on Earth for each part of the base (Surface, Resources, Heat swing, Polar light and power, and the rest), one pin per part across the globe. Each pin shows the part, the place, one number that matches and one that breaks, and opens that place in the chapters above.
7. **How we checked it.** A few honest lines and one chart of the fourth run: known analogs against ordinary places and plain deserts. 10 of 15 checks pass, not all of them.

Also on the site:
- **Guided tour:** plays the page by itself with captions and a progress bar, and ends on "Build the whole base". It never blocks the picker, and anyone can start it again. The demo video records it.
- **3D terrain close-up:** the chosen place as real terrain with satellite imagery and a low sun, like the light at the Moon's south pole.
- **Data lens on the globe:** light Earth by one trait instead of the overall score (for example "as cold as the south pole" or "as flat as Jezero"), and show the known analogs, caves, ordinary places and plain deserts from our test list as a layer.
- **"For judges" view:** the six benchmarks in the guide's words, the seven questions with our answers, every dataset with its link and licence, how the clusters line up with the terrain types, "Not in this version", how the top places shift when weights change, and the AI note.
- **Terrain filter and year-round switch** next to the picker.
- **A link for every view:** the address holds the base site, filter and place, so a judge can open the exact view we describe on the project page.
- **"Adjust weights"** (extra): combines the pre-computed challenge scores with the user's weights by the method's own rule. No new data is made.

Only the Moon's south pole and Jezero are checked against test places. The other four base sites are marked "scored, not checked". Jezero's card says that the Mars Surface check misses its pass mark.

### The data does the work

We spent a long time on the data, so the site shows as much of it as a newcomer can take in. Every feature above reads a column that already exists; none adds a number.

| Feature | Data it reads | What it proves to a judge |
|---|---|---|
| Five best places, featured match | `score:<filter>` in each target file, `cells.bin` | All of Earth's land was searched, not a hand-picked list |
| Match and break rows | trait values in `cells.bin`, `rank:<trait>`, target `values` | Every number names its dataset and its resolution |
| Build the whole base | `ch:<challenge>` in each target file | The team's idea: each part of a base has its own best place |
| Data lens | `rank:<trait>` columns, `labels.json` | 17 traits from 31 datasets, and known sites next to new ones |
| New place, data present, stays on top | `nearest_analog_km`, `cov:<challenge>`, `stable:<filter>` | Novelty, honesty about gaps, and robustness |
| Terrain filter, seasons, year-round switch | `terrain_type`, `m_best`, `m_freeze`, `m_rain`, `score:<filter>:yr` | Guide benchmarks 2 and 5 |
| How we checked it | `validation.json` | The method was tested, with rules fixed before each run |
| For judges | manifest `benchmarks`, `questions`, `datasets`, `clustering`, `not_in_version` | Guide benchmarks 1 to 6 and its seven questions |
| Field sheet | all of the above for one place | A test team could take it into the field |

### The guide's benchmarks on screen

| # | Benchmark | Where a judge sees it |
|---|---|---|
| 1 | At least 3 open archives | The datasets inside every row, and the full list in "For judges" |
| 2 | At least 4 terrain types | The terrain type on each place, the terrain filter, and the clusters in "For judges" |
| 3 | Dashboard with rankings, coordinates and data details | The globe, the five best places, the match chapters and the field sheet |
| 4 | Weighting and clustering | Mission filters in the picker; clustering explained in "For judges" |
| 5 | Seasons | Best, freeze–thaw and rainy months in "What to test here"; the year-round switch |
| 6 | Mission filters | The picker |

### Build rules

- Static site in `site/`: Vite, TypeScript, Preact and three.js. It copies `dataset/` in at build time, with no second copy in git, and uses the types in `dataset/contract.ts`.
- `pipeline/` and `dataset/` don't change. The browser selects, groups and displays only what is already computed.
- The browser loads only the columns a screen needs, by asking for byte ranges of the `.bin` files. A first result stays within about 2 MB.
- No keys and no server. The globes use NASA images bundled with the site (`site/scripts/fetch-textures.mjs` builds them; credits are in `site/public/img/CREDITS.md`). The only live calls are open map tiles for the 3D terrain close-up, and the page works without them.
- Budgets: first screen at most 120 words, a collapsed match at most 60, the main page at most 900 with everything collapsed; any base site and filter in two clicks; no sideways scroll at 390 px; reduced motion and keyboard use respected. A Playwright test enforces them.
- Ideas from other projects are used only as general web patterns, in our own code and words. No other team's code, text or assets, and no names of other projects anywhere in the repo or on the site.
- Hosting on Vercel. Version 1 stays live and untouched. Version 2 has its own Vercel project, `parallels-v2`, and is deployed from the command line with `vercel deploy --target=preview`; pushes to `v2` start no build in version 1's project. A public version 2 link is the team's call.

### Who builds what

- **The orchestrator** (Claude Fable 5.2 at high effort, the main build thread) owns the plan, the shared files, the 3D scene and the story chapters. It writes each builder's brief, joins the results, runs every test, takes screenshots, commits, deploys and shows the team. It writes little feature code itself, to save the session limit.
- **Builders** (Claude Opus at medium effort, high for the hard groups) each build one group in their own files and its unit tests. They don't commit, and they don't edit shared files: they hand the orchestrator the few lines a shared file needs.
- **Checkers** (Claude Sonnet at medium effort) do mechanical work: running tests, the number check and the fresh-eyes check.
- Effort is never below medium or above high. At most three builders run at once.
- Shared files: `app.tsx`, `state.ts`, `styles.css`, `scene/`, `data/store.ts`, `data/load.ts`.
- **A builder's brief** names: the group's goal in two sentences, the files it may write, the data columns and manifest fields it reads, the props or functions it must expose, the check that proves it done, and these rules: no invented numbers, plain words, the budgets, reduced motion, keyboard use, no other project's code.
- After each wave the orchestrator joins the groups, runs `npm test`, `npm run build` and `npm run e2e`, takes screenshots at 390×844 and 1440×900, commits each group on its own, pushes, deploys a preview, ticks the boxes below and shows the team, then starts the next wave without waiting.
- If a session limit stops the work, the next session reads this part, runs the tests, and starts at the first unticked box.

### Roadmap (Sunday 15 November)

Times are the team's local time. The build machine's clock is 3 hours ahead. Build until the freeze at 18:00, then fixes only.

**Done**
- [x] Data loading by byte range, distinct top places, the match model, with unit tests
- [x] 3D scene: Earth, Moon and Mars from NASA imagery, lit matches, pins
- [x] Intro, "Find a place", "Where it matches", "Where it breaks", "What to test here"
- [x] Vercel project `parallels-v2` with preview deploys

**Now: the team saves a draft** (before 03:00)
- [ ] Save a complete draft on the project page with version 1's link, so a valid entry exists whatever happens. Resubmitting is allowed, and only the last saved version counts.

**Wave 1: evidence and benchmarks** (02:30 to 07:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 1A "How we checked it": honest lines and the fourth-run chart | Opus, medium | `site/src/ui/Checked.tsx`, `checked.css` | every number comes from `validation.json`: 1 of 4, 10 of 15, 6 not counted, used four times |
| [ ] | 1B "For judges" view | Opus, medium | `site/src/ui/Judges.tsx`, `judges.css` | six benchmarks, seven questions, all 31 datasets with link and licence, the clustering summary, stability text, "Not in this version", the AI note |
| [ ] | 1C Playwright tests: budgets, numbers on screen against the data files, links, no console errors | Sonnet, medium | `site/e2e/` | the tests run and fail only for real faults |
| [ ] | 1D Terrain filter, year-round switch, and on each place: terrain type, "new place", data present, stays on top; footer with the AI note and credits; the view in the address | orchestrator | shared files | the filter shows fewer than five places when a type is rare; a copied address reopens the same view |

**Wave 2: show the data** (07:00 to 12:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 2A "Build the whole base": the best place for each part of the base, one pin per part | Opus, high | `site/src/data/base.ts` with a unit test, `site/src/ui/Base.tsx`, `base.css` | each pin is the top cell of that `ch:` column; a place that wins two parts shows once with both; parts not scored are listed as labels |
| [ ] | 2B 3D terrain close-up from open elevation and imagery tiles, with a low-sun setting | Opus, high | `site/src/terrain/`, `site/src/ui/Terrain.tsx`, `terrain.css` | opens for both headline places; the page still works when tiles are blocked; tile sources credited |
| [ ] | 2C Field sheet and "check it yourself": print view and CSV download for a place; NASA Worldview, Moon Trek and Mars Trek links | Opus, medium | `site/src/data/sheet.ts` with a unit test, `site/src/ui/FieldSheet.tsx`, `sheet.css` | every value in the CSV matches the screen; every link opens |
| [ ] | 2D Data lens on the globe and the test-place layer; motion and polish: count-ups, text reveals, hover and pressed states, a fixed top bar | orchestrator | shared files | the lit cells are the top 10% of the chosen `rank:` column; nothing moves with reduced motion on |

**Wave 3: the tour, and make it safe** (12:00 to 16:00)

| | Group | Builder | Files | Check |
|---|---|---|---|---|
| [ ] | 3A Self-playing guided tour: captions, progress, pause and exit, ending on "Build the whole base" | Opus, high | `site/src/ui/Tour.tsx`, `tour.css` | runs start to end in about 28 seconds; any click or scroll by the user takes control back |
| [ ] | 3B Independent review of the code for bugs and wrong numbers | Opus, high | read only | findings fixed or listed |
| [ ] | 3C A flat picture map when 3D is not available, keyboard reach, colour-blind check, download budget on a phone; page title, description, share image and icon | orchestrator | shared files | budget tests pass |
| [ ] | 3D "Adjust weights" (extra, first to cut) | Opus, medium | `site/src/ui/Weights.tsx`, `weights.css` | a hand-set mix equal to a mission filter gives the same top place |

**Wave 4: present** (16:00 to the freeze at 18:00)

| | Step | Who | Check |
|---|---|---|---|
| [ ] | Demo video: Playwright records the tour at 1920×1080; ffmpeg burns in the captions in the official timing; aim for 28 seconds | Opus, medium | the uploaded file is 30 seconds or less; it works on mute |
| [ ] | Fresh-eyes check: a model shown only four screenshots says what the site found and where one match breaks | Sonnet, medium | two correct sentences |
| [ ] | README: replace the screenshots in `docs/images/` with final ones, add "Build the whole base" and the data lens, update the Status table, add the live link and the video | Opus, medium | every number matches the data files |
| [ ] | Project page text in `docs/project-page.md`: every form field, the NASA Data field with each dataset, link and use, the partner data field, the AI note | orchestrator | every box in [guidelines](guidelines.md) section 7 |
| [ ] | The team compares version 1 and version 2 and chooses the public link; the orchestrator deploys it to production | team, then orchestrator | the link opens in a private window on a phone and a laptop |
| [ ] | The team makes the repo public and renames it; the orchestrator updates the remotes and every repo link | team, then orchestrator | the README and the commits behind "rules fixed in git" open in a private window |

**Wave 5: ship** (18:00 to 21:59, fixes only)

| | Step | Who | Check |
|---|---|---|---|
| [ ] | Both of us test the live site on a phone and a laptop: try to break it, check numbers against the data, read it as a newcomer | team | a newcomer gets a result in under a minute without help |
| [ ] | Request a FortiGuard web-filter classification for the public link | team | request sent |
| [ ] | Final plan update; tag the submitted commit `submitted` | orchestrator | the tag is pushed |
| [ ] | Final submission | team | the success banner shows |

**Needed from the team:** the TEAM RMD member names for the credits and the video's first caption (by 16:00); the choice of public link (by 17:00); the repo going public and its new name (by 17:00); a check that the Local Event's deadline is in the same time zone as these times.

### Fallbacks

| Risk | Fallback | Switch by |
|---|---|---|
| "Build the whole base" not solid | a table of the best place per part, inside "What to test here" | 11:00 |
| 3D terrain not solid | leave it out; "What to test here" keeps the zoomed globe | 11:00 |
| Tour not solid | a short captioned walk-through with "Next" buttons | 14:00 |
| Globe too slow on a phone | a flat picture map on phones | 15:00 |
| Time runs short | cut in this order: "Adjust weights", the data lens, 3D terrain on phones, extra motion, the field sheet's print view (keep the CSV), the year-round switch, polish on the four unchecked base sites | 15:00 |
| Recorded video fails | record the screen by hand with the same captions; if that fails too, 7 slides or fewer | 19:00 |
| Version 2 not ready, or not better | submit version 1's link | the team's call at 17:00 |
| Session limit reached | the next session starts at the first unticked box; groups already started are finished first | at once |

Never cut: the picker, the five distinct places, the match and break chapters for the two checked base sites, "Build the whole base" at least as a table, "How we checked it", "For judges", the AI note, the tests, the demo video.

### Awards, page and demo

| Award | What makes the case |
|---|---|
| Best Use of Science | the "How we checked it" chart, weights fixed before each run, a held-out half, and "where it breaks" on every match |
| Best Use of Data | 31 datasets from five open archives on one comparable scale, every number linked to its dataset, the data lens, and the field sheet |
| Best Mission Concept | mission filters, "Build the whole base", and what to test at each place and in which months |

- **Project page:** lead with the headline and the checked-it chart. Paste in four images: the globe, "Build the whole base", the "where it breaks" chapter and the chart. Each image links to its exact view on the site.
- **Demo (28 seconds):** a screen recording of the guided tour, with captions burned in, in the official timing (team 0:00, challenge 0:02, name and tagline 0:05, how it works with NASA data 0:10, what's next 0:20). Motion graphics go on top of the recording only. If AI makes any graphics, the video carries a visible "Made with AI assistance" mark.

### Our edge

We check the method against known analog sites in public, with the rules fixed before each run, and the test is hard: known analogs must beat ordinary places and plain deserts, and we publish the checks that fail. Every match shows where it breaks. We search all of Earth's land on 17 traits from 31 datasets, and we show the best place for each part of a base, not one winner. The site is static, needs no server or keys, and opens for any judge until the awards in January.

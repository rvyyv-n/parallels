# Plan

Part 1 is the team's idea, from our planning board. Claude checked it against the available data and our local [Challenge Guide](challenge-guide.pdf), suggested refinements, and we kept the ones listed at the end of part 1. Part 2 is the spec for version 2 of the site: what it shows and the rules it keeps. What gets built when is in the [roadmap](roadmap.md).

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

## Part 2. What version 2 is

Written by Claude on Sunday 15 November and kept in step with the site as it is built. Where it differs from part 1, part 1 wins. This is the spec: what the site shows and the rules it keeps. What gets built when, and by whom, is in the [roadmap](roadmap.md). The method, the data, the limits and the check results are in the [README](../README.md); the test places are in `pipeline/sites.json`.

The site in `site/` is built from scratch for version 2. Every number on screen is read from the files in `dataset/`.

### The sentence

No place on Earth copies a Moon or Mars base whole, but for each part of a base there is a best place on Earth to practise. The site shows where it matches and where it doesn't. Everything on screen serves that sentence.

### The look

Cinematic, with real imagery. Earth, the Moon and Mars are 3D globes made from NASA photo maps. One 3D scene stays on screen while the page scrolls through chapters, and the globes move with the scroll. Gold with "=" means a match. Blue with "≠" means a break. Type: Newsreader for headings, Geist for text, Geist Mono for numbers. The team approved this direction on 15 November.

### The site shapes the data

The data files hold more than a newcomer needs: 17 traits, 31 datasets, per-challenge scores, coverage, stability and clusters. The site does not try to show all of it. Each screen takes only what serves the sentence, and the rest stays in the files, in "For judges" and in the CSV download. A column earns a place on screen only when a newcomer would miss it if it were gone. When in doubt, leave it out.

### Main flow (one page, told by scrolling)

1. **Intro.** Earth's horizon with lit matches, the Moon and Mars above it, and the sentence in large type. Buttons: "Find a place", "Take the tour", and a quieter "New to the Moon and Mars?" link to the Learn page.
2. **Find a place.** Pick a base site and a mission filter. The globe lights the closest 10% of Earth's land and pins the five best distinct places (at least 300 km apart and in different regions). The best place is featured with one number that matches and one that breaks. Each place shows its terrain type, and "new place" when it is more than 300 km from every known analog. The Moon's south pole and rover mobility are selected at the start.
3. **Where it matches.** Earth and the base site face each other. Each row pairs the Earth value with the base-site value, joined by a long "=". A row opens to show both datasets, with links.
4. **Where it breaks.** The same rows with "≠", places with no data shown as missing, and what no place on Earth can copy (gravity, air, radiation).
5. **What to test here.** Hardware, tests, why, the best, freeze–thaw and rainy months, coordinates (the middle of a square about 50 km wide), distance to the nearest known analog, terrain type, and the parts we could not score. "Check it yourself": NASA Worldview at the place, Moon Trek or Mars Trek for the base site, and a CSV of every value with its dataset.
6. **Build the whole base.** The payoff of the sentence: for the chosen base site, the best place on Earth for each part of the base (Surface, Resources, Heat swing, Polar light and power, and the rest), one pin per part across the globe. Each pin shows the part, the place, and one number that matches. Choosing a pin opens that place in the chapters above. It reads the `ch:` columns in each target file.
7. **How we checked it.** A few honest lines and one chart of the fourth run: known analogs against ordinary places and plain deserts. 10 of 15 checks pass, not all of them.

Only the Moon's south pole and Jezero are checked against test places. The other four base sites are marked "scored, not checked". Jezero's card says that the Mars Surface check misses its pass mark.

### The Learn page

A separate page (`learn.html`, one view for the Moon and one for Mars) for readers new to either world. It gives the site a second way in, and it stays out of the main flow so the main page keeps its budgets. Every value on it comes from `dataset/` or from a source named next to it. Nothing is modelled to look smooth: where we have two measured ends, we show two measured ends.

1. **Meet the Moon / Meet Mars.** The world turning, and a few facts from the manifest (`cant_copy` and the base site's `facts`): gravity, air, radiation and what the ground is made of, each with its source.
2. **Hot and cold.** A switch that animates the base site's measured temperatures (coldest and warmest where the data has them, otherwise the cold and the daily swing) against its best place on Earth, from the target values and the cell values.
3. **A year on Earth.** A month slider: which of the five best places are in their best months, freeze–thaw months or rainy months (`m_best`, `m_freeze`, `m_rain`). This is the guide's seasons benchmark, made hands-on.
4. **What Earth can't copy.** Pick a load (an astronaut, a rover, a habitat module) and see its weight on Earth, the Moon and Mars, from the NASA fact-sheet gravity. Air pressure and radiation are shown beside it with their sources.
5. **Tested on Earth first.** The known analogs from our test list (`labels.json`) on a small map. Choosing one shows what was tested there and its source.
6. **Same process, two worlds.** Four pairs of NASA photos (public domain, bundled with the site and credited): dust, ice, volcanoes, lava tubes. One line each.

It ends with "Find your own place", which opens the main page with that world's base site chosen.

### Also on the site

- **Guided tour:** plays the main page by itself in 30 to 60 seconds, with captions and a progress bar, and ends on "Build the whole base". It never blocks the picker, and anyone can start it again. The demo video is cut from a recording of it.
- **3D terrain close-up:** the chosen place as real terrain with satellite imagery and a low sun, like the light at the Moon's south pole.
- **"For judges" view:** the six benchmarks in the guide's words, the seven questions with our answers, every dataset with its link and licence, how the clusters line up with the terrain types, "Not in this version", how the top places shift when weights change, and the AI note.
- **Terrain filter and year-round switch** next to the picker.
- **A link for every view:** the address holds the base site, filter and place, so a judge can open the exact view we describe on the project page.
- **Extras, only if time is left:** "Adjust weights" (combines the pre-computed challenge scores with the user's weights by the method's own rule) and a globe layer of the known analogs and caves.

### The guide's benchmarks on screen

| # | Benchmark | Where a judge sees it |
|---|---|---|
| 1 | At least 3 open archives | The datasets inside every row, and the full list in "For judges" |
| 2 | At least 4 terrain types | The terrain type on each place, the terrain filter, and the clusters in "For judges" |
| 3 | Dashboard with rankings, coordinates and data details | The globe, the five best places, the match chapters and the CSV |
| 4 | Weighting and clustering | Mission filters in the picker; clustering explained in "For judges" |
| 5 | Seasons | Best, freeze–thaw and rainy months in "What to test here"; the year-round switch; the month slider on the Learn page |
| 6 | Mission filters | The picker |

### Build rules

- Static site in `site/`: Vite, TypeScript, Preact and three.js. It copies `dataset/` in at build time, with no second copy in git, and uses the types in `dataset/contract.ts`.
- `pipeline/` and `dataset/` don't change. The browser selects, groups and displays only what is already computed. The only arithmetic it adds is unit conversion and the Learn page's weight from gravity, both shown with their source.
- The browser loads only the columns a screen needs, by asking for byte ranges of the `.bin` files. A first result stays within about 2 MB.
- No keys and no server. The globes and the Learn page photos are NASA images bundled with the site (scripts in `site/scripts/` fetch them; credits are in `site/public/img/CREDITS.md`). The only live calls are open map tiles for the 3D terrain close-up, and the page works without them.
- Budgets: first screen at most 120 words, a collapsed match at most 60, the main page at most 900 with everything collapsed; any base site and filter in two clicks; no sideways scroll at 390 px; reduced motion and keyboard use respected. A Playwright test enforces them.
- Other public projects may be studied for approaches: how a problem was solved, a layout, a motion pattern. The code is written fresh for our structure, our data and our design. No code, text or assets are copied, with or without changes, and no other project is named in the repo or on the site. Space Apps asks us to confirm that all work is original and to list everything we used.
- Hosting on Vercel. Version 1 stays live and untouched. Version 2 has its own Vercel project, `parallels-v2`, and is deployed from the command line with `vercel deploy --target=preview`; pushes to `v2` start no build in version 1's project. A public version 2 link is the team's call.

### Awards, page and demo

| Award | What makes the case |
|---|---|
| Best Use of Science | the "How we checked it" chart, weights fixed before each run, a held-out half, and "where it breaks" on every match |
| Best Use of Data | five open archives on one comparable scale, every number linked to its dataset, and the CSV of every value |
| Best Mission Concept | mission filters, "Build the whole base", and what to test at each place and in which months |

- **Project page:** lead with the headline and the checked-it chart. Paste in four images: the globe, "Build the whole base", the "where it breaks" chapter and the chart. Each image links to its exact view on the site.
- **Demo (28 seconds):** cut from a screen recording of the guided tour, with captions burned in, in the official timing (team 0:00, challenge 0:02, name and tagline 0:05, how it works with NASA data 0:10, what's next 0:20). Motion graphics go on top of the recording only. If AI makes any graphics, the video carries a visible "Made with AI assistance" mark.

### Our edge

We check the method against known analog sites in public, with the rules fixed before each run, and the test is hard: known analogs must beat ordinary places and plain deserts, and we publish the checks that fail. Every match shows where it breaks, and every value on the site, the Learn page included, is measured, not modelled. We search all of Earth's land, and we show the best place for each part of a base, not one winner. The site is static, needs no server or keys, and opens for any judge until the awards in January.

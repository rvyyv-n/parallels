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

Details: the README's [Method in short](../README.md#method-in-short).

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

### The sentence

No place on Earth copies a Moon or Mars base whole, but for each part of a base there is a best place on Earth to practise. The site shows where it matches and where it doesn't. Everything on screen serves that sentence.

### Main flow (a result in two clicks)

1. **Open the site.** The globe and the picker are on screen. The Moon's south pole is selected, and its headline find is featured: the Sistan and Baluchestan region of Iran, more than 100 km from every known analog site in our list.
2. **Pick a target and a mission filter.** The globe colours Earth by match. Five distinct best places appear, at least about 300 km apart, with coordinates and terrain type.
3. **Open a place.** Its match card shows what is similar and what is different (in real units, Earth against the target), what Earth can't copy, its best, freeze–thaw and rainy months, and what to test there. Every number links to its dataset.
4. **"How we checked it":** one chart of known analogs against ordinary places and plain deserts, with the honest result: 10 of 15 checks pass, not all of them.

Also on the site:
- **Guided flow:** a short walk-through for first visits, which anyone can start again. The demo video records it.
- **"For judges" view:** the six benchmarks in the guide's words, the seven questions with our answers, every dataset with its link and licence, "Not in this version", and the AI note.
- **"Adjust weights"** (extra, outside the main flow): combines the pre-computed challenge scores with the user's weights by the method's own rule. No new data is made.

Only the Moon's south pole and Jezero have a headline in the data. The other four targets lead with their top place.

### The guide's benchmarks on screen

| # | Benchmark | Where a judge sees it |
|---|---|---|
| 1 | At least 3 open archives | The dataset link on every number, and the full list in "For judges" |
| 2 | At least 4 terrain types | A terrain-type tag on each place, and a terrain filter |
| 3 | Dashboard with rankings, coordinates and data details | The globe, the top-5 list and the match card |
| 4 | Weighting and clustering | Mission filters on the main screen; clustering explained in "For judges" |
| 5 | Seasons | Best, freeze–thaw and rainy months on each match card |
| 6 | Mission filters | The picker |

### Build rules

- Static site in `site/`. It takes `dataset/` in at build time, without a second copy in git, and uses the types in `dataset/contract.ts`.
- `pipeline/` and `dataset/` don't change. The browser selects, groups and displays only what is already computed.
- No keys, no server, and no live calls except map tiles, which have a bundled fallback image.
- Playwright tests the word and click budgets, the 390 px layout, keyboard use, reduced motion, and every data and link check.
- Hosting on Vercel. Version 1 stays live and untouched. Version 2 gets a preview link first; a public version 2 link is the team's call.

### Roadmap (Sunday)

| By | Step | Check |
|---|---|---|
| 04:00 | Questions to the team, a direction screenshot | the team says yes |
| while waiting | Data loading, distinct-places grouping, tests | no two of the top 5 within 300 km |
| 09:00 | Main flow on a preview link | **Checkpoint 1:** phone and laptop, a result in two clicks |
| 13:00 | Match cards, the checked-it chart, "For judges", guided flow | every number traces to a dataset |
| build done | Polish only from here | budgets pass |
| 18:00 | **Feature freeze** | **Checkpoint 2:** a fresh model, shown only screenshots, says what the site found and where one match breaks |
| 18:00–21:00 | Demo video, project page, final README and plan update, the team compares version 1 and version 2, repo rename | every box in [guidelines](guidelines.md) section 7 |
| 21:59 | Final submission | the success banner shows |

### Fallbacks

| Risk | Fallback | Switch by |
|---|---|---|
| Globe too slow on a phone | a flat map on phones | 11:00 |
| Preview link needs a login | a second Vercel project (team's call) | 13:00 |
| Version 2 not ready, or not better | submit version 1's link | the team's call at the end |
| Video fails | 7 slides or fewer | 20:00 |

### Awards, page and demo

| Award | What makes the case |
|---|---|
| Best Use of Science | the "How we checked it" chart, weights fixed before each run, a held-out half, and "where it breaks" on every match |
| Best Use of Data | five open archives on one comparable scale, every number linked to its dataset |
| Best Mission Concept | mission filters, and what to test at each place and in which months |

- **Project page:** lead with the headline and the checked-it chart. Paste in three images: the globe, a match card with its "where it breaks" part, and the chart.
- **Demo (28 seconds):** a screen recording of the guided flow, with captions burned in, in the official timing (team 0:00, challenge 0:02, name and tagline 0:05, how it works with NASA data 0:10, what's next 0:20). Motion graphics go on top of the recording only. If AI makes any graphics, the video carries a visible "Made with AI assistance" mark.

### Rivals

A scan on 13 November found at least 22 public repos for this challenge. The three serious ones ([TwinWorlds](https://github.com/JimmyGuajan/twinworlds), [EarthTwin](https://github.com/es-ratt/earthtwin), [terrestrial-analog-finder](https://github.com/shishir-kuet/terrestrial-analog-finder)) show no real check against known analog sites, and none searches all of Earth's land with both a validation and "where it breaks". Those two are our edge.

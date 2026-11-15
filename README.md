<img src="assets/logo.svg" width="96" alt="Parallels logo">

# Parallels

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0b3d91?style=flat)](https://www.spaceappschallenge.org/)
[![Challenge](https://img.shields.io/badge/Challenge-Earth%20analogs%20for%20Moon%20and%20Mars-2ea043?style=flat)](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/)
[![TEAM RMD](https://img.shields.io/badge/Team-RMD-ffc965?style=flat)](#team-and-credits)
[![Licence](https://img.shields.io/badge/Licence-MIT-blue?style=flat)](LICENSE)

**Earth's closest parallels to every part of a Moon or Mars base.**

Our NASA Space Apps 2026 entry for [Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/). Event: 14–15 November 2026.

No single place on Earth can stand in for a Moon or Mars base. So we split base-building into challenges, and for each one we rank the Earth sites best suited to test it. Parallels scores **91,971** squares of land (0.5°, about 50 km wide) against **six** Moon and Mars base sites, for **three** kinds of mission. Every match shows what is similar, how similar, and where it breaks, with the dataset behind each number. We check the method against known analog sites and publish the result, pass or fail.

**TEAM RMD** · Live site: [dotcatcher.vercel.app](https://dotcatcher.vercel.app) · Use of AI: [How we used AI](#how-we-used-ai)

---

## Screenshots

<table>
<tr>
<td width="50%" valign="top"><img src="docs/images/intro.jpg" alt="The opening screen"><br><b>The opening screen</b><br><sub>Earth's horizon with the Moon and Mars above it. Scrolling picks a base site and a kind of test.</sub></td>
<td width="50%" valign="top"><img src="docs/images/explore.jpg" alt="Earth's top 10"><br><b>Earth's top 10</b><br><sub>Pick a base site and a mission filter. The globe colours all land by match, and the list shows the ten best places with their scores.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/images/match.jpg" alt="One match"><br><b>One match</b><br><sub>The place on Earth beside the Moon or Mars site at the same ground scale, with the score, what matches and what breaks.</sub></td>
<td width="50%" valign="top"><img src="docs/images/part-by-part.jpg" alt="Part by part"><br><b>Part by part</b><br><sub>Each challenge opens to its traits: the Earth value against the target, Earth's whole range, and both datasets.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/images/where-it-breaks.jpg" alt="Where it breaks"><br><b>Where it breaks</b><br><sub>The weak traits at this place, and what no place on Earth can copy: gravity, air and radiation.</sub></td>
<td width="50%" valign="top"><img src="docs/images/how-we-checked.jpg" alt="How we checked it"><br><b>How we checked it</b><br><sub>Every validation run, with the checks that did not pass left on show.</sub></td>
</tr>
<tr>
<td width="50%" valign="top"><img src="docs/images/worlds.jpg" alt="Meet the Moon and Mars"><br><b>Meet the Moon and Mars</b><br><sub>The base site's measured values, what a base there must solve, and where crews already rehearse on Earth.</sub></td>
<td width="50%" valign="top"><img src="docs/images/phone.jpg" alt="The site on a phone" width="60%"><br><b>On a phone</b><br><sub>The same flow on a small screen, with the guided tour one tap away.</sub></td>
</tr>
</table>

The screenshots show the live site on 15 November 2026.

---

## Contents

1. [The problem](#the-problem)
2. [What Parallels does](#what-parallels-does)
3. [How it works](#how-it-works)
4. [Status](#status)
5. [Repository layout](#repository-layout)
6. [Quick start](#quick-start)
7. [The data files](#the-data-files)
8. [How we used AI](#how-we-used-ai)
9. [NASA and partner data sources](#nasa-and-partner-data-sources)
10. [Technology stack](#technology-stack)
11. [Scoring model](#scoring-model)
12. [Validation](#validation)
13. [Limits](#limits)
14. [Team and credits](#team-and-credits)
15. [Licence](#licence)

---

## The problem

Testing hardware on the Moon or Mars is too costly to get wrong, so space agencies test first on Earth, in places called analogs. A few famous sites are used again and again: the Atacama, Hawaii's volcanoes, Haughton Crater, Rio Tinto, Antarctica and Iceland. Thousands of other deserts, volcanic fields, salt flats, frozen basins and caves have never been compared with the same set of planetary measurements.

No place on Earth copies a base whole:

| Why | What it means |
|---|---|
| Each part of a base needs different ground | The best place to practise rover driving is not the best place to practise drilling frozen ground. |
| Earth cannot copy some things at all | Low gravity, the Moon's vacuum, Mars's thin air and space radiation. |
| Most of Earth was never checked | Lists of analog sites are short and picked by hand. |

So Parallels asks a narrower question. For each part of a base, where on Earth is the best place to practise it, and where does that match break?

---

## What Parallels does

| Capability | Description |
|---|---|
| **Base sites** | Six: the Moon's south pole (the nine Artemis III regions) and five Mars sites (Jezero, Gale, Arcadia Planitia, Deuteronilus Mensae and the Arsia Mons caves). Each value names its dataset or paper in `manifest.json`. |
| **Parts of a base** | The Moon has eight challenges and Mars has seven, such as Surface, Resources, Heat swing and Atmosphere and dust. Parts that cannot be measured on both sides are shown, not scored, with the reason. |
| **Mission filters** | Rover mobility, Life support and Habitat structure. Each one weights the challenges for that kind of test. You can also set the weights by hand. |
| **Search of all land** | Every square of land is ranked on 17 traits against all of Earth's land, not against a hand-picked list. The globe colours all of it by match. |
| **Top 10 places** | The ten best places for a base site and filter, each with its score out of 100, coordinates and terrain type. |
| **Side by side** | The Earth place (Landsat) beside the Moon or Mars site (LOLA relief or Viking colour), drawn at the same ground scale, with a wipe to compare. Display only, not scored. |
| **Match and break** | Each trait shows the Earth value against the base-site value in real units, Earth's whole range, and both datasets. Missing data is shown as missing. |
| **New places** | A "rarely used" tag marks places more than 100 km from all 50 known analog sites in our list. The Moon's top place for rover mobility is 426 km from the nearest one. |
| **Seasons** | Best months, freeze–thaw months and rainy months for each place, and a switch for year-round testing. |
| **Terrain types** | Arid basin, high-altitude volcanic field, salt flat, frozen ground, and cave or lava tube, each from a visible rule. Filter the top 10 by type. |
| **Worlds** | The Moon and Mars side: what Earth can't copy, the base site's measured values, the challenges a base there must solve, and the known analog sites. |
| **Guided tour** | Seven steps through the explorer, from the top 10 to how we checked it. |
| **Shareable views** | The address holds the base site, filter and place, so a link opens the same match. |
| **A public check** | Known analogs must beat ordinary places and plain deserts. The rules were fixed in git before each run, and every result is on the site. See [Validation](#validation). |

**Design rule:** the browser computes nothing new for the default view. It selects, groups and displays what the pipeline already computed, so every number on screen traces to a named dataset. Hand-set weights combine the pre-computed ranks; they never recompute a rank or a value.

---

## How it works

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. BASE-SITE VALUES                                                      │
│    Moon and Mars maps (NASA PDS, NASA PGDA, USGS) and published results  │
│    → one value per trait for each of the six base sites                  │
└──────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. EARTH DATA LAYER (offline pipeline)                                   │
│    NASA POWER climate, Copernicus terrain, GLiM rock, NASA EMIT minerals │
│    and MODIS land cover → one 0.5° grid of 91,971 land squares           │
└──────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. RANKING                                                               │
│    each trait is ranked against all of Earth's land                      │
│    traits → challenges → mission filters                                 │
└──────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 4. VALIDATION                                                            │
│    known analogs against ordinary places and plain deserts,              │
│    with the rules fixed in git before each run                           │
└──────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 5. DATA FILES (site/public/data/)                                        │
│    manifest.json, cells.bin, six target files, labels.json,              │
│    validation.json                                                       │
└──────────────────────────────────────────────────────────────────────────┘
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 6. STATIC SITE (site/)                                                   │
│    globe and top 10, side-by-side close-up, where each place matches     │
│    and where it breaks, Worlds, how we checked it, guided tour           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Status

**Version 1 is live** at [dotcatcher.vercel.app](https://dotcatcher.vercel.app) and is our submission. It ranks every land cell on Earth against six targets: the Moon's south pole and five Mars sites (Jezero, Gale, Arcadia Planitia, Deuteronilus Mensae and the Arsia Mons caves). The map shows method version 1.2. Only the Moon's south pole and Jezero are checked against test places.

**The method does not pass every check.** It passes 1 of its 4 first checks. In the fourth run, 10 of 15 checks with enough sites pass. On the held-out half, version 1.2 beats ordinary places 96% of the time for the Moon and 76% for Mars. The site shows all of this. See [Validation](#validation) and `site/public/data/validation.json`.

---

## Repository layout

- [docs/workflow.png](docs/workflow.png): our workflow at a glance; start here.
- [docs/challenge-guide.pdf](docs/challenge-guide.pdf): our local event's Challenge Guide, the main brief.
- [docs/challenge.md](docs/challenge.md): the challenge in plain words, and how we meet the guide's six objectives and answer its seven questions.
- [docs/team-plan.md](docs/team-plan.md): what we're building.
- [docs/claudes-plan.md](docs/claudes-plan.md): the build plan from before v1: method, data, checks, stack and roadmap.
- [docs/v1-spec.md](docs/v1-spec.md): the brief for version 1, including the data file layout.
- [docs/review-pre-v1.md](docs/review-pre-v1.md): the data and test-place checks made before the build.
- [docs/judging-notes.md](docs/judging-notes.md): how Space Apps is judged and what past winners did.
- [docs/guidelines.md](docs/guidelines.md): how we work, the official rules and our submission checklist.
- [CLAUDE.md](CLAUDE.md): instructions for Claude, our AI build assistant.
- [PRODUCT.md](PRODUCT.md): product and design notes for the site.
- `pipeline/`: the Python data pipeline. Its method settings are in `pipeline/config/`.
- `site/`: the Vite site. It reads the files in `site/public/data/` and changes none of them.
- `site/public/data/`: the pre-computed files the site loads. See [The data files](#the-data-files).

---

## Quick start

Pipeline (Python 3.13). Run each command from the repository root.

1. `uv sync` installs the packages into `.venv`.
2. Run the pipeline stages in this order. Raw downloads go to `data/`, which is not in git. Results go to `data/derived/`.

| Stage | Command | What it does |
|---|---|---|
| Climate | `.venv/Scripts/python -m pipeline.climate` | Reads NASA POWER climate data and Natural Earth land. Writes the 0.5 degree climate grid. |
| Terrain | `.venv/Scripts/python -m pipeline.terrain_grid` | Reads Copernicus DEM GLO-90 tiles. Writes slope and relief for each cell. Takes about 30 minutes. |
| Surface | `.venv/Scripts/python -m pipeline.surface` | Reads GLiM rock, NASA EMIT minerals and MODIS land cover. Writes the surface grid. Needs a free NASA Earthdata login in `~/.netrc`. |
| Targets | `.venv/Scripts/python -m pipeline.targets` | Reads Moon and Mars maps. Writes `pipeline/derived/targets_v1.json`. |
| Export | `.venv/Scripts/python -m pipeline.export` | Ranks the cells, runs the validation and writes the files in `site/public/data/`. Add `--method 1.2` to run method versions 1.1 and 1.2 as further validation runs. |

3. Run the tests: `.venv/Scripts/python -m pytest`.

On macOS and Linux, use `.venv/bin/python` in place of `.venv/Scripts/python`.

### The site

The site is static: it has no server and no keys. Run each command from `site/`.

| Command | What it does |
|---|---|
| `npm install` | Installs the packages. |
| `npm run dev` | Starts the site locally. |
| `npm run build` | Checks the types and builds the site into `site/dist`. |
| `npm test` | Runs the Playwright tests on port 4319. Run `npx playwright install chromium` first. Set `RUN_NETWORK=1` to also check every source link. |

---

## The data files

The pipeline and the site meet only through these files in `site/public/data/`. `pipeline.export` writes all of them.

| File | What it holds | Size |
|---|---|---|
| `manifest.json` | The data list, traits, challenges, mission filters, terrain types, targets and their values, the byte layout of the `.bin` files, the benchmarks, the questions and the "not in this version" list | 230 KB |
| `cells.bin` | One value per land cell (91,971 cells) for each of 30 columns: position, climate, terrain, rock, minerals, terrain type and cluster | 4.4 MB |
| `target-moon-south-pole.bin` | Ranks and scores of every cell against the Moon's south pole | 3.6 MB |
| `target-mars-jezero.bin` | The same, against Jezero | 3.6 MB |
| `target-mars-gale.bin` | The same, against Gale | 3.3 MB |
| `target-mars-arcadia-planitia.bin` | The same, against Arcadia Planitia | 2.8 MB |
| `target-mars-deuteronilus-mensae.bin` | The same, against Deuteronilus Mensae | 2.8 MB |
| `target-mars-arsia-mons-caves.bin` | The same, against the Arsia Mons caves | 2.8 MB |
| `labels.json` | 77 labelled places: known analogs, plain deserts, ordinary places and caves | 35 KB |
| `validation.json` | The test places, pass marks and the results of every run, with the stability check | 276 KB |

How to read the binary files:

- Each `.bin` file stores its columns one after the other. Each column is an array of little-endian numbers.
- The manifest gives each column's `dtype` (`u8`, `u16`, `i16` or `f32`) and its byte `offset`. The `cells.bin` layout is in `grid`. Each target's layout is in its `bin` entry.
- Decoded value = raw × `scale` + `add`. A column with no `scale` or `add` is a plain number.
- The no-data codes are 255 for `u8`, 65535 for `u16` and -32768 for `i16`. A column's `nodata` field gives its own code.
- In a target file, `rank:<trait>` and `ch:<challenge>` are one byte each. The values 0 to 250 mean 0 to 1. The value 255 means no data.
- `cov:<challenge>` is one byte: the percent of the challenge's trait weight that has data (0 to 100).
- `score:<filter>` and `score:<filter>:yr` are two bytes each. The values 0 to 10000 mean 0 to 1. The value 65535 means not ranked.
- `stable:<filter>` is one byte: 1 if the cell stays in the top 20 in at least 90% of 1,000 runs with changed weights, otherwise 0.
- The types are in `site/src/contract.ts`. The layout is in section 6 of [docs/v1-spec.md](docs/v1-spec.md).

---

## How we used AI

The core idea and the key design decisions come from our team. We use Claude (Anthropic) to research the challenge and the judging rules, write our planning documents and, during the event, write and test the data pipeline and the site. We check its work at each checkpoint. Our local Challenge Guide asks for mission filters, terrain types and seasons. Claude checked our plan against the guide and we added them. Claude suggested a list of names and we picked Parallels. Our designs, including the logo, are aided by AI. The logo is on the site (header, footer and browser tab), and the site's footer says it was drawn with AI. Any other AI-made image or video carries a visible watermark. On 15 November the team chose the scroll-story opening of another entry, [Terra Nova](https://github.com/Yakiyo/terra-nova), as the model for ours. Claude studied it and wrote our version from scratch, with our own words, data and code; none of its code or images is used.

---

## NASA and partner data sources

Every number on the site comes from one of these datasets. No sample or placeholder data is used. Each row shows the licence as the source states it.

| Dataset | Agency | Licence | Used for |
|---|---|---|---|
| [NASA POWER climatology, MERRA-2 meteorology (power_merra2_climatology_temporal_lst.zarr)](https://nasa-power.s3.amazonaws.com/index.html) | NASA | NASA open data, no restrictions | ground and air temperature, daily range, precipitation, wind, humidity, seasons |
| [NASA POWER climatology, CERES SYN1deg radiation (power_syn1deg_climatology_temporal_lst.zarr)](https://nasa-power.s3.amazonaws.com/index.html) | NASA | NASA open data, no restrictions | aerosol optical depth, UV index, surface albedo |
| [EMIT L3 Aggregated Mineral Spectral Abundance 0.5 Deg V002 (EMITL3ASA)](https://doi.org/10.5067/EMIT/EMITL3ASA.002) | NASA | Freely distributed (NASA open data) | Surface mineral abundance (iron oxides, clays, sulfates, carbonates) per cell |
| [MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 0.05 Deg CMG (MCD12C1) v061, 2025](https://doi.org/10.5067/MODIS/MCD12C1.061) | NASA | NASA open data (LP DAAC, no restrictions) | Share of each cell that is barren, snow/ice or water, from per-class percentages |
| [LRO LOLA polar elevation map LDEM_75S_240M](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img) | NASA | Public NASA data; no restriction stated on the product page | Moon slopes, relief and share of gentle ground in each 10 km window; places the Diviner and PGDA windows. |
| [LRO Diviner south polar winter-minimum and summer-maximum temperature maps (80°S to the pole)](https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/) | NASA | No licence stated on the Diviner team's download page | Moon coldest and warmest ground temperatures and the summer-to-winter swing. |
| [LOLA/PGDA average solar visibility AVGVISIB_75S_120M](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF) | NASA | Public NASA data; no restriction stated on the product page | Moon share of time in sunlight (best-lit pixel and window median). |
| [LOLA/PGDA permanent shadow map LPSR_75S_120M](https://pgda.gsfc.nasa.gov/products/69) | NASA | Public NASA data; no restriction stated on the product page | Moon share of each 10 km window in permanent shadow. |
| [Mars Odyssey GRS water-equivalent hydrogen H2O_SR_5X5](https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab) | NASA | Public NASA data; no restriction stated on the product page | Mars hydrogen (as water-equivalent) in the top metre. |
| [TES dust cover index (Ruff and Christensen 2002)](https://www.mars.asu.edu/~ruff/DCI/dci_lo_ice_dust_16ppd_shifted.pds) | NASA | Open download from the Arizona State University TES team; no licence stated | Mars surface dust cover. |
| [MGS TES thermal inertia maps, night map and interpolation mask (MGS-M-TES-5-TIMAP-V1.0)](https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img) | NASA | Public NASA data; no restriction stated on the product page | Mars thermal inertia, shown as a label and read against NASA's landing-site rule for load-bearing ground (Golombek et al. 2020). |
| [NASA NSSDC Moon fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) | NASA | NASA public document | Noon sun height from latitude (with the Moon's 1.54° tilt). |
| [NASA NSSDC Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | NASA | NASA public document | Noon sun height from latitude (with Mars's 25.2° tilt); planet-wide average temperature for the frozen-months value. |
| [NASA/JPL, REMS air temperature at Gale, Aug 2012–Feb 2013](https://science.nasa.gov/resource/steady-temperatures-at-mars-gale-crater) | NASA | NASA public page | Gale air temperatures. |
| [NASA planetary fact sheets (NSSDCA)](https://nssdc.gsfc.nasa.gov/planetary/factsheet/) | NASA | Public domain (NASA) | Gravity, air and the plain facts behind the dryness and bare-ground targets |
| [NASA Science: the Moon's composition](https://science.nasa.gov/moon/composition/) | NASA | Public domain (NASA) | The south pole's pale highland rock |
| [Hargreaves-Samani (1985) potential evapotranspiration with FAO-56 extraterrestrial radiation, from POWER T2M and T2M_RANGE](https://www.fao.org/4/x0490e/x0490e07.htm) | computed | method | potential evaporation and the UNEP aridity index |
| Solar geometry from latitude | computed | method | noon sun height |
| [Natural Earth 1:10m land polygons (ne_10m_land)](https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip) | other | public domain | land fraction of each cell |
| [Natural Earth 1:10m admin-1 states and provinces (ne_10m_admin_1_states_provinces)](https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip) | other | public domain | region and country names |
| [Copernicus DEM GLO-90 (on AWS Open Data)](https://copernicus-dem-90m.s3.amazonaws.com/) | ESA | Copernicus DEM licence: free for any use with attribution | Earth terrain statistics per 0.5 degree cell, comparable with Moon and Mars target windows |
| [GLiM Global Lithological Map, 0.5 degree grid (Hartmann and Moosdorf 2012)](https://doi.org/10.1594/PANGAEA.788537) | other | CC BY 3.0 | Rock type per cell: plutonic, volcanic, evaporite, ice, water |
| [USGS HRSC–MOLA blended elevation map of Mars, 200 m](https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif) | USGS | Open download from USGS Astrogeology; no licence stated on the file page | Mars slopes, relief and share of gentle ground in each 10 km window. |
| [Hayne et al. 2017, Global regolith thermophysical properties of the Moon from the Diviner Lunar Radiometer Experiment](https://arxiv.org/abs/1711.00977) | other | Open-access preprint | Moon-wide thermal inertia label. |
| [Gómez-Elvira et al. 2017, REMS ground temperature at Gale](https://www-mars.lmd.jussieu.fr/granada2017/abstracts/gomez-elvira_granada2017.pdf) | other | Conference abstract | Gale ground temperatures. |
| [Rodríguez-Manfredi et al. 2023, Perseverance MEDA](https://www.nature.com/articles/s41561-022-01084-0) | other | Open-access paper | Jezero daily air-temperature swing. |
| [Zorzano et al. 2024, MEDA thermal infrared sensor over one Mars year](https://doi.org/10.1038/s41598-024-57458-4) | other | Open-access paper | Jezero ground temperature. |
| [Lemmon et al. 2022, Perseverance Mastcam-Z solar imaging](https://doi.org/10.1029/2022GL100126) | other | Open-access paper | Jezero dust optical depth. |
| [Jezero crater minerals: Horgan et al. 2020 (Icarus) and Scheller et al. 2022 (Science)](https://doi.org/10.1126/science.abo5204) | other | Cited published result | Which mineral groups are reported at Jezero |
| [Farley et al. 2022, aqueously altered igneous rocks sampled on the floor of Jezero crater (Science)](https://doi.org/10.1126/science.abo2196) | other | Cited published result | Mars's basalt crust and Jezero's igneous crater floor, the target for the volcanic rock trait |
| [Gale crater minerals: Rampe et al. 2020 (Geochemistry)](https://doi.org/10.1016/j.chemer.2020.125605) | other | Cited published result | Which mineral groups are reported at Gale |

The datasets come from five main open archives: NASA PDS Geosciences Node, USGS Astrogeology, NASA POWER and NASA Earthdata, Copernicus Data Space / AWS Open Data, and NASA PGDA (Goddard).

### Images on the site

These images are shown, not scored. No NASA logo or insignia is used.

| Image | Source | Licence | Used for |
|---|---|---|---|
| [Blue Marble: Shaded Relief and Bathymetry](https://nasa-gibs.github.io/gibs-api-docs/) | NASA Earth Observatory via NASA GIBS | NASA open data, no restrictions | Earth map background, the 3D Earth in the intro, the small ground pictures in the top 10 and the base layer of the Earth close-up (live tiles). We bundle two copies, `site/public/img/blue-marble.jpg` (1,024 px) and `blue-marble-4k.jpg` (4,096 px, fetched from GIBS on 2026-11-15 for wide screens). The bundled copy takes over if the live tile service is down. |
| [Landsat WELD true colour, global annual mosaic](https://nasa-gibs.github.io/gibs-api-docs/) | NASA / USGS Landsat, via NASA GIBS | NASA open data, no restrictions | Earth side of the close-up in each match (live tiles). Blue Marble shows where it has no data. |
| [LOLA south-pole shaded relief, 87.5° S to the pole](https://trek.nasa.gov/moon/) | NASA LRO LOLA, via NASA Moon Trek tiles | Public domain (NASA) | Moon side of the close-up (live tiles). Shaded relief from laser altimetry, not a photo. |
| [CGI Moon Kit: LROC colour map with filled poles](https://svs.gsfc.nasa.gov/4720) | NASA Scientific Visualization Studio (LRO data) | Public domain (NASA) | The 3D Moon in the intro (`site/public/img/moon.jpg`), and the bundled fallback for the Moon close-up. |
| [Viking MDIM 2.1 global colour mosaic](https://trek.nasa.gov/mars/) | NASA / USGS Astrogeology, via NASA Mars Trek tiles | Public domain (NASA / USGS) | The 3D Mars in the intro (`site/public/img/mars.jpg`), and the Mars side of the close-up (live tiles, with the bundled copy as fallback). |

---

## Technology stack

| Library | Licence | Use |
|---|---|---|
| numpy, scipy, pandas, xarray, zarr, fsspec, s3fs, aiohttp, netCDF4, h5netcdf, rasterio (GDAL), pyproj, pyshp, requests, earthaccess, pyhdf, pytest | Open-source licences, set by each package | Data pipeline and its tests (see `pyproject.toml`) |
| [MapLibre GL JS](https://maplibre.org/) | BSD-3-Clause | Earth globe and map |
| [three.js](https://threejs.org/) | MIT | 3D Earth, Moon and Mars in the intro |
| [Lucide icons](https://lucide.dev/) | ISC | Icons in the match view |
| [Vite](https://vite.dev/) and TypeScript | MIT / Apache-2.0 | Building the site |
| Playwright | Apache-2.0 | Site tests |
| [Archivo](https://fontsource.org/fonts/archivo) (variable, by Omnibus-Type) | SIL Open Font Licence 1.1 | Headings, labels and numbers |

---

## Scoring model

- Each trait is ranked against all of Earth's land. A cell's rank is the share of land, counted by area, that is strictly further from the target value. Land exactly as far away earns no credit.
- A challenge combines its trait ranks with a weighted geometric mean. A mission filter combines the challenge scores the same way. Ranks have a floor of 0.01.
- The Moon has eight challenges: Surface, Resources, Dryness, Heat swing, Shelter, Polar light and power, Industrial sites and Dust. Mars has seven: Surface, Resources, Dryness, Heat swing, Shelter, Atmosphere and dust, and Signs of life. The mission filters are Rover mobility, Life support and Habitat structure.
- Version 1.0 used hand-set weights. A second run, designed after the first, checked each known analog only on the challenges it is used for.
- Version 1.1 gave each part of a challenge equal weight and added a volcanic rock trait for Mars. Why: Mars Surface failed clearly in the second run (21% against ordinary places, pass mark 80%). Farmland is as flat as Jezero's floor, and Mars had no rock trait.
- Version 1.2 counts only land strictly further from the target. Why: the Amazon near Manaus scored above 90% of land for rover mobility at Jezero, because tied values got half credit.
- Each version replaced the one before only by a rule fixed before it ran. The test places have now been used four times, so no further change will be judged on them.
- The rules were fixed in git before each run: commits `16b6a1c` (weights, thresholds, pass marks and held-out split), `d48b9ab` (config formatting restored), `7661981` (version 1.1) and `b070766` (version 1.2).

---

## Validation

We graded the method in public. The weights, the pass marks and the held-out half were fixed in git before each run, and every result is in `site/public/data/validation.json` and on the site, pass or fail. Known analog sites must score above ordinary places (farmland, forest, cities) and above plain deserts.

| Run | What it tested | Result |
|---|---|---|
| First | Method version 1.0, with hand-set weights | 1 of 4 checks pass |
| Second | Each known analog only on the challenges it is used for | 6 of 11 checks with enough sites pass |
| Third | Version 1.1: each part of a challenge counts equally; a volcanic rock trait for Mars | 7 of 15 checks with enough sites pass |
| Fourth | Version 1.2: no credit for tied values. This is the method on the map | 10 of 15 checks with enough sites pass; 6 more have too few sites to count |

- **Held-out half:** version 1.2 beats ordinary places 96% of the time for the Moon and 76% for Mars.
- **What still fails:** Mars Surface misses its pass mark (73% against 80%), and so does Mars Dryness. The Moon's polar and highland check reaches 72% against 80%.
- **Not a blind test any more:** the test places were used four times, so no further change will be judged on them.
- **Top places shift when the weights change.** We changed every weight by up to 50%, 1,000 times. For the Moon's south pole, 13 of the top 20 places for rover mobility stay in the top 20 in at least 90% of runs, 11 of 20 for life support and 12 of 20 for habitat structure. For Jezero the figures are 6, 3 and 0 of 20.

---

## Limits

| Limit | What it means |
|---|---|
| Cells are 0.5 degrees (about 50 km) | Small sites, such as small craters and valleys, are hidden. The close-up shows the ground, but scores stay per cell. |
| One rock class per cell | The GLiM rock map gives one main rock for each cell. |
| Minerals cover bare, dry land only | EMIT mineral data is empty outside its coverage and where vegetation, water, cloud or urban areas hide the ground. |
| Top places change with the weights | We changed the weights by up to 50% in 1,000 runs. For Jezero, 6 of 20 top places stay in the top 20 for rover mobility, 3 of 20 for life support and 0 of 20 for habitat structure. |
| Only two targets are checked | The Moon's south pole and Jezero are checked against test places. The other four are scored but not validated. |
| Validation does not pass in full | See [Validation](#validation). The test places were used four times. |
| Thermal inertia is a label | Mars thermal inertia (NASA TES) is shown, not scored. Earth's side needs a checked conversion first. |
| No UV, no travel difficulty | UV is not scored or shown. How hard it is to get there is not scored. |
| Artemis regions | The nine Artemis regions are not separate maps. Their values sit under the Moon's south pole. |
| Some ideas are left out | Mars ice maps (SWIM) can only be labels. Martian valley networks have no global Earth layer. The lunar pit atlas was not checked. |
| Terrain is ESA data | Earth slopes and relief come from Copernicus DEM GLO-90, a European (ESA) dataset. |
| What Earth can't copy | Low gravity, the Moon's vacuum, Mars's thin air and space radiation. |

---

## Team and credits

**TEAM RMD.** The core idea and the key design decisions are the team's. See [How we used AI](#how-we-used-ai) for what Claude did.

Every dataset, code library and image we used is listed above, with its source and licence: [data sources](#nasa-and-partner-data-sources), [images](#images-on-the-site) and [technology stack](#technology-stack).

---

## Licence

[MIT](LICENSE)

<img src="assets/logo.svg" width="96" alt="Parallels logo">

Logo: AI-made image (drawn by Claude)

# Parallels

**Earth's closest parallels to every part of a Moon or Mars base.**

Our NASA Space Apps 2026 entry for [Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/). Event: 14–15 November 2026.

No single place on Earth can stand in for a Moon or Mars base. So we split base-building into challenges, and for each one we rank the Earth sites best suited to test it. Every match shows what is similar, how similar, and where it breaks.

## Status

Version 1 ranks every land cell on Earth against six targets: the Moon's south pole and five Mars sites (Jezero, Gale, Arcadia Planitia, Deuteronilus Mensae and the Arsia Mons caves). The data files hold method version 1.2. Only the Moon's south pole and Jezero are checked against test places.

Version 1 does not pass every check. It passes 1 of its 4 first checks. In the fourth run, 10 of 15 checks with enough sites pass. On the held-out half, version 1.2 beats ordinary places 96% of the time for the Moon and 76% for Mars. See `dataset/validation.json`.

## What's here

- [docs/workflow.png](docs/workflow.png): our workflow at a glance; start here.
- [docs/challenge-guide.pdf](docs/challenge-guide.pdf): our local event's Challenge Guide, the main brief.
- [docs/challenge.md](docs/challenge.md): the challenge in plain words, and how we meet the guide's six objectives and answer its seven questions.
- [docs/team-plan.md](docs/team-plan.md): what we're building.
- [docs/claudes-plan.md](docs/claudes-plan.md): the build plan from before v1: rivals, method, data, checks and roadmap, and the data checks made before the build.
- [docs/judging-notes.md](docs/judging-notes.md): how Space Apps is judged and what past winners did.
- [docs/guidelines.md](docs/guidelines.md): how we work, the official rules and our submission checklist.
- [CLAUDE.md](CLAUDE.md): instructions for Claude, our AI build assistant.
- `pipeline/`: the Python data pipeline. Its method settings are in `pipeline/config/`.
- `dataset/`: the pre-computed files the pipeline exports. See [The data files](#the-data-files).

## Run it

Pipeline (Python 3.13). Run each command from the repository root.

1. `uv sync` installs the packages into `.venv`.
2. Run the pipeline stages in this order. Raw downloads go to `data/`, which is not in git. Results go to `data/derived/`.

| Stage | Command | What it does |
|---|---|---|
| Climate | `.venv/Scripts/python -m pipeline.climate` | Reads NASA POWER climate data and Natural Earth land. Writes the 0.5 degree climate grid. |
| Terrain | `.venv/Scripts/python -m pipeline.terrain_grid` | Reads Copernicus DEM GLO-90 tiles. Writes slope and relief for each cell. Takes about 30 minutes. |
| Surface | `.venv/Scripts/python -m pipeline.surface` | Reads GLiM rock, NASA EMIT minerals and MODIS land cover. Writes the surface grid. Needs a free NASA Earthdata login in `~/.netrc`, read through `earthaccess`. Without it, EMIT minerals and every MODIS file are out. rasterio's GDAL has no HDF4 driver, so the MODIS file is read with `pyhdf`. |
| Targets | `.venv/Scripts/python -m pipeline.targets` | Reads Moon and Mars maps. Writes `pipeline/derived/targets_v1.json`. |
| Export | `.venv/Scripts/python -m pipeline.export` | Ranks the cells, runs the validation and writes the files in `dataset/`. Add `--method 1.2` to run method versions 1.1 and 1.2 as further validation runs. |

3. Run the tests: `.venv/Scripts/python -m pytest`.

On macOS and Linux, use `.venv/bin/python` in place of `.venv/Scripts/python`.

Version 1 was built with Python 3.13.17 and uv 0.13.7. Never print, copy or commit the Earthdata login.

## The data files

The pipeline's whole output is these files in `dataset/`. `pipeline.export` writes all of them.

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
- Hand-set weights use the same 70% gate as the mission filters: the sum of each challenge weight times its `cov`, over the sum of the challenge weights. A cell under 70% is not ranked.
- The manifest's `scoring.layout` repeats these target-file rules in one paragraph.
- The types are in `dataset/contract.ts`.

What the files promise:

- Every number traces to a named dataset. Each trait in the manifest names its Earth dataset (an id into the data list), its statistic and its resolution. Each target value names its statistic, its dataset or paper, its resolution and its kind (computed, published or derived).
- The Moon's south-pole target also holds its own values for each of the nine Artemis regions, under `regions`.
- The data list gives each dataset's id, name, link, licence and use.
- A reader of the files may combine the pre-computed ranks with its own weights. It never recomputes a rank or a value.

## How we used AI

The core idea and the key design decisions come from our team. We use Claude (Anthropic) to research the challenge and the judging rules, write our planning documents and, during the event, write and test the data pipeline and the site. We check its work at each checkpoint. Our local Challenge Guide asks for mission filters, terrain types and seasons. Claude checked our plan against the guide and we added them. Claude suggested a list of names and we picked Parallels. Claude also drew the logo; it is marked as AI-made wherever it appears, and it is not used on the site or the project page. Any other AI-made image or video carries a visible watermark.

## Data

Every number in the data files comes from one of these datasets. No sample or placeholder data is used. Each row shows the licence as the source states it.

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

### Code libraries

| Library | Licence | Use |
|---|---|---|
| numpy, scipy, pandas, xarray, zarr, fsspec, s3fs, aiohttp, netCDF4, h5netcdf, rasterio (GDAL), pyproj, pyshp, requests, earthaccess, pyhdf, pytest | Open-source licences, set by each package | Data pipeline and its tests (see `pyproject.toml`) |

## Method in short

- Each trait is ranked against all of Earth's land. A cell's rank is the share of land, counted by area, that is strictly further from the target value. Land exactly as far away earns no credit.
- A challenge combines its trait ranks with a weighted geometric mean. A mission filter combines the challenge scores the same way. Ranks have a floor of 0.01.
- The Moon has eight challenges: Surface, Resources, Dryness, Heat, Shelter, Light, Industrial sites and Dust. Mars has seven: Surface, Resources, Dryness, Heat, Shelter, Atmosphere and Life. The mission filters are Rover mobility, Life support and Habitat structure.
- Version 1.0 used hand-set weights. A second run, designed after the first, checked each known analog only on the challenges it is used for.
- Version 1.1 gave each part of a challenge equal weight and added a volcanic rock trait for Mars. Why: Mars Surface failed clearly in the second run (21% against ordinary places, pass mark 80%). Farmland is as flat as Jezero's floor, and Mars had no rock trait.
- Version 1.2 counts only land strictly further from the target. Why: the Amazon near Manaus scored above 90% of land for rover mobility at Jezero, because tied values got half credit.
- Each version replaced the one before only by a rule fixed before it ran. The test places have now been used four times, so no further change will be judged on them.
- The default weights come from what each target and its hardware need, never from the test places. Each weight has a one-line reason in `pipeline/config/`. They were set before any version 1 score existed.
- The rules were fixed in git before each run: commits `16b6a1c` (weights, thresholds, pass marks and held-out split), `d48b9ab` (config formatting restored), `7661981` (version 1.1) and `b070766` (version 1.2).

## Limits

| Limit | What it means |
|---|---|
| Cells are 0.5 degrees (about 50 km) | Small sites, such as small craters and valleys, are hidden. Zooming to one valley or crater is not in version 1. |
| One rock class per cell | The GLiM rock map gives one main rock for each cell. |
| Minerals cover bare, dry land only | EMIT mineral data is empty outside its coverage and where vegetation, water, cloud or urban areas hide the ground. |
| Top places change with the weights | We changed the weights by up to 50% in 1,000 runs. For Jezero, 6 of 20 top places stay in the top 20 for rover mobility, 3 of 20 for life support and 0 of 20 for habitat structure. |
| Only two targets are checked | The Moon's south pole and Jezero are checked against test places. The other four are scored but not validated. |
| Validation does not pass in full | See [Status](#status). The test places were used four times. |
| Thermal inertia is a label | Mars thermal inertia (NASA TES) is shown, not scored. Earth's side needs a checked conversion first. |
| No UV, no travel difficulty | UV is not scored or shown. How hard it is to get there is not scored. |
| Artemis regions | The nine Artemis regions are not separate maps. Their values sit under the Moon's south pole. |
| Some ideas are left out | Mars ice maps (SWIM) can only be labels. Martian valley networks have no global Earth layer. The lunar pit atlas was not checked. |
| Terrain is ESA data | Earth slopes and relief come from Copernicus DEM GLO-90, a European (ESA) dataset. |
| What Earth can't copy | Low gravity, the Moon's vacuum, Mars's thin air and space radiation. |

## Licence

[MIT](LICENSE)

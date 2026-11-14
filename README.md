<img src="assets/logo.svg" width="96" alt="Parallels logo">

# Parallels

**Earth's closest parallels to every part of a Moon or Mars base.**

Our NASA Space Apps 2026 entry for [Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/). Event: 14–15 November 2026.

**Status:** the idea ([docs/team-plan.md](docs/team-plan.md)) and the name are set, and the plan meets each benchmark in our local event's Challenge Guide. The tech stack, roadmap and fallbacks are in [docs/claudes-plan.md](docs/claudes-plan.md). A working prototype of the finder is in `site/` and `pipeline/`.

No single place on Earth can stand in for a Moon or Mars base. So we split base-building into challenges, and for each one we rank the Earth sites best suited to test it. Every match shows what is similar, how similar, and where it breaks.

## What's here

- [docs/workflow.png](docs/workflow.png): our workflow at a glance; start here.
- [docs/challenge-guide.pdf](docs/challenge-guide.pdf): our local event's Challenge Guide, the main brief.
- [docs/challenge.md](docs/challenge.md): the challenge in plain words, and how we meet the guide's six objectives and answer its seven questions.
- [docs/team-plan.md](docs/team-plan.md): what we're building.
- [docs/claudes-plan.md](docs/claudes-plan.md): build notes: method, data, checks, stack and roadmap.
- [docs/judging-notes.md](docs/judging-notes.md): how Space Apps is judged and what past winners did.
- [docs/guidelines.md](docs/guidelines.md): how we work, the official rules and our submission checklist.
- [CLAUDE.md](CLAUDE.md): instructions for Claude, our AI build assistant.
- `retired/`: earlier challenge ideas, kept for reference.

## Run it

- Pipeline (Python 3.13): `uv venv .venv && uv pip install -p .venv numpy scipy rasterio pyproj requests pytest`, then `.venv/Scripts/python -m pipeline.earth`, `-m pipeline.planets` and `-m pipeline.build`. Tests: `.venv/Scripts/python -m pytest pipeline`.
- Site (`site/`): `npm install`, `npm run dev`. Tests: `npx playwright install chromium`, then `npm test` (set `RUN_NETWORK=1` to also check every source link).

## How we used AI

The core idea and the key design decisions come from our team. We use Claude (Anthropic) to research the challenge and the judging rules, write our planning documents and, during the event, write and test the code. We check its work at each checkpoint. Claude checked our plan against the local Challenge Guide and suggested the mission filters, terrain types, seasons and extra traits; we chose to adopt them. Claude suggested a list of names and we picked Parallels. Claude also drew the logo, which is labelled here and in the file's metadata. Any other AI-made image or video carries a visible watermark.

## Data

The prototype mixes real data with clearly labelled sample values. On the site, every sample number carries a hatched "sample" tag, and the validation check uses real data only.

**Real**

| Source | Used for |
|---|---|
| [NASA POWER climatology](https://power.larc.nasa.gov/) | Earth coldest temperature, yearly and daily swing, frozen months, rain and snow |
| [Copernicus DEM GLO-90](https://registry.opendata.aws/copernicus-dem/) (ESA, partner data) | Earth slopes and height range, resampled to 240 m (Moon) and 200 m (Mars) |
| [LRO LOLA south-pole elevation, 240 m](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/) | Moon slopes and height range |
| [LRO Diviner polar temperatures](https://www.diviner.ucla.edu/science) | Moon coldest and hottest ground |
| [NASA PGDA south-pole illumination](https://pgda.gsfc.nasa.gov/products/69) | Moon share of time in sunlight |
| [HRSC–MOLA blended Mars DEM, 200 m](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m) (USGS; ESA/DLR and NASA) | Mars slopes and height range |
| [Mars Odyssey GRS water-equivalent hydrogen](https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/) | Mars ice in the ground |
| [MGS TES dust cover index](https://www.mars.asu.edu/~ruff/DCI/dci.html) | Mars dust cover (shown, not scored) |
| Curiosity REMS and Perseverance MEDA, published | Mars temperatures at Gale and Jezero |
| [USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/), [USGS Mars cave catalogue](https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing) | where we place each target |
| [NASA GIBS Blue Marble](https://nasa-gibs.github.io/gibs-api-docs/) | map background |
| Sun height | computed from latitude |

**Sample (placeholders)**: ground strength, rock cover, ice in the ground (Earth and Moon), feldspar-rich rock, clays and sulfates, dust-lifting days, and Mars temperatures at Arcadia Planitia, Deuteronilus Mensae and Arsia Mons. They are generated from a fixed seed, so they don't change between runs, and they are never used in the validation check.

Code libraries: numpy, scipy, rasterio (GDAL), pyproj, requests, pytest; Vite, TypeScript, MapLibre GL JS, Playwright; Barlow fonts (SIL Open Font License).

## Licence

[MIT](LICENSE)

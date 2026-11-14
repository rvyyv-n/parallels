# Claude's plan

Build notes for the [team plan](team-plan.md): rivals, method, data, checks, stack, roadmap and fallbacks. Written by Claude on 13 November 2026 and aligned with our local [Challenge Guide](challenge-guide.pdf) on 14 November. Where this file and the team plan differ, the team plan wins.

## 1. Rivals

A scan on 13 November found at least 22 public repos for this challenge. Three are serious:

| Project | Strong point | What it lacks |
|---|---|---|
| [TwinWorlds](https://github.com/JimmyGuajan/twinworlds) | 15-trait fingerprint, a mission picker, "what it cannot simulate", a 2.5° global map, live site | Its only check on known sites is an anecdote; global map is coarse; some traits are literature estimates |
| [EarthTwin](https://github.com/es-ratt/earthtwin) | Leaves missing data empty, limitations tab, tests, live site | Ranks only 18 hand-picked Earth sites; its own docs say "not a validated ranking" |
| [terrestrial-analog-finder](https://github.com/shishir-kuet/terrestrial-analog-finder) | Terrain at 30 m in 12 regions | Terrain only, no global search, no live link |

Where we can beat them:

1. **We test the method in public.** Known analogs should outrank farmland and rainforest, with plain deserts in between, and we fix the weights before running the test. None of the three rivals does this. Our literature search turned up no published analog method checked this way either.
2. **Search all of Earth's land, then zoom to one spot.** Screen the globe at 0.5°, then compare terrain at the same scale as the Moon or Mars data, down to one valley, crater or massif. The challenge asks for exactly this ("'The Sahara' is too broad").
3. **Rank by "Earth rank", show the real gap.** Nowhere on Earth is as cold as a lunar crater, so we rank places by how far toward the target they get. Next to that rank we always show the real gap in units, e.g. how far the coldest month falls short of −248 °C.
4. **A headline that fills a real gap.** The Moon's south pole is pale anorthosite highland rock ([Lemelin et al. 2022](https://api.crossref.org/works/10.3847/PSJ/ac532c)), but most lunar analogs in use are dark basalt. Mistastin crater, where Artemis crews trained, is the exception ([NASA, LPSC 2024](https://ntrs.nasa.gov/api/citations/20230018695/downloads/LPSC2024_Evans_draft2.pdf)). We headline a highland stand-in only if NASA data alone ranks it high (section 5).

## 2. The main flow

The first version has **two targets: the Moon's south pole and Jezero crater on Mars.** Arcadia Planitia (buried ice) comes next, then the rest of section 5.

1. **Open the site.** The map already shows the headline find for the Moon's south pole, with its scorecard open.
2. **Pick a target and a mission filter** (rover mobility, life support, habitat structure). The map colours all land by match, and a list shows the top 10 spots with their coordinates and terrain type. A "rarely used" badge marks spots more than 100 km from every known analog site in our list.
3. **Click a spot.** The scorecard opens:
    - each trait as a bar of Earth rank, with the real Earth and target values (and their datasets and resolution) as the main figure beside it;
    - an "Earth can't copy" block for gravity, air, radiation and magnetic shield;
    - the site's best months to test, freeze–thaw months and rainy months;
    - how hard it is to get there;
    - one line on what to test there;
    - Earth and target images side by side.
4. **"How we checked it"** shows the validation chart (section 6).

That's two clicks to a result, well under a minute. A terrain-type filter and hand-set weights sit beside the list.

**Extras,** only once that flow works:
- more targets;
- a stability badge (section 6);
- a reverse mode: click any place on Earth and see its closest target.

## 3. Method

### Traits

The first version scores these traits; wind, dust and UV count for Mars only.

| Trait | Earth data | Moon data | Mars data |
|---|---|---|---|
| Cold | POWER surface temperature, coldest month | Diviner winter minimum | REMS and MEDA ground temperature |
| Heat swing | POWER day-to-night and seasonal range | Diviner summer max minus winter min | REMS and MEDA daily swing |
| Thermal inertia | estimated from MODIS day–night temperature (MOD11C3) and albedo (MCD43C3), marked as an estimate | Diviner regolith properties ([Hayne et al. 2017](https://doi.org/10.1002/2017JE005387)) | TES thermal inertia map |
| Dryness | aridity index: POWER rain (PRECTOTCORR) against evaporation (EVPTRNS) | dry | MEDA humidity |
| Sunlight and sun height | POWER sunlight; noon sun height, which we compute | PGDA fraction of time lit; sun 2–7° above the horizon | computed from latitude |
| Bare ground | MODIS vegetation index (MOD13C2) | bare | bare |
| Terrain | slope and roughness, computed by us from SRTMGL30, NASADEM or Copernicus | slope and roughness, computed by us from LOLA height | slope and roughness from MOLA height |
| Rock and minerals | Moon: share of the cell in GLiM rock classes like the target's (plutonic for highlands). Mars: EMIT minerals (10 kinds, 55°S–55°N) | anorthosite, low iron | clays, sulfates, carbonates, olivine |
| Ice and frozen ground | MODIS snow (MOD10CM), POWER soil temperature, Obu 2018 permafrost | ice in shadowed craters (LCROSS, LEND, Mini-RF) | buried ice (SWIM, SHARAD, Odyssey GRS) |
| Wind and dust (Mars only) | POWER wind | — | MEDA wind; TES dust cover index |
| UV (Mars only) | POWER UV index (ALLSKY_SFC_UV_INDEX) | — | published surface UV; Earth falls short, shown as a gap |

- **Traits a target lacks score zero weight for that target:** wind on the Moon, for example. Otherwise the calmest rainforest basins would score as "Moon-like".
- **Labels only, never scored:** lists from papers (anorthosite massifs, lava tubes, impact craters). They explain a match, so a place can't rank high just because we put it on a list.
- **Not scored:** how hard it is to get there, from SEDAC population (GPWv4) and GRIP4 roads.
- **Seasons:** from POWER monthly values. A freeze–thaw month has an average daily low below 0 °C and high above it (T2M_MIN, T2M_MAX); a rainy month has well above the site's average rain. Best months are those with neither. Year-round viability is the share of usable months, and it lowers the score only for year-round testing.
- **Same statistic on both sides where possible.** Where it isn't (Earth monthly climate against a Diviner pixel extreme, for example), the scorecard names each one. Slope is computed with one method from every elevation map, never mixed with ready-made slope products.

### Terrain types and clustering

Each 0.5° cell gets one tag, by rules shown on the site:

| Type | Rule |
|---|---|
| Arid basin | aridity index below 0.2 and lower than its surroundings |
| High-altitude volcanic field | mostly GLiM volcanic rock, above 2,000 m |
| Salt flat | GLiM evaporites, aridity index below 0.2 |
| Frozen ground | permafrost (Obu 2018) |
| Cave or lava tube | point list: USGS Mars cave catalogue, [LROC lunar pits](http://lroc.sese.asu.edu/atlases/pits), Earth caves from papers |

The thresholds are first guesses, fixed before any validation run. Separately, k-means on the trait values groups cells into clusters; the site shows how far clusters and tags agree, as a check on both.

**Shown on every scorecard, never scored**, because nowhere on Earth comes close:

| | Earth | Moon | Mars |
|---|---|---|---|
| Gravity (m/s²) | 9.81 | 1.62 | 3.73 |
| Air pressure | 1,013 mbar at sea level | 3×10⁻¹⁵ bar at night | 6.36 mbar average |
| Surface radiation (dose a person receives) | about 6.6 µSv/day (2.4 mSv a year, natural background) | 1,369 µSv/day (Chang'e 4, not the pole) | about 670 µSv/day (Gale) |

Sources: NASA's [Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) and [Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) fact sheets, [background radiation](https://en.wikipedia.org/wiki/Background_radiation) (UNSCEAR figure), [Zhang et al. 2020](https://www.science.org/doi/10.1126/sciadv.aaz1334) via a [press summary](https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html), and [NASA's Curiosity RAD release](https://science.nasa.gov/photojournal/radiation-measurements-on-mars/).

### Scoring

**Earth rank, one rule for every trait.** A place's rank on a trait is the share of Earth's land that is further from the target than it is, where:

- distance is |Earth value − target value|;
- land is counted by area (cells weighted by cos latitude), so the small cells near the poles don't skew it;
- 0.99 means only 1% of land comes closer.

The same rule works whether the target sits inside Earth's range (Mars slopes) or far outside it (lunar cold), and it puts every trait on the same 0–1 scale.

- **Overall match:** a weighted geometric mean of the trait ranks, each floored at 0.01 so one trait can't zero the total. A weak trait still pulls it down hard. The [Earth Similarity Index](https://arxiv.org/pdf/1507.06293) combines traits this way. Its known flaw is that one number hides which traits match, so we never show the total without the trait bars.
- **Missing data:** never filled in on screen. The scorecard says "no data". For ranking only, a missing trait counts as the median (0.5), so a gap can't lift a place. A cell where less than 70% of the weight has data isn't ranked at all.
- **Weights:** one default set per target and mission filter, chosen from what the target and the hardware need, not from the test sites. They're committed before the first validation run. Users can change them; every filter's scores are pre-computed.
- **Honest resolution:** POWER's climate values are model output at about 50 km (MERRA-2) and 110 km (CERES), not satellite pixels. The global map is 0.5° and says so. Only the zoom stage claims fine detail, and only for terrain.

### Zoom stage

1. **Pick the windows:** the top 30 cells per target, plus the known analogs smaller than a cell.
2. **Cut each one:** a 20 × 20 km window of NASADEM (60°S–60°N), or Copernicus beyond that.
3. **Bring both sides to one scale:** resample to the planet map's scale, 240 m for LOLA and about 460 m for 128-pixel-per-degree MOLA.
4. **Compare the terrain:** match the window's slope and roughness spread with the target's.
5. **Choose the spot:** the best-matching spot inside each cell.

This gives the scorecard its "one valley, crater or massif". If the fine MOLA map is too big to fetch in time, Mars gets no terrain zoom and says so.

## 4. Data

Every dataset below was checked on 13 November: the files answered, or NASA's data catalogue (CMR) listed them.

**NASA Earth data** (the main scoring work):

| Dataset | What for | Login? | Size |
|---|---|---|---|
| [NASA POWER climatology](https://nasa-power.s3.amazonaws.com/) (MERRA-2 and CERES SYN1deg, Zarr on AWS) | temperature (incl. monthly lows and highs), sunlight, rain, evaporation, UV index, humidity, wind, soil temperature, snow depth | no | about 150 MB |
| EMIT L3 mineral abundance (EMITL3ASA v002) | 10 surface minerals at 0.5°, 55°S–55°N; no feldspar, so Mars only | Earthdata | 22 MB |
| SRTMGL30 v002; NASADEM tiles for zoom windows | elevation, slope, roughness, 60°S–60°N | Earthdata | about 250 MB, plus about 1 MB per window |
| MODIS vegetation index (MOD13C2 v061), 0.05° | bare ground | Earthdata | about 100 MB a month (fewer months will do) |
| MODIS snow cover (MOD10CM v61) | months with snow | Earthdata | about 15 MB |
| MODIS land-surface temperature (MOD11C3 v061) | day–night swing for thermal inertia; sharper temperature | Earthdata | about 0.8 GB a year |
| MODIS albedo (MCD43C3 v061) | thermal inertia estimate | Earthdata | size to check |
| SEDAC population (GPWv4 rev11, 1°) | how hard to get there | Earthdata | under 1 MB |
| [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) Blue Marble tiles | map background | no key | streamed |

**Moon and Mars data** (all answered on 13 November unless marked):

| Dataset | What for | Size |
|---|---|---|
| [LOLA south-pole height](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img), 240 m | terrain (we compute slope and roughness) | 29 MB |
| [LOLA fraction of time lit](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF) and [permanent shadow](https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_75S_120M_201608.TIF), 120 m | sunlight | 83 MB, 1 MB |
| Diviner [summer maximum](https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_summer_max-float.tif) and [winter minimum](https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_winter_min-float.tif) temperature | cold, heat swing | 26 MB each |
| [MOLA height map](https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img), 16 px per degree; 128 px per degree for zoom windows | Mars terrain | 33 MB; 128 px size still to check |
| [TES dust cover index](http://www.mars.asu.edu/~ruff/DCI/dci_lo_ice_dust_16ppd_shifted.tif) | Mars dust | 50 MB |
| [Odyssey GRS water-equivalent hydrogen](https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab) | Mars ice | 187 KB |
| [USGS Mars cave catalogue](https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing) | Mars caves (label) | 1.8 MB |
| TES thermal inertia map (USGS Astrogeology or PDS) | Mars thermal inertia | link to confirm |
| Diviner regolith properties ([Hayne et al. 2017](https://doi.org/10.1002/2017JE005387)) | Moon thermal inertia | link to confirm |
| [LROC lunar pit atlas](http://lroc.sese.asu.edu/atlases/pits) | Moon pits (label) | small |
| [SWIM ice maps](https://swim.psi.edu/SWIM4MIMProducts.php) | Mars buried ice | unknown: site was down; retry |
| Rover and orbiter results (REMS, RAD, MEDA, LCROSS, LEND, Mini-RF) | target values | from papers (section 5) |

**Partner and other data** (fills gaps; credited in its own form field):

| Dataset | What for | Licence |
|---|---|---|
| Copernicus DEM GLO-90 (ESA, on AWS, no login) | terrain beyond 60°N and 56°S | Copernicus licence |
| [GLiM rock map](https://doi.org/10.1594/PANGAEA.788537) | rock class for Moon targets and wherever EMIT doesn't reach; volcanic and evaporite classes for terrain types | CC-BY 3.0 |
| [Obu et al. 2018 permafrost](https://doi.org/10.1594/PANGAEA.888600) | frozen ground, Northern Hemisphere | CC-BY 3.0 |
| [GRIP4 roads](https://www.globio.info/download-grip-dataset) | how hard to get there | check on download |
| Anorthosite massifs, lava tubes, impact craters | labels | from papers. The Earth Impact Database site looks dead, and no global lava-tube map exists. |

**Totals:** about 2 GB, and one free NASA Earthdata account unlocks all of it. Without that account, POWER, Copernicus and the planetary files still cover most traits (section 9).

**Known gaps:**
- Radiation has never been measured at the Moon's south pole, or anywhere on Mars's surface except Gale. We label stand-in values as such.
- NASA publishes no per-region values for the Artemis candidates, so we compute them from the LOLA, PGDA and Diviner files.

## 5. Targets and the headline find

### Moon

NASA's nine candidate regions near the south pole ([NASA, 28 Oct 2024](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)):

- Peak near Cabeus B
- Haworth
- Malapert Massif
- Mons Mouton Plateau
- Mons Mouton
- Nobile Rim 1
- Nobile Rim 2
- de Gerlache Rim 2
- Slater Plain

They're still the list for the first crewed landing, which [NASA's Artemis IV page](https://www.nasa.gov/mission/artemis-iv/) now dates to early 2028.

- **How we place them:** NASA publishes no centre points, so we anchor each region on the USGS coordinates of the feature it's named after, and say so.
- **First version:** one "south-pole highlands" target, built from all nine regions. Each region's own values, computed from the LOLA, PGDA and Diviner files, appear on its scorecard.

Published values for the region as a whole:

| Trait | Value | Source |
|---|---|---|
| Coldest ground | as low as 25 K (−248 °C) in permanent shadow; sunlit rims about 220 K | [Diviner team](https://www.diviner.ucla.edu/science) |
| Sunlight | 92% of the time on the Shackleton–de Gerlache ridge, 2 m above the ground | [Gläser et al. 2014](https://elib.dlr.de/94240) |
| Sun height | 2–7° above the horizon | [NASA Artemis overview for Space Apps 2025](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) |
| Slope limits | landing under 10°; walking under 20° | same |
| Rock | noritic anorthosite (feldspar-rich) | [Lemelin et al. 2022](https://api.crossref.org/works/10.3847/PSJ/ac532c) |
| Ice | 5.6 ± 2.9% water by weight in Cabeus soil | [LCROSS, Colaprete et al. 2010](https://www.chem.uci.edu/~unicorn/old/H2A/handouts/PDFs/LCROSSPaper.pdf) |

### Mars

| Site | Lat, lon (°E) | Why it's a target | Key values |
|---|---|---|---|
| Jezero (first version) | 18.38, 77.58 | Perseverance; ancient lake | air pressure 650–761 Pa; gusts to 25 m/s; carbonates, sulfates, olivine ([Rodríguez-Manfredi 2023](https://www.nature.com/articles/s41561-022-01084-0)) |
| Arcadia Planitia (next) | 47.2, 184.3 | best candidate for reachable buried ice | ice slab tens of metres thick ([Bramson 2015](https://arxiv.org/pdf/1509.03210)); SWIM's top area ([Morgan 2021](https://www.nature.com/articles/s41550-020-01290-z)) |
| Gale | −5.4, 137.8 | Curiosity; the only radiation measurement on Mars's surface | day-to-night drop usually over 55 °C; clay mudstone ([Vaniman 2014](https://doi.org/10.1126/science.1243480)) |
| Deuteronilus or Protonilus Mensae | 43.9, 22.6 or 42.19, 48.06 | glaciers; NASA 2015 human landing-site workshop | debris aprons mostly water ice ([Plaut 2009](https://api.crossref.org/works/10.1029/2008GL036379)) |
| Arsia Mons caves | −8.35, 239.91 (summit) | cave openings | 7 openings 100–225 m wide ([Cushing 2007](https://doi.org/10.1029/2007GL030709)) |

### Headline candidates

These are places to test, not results. All coordinates are rough and get checked on a map first.

| Candidate | Stands in for | Why | Used as an analog? |
|---|---|---|---|
| Nain anorthosite massif, Labrador (56.5, −61.7) | the Moon's south-pole highlands | about 20,000 km² of anorthosite, next to Mistastin | none found |
| Manicouagan crater, Québec (51.4, −68.7) | a highland impact crater | impact into anorthosite | proposed only |
| Lut Desert kaluts, Iran (30.4, 58.7) | Mars's wind-carved terrain | yardangs and mega-ripples like Mars's | a few papers |
| Umm Jirsan lava tube, Harrat Khaybar, Saudi Arabia (25.7, 39.9) | lava tubes on the Moon and Mars | 1,481 m tube in a young lava field | no planetary study found |
| Emi Koussi, Tibesti, Chad (19.8, 18.6) | a Martian volcano | NASA Earth Observatory pairs it with Elysium Mons | proposed only |

**The bar for a headline:**
- it ranks in the top 1% of land outside Antarctica, on NASA-data traits alone, with the paper-list labels switched off;
- it is more than 100 km from every known analog in our list;
- we can show it at one specific spot.

**Antarctica** is left out of headlines because it's the analog everyone already uses and access is tightly controlled. It still appears on the map, and in the validation.

We pick the headline on Saturday evening from the results. If none clears the bar, the validation becomes the headline (section 9).

**Rock is a weak link for the Moon.** At 0.5°, GLiM only tells us "plutonic rock", not "anorthosite". Earth anorthosite also differs from lunar anorthosite in age and calcium content. The scorecard says both plainly.

## 6. How we check it

The full lists of test places are in appendix A.

**Mars test (overall score):**

1. **Groups:**
    - 23 known Mars analogs, such as Atacama (Yungay), the Dry Valleys, Haughton crater, Rio Tinto, Utah's MDRS and Qaidam;
    - 12 ordinary places, such as the Iowa corn belt, the Amazon near Manaus and the Ganges plain;
    - 6 plain deserts that aren't analogs, such as a Sahara dune sea and the Thar. These catch a method that just rewards "dry and bare".
2. **Scoring rule:** each place is scored against the built Mars targets, and its best target counts. The same rule applies to every group.
3. **Pass marks, set now, before we see any data:**
    - pick one known analog and one ordinary place at random: the analog ranks higher at least 8 times in 10;
    - pick one known analog and one plain desert: the analog ranks higher at least 6 times in 10.

**Moon test (two parts):**

- **Why it's split:** most lunar analogs in use are basalt training sites, which stand in for the Moon's dark plains (maria), not its polar highlands. A good south-pole match should rank them low on rock.
- **Part 1, polar and highland analogs:** Mistastin, Haughton crater on Devon Island, and Lofoten. These face the ordinary places on the overall south-pole score, with the same "8 in 10" mark. It's a small group, and we say so.
- **Part 2, basalt and crater sites:** checked only on the traits they're used for. Black Point and the Cinder Lake craters should beat every ordinary place on terrain roughness, for example.
- **On the site:** we show where NASA's basalt training sites land for the south pole. Ranking low on rock is the point of the headline, not a failure.

**Fairness:**
- **Weights:** committed before the first run, so the git history shows we didn't tune them to pass.
- **Held-out half:** half the known analogs are set aside in a fixed, committed random split. If we ever change the weights, only that unseen half judges the change, and the site shows both runs.
- **Small sites:** places smaller than a 0.5° cell (Meteor Crater, Rio Tinto) are scored on climate and rock at 0.5°, and on terrain only after the zoom stage.
- **Misses:** if a known analog ranks low, we say why. Rio Tinto, for example, is an analog for its acid chemistry, which no trait here measures.

**Stability:** re-run with 1,000 random weight sets, each weight changed by up to ±50%. A top match that stays in the top 20 in at least 90% of runs earns the stability badge.

**On the site:** one chart. Each test place is a dot on a 0–100 Earth-rank line, with one row per group. The same chart goes on the project page and in the video.

**Data checks:**
- Five random cells match the POWER point API.
- The computed Artemis values agree with published ones (ridge lit about 92%; shadowed floors below 110 K).

## 7. Tech stack and hosting

- **Pipeline:** Python 3.13 with numpy, xarray, zarr, fsspec, rasterio, netCDF4, earthaccess and pandas, in `pipeline/`. Raw downloads go in `data/` (already gitignored). Outputs are small files in `site/public/data/`. A 0.5° land grid is about 75,000 cells, so the traits plus the scores for each mission filter come to under a few MB per target.
- **Site:** Vite and TypeScript (no framework unless the interface outgrows it); MapLibre GL JS 6.18 with GIBS Blue Marble tiles (no key; zoom levels up to 8); plain SVG charts. Every score, for every mission filter, is pre-computed into its own file, so the browser never recalculates anything.
- **Tests:**
    - pytest for the pipeline: the scoring rule on hand-made cases, plus the data checks in section 6;
    - Playwright for the main flow and every link.
- **Hosting:** GitHub Pages needs a public repo on a free account. Vercel's free plan works from our private repo, but it's for non-commercial use only and pauses a site for 30 days if it goes over the limits. **Recommendation:** make the repo public before submission, serve from GitHub Pages and keep Vercel as a mirror.
- **Lasting until 26 January 2027:**
    - no keys, no server, no live data calls;
    - GIBS tiles are the only live dependency, so a static background image ships as a fallback;
    - we tag the submitted version and request a FortiGuard classification after deploying.

## 8. Roadmap

Steps in order, each with its check. The site is built on a stub data file from step 1 onward, alongside the pipeline, so it never waits for real data. Clock times appear only where our guidelines ask for them: the fallback switch times in section 9, a first draft on Saturday night, and the final submission by Sunday 21:59.

1. **Before the event: accounts, setup and downloads.** We make a free Earthdata account, install the Python packages, download every file in section 4, and deploy a placeholder site that already runs on stub data.
    → verify: a download check lists every file and its size; the placeholder opens in a private window on a phone.
2. **Earth trait grid and target values** for the south pole and Jezero.
    → verify: five random cells match the POWER point API; the Artemis values agree with published ones.
3. **Scoring, terrain types, seasons and the validation run.** The weights (per mission filter), terrain thresholds and the held-out split are committed first.
    → verify: the section 6 pass marks are met, or the failure is written up honestly.
4. **Real data in the site.**
    → verify: **Checkpoint 1.** Both of us test on a phone and a laptop, and a newcomer gets a result in under a minute.
5. **Zoom stage and headline.**
    → verify: the headline clears the section 5 bar, and its scorecard shows every trait or an honest "no data".
6. **First complete draft submitted (Saturday night).**
    → verify: every form field is filled in, and the site link opens in a private window.
7. **Sunday: extras, demo and page.** Arcadia and more targets, the stability badge, the 28-second video and the page images.
    → verify: **Checkpoint 2.** Same tests as Checkpoint 1, plus the numbers on screen are checked against the source files.
8. **Final submission by 21:59.**
    → verify: every box in guidelines section 7 is ticked, and the success banner shows.

## 9. Risks and fallbacks

Times are in our Local Event's time zone.

| Risk | Fallback | Switch by |
|---|---|---|
| Python packages won't install here | uv or Miniforge; failing that, run the pipeline on the laptop | Friday night |
| Earthdata login or downloads fail | POWER, Copernicus and the planetary files only (no login); rock from GLiM | Saturday 10:00 |
| SWIM site stays down | NASA image PIA26045 plus SHARAD and Odyssey GRS | Saturday 10:00 |
| Hosting: Pages needs a public repo | Vercel free plan from the private repo | Saturday 12:00 |
| Rock trait unworkable | drop it from the score and keep it as an explanation | Saturday 14:00 |
| Map library trouble | static map image plus a clickable list | Saturday 15:00 |
| Validation fails | publish the honest result and the reasons, never hidden. It's still more than any rival shows. | write-up by Saturday 16:00 |
| Moon ranking is all polar ice | already handled: GLiM's ice class scores low on rock, and headlines exclude Antarctica | built in |
| Zoom stage too slow | ship the 0.5° screen; headline at cell level with imagery | Saturday 20:00 |
| No headline clears the bar | headline the validation: "it finds the analogs NASA uses, and ranks these next" | Saturday 22:00 |
| GIBS tiles go down after the event | bundled static background image | built in from the start |
| Video fails | 7 slides or fewer | Sunday 18:00 |

## 10. Awards, project page and demo

**Awards we aim at:**

| Award | What on the page makes the case |
|---|---|
| Best Use of Science | the validation chart; weights fixed beforehand; a held-out half; trait-by-trait "where it breaks" |
| Best Use of Data | three archives (NASA PDS, NASA Earthdata, USGS Astrogeology) on one comparable scale; per-region Artemis values computed by us |
| Best Mission Concept | mission filters and the headline's test plan: what to test there, in which months, and how it helps the first crewed south-pole landing |

**Project page:**
- Lead with the headline image and the validation chart, then answer the form's questions.
- Paste in three images: the map, the headline scorecard with its "where it breaks" block, and the validation chart.
- The NASA Data field lists each dataset with a link and what we used it for.
- The AI note goes in the site footer, the description and the README.

**Demo (28 seconds):** the product is on screen from the first frame, captions are burned in, and there's no music.

| Time | On screen | Caption |
|---|---|---|
| 0:00 | site loads on the map | team name |
| 0:02 | map | the challenge |
| 0:05 | map | name and tagline |
| 0:10 | pick a target, the map lights up, click the headline, scorecard | how it works, and which NASA data does the work |
| 0:20 | validation chart, then zoom out | what's next: more targets, finer data, field checks |

## 11. Open questions for the team

- [ ] Our Local Event's time zone sets every switch time above. The Challenge Guide comes from Cedar College with Karachi sponsors, so probably Pakistan time (UTC+5): confirm.
- [ ] Do we make the repo public before submission (for GitHub Pages), or use Vercel?
- [ ] Who makes the free NASA Earthdata account, and when?

## Appendix A. Test places

Coordinates are latitude, longitude. A \* marks an estimate still to be checked on a map.

**Moon, polar and highland (overall score):**
- Mistastin crater 55.88, −63.30\*
- Haughton crater, Devon Island 75.38, −89.67
- Lofoten 68.10, 13.30\*

**Moon, basalt and crater (trait checks only):**
- Black Point lava flow 35.70, −111.40\*
- Cinder Lake crater field 35.30, −111.45\*
- Meteor Crater 35.03, −111.02
- Kilbourne Hole 31.97, −106.97\*
- Sedan crater 37.18, −116.05\*
- Sudbury 46.60, −81.18
- Ries crater 48.88, 10.57\*
- Lanzarote 29.16, −13.45\*
- Mauna Kea 19.78, −155.47\*
- Askja 65.05, −16.75\*
- Etna 37.75, 15.00
- Teide 28.26, −16.62

**Mars analogs (23):**
- Yungay, Atacama −24.10, −70.02\*
- McMurdo Dry Valleys −77.47, 162.52
- Haughton crater 75.38, −89.67
- Gypsum Hill, Axel Heiberg 79.40, −90.75
- Bockfjorden, Svalbard 79.43, 13.33\*
- Rio Tinto 37.40, −6.34
- MDRS, Utah 38.41, −110.79
- Qaidam (Dalangtan) 37.27, 94.45
- Tso Kar 33.30, 77.98\*
- Puga Valley 33.22, 78.31\*
- Kangerlussuaq 67.00, −50.70\*
- Makgadikgadi −20.70, 25.90\*
- Pavilion Lake 50.87, −121.74
- Laguna de Tirez 39.54, −3.36
- Spotted Lake 49.08, −119.57
- Salar de Pajonales −25.14, −68.82
- Gros Morne 49.62, −57.75
- Argentine Puna −26, −67\*
- Death Valley 36.50, −117.00\*
- Craters of the Moon 43.42, −113.52\*
- Kīlauea Iki 19.37, −155.22\*
- Bletterbach 46.35, 11.43\*
- CHILL-ICE lava tube 64.79, −20.71

**Ordinary places (12):**
- Iowa corn belt 42.0, −93.5
- Beauce 48.2, 1.7
- Pampas −35.0, −61.0
- central Ukraine 49.5, 32.0
- Amazon near Manaus −3.0, −60.0
- Congo Basin 0.5, 24.0
- central Borneo 1.0, 114.0
- Pantanal −17.5, −57.0
- Flevoland 52.5, 5.5
- Ganges plain near Dhaka 24.0, 90.0
- Waikato −37.8, 175.3
- Kampala 0.3, 32.6

**Plain deserts (6, all estimates to check):**
- Grand Erg Oriental 30.5, 7.5\*
- Thar 27.0, 71.0\*
- Rub' al Khali 20.0, 50.0\*
- Simpson Desert −25.0, 137.0\*
- Great Victoria Desert −29.0, 127.0\*
- Kalahari −23.0, 22.0\*

**Left out:** habitat-only analogs (HI-SEAS, NEEMO, Concordia), because they copy isolation, not ground.

Sources for the known analogs:
- [Terrestrial analogue sites (Wikipedia)](https://en.wikipedia.org/wiki/Terrestrial_analogue_site)
- [ESA PANGAEA](https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/CAVES_and_PANGAEA/What_is_PANGAEA)
- [NASA BASALT](https://www.nasa.gov/missions/analog-field-testing/what-is-basalt/)
- [Europlanet sites](https://www.europlanet.org/?p=8693)
- [NASA, LPSC 2024](https://ntrs.nasa.gov/api/citations/20230018695/downloads/LPSC2024_Evans_draft2.pdf)
- [Mars habitability analogues (Wikipedia)](https://en.wikipedia.org/wiki/Mars_habitability_analogue_environments_on_Earth)
- [Salar de Pajonales](https://www.frontiersin.org/articles/10.3389/fspas.2021.797591/full)

## Sources

Rivals and hosting (opened 13 Nov):
- the [challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/), last edited 13 Nov
- [GitHub plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- Vercel: [Hobby plan](https://vercel.com/docs/plans/hobby), [Git deploys](https://vercel.com/docs/git), [terms](https://vercel.com/legal/terms)
- [MapLibre raster sources](https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterTileSource/)

Earth data:
- the [NASA POWER Zarr bucket](https://nasa-power.s3.amazonaws.com/) and point API
- the [CMR collection search](https://cmr.earthdata.nasa.gov/search/collections.json), used for every short name in section 4
- [Harmony capabilities](https://harmony.earthdata.nasa.gov/capabilities)

Method:
- [Preston & Dartnell 2014](https://ui.adsabs.harvard.edu/abs/2014IJAsB..13...81P)
- [Foucher et al. 2021](https://arpi.unipi.it/retrieve/e0d6c930-149e-fcf8-e053-d805fe0aa794/Foucher_2021.pdf)
- [Earth Similarity Index](https://arxiv.org/pdf/1507.06293)
- [Meng et al. 2024](https://arxiv.org/abs/2501.08584)
- [NASA lighting study for the south pole](https://ntrs.nasa.gov/api/citations/20240011393/downloads/Lighiting%20Study%20IEEE%20Paper%20FINAL-1.pdf)
- [Montana's Moon-like rocks (NASA)](https://science.nasa.gov/earth/earth-observatory/montanas-moon-like-rocks-146650)

Moon and Mars values: linked in sections 3 and 5.

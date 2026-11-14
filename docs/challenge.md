# Earth Analogs for Moon and Mars: the challenge

**Main source:** our local event's [Challenge Guide](challenge-guide.pdf) (Challenge #09, Cedar College). It sets six objectives, each with a target benchmark, and seven questions a solution should answer. The [official challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/) adds NASA's tips and data list. Submission rules are in [guidelines.md](guidelines.md#1-official-rules-we-must-meet).

## The short version

**Search Earth with open data for new places that match a Moon south-pole base or Mars surface operations, rank them, and explain how close each match really is.**

## The problem

Testing hardware on the Moon or Mars is too costly to get wrong, so agencies test first on Earth, in "analogs". A few famous sites get used over and over: Atacama, Hawaii's volcanoes, Haughton Crater, Rio Tinto, Antarctica, Iceland. Thousands of other deserts, volcanic fields, salt flats, frozen basins and caves have never been compared against a standard set of planetary measurements, because Earth and planetary data sit in separate archives.

The guide asks for a **discovery engine**: pick planetary conditions (minerals, thermal inertia, dryness, day-to-night swing, sun angle) and get a ranked map of Earth places that match. The targets are **permanent settlements at the Moon's south pole** (shadowed craters, sunlit rims, ice traps) and **Mars surface operations**.

Without it, gear gets tested where conditions don't match, scouting trips replace prediction, remote sites go unused, and tests cover one stress at a time instead of several together (thin air, strong UV and sharp dust at once).

## The six objectives, and how we meet them

| # | Objective | Benchmark | How we meet it ([team plan](team-plan.md)) |
|---|---|---|---|
| 1 | Cross-domain data | At least 3 distinct open data archives (e.g. NASA PDS, USGS, Landsat/Sentinel) | Five archives in use: NASA PDS Geosciences (Moon and Mars), USGS Astrogeology (Mars caves, feature names), NASA POWER and NASA Earthdata (Earth), Copernicus (Earth terrain) and NASA PGDA (Moon sunlight), named on the site |
| 2 | Geographical scope | Map and index at least 4 terrain types: arid basins, high-altitude volcanic fields, salt flats, caves | Terrain types: those four plus frozen ground, tagged from the data and filterable |
| 3 | Useful output | Web dashboard with similarity rankings, coordinates and data details on the map | Map, ranked list with latitude and longitude, and the source of every value |
| 4 | Multi-variable scoring | Weighting and clustering; thermal inertia, minerals, aridity | Weighted trait scores; clustering for terrain types; thermal inertia, rock and minerals, and dryness as traits |
| 5 | Seasons | Monsoons and freeze–thaw cycles in the matching | Best months, freeze–thaw months and rainy months per site; part-year sites score lower for year-round testing |
| 6 | Mission filters | Filters for rover mobility, life support or habitat-structure testing | Mission filters that reweight the challenges, plus hand-set weights |

## The seven questions, and our answers

These answers go on the site and the project page.

| # | Question, shortened | Our answer |
|---|---|---|
| 1 | How do you handle sun angles and permanent darkness when matching Earth caves or polar canyons? | NASA's lunar maps of time in sunlight and permanent shadow (made from LOLA heights) against Earth sun height worked out from latitude. Earth has no permanent shadow outside caves; that's listed under "where it breaks". |
| 2 | Which spectroscopy and neutron data link Earth's dry or frozen ground to lunar ice traps? | Loaded as data: Mars from Odyssey's gamma-ray and neutron instruments, and Earth minerals from EMIT spectra. Cited as published values, not loaded: Moon LEND (neutrons), Mini-RF (radar) and LCROSS. Earth frozen ground comes from a POWER temperature rule. |
| 3 | How do you compare coarse planetary data with sharp Earth images fairly? | Both sides go onto one 0.5° grid for the global search; terrain is compared at the planet map's own scale. Every value shows its resolution. |
| 4 | Which distance measure or clustering scores the match? | Each trait is ranked by how close a place gets to the target compared with all of Earth's land; the ranks are combined with the mission filter's weights. k-means clustering groups terrain types. |
| 5 | Caves don't show in surface images: which height maps or LiDAR do you use? | None can: no global cave map exists for Earth, the Moon or Mars. We index known caves (USGS Mars cave catalogue, LROC lunar pits, Earth caves from papers) as labels, not scores. |
| 6 | How do weights change for the hardware being tested? | Mission filters and hand-set weights. Dust abrasion stays a label; UV comes from NASA POWER; day-to-night swing is in Heat swing. The guide also names a "weathering index": we don't compute one. Freeze–thaw months and aridity are our stand-ins for weathering. |
| 7 | How do you check the rankings against real field sites? | Known analogs must score high and ordinary places low, shown on the site ([guidelines](guidelines.md#2-doing-the-science-honestly)). |

## What makes a strong entry

From NASA's official page:

- **Go beyond looks.** Use data, not photos alone.
- **No place matches everything.** Being clear about the weak spots counts in your favour.
- **Find somewhere new.** NASA's words: "Surprise us."
- **Zoom in.** One crater, valley or lava tube beats "the Sahara".
- **Think about processes, not only places.** Dust storms, ice movement, erosion and volcanoes can be analogs too.
- **Know Earth's limits.** Earth can't fake low gravity, the Moon's vacuum, Mars's thin air, or space radiation.

## References from the guide

- [NASA Open Data Portal](https://data.nasa.gov) and [NASA Open APIs](https://api.nasa.gov)
- [NASA Planetary Data System](https://pds.nasa.gov)
- [USGS Astrogeology Science Center](https://astrogeology.usgs.gov)
- [NASA Moon Trek](https://trek.nasa.gov/moon) and [Mars Trek](https://trek.nasa.gov/mars)
- [NASA Space Science Data Coordinated Archive](https://nssdc.gsfc.nasa.gov) (the guide's link has a typo, "nssca")
- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons)

NASA's data list is in [guidelines.md](guidelines.md#3-data); the datasets we use are in the [README](../README.md#data).

## Who it's for

Mission planners and hardware engineers choosing where to test rovers, habitats and life support; scientists looking for new field sites; students and the public.

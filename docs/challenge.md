# Earth Analogs for Moon and Mars: the challenge

**Main source:** our local event's [Challenge Guide](challenge-guide.pdf) (Challenge #09, Cedar College). It sets six objectives, each with a target benchmark, and seven questions a solution should answer. The [official challenge page](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/) adds NASA's own tips and data list. The official rules for submitting are in [guidelines.md](guidelines.md#1-official-rules-we-must-meet).

## The short version

**Search Earth with open data for new places that match a Moon south-pole base or Mars surface operations, rank them, and explain how close each match really is.**

## The problem

Testing hardware on the Moon or Mars is too expensive and too unforgiving to get wrong, so agencies test on Earth first, in "analogs": places whose ground, cold, light or air behave a bit like another world's.

A few famous sites get used over and over:

- **Atacama Desert, Chile:** so dry it's like Mars.
- **Mauna Loa and Kīlauea, Hawaii:** volcanic rock.
- **Haughton Crater, Canada, and Rio Tinto, Spain:** mapped by NASA Ames for rover tests and life-detection instruments.
- **Antarctica, Iceland, the Mojave:** cold, volcanic or dry.

The guide says Earth has thousands of under-studied places that could match too: extreme deserts, high-altitude volcanic fields, salt flats, permafrost basins and caves. Nobody has compared them against a standard set of planetary measurements. Earth data and Moon and Mars data sit in separate archives, so researchers cross-reference them by hand. **Agencies lack a discovery engine where you pick planetary conditions (minerals, thermal inertia, dryness, day-to-night temperature swing, sun angle) and get a ranked map of Earth places that match.**

The targets are **permanent settlements at the Moon's south pole** (permanently shadowed craters, sunlit rim peaks, ice traps) and **Mars surface operations** (including old valley networks).

## Why it matters

The guide lists five costs of the gap:

1. **Testing in the wrong place.** Rovers and habitats get tested where the conditions don't match, often in the same old deserts, missing places like frozen ground or high-UV lava tubes.
2. **Searching by hand.** No single tool spans Earth and planetary data.
3. **Cost and delays.** Gear that wasn't matched to its target fails on arrival; teams pay for scouting trips because nothing predicts the match.
4. **Missed places.** Remote lava tubes and salty polar basins go unused.
5. **One stress at a time.** Test sites cover cold or terrain separately, never several stresses together (thin air, strong UV and sharp dust at once).

## The six objectives

Each has a target benchmark. The last two columns are Claude's check of our [team plan](team-plan.md) against it (14 November). The fixes are suggestions; the team decides which to take.

| # | Objective | Benchmark | Team plan today | Suggested fix |
|---|---|---|---|---|
| 1 | Cross-domain data | Combine at least 3 distinct open data archives (e.g. NASA PDS, USGS, Landsat/Sentinel) | Met in outline: Moon and Mars data from PDS, Earth data from NASA Earthdata | Add USGS Astrogeology (Mars cave list, feature names) and name all three on the site |
| 2 | Geographical scope | Map and index at least 4 terrain types: arid basins, high-altitude volcanic fields, salt flats, caves | Missing: the plan is sorted by base challenge, not terrain type; caves are a label only | Tag each Earth match with a terrain type worked out from the data (dryness, height, rock class); filter by type; index caves as a list of known sites |
| 3 | Useful output | A web dashboard with similarity rankings, coordinates and data details on the map | Implied, not written down | A ranked list with latitude and longitude, and the source of every value |
| 4 | Multi-variable scoring | Weighting and clustering; match on thermal inertia, minerals and aridity | Minerals partly (Mars hydrated minerals, Moon oxygen-bearing rock); no aridity, thermal inertia or clustering | Aridity from NASA POWER rain and evaporation. Thermal inertia inside Heat swing: Mars and Moon have maps of it, while Earth's is estimated from MODIS day–night temperature and marked as an estimate. Clustering to group Earth places into terrain types, which also covers objective 2 |
| 5 | Seasons | Include seasonal changes such as monsoons and freeze–thaw cycles in the matching | Heat swing covers seasonal temperature only | Count freeze–thaw cycles and rainy months from NASA POWER, and show the best months to test at each site |
| 6 | Mission filters | Filters for rover mobility, life support or habitat-structure testing | Good fit: our challenges already group this way | Rover mobility = Surface + Dust. Life support = Resources + Heat swing + Polar light and power. Habitat structure = ground strength + Shelter + Heat swing |

## The seven questions

The guide asks solutions to answer these. Each needs a plain answer on the site or the project page.

| # | Question, shortened | Our answer so far |
|---|---|---|
| 1 | How do you handle sun angles and permanent darkness (lunar polar craters) when matching Earth caves or deep polar canyons? | Polar light and power: NASA's lunar maps of time in sunlight and permanent shadow, made from LOLA heights, against Earth sun height worked out from latitude. Earth has no permanent shadow outside caves, which goes in "where it breaks". |
| 2 | Which spectroscopy and neutron-spectrometer data match Earth's dry or frozen ground with lunar ice traps? | Moon: LEND (neutrons), Mini-RF (radar), LCROSS. Mars: Odyssey's gamma-ray and neutron instruments. Earth: permafrost and snow maps; EMIT minerals for Mars matches. |
| 3 | How do you compare coarse planetary data with sharp Earth images fairly? | Not in the team plan yet. [Claude's plan](claudes-plan.md#zoom-stage) brings both sides to the same scale before comparing, and states each value's resolution on screen. |
| 4 | Which distance measure or clustering (Euclidean, cosine, k-means) scores the match? | Not decided. Claude's plan ranks each trait by the share of Earth's land that's further from the target, then combines the traits (section 3 there). k-means could group terrain types (objective 2). |
| 5 | Caves don't show in surface images: which height maps or LiDAR do you use? | Honest answer: no global cave map exists for Earth, the Moon or Mars. We index known caves (USGS Mars cave catalogue, lunar pits seen by LROC, Earth caves from published papers) as labels and say they aren't scored. |
| 6 | How do weights change for the hardware being tested (dust abrasiveness, UV, day–night swing)? | Mission filters (objective 6). UV could be added from NASA POWER's UV index; dust stays a label for the Moon. |
| 7 | How do you check the rankings against real field sites? | Guidelines section 2: known analogs must score high and ordinary places low, shown on the site. Details in [Claude's plan](claudes-plan.md#6-how-we-check-it). |

## What makes a strong entry

From NASA's official page:

- **Go beyond looks.** Two places can look alike but be very different underneath. Use data, not photos alone.
- **No place matches everything.** Being clear about the weak spots counts in your favour.
- **Find somewhere new.** Don't just rediscover Antarctica or Atacama. NASA's words: "Surprise us."
- **Zoom in.** "The Sahara" is too broad. One crater, valley or lava tube is a stronger answer.
- **Think about processes, not only places.** Dust storms, ice movement, erosion and volcanoes can be analogs too.
- **Know Earth's limits.** Earth can't fake low gravity, the Moon's vacuum, Mars's thin air, or space radiation, which Earth's magnetic field and thick air block.

## Key terms

From the guide's glossary:

- **Terrestrial analog:** a place on Earth that shares geology, physics or environment with the Moon or Mars, used to test equipment and methods before flight.
- **Multi-dataset correlation:** combining terrain, temperature, geology, vegetation, water, ice or dust data from several agencies.
- **Similarity metrics:** the maths that scores how closely an Earth place matches a planetary target.
- **Analog fidelity and limitations:** how well a place matches and where it doesn't, including Earth's stronger gravity, thick air and magnetic shield.
- **Planetary processes:** Earth processes (sediment, dust storms, volcanoes, erosion, ice) that help explain the Moon or Mars.

## A simple way to picture it

A **dating app for planets**. Give it a Moon or Mars location and it shows Earth places, each with a match score and a short explanation: "you both love cold and darkness, but you have air and it doesn't."

## Data and references

The guide's reference list:

- [NASA Open Data Portal](https://data.nasa.gov) and [NASA Open APIs](https://api.nasa.gov)
- [NASA Planetary Data System](https://pds.nasa.gov)
- [USGS Astrogeology Science Center](https://astrogeology.usgs.gov)
- [NASA Moon Trek](https://trek.nasa.gov/moon) and [Mars Trek](https://trek.nasa.gov/mars)
- [NASA Space Science Data Coordinated Archive](https://nssdc.gsfc.nasa.gov) (the guide's link has a typo, "nssca")
- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons)
- [NASA Ames Research Center](https://www.nasa.gov/ames), [NASA Earth Science](https://science.nasa.gov/earth-science), [NASA STEM resources](https://www.nasa.gov/learning-resources)

The data list from NASA's official page is in [guidelines.md](guidelines.md#3-data).

## Who it's for

Mission planners and hardware engineers choosing where to test rovers, habitats and life support; scientists looking for new field sites; students and the public curious about why some corners of Earth feel like another planet.

## Competition

The challenge looks popular. A quick search on 2026-11-13 found at least eight public team repos for it, and most build the same thing: a web app that ranks Earth sites by similarity. Examples: [EarthTwin](https://github.com/es-ratt/earthtwin), [TwinWorlds](https://github.com/JimmyGuajan/twinworlds), [terrestrial-analog-finder](https://github.com/shishir-kuet/terrestrial-analog-finder). Standing out probably means a surprising location or a sharper, more honest way of explaining each match.

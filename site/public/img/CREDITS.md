# Globe images

Real images, not AI-made. `site/scripts/fetch-textures.mjs` builds every file in this folder from the sources below. No NASA logo or insignia is used.

| Files | Source | Agency | Licence |
|---|---|---|---|
| `earth-*.jpg` | Blue Marble Next Generation, August 2004, layer `BlueMarble_NextGeneration` on [NASA GIBS](https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities) | NASA | NASA open data, no restrictions |
| `moon-*.jpg` | LROC colour map `lroc_color_poles_4k.tif` from the [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | NASA | Public NASA data |
| `mars-*.jpg` | Viking MDIM 2.1 colour mosaic, layer `Mars_Viking_MDIM21_ClrMosaic_global_232m` on [NASA Mars Trek](https://trek.nasa.gov/mars) | NASA / USGS | Public NASA and USGS data |

The site changes these images only in size, and in the browser it adds lighting and the lit match layer on top.

# Learn page photos

Real photos, not AI-made and not artist's concepts. `site/scripts/fetch-photos.mjs` downloads them from the [NASA Image and Video Library](https://images.nasa.gov) by NASA id, checks each record's credit, and resizes them; it changes nothing else. No NASA logo, flag or insignia is in frame, and no people.

| File | Title | NASA id | Link | Credit | Licence |
|---|---|---|---|---|---|
| `learn/dust-earth.jpg` | Earth: Dust Storm, Sahara Desert, Algeria/Niger Border, Africa | `s49-92-071` | [record](https://images.nasa.gov/details/s49-92-071) | NASA (STS-49 crew) | NASA media are generally not copyrighted. The record states no copyright. |
| `learn/dust-mars.jpg` | Mars: The Devil is in the Details | `PIA23736` | [record](https://images.nasa.gov/details/PIA23736) | NASA/JPL-Caltech/University of Arizona | NASA media are generally not copyrighted. The record states no copyright. |
| `learn/ice-earth.jpg` | Earth: Jakobshavn Calving Front | `GSFC_20171208_Archive_e001754` | [record](https://images.nasa.gov/details/GSFC_20171208_Archive_e001754) | NASA/GSFC/Jefferson Beck | NASA media are generally not copyrighted. The record links NASA's image use policy. |
| `learn/ice-mars.jpg` | Mars: Underground Martian Ice Deposit Exposed at Scarp | `PIA22077` | [record](https://images.nasa.gov/details/PIA22077) | NASA/JPL-Caltech/UA/USGS | NASA media are generally not copyrighted. The record states no copyright. |
| `learn/volcano-earth.jpg` | Earth: iss068e068973 | `iss068e068973` | [record](https://images.nasa.gov/details/iss068e068973) | NASA (Expedition 68 crew) | NASA media are generally not copyrighted. The record states no copyright. |
| `learn/volcano-mars.jpg` | Mars: Olympus Mons | `PIA00300` | [record](https://images.nasa.gov/details/PIA00300) | NASA/JPL/USGS | NASA media are generally not copyrighted. The record states no copyright. |
| `learn/tube-earth.jpg` | Earth: Earth Observation | `iss045e112699` | [record](https://images.nasa.gov/details/iss045e112699) | NASA (Kjell Lindgren, Expedition 45) | NASA media are generally not copyrighted. The record states no copyright. |
| `learn/tube-moon.jpg` | Moon: Marius Hills Pit -- Lava Tube Skylight? | `PIA12954` | [record](https://images.nasa.gov/details/PIA12954) | NASA/GSFC/Arizona State University | NASA media are generally not copyrighted. The record states no copyright. |

# 3D terrain close-up

Loaded live from open map tiles when a visitor opens the close-up; nothing here is bundled, and the rest of the site works without it. No key is needed.

| Used for | Source | Agency | Licence |
|---|---|---|---|
| Heights | Terrain Tiles (Terrarium format) on [AWS Open Data](https://registry.opendata.aws/terrain-tiles/), built from NASA SRTM, USGS GMTED2010 and 3DEP, NOAA ETOPO1 and others ([full list](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)) | NASA / USGS / NOAA and others | Open data, attribution per source |
| Image | Landsat WELD true colour, 2000, layer `Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual` on [NASA GIBS](https://gibs.earthdata.nasa.gov) | NASA / USGS | NASA open data, no restrictions |
| Image, when the first is missing | Sentinel-2 cloudless 2016 by [EOX IT Services GmbH](https://s2maps.eu) (contains modified Copernicus Sentinel data 2016) | EOX / ESA Copernicus | CC BY 4.0 |

We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).

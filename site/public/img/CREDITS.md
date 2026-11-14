# Globe images

Real images, not AI-made. `site/scripts/fetch-textures.mjs` builds every file in this folder from the sources below. No NASA logo or insignia is used.

| Files | Source | Agency | Licence |
|---|---|---|---|
| `earth-*.jpg` | Blue Marble Next Generation, August 2004, layer `BlueMarble_NextGeneration` on [NASA GIBS](https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities) | NASA | NASA open data, no restrictions |
| `moon-*.jpg` | LROC colour map `lroc_color_poles_4k.tif` from the [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) | NASA | Public NASA data |
| `mars-*.jpg` | Viking MDIM 2.1 colour mosaic, layer `Mars_Viking_MDIM21_ClrMosaic_global_232m` on [NASA Mars Trek](https://trek.nasa.gov/mars) | NASA / USGS | Public NASA and USGS data |

The site changes these images only in size, and in the browser it adds lighting and the lit match layer on top.

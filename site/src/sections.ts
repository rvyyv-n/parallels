import "./sections.css";

export const IMAGERY = [
  {
    name: "Blue Marble: Shaded Relief and Bathymetry (map background, live tiles)",
    by: "NASA Earth Observatory via NASA GIBS",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    licence: "NASA open data, no restrictions",
    use: "The background of the Earth map, the 3D Earth on Home and the bottom layer of the Earth close-up. If the tile service is down, the site uses its own copy of the same images.",
  },
  {
    name: "Landsat WELD true colour, global annual mosaic (Earth close-up, live tiles)",
    by: "NASA / USGS Landsat, via NASA GIBS",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    licence: "NASA open data, no restrictions",
    use: "The Earth side of the close-up in each match. We show it but do not score it. Where it has no data, Blue Marble shows.",
  },
  {
    name: "LOLA south-pole shaded relief, 87.5° S to the pole (Moon close-up, live tiles)",
    by: "NASA LRO LOLA, via NASA Moon Trek tiles",
    url: "https://trek.nasa.gov/moon/",
    licence: "Public domain (NASA)",
    use: "The Moon side of the close-up. This is shaded relief from laser altimetry, not a photo. We show it but do not score it.",
  },
  {
    name: "CGI Moon Kit: LROC colour map with filled poles",
    by: "NASA Scientific Visualization Studio (LRO data)",
    url: "https://svs.gsfc.nasa.gov/4720",
    licence: "Public domain (NASA)",
    use: "The surface of the 3D Moon in the Moon part of Home, and the site pictures in its list. We draw the site pictures as a view from above the pole with more contrast, because the map is very flat near the pole. The site also uses its own copy as the fallback for the Moon close-up. We show it but do not score it.",
  },
  {
    name: "Viking MDIM 2.1 global colour mosaic",
    by: "NASA / USGS Astrogeology, via NASA Mars Trek tiles",
    url: "https://trek.nasa.gov/mars/",
    licence: "Public domain (NASA / USGS)",
    use: "The surface of the 3D Mars in the Mars part of Home, the site pictures in its list, and the Mars side of the close-up. The close-up uses live tiles, with a copy on the site as the fallback. We show it but do not score it.",
  },
];

export const CODE = [
  { name: "MapLibre GL JS", url: "https://maplibre.org/", licence: "BSD-3-Clause", use: "Earth globe and map" },
  { name: "three.js", url: "https://threejs.org/", licence: "MIT", use: "3D Earth, Moon and Mars in the intro" },
  { name: "Lucide icons 1.73.0", url: "https://lucide.dev/", licence: "ISC", use: "Icons on the match page" },
  { name: "Archivo (variable font, by Omnibus-Type)", url: "https://fontsource.org/fonts/archivo", licence: "SIL Open Font Licence 1.1", use: "Headings, labels and numbers" },
  { name: "Vite and TypeScript", url: "https://vite.dev/", licence: "MIT / Apache-2.0", use: "Tools that build the site" },
];

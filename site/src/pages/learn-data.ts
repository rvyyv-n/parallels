export interface Load {
  id: string;
  name: string;
  short: string;
  kg: number;
  source: string;
  url: string;
}

export const LOADS: Load[] = [
  {
    id: "suit",
    name: "ISS spacesuit with its life-support backpack, with no astronaut in it",
    short: "Spacesuit",
    kg: 145,
    source: "NASA EMU fact sheet",
    url: "https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf",
  },
  {
    id: "rover",
    name: "Perseverance rover",
    short: "Rover",
    kg: 1025,
    source: "NASA Perseverance rover components",
    url: "https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/",
  },
  {
    id: "module",
    name: "BEAM, a habitat module tested on the space station",
    short: "Habitat module",
    kg: 1413,
    source: "NASA SpaceX CRS-8 mission overview",
    url: "https://www.nasa.gov/wp-content/uploads/2018/07/spacex_crs-8_mission_overview.pdf",
  },
];

export interface Photo {
  file: string;
  id: string;
  title: string;
  world: string;
  alt: string;
  credit: string;
}

export interface PhotoPair {
  pair: string;
  line: string;
  photos: [Photo, Photo];
}

export const PHOTOS: PhotoPair[] = [
  {
    pair: "dust",
    line: "Wind moves dust: a dust storm in the Sahara, and a dust devil on Mars.",
    photos: [
      {
        file: "dust-earth.jpg",
        id: "s49-92-071",
        title: "Dust Storm, Sahara Desert, Algeria/Niger Border, Africa",
        world: "Earth",
        alt: "A wall of brown dust moves across the Sahara. Small clouds are above its front. The view is from orbit.",
        credit: "NASA (STS-49 crew)",
      },
      {
        file: "dust-mars.jpg",
        id: "PIA23736",
        title: "The Devil is in the Details",
        world: "Mars",
        alt: "A pale dust devil and its long dark shadow on orange plains on Mars. The view is from above.",
        credit: "NASA/JPL-Caltech/University of Arizona",
      },
    ],
  },
  {
    pair: "ice",
    line: "Thick layers of ice: a glacier in Greenland, and buried ice in a cliff on Mars (with stronger colours).",
    photos: [
      {
        file: "ice-earth.jpg",
        id: "GSFC_20171208_Archive_e001754",
        title: "Jakobshavn Calving Front",
        world: "Earth",
        alt: "The broken white edge of Jakobshavn Glacier in Greenland. The view is from a NASA aircraft.",
        credit: "NASA/GSFC/Jefferson Beck",
      },
      {
        file: "ice-mars.jpg",
        id: "PIA22077",
        title: "Underground Martian Ice Deposit Exposed at Scarp",
        world: "Mars",
        alt: "A steep slope on Mars. A thick band of buried ice shows as bright blue. The view is from above.",
        credit: "NASA/JPL-Caltech/UA/USGS",
      },
    ],
  },
  {
    pair: "volcanoes",
    line: "Thin lava makes wide volcanoes with low slopes: Hawaii, and Olympus Mons on Mars.",
    photos: [
      {
        file: "volcano-earth.jpg",
        id: "iss068e068973",
        title: "iss068e068973",
        world: "Earth",
        alt: "The island of Hawaii in a blue ocean, with snow on its two large volcanoes. The view is from the space station.",
        credit: "NASA (Expedition 68 crew)",
      },
      {
        file: "volcano-mars.jpg",
        id: "PIA00300",
        title: "Olympus Mons",
        world: "Mars",
        alt: "Olympus Mons on Mars: a very large round volcano with a crater at its top and a cliff around its bottom. The view is from above.",
        credit: "NASA/JPL/USGS",
      },
    ],
  },
  {
    pair: "lava tubes",
    line: "Lava flows on Mauna Loa in Hawaii, and a pit on the Moon. The pit possibly opens into a lava tube.",
    photos: [
      {
        file: "tube-earth.jpg",
        id: "iss045e112699",
        title: "Earth Observation",
        world: "Earth",
        alt: "Dark lava flows go down the slopes of Mauna Loa from its top crater. The view is from the space station.",
        credit: "NASA (Kjell Lindgren, Expedition 45)",
      },
      {
        file: "tube-moon.jpg",
        id: "PIA12954",
        title: "Marius Hills Pit -- Lava Tube Skylight?",
        world: "Moon",
        alt: "A small, dark, round hole in the grey ground of the Marius Hills on the Moon. The view is from above.",
        credit: "NASA/GSFC/Arizona State University",
      },
    ],
  },
];

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
    name: "ISS spacesuit with its life-support backpack, without the astronaut",
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
    line: "Wind lifts dust: a dust storm in the Sahara, and a dust devil on Mars.",
    photos: [
      {
        file: "dust-earth.jpg",
        id: "s49-92-071",
        title: "Dust Storm, Sahara Desert, Algeria/Niger Border, Africa",
        world: "Earth",
        alt: "A wall of brown dust rolling across the Sahara, seen from orbit, with small clouds above its front.",
        credit: "NASA (STS-49 crew)",
      },
      {
        file: "dust-mars.jpg",
        id: "PIA23736",
        title: "The Devil is in the Details",
        world: "Mars",
        alt: "A pale dust devil on orange Martian plains, seen from above, with its long dark shadow.",
        credit: "NASA/JPL-Caltech/University of Arizona",
      },
    ],
  },
  {
    pair: "ice",
    line: "Thick ice in layers: a Greenland glacier, and buried ice in a cliff on Mars (colours enhanced).",
    photos: [
      {
        file: "ice-earth.jpg",
        id: "GSFC_20171208_Archive_e001754",
        title: "Jakobshavn Calving Front",
        world: "Earth",
        alt: "The broken white edge of Jakobshavn Glacier in Greenland, seen from a NASA aircraft.",
        credit: "NASA/GSFC/Jefferson Beck",
      },
      {
        file: "ice-mars.jpg",
        id: "PIA22077",
        title: "Underground Martian Ice Deposit Exposed at Scarp",
        world: "Mars",
        alt: "A steep Martian slope seen from above, where a thick band of buried ice shows as bright blue.",
        credit: "NASA/JPL-Caltech/UA/USGS",
      },
    ],
  },
  {
    pair: "volcanoes",
    line: "Runny lava builds wide, gentle volcanoes: Hawaii, and Olympus Mons on Mars.",
    photos: [
      {
        file: "volcano-earth.jpg",
        id: "iss068e068973",
        title: "iss068e068973",
        world: "Earth",
        alt: "The island of Hawaii in a blue ocean, seen from the space station, with snow on its two big volcanoes.",
        credit: "NASA (Expedition 68 crew)",
      },
      {
        file: "volcano-mars.jpg",
        id: "PIA00300",
        title: "Olympus Mons",
        world: "Mars",
        alt: "Olympus Mons on Mars seen from above: a huge round volcano with a crater at its top and a cliff around its base.",
        credit: "NASA/JPL/USGS",
      },
    ],
  },
  {
    pair: "lava tubes",
    line: "Lava flows on Mauna Loa in Hawaii, and a pit on the Moon that may open into a lava tube.",
    photos: [
      {
        file: "tube-earth.jpg",
        id: "iss045e112699",
        title: "Earth Observation",
        world: "Earth",
        alt: "Dark lava flows spreading down the slopes of Mauna Loa from its summit crater, seen from the space station.",
        credit: "NASA (Kjell Lindgren, Expedition 45)",
      },
      {
        file: "tube-moon.jpg",
        id: "PIA12954",
        title: "Marius Hills Pit -- Lava Tube Skylight?",
        world: "Moon",
        alt: "A small, dark, round hole in the grey cratered ground of the Moon's Marius Hills, seen from above.",
        credit: "NASA/GSFC/Arizona State University",
      },
    ],
  },
];

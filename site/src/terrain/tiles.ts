export const TILE = 256;
export const WIDTH_M = 50_000;
export const MAX_LAT = 85.0511;
export const MIN_SAMPLES = 200;
export const IMAGE_ZOOM = 12;

const CIRCUMFERENCE = 40_075_016.686;
const DEG = Math.PI / 180;

export interface Box {
  z: number;
  x0: number;
  y0: number;
  n: number;
  metres: number;
}

export interface TileRef {
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
}

export interface Heights {
  n: number;
  metres: number;
  data: Float32Array;
  min: number;
  max: number;
}

export interface Imagery {
  id: "gibs" | "eox";
  credit: string;
  url: (t: TileRef) => string;
}

export const ELEVATION = {
  credit: "Heights: Terrain Tiles on AWS Open Data (NASA SRTM and other sources)",
  url: (t: TileRef) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${t.z}/${t.x}/${t.y}.png`,
};

export const IMAGERY: Imagery[] = [
  {
    id: "gibs",
    credit: "Image: NASA GIBS, Landsat WELD true colour, 2000",
    url: (t) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-12-01/GoogleMapsCompatible_Level12/${t.z}/${t.y}/${t.x}.jpg`,
  },
  {
    id: "eox",
    credit: "Image: Sentinel-2 cloudless 2016 by EOX, contains modified Copernicus Sentinel data 2016, CC BY 4.0",
    url: (t) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${t.z}/${t.y}/${t.x}.jpg`,
  },
];

export const metresPerPixel = (lat: number, z: number) => (CIRCUMFERENCE * Math.cos(lat * DEG)) / (TILE * 2 ** z);

const mercatorY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)) / Math.PI) / 2;

export function box(lat: number, lon: number): Box | undefined {
  if (Math.abs(lat) > MAX_LAT) return undefined;
  let z = 0;
  while (WIDTH_M / metresPerPixel(lat, z) < MIN_SAMPLES) z++;
  const size = TILE * 2 ** z;
  const n = Math.round(WIDTH_M / metresPerPixel(lat, z));
  const x0 = Math.round(((lon + 180) / 360) * size - n / 2);
  const y0 = Math.round(mercatorY(lat) * size - n / 2);
  if (y0 < 0 || y0 + n > size) return undefined;
  return { z, x0, y0, n, metres: metresPerPixel(lat, z) };
}

export function tilesFor(b: Box, z = b.z): TileRef[] {
  const k = 2 ** (z - b.z);
  const left = b.x0 * k;
  const top = b.y0 * k;
  const last = b.n * k - 1;
  const count = 2 ** z;
  const tiles: TileRef[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + last) / TILE); ty++)
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + last) / TILE); tx++)
      tiles.push({ z, x: ((tx % count) + count) % count, y: ty, left: tx * TILE - left, top: ty * TILE - top });
  return tiles;
}

export const terrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;

export function decode(rgba: ArrayLike<number>, n: number, metres: number): Heights {
  const data = new Float32Array(n * n);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const h = terrarium(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    data[i] = h;
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  return { n, metres, data, min, max };
}

export function blankShare(rgba: ArrayLike<number>) {
  let blank = 0;
  let seen = 0;
  for (let i = 0; i < rgba.length; i += 4 * 7) {
    seen++;
    if (rgba[i + 3] < 16 || Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) < 8) blank++;
  }
  return blank / seen;
}

async function bitmap(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return createImageBitmap(await res.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
}

async function stitch(b: Box, z: number, url: (t: TileRef) => string, signal: AbortSignal) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = b.n * 2 ** (z - b.z);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  await Promise.all(
    tilesFor(b, z).map(async (t) => {
      const image = await bitmap(url(t), signal);
      ctx.drawImage(image, t.left, t.top);
      image.close();
    }),
  );
  return { canvas, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
}

export async function loadHeights(b: Box, signal: AbortSignal) {
  const { pixels } = await stitch(b, b.z, ELEVATION.url, signal);
  return decode(pixels, b.n, b.metres);
}

export async function loadImagery(b: Box, signal: AbortSignal) {
  const z = Math.max(b.z, Math.min(IMAGE_ZOOM, b.z + 2));
  for (const source of IMAGERY) {
    try {
      const { canvas, pixels } = await stitch(b, z, source.url, signal);
      if (blankShare(pixels) < 0.2) return { canvas, source };
    } catch (e) {
      if (signal.aborted) throw e;
    }
  }
  return undefined;
}

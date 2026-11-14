// Usage: node scripts/fetch-textures.mjs
// Downloads real NASA imagery once and writes the globe textures in public/img/.
// Tiles are cached in ../data/textures-src/ (not in git). Sources are listed in public/img/CREDITS.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, "..", "..", "data", "textures-src");
const out = join(here, "..", "public", "img");
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

async function get(url, name) {
  const file = join(cache, name);
  if (existsSync(file)) return readFileSync(file);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "globe-texture-fetch" } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
      return buf;
    }
    if (attempt === 3) throw new Error(`${url}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function mosaic({ name, cols, rows, tile, url, width, height }) {
  const jobs = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) jobs.push({ x, y });
  const tiles = [];
  for (let i = 0; i < jobs.length; i += 4) {
    const batch = jobs.slice(i, i + 4);
    const bufs = await Promise.all(batch.map(({ x, y }) => get(url(x, y), `${name}_${y}_${x}.jpg`)));
    batch.forEach(({ x, y }, k) => tiles.push({ input: bufs[k], left: x * tile, top: y * tile }));
  }
  return sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: "#000" } })
    .composite(tiles)
    .png()
    .toBuffer()
    .then((b) => sharp(b).extract({ left: 0, top: 0, width, height }).png().toBuffer());
}

async function write(buffer, name, sizes, quality = 82) {
  for (const w of sizes) {
    const file = join(out, `${name}-${w}.jpg`);
    await sharp(buffer).resize(w, w / 2, { kernel: "lanczos3" }).jpeg({ quality, mozjpeg: true }).toFile(file);
    console.log(file);
  }
}

const earth = await mosaic({
  name: "gibs_bmng_z3",
  cols: 10,
  rows: 5,
  tile: 512,
  width: 5120,
  height: 2560,
  url: (x, y) =>
    `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/2004-08-01/500m/3/${y}/${x}.jpeg`,
});
await write(earth, "earth", [1024, 2048, 4096]);

const mars = await mosaic({
  name: "trek_mars_viking_z3",
  cols: 16,
  rows: 8,
  tile: 256,
  width: 4096,
  height: 2048,
  url: (x, y) =>
    `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/3/${y}/${x}.jpg`,
});
await write(mars, "mars", [1024, 2048, 4096]);

const moon = await get("https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif", "lroc_color_poles_4k.tif");
await write(moon, "moon", [1024, 2048, 4096]);

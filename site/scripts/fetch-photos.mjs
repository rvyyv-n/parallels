// Usage: node scripts/fetch-photos.mjs
// Downloads the Learn page's eight photos from the NASA Image and Video Library by their NASA id,
// checks each record's credit, and writes public/img/learn/*.jpg and the Learn section of public/img/CREDITS.md.
// Originals are cached in ../data/photos-src/ (not in git). The list of photos is src/learn/photos.json.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const cache = join(here, "..", "..", "data", "photos-src");
const out = join(here, "..", "public", "img", "learn");
const credits = join(here, "..", "public", "img", "CREDITS.md");
const pairs = JSON.parse(readFileSync(join(here, "..", "src", "learn", "photos.json"), "utf8"));
const MAX_WIDTH = 1200;
const MAX_BYTES = 200_000;
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

async function get(url, type) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "learn-photo-fetch" } });
    if (res.ok) return type === "json" ? res.json() : Buffer.from(await res.arrayBuffer());
    if (attempt === 3) throw new Error(`${url}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function record(id) {
  const json = await get(`https://images-api.nasa.gov/search?nasa_id=${encodeURIComponent(id)}`, "json");
  const item = json.collection.items.find((i) => i.data[0].nasa_id === id);
  if (!item) throw new Error(`${id}: no record`);
  return item.data[0];
}

async function original(id) {
  const name = join(cache, id);
  if (existsSync(name)) return readFileSync(name);
  const json = await get(`https://images-api.nasa.gov/asset/${encodeURIComponent(id)}`, "json");
  const hrefs = json.collection.items.map((i) => i.href.replace(/^http:/, "https:"));
  const href = hrefs.find((h) => /~orig\.(jpe?g|tif|png)$/i.test(h)) ?? hrefs.find((h) => /~large\.jpe?g$/i.test(h));
  if (!href) throw new Error(`${id}: no original`);
  const buf = await get(href);
  writeFileSync(name, buf);
  return buf;
}

async function shrink(buf, file) {
  for (let quality = 82; quality >= 50; quality -= 6) {
    const jpg = await sharp(buf)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (jpg.length <= MAX_BYTES) {
      writeFileSync(file, jpg);
      return;
    }
  }
  throw new Error(`${file}: still over ${MAX_BYTES} bytes`);
}

const rows = [];
for (const pair of pairs) {
  for (const photo of pair.photos) {
    const r = await record(photo.nasa_id);
    const text = [r.secondary_creator, r.photographer, r.description].filter(Boolean).join(" ");
    if (!text.includes(photo.record_credit)) throw new Error(`${photo.nasa_id}: credit "${photo.record_credit}" not in the record`);
    if (/copyright|©/i.test(text)) throw new Error(`${photo.nasa_id}: the record mentions copyright`);
    const file = join(out, photo.file);
    await shrink(await original(photo.nasa_id), file);
    const meta = await sharp(file).metadata();
    console.log(`${file} ${meta.width}x${meta.height} ${statSync(file).size} B`);
    const policy = /image use policy/i.test(r.description) ? "The record links NASA's image use policy." : "The record states no copyright.";
    rows.push(
      `| \`learn/${photo.file}\` | ${photo.world}: ${r.title} | \`${photo.nasa_id}\` | [record](https://images.nasa.gov/details/${encodeURIComponent(photo.nasa_id)}) | ${photo.credit} | NASA media are generally not copyrighted. ${policy} |`,
    );
  }
}

const section = `# Learn page photos

Real photos, not AI-made and not artist's concepts. \`site/scripts/fetch-photos.mjs\` downloads them from the [NASA Image and Video Library](https://images.nasa.gov) by NASA id, checks each record's credit, and resizes them; it changes nothing else. No NASA logo, flag or insignia is in frame, and no people.

| File | Title | NASA id | Link | Credit | Licence |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
const old = readFileSync(credits, "utf8");
const cut = old.indexOf("\n# Learn page photos");
writeFileSync(credits, (cut < 0 ? old.trimEnd() + "\n" : old.slice(0, cut + 1)) + "\n" + section);
console.log(credits);

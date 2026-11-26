import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type Page } from "@playwright/test";
import type { Manifest } from "../src/contract";
import { decode, type Cols } from "../src/data";

const dir = path.join(import.meta.dirname, "..", "public", "data");

let cachedManifest: Manifest | null = null;
let cachedCells: Cols | null = null;
const cachedTargets = new Map<string, Cols>();

export const manifest = (): Manifest => (cachedManifest ??= JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")));

const buf = (f: string) => {
  const b = fs.readFileSync(path.join(dir, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

export function cols(m: Manifest, target: string) {
  const t = m.targets.find((x) => x.id === target)!;
  const cells = (cachedCells ??= decode(buf(m.grid.file), m.grid));
  let td = cachedTargets.get(target);
  if (!td) {
    td = decode(buf(t.bin.file), t.bin, true);
    cachedTargets.set(target, td);
  }
  return { cells, t: td, target: t };
}

// Block live remote map tile fetches during local tests so SwiftShader doesn't decode hundreds of remote JPEGs.
// Set LIVE_TILES=1 to exercise live GIBS, EOX Sentinel-2, and Trek tiles.
export const test = base.extend({
  page: async ({ page }, use) => {
    if (!process.env.LIVE_TILES) {
      await page.route("**://gibs.earthdata.nasa.gov/**", (r) => r.abort());
      await page.route("**://tiles.maps.eox.at/**", (r) => r.abort());
      await page.route("**://trek.nasa.gov/**", (r) => r.abort());
    }
    await use(page);
  },
});

export { expect, type Page };

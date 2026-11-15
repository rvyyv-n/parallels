import { expect as base, type Page } from "@playwright/test";
import { buildMatch, formatCoords, formatValue, gridColumns, targetColumns } from "../src/data/match";
import { distinctPlaces } from "../src/data/places";
import { Store } from "../src/data/store";
import type { Validation } from "../../dataset/contract";
import { nodeSource, readJson, readManifest } from "../tests/node-source";

export const expect = base.configure({ timeout: 20_000 });

export const manifest = await readManifest();
export const validation = await readJson<Validation>("validation.json");
const store = new Store(nodeSource);

export const CHAPTERS = ["intro", "find", "match", "breaks", "test"];

export const shortName = (name: string) => name.split(" (")[0];

export const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

export async function loaded(page: Page, hash = "") {
  await page.goto("/" + hash);
  await page.locator('[data-testid="feature"] table.pairs').waitFor({ state: "attached" });
  await page.locator('.pairs-box[aria-busy="false"]').waitFor({ state: "attached" });
}

export async function ready(page: Page, hash = "") {
  await loaded(page, hash);
  await page.locator('[data-chapter="find"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="feature"] table.pairs').waitFor({ state: "visible" });
}

export async function expectedView(targetId: string, filterId: string) {
  const target = manifest.targets.find((t) => t.id === targetId)!;
  const filter = manifest.filters.find((f) => f.id === filterId)!;
  const [score, lat, lon, region] = await Promise.all([
    store.column(target.bin, `score:${filter.id}`),
    store.column(manifest.grid, "lat"),
    store.column(manifest.grid, "lon"),
    store.column(manifest.grid, "region"),
  ]);
  const places = distinctPlaces({ score, lat, lon, region, regions: manifest.regions });
  const best = places[0];
  const [grid, ranks] = await Promise.all([
    store.cell(manifest.grid, gridColumns(manifest, target), best.cell),
    store.cell(target.bin, targetColumns(manifest, target, filter), best.cell),
  ]);
  const match = buildMatch(manifest, target, filter, best.cell, grid, ranks);
  const rows = [match.bestMatch, match.worstBreak].filter((r) => !!r);
  return {
    regions: places.map((p) => p.region),
    region: best.region,
    coords: formatCoords(best.lat, best.lon),
    pairs: rows.map((r) => [formatValue(r.earth, r.trait), formatValue(r.target.value, r.trait)]),
  };
}

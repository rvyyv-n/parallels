import { describe, expect, it } from "vitest";
import { buildMatch, fixed, gridColumns, targetColumns } from "../src/data/match";
import { distinctPlaces } from "../src/data/places";
import { sheet, sheetName, sheetRows, toCsv, trekUrl, worldviewUrl } from "../src/data/sheet";
import { Store } from "../src/data/store";
import { nodeSource, readManifest } from "./node-source";

const manifest = await readManifest();
const store = new Store(nodeSource);
const rover = manifest.filters.find((f) => f.id === "rover")!;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[i++];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  return rows;
}

async function bestPlace(targetId: string) {
  const target = manifest.targets.find((t) => t.id === targetId)!;
  const [score, lat, lon, region] = await Promise.all([
    store.column(target.bin, `score:${rover.id}`),
    store.column(manifest.grid, "lat"),
    store.column(manifest.grid, "lon"),
    store.column(manifest.grid, "region"),
  ]);
  const place = distinctPlaces({ score, lat, lon, region, regions: manifest.regions })[0];
  const [grid, ranks] = await Promise.all([
    store.cell(manifest.grid, gridColumns(manifest, target), place.cell),
    store.cell(target.bin, targetColumns(manifest, target, rover), place.cell),
  ]);
  const match = buildMatch(manifest, target, rover, place.cell, grid, ranks);
  const info = { ...place, terrain: manifest.terrain_types[0], nearestAnalogKm: match.nearestAnalogKm };
  return { target, place: info, match };
}

describe("check it yourself", () => {
  for (const id of ["moon-south-pole", "mars-jezero"]) {
    it(`${id}: one row per trait, the match's values at the trait's digits`, async () => {
      const { target, place, match } = await bestPlace(id);
      const csv = sheet(manifest, target, rover, place, match, "https://example.org/#p=1");
      expect(csv.startsWith("﻿")).toBe(true);
      const rows = parseCsv(csv.slice(1));
      const start = rows.findIndex((r) => r[0] === "Trait");
      const table = rows.slice(start + 1);
      expect(table).toHaveLength(match.rows.length);
      match.rows.forEach((r, i) => {
        const [label, earth, site, unit] = table[i];
        expect(label).toBe(r.trait.label);
        expect(unit).toBe(r.trait.unit);
        expect(earth).toBe(r.earth === null ? "" : fixed(r.earth, r.trait.digits));
        expect(site).toBe(r.target.value === null ? "" : fixed(r.target.value, r.trait.digits));
        expect(earth).not.toContain("−");
      });
      expect(rows.find((r) => r[0] === "Data built")?.[1]).toBe(manifest.generated);
      expect(rows.find((r) => r[0] === "Method version")?.[1]).toBe(manifest.method_version);
      expect(rows.find((r) => r[0] === "Latitude")?.[1]).toBe(match.lat.toFixed(2));
      const ch = rows.findIndex((r) => r[0] === "Challenge");
      expect(rows.slice(ch + 1, ch + 1 + match.challenges.length).map((r) => r[0])).toEqual(match.challenges.map((c) => c.challenge.name));
      expect(sheetName(target, rover, match)).toBe(`parallels-${id}-rover-${match.cell}.csv`);
    });
  }

  it("leaves missing values empty, never 0", async () => {
    const jezero = manifest.targets.find((t) => t.id === "mars-jezero")!;
    const [grid, ranks] = await Promise.all([
      store.cell(manifest.grid, gridColumns(manifest, jezero), jezero.headline!.cell),
      store.cell(jezero.bin, targetColumns(manifest, jezero, rover), jezero.headline!.cell),
    ]);
    const match = buildMatch(manifest, jezero, rover, jezero.headline!.cell, grid, ranks);
    const minerals = sheetRows(match).find((r) => r.trait === match.rows.find((m) => m.trait.id === "minerals")!.trait.label)!;
    expect(minerals.earth).toBe("");
    expect(minerals.closerThan).toBe("");
  });

  it("quotes commas, quotes and line breaks so they round-trip", () => {
    const rows = [
      ["Gale, Mars", 'a "quoted" word', "two\nlines", "plain"],
      ["", "-3", "°C", "x,y"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("frames the place in Worldview and the base site in the right Trek", async () => {
    const { place } = await bestPlace("moon-south-pole");
    const v = new URL(worldviewUrl(place.lat, place.lon, manifest.generated)).searchParams.get("v")!.split(",").map(Number);
    expect(v[0]).toBeLessThan(place.lon);
    expect(v[2]).toBeGreaterThan(place.lon);
    expect(v[1]).toBeLessThan(place.lat);
    expect(v[3]).toBeGreaterThan(place.lat);
    expect(v[2] - v[0]).toBeGreaterThan(1);

    const moon = manifest.targets.find((t) => t.id === "moon-south-pole")!;
    expect(trekUrl(moon)).toMatch(/^https:\/\/trek\.nasa\.gov\/moon\/#v=0\.1&x=0&y=0&/);
    const jezero = manifest.targets.find((t) => t.id === "mars-jezero")!;
    expect(trekUrl(jezero)).toMatch(/^https:\/\/trek\.nasa\.gov\/mars\/#/);
    expect(trekUrl(jezero)).toContain(`x=${jezero.lon}&y=${jezero.lat}`);
  });
});

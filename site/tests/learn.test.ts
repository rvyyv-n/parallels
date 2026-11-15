import { describe, expect, it } from "vitest";
import type { LabelPoint } from "../../dataset/contract";
import { buildMatch, formatValue, gridColumns, monthsOf, targetColumns } from "../src/data/match";
import { distinctPlaces } from "../src/data/places";
import { Store } from "../src/data/store";
import loads from "../src/learn/loads.json";
import photos from "../src/learn/photos.json";
import {
  analogsOf,
  baseTarget,
  findHref,
  gravity,
  kelvinToC,
  mapPosition,
  MONTH_COLUMNS,
  monthState,
  placeMonths,
  tempPairs,
  tempText,
  testedThere,
  weight,
  worldOf,
  type World,
} from "../src/learn/learn";
import { nodeSource, readJson, readManifest } from "./node-source";

const manifest = await readManifest();
const labels = await readJson<LabelPoint[]>("labels.json");
const store = new Store(nodeSource);
const rover = manifest.filters[0];

async function bestMatch(world: World) {
  const target = baseTarget(manifest, world);
  const [score, lat, lon, region] = await Promise.all([
    store.column(target.bin, `score:${rover.id}`),
    store.column(manifest.grid, "lat"),
    store.column(manifest.grid, "lon"),
    store.column(manifest.grid, "region"),
  ]);
  const places = distinctPlaces({ score, lat, lon, region, regions: manifest.regions });
  const cell = places[0].cell;
  const [grid, ranks] = await Promise.all([
    store.cell(manifest.grid, gridColumns(manifest, target), cell),
    store.cell(target.bin, targetColumns(manifest, target, rover), cell),
  ]);
  return { target, places, match: buildMatch(manifest, target, rover, cell, grid, ranks) };
}

describe("worlds", () => {
  it("reads the world from the address, the Moon by default", () => {
    expect(worldOf("")).toBe("moon");
    expect(worldOf("?world=mars")).toBe("mars");
    expect(worldOf("?world=venus")).toBe("moon");
  });

  it("uses each world's checked base site and links the main page to it", () => {
    expect(baseTarget(manifest, "moon").id).toBe("moon-south-pole");
    expect(baseTarget(manifest, "mars").id).toBe("mars-jezero");
    expect(findHref(baseTarget(manifest, "moon"))).toBe("./");
    expect(findHref(baseTarget(manifest, "mars"))).toBe("./#t=mars-jezero");
  });

  it("the rover filter is the first mission filter", () => {
    expect(rover.id).toBe("rover");
  });
});

describe("what Earth can't copy", () => {
  it("parses gravity from the manifest's own text", () => {
    const g = gravity(manifest);
    expect(g).toEqual({ earth: 9.81, moon: 1.62, mars: 3.73 });
    const row = manifest.cant_copy.find((r) => r.name === "Gravity")!;
    expect(row.moon.startsWith(String(g.moon))).toBe(true);
    expect(row.mars.startsWith(String(g.mars))).toBe(true);
  });

  it("weight is mass times gravity, nothing else", () => {
    const g = gravity(manifest);
    expect(weight(1025, g.mars)).toBeCloseTo(3823.25, 6);
    expect(weight(145, g.moon)).toBeCloseTo(234.9, 6);
  });

  it("every load has a published mass and a linked source", () => {
    expect(loads.map((l) => l.id)).toEqual(["suit", "rover", "module"]);
    for (const l of loads) {
      expect(l.mass_kg).toBeGreaterThan(0);
      expect(l.source.length).toBeGreaterThan(5);
      expect(l.url).toMatch(/^https:\/\/(www\.|science\.)?nasa\.gov\//);
    }
  });
});

describe("known analogs", () => {
  it("splits the tested places by world and leaves out untested candidates", () => {
    const moon = analogsOf(labels, "moon");
    const mars = analogsOf(labels, "mars");
    expect(moon.length).toBe(17);
    expect(mars.length).toBe(29);
    expect(moon.every((l) => l.groups!.some((g) => g === "moon-analog" || g === "moon-basalt"))).toBe(true);
    expect(mars.every((l) => l.groups!.includes("mars-analog"))).toBe(true);
    expect([...moon, ...mars].some((l) => l.groups!.includes("candidate"))).toBe(false);
    expect(moon.map((l) => l.id)).toContain("haughton-crater-devon-island");
    expect(mars.map((l) => l.id)).toContain("haughton-crater-devon-island");
  });

  it("keeps what was tested and drops the 'Used for' tag and location notes", () => {
    const mistastin = labels.find((l) => l.id === "mistastin-crater")!;
    expect(testedThere(mistastin.note)).toBe(
      "Field geology training site for CSA and NASA astronauts, including the Artemis II crew.",
    );
  });

  it("places points on the flat map from longitude and latitude", () => {
    expect(mapPosition(0, 0)).toEqual({ x: 0.5, y: 0.5 });
    expect(mapPosition(90, -180)).toEqual({ x: 0, y: 0 });
    expect(mapPosition(-90, 180)).toEqual({ x: 1, y: 1 });
  });
});

describe("a year on Earth", () => {
  it("reading only the month columns gives the same months as the full match", async () => {
    const { places } = await bestMatch("moon");
    const target = baseTarget(manifest, "moon");
    for (const p of places) {
      const [grid, ranks] = await Promise.all([
        store.cell(manifest.grid, gridColumns(manifest, target), p.cell),
        store.cell(target.bin, targetColumns(manifest, target, rover), p.cell),
      ]);
      const full = buildMatch(manifest, target, rover, p.cell, grid, ranks).months;
      expect(placeMonths(await store.cell(manifest.grid, MONTH_COLUMNS, p.cell))).toEqual(full);
    }
  });

  it("reads each month straight from the month masks", async () => {
    const { match } = await bestMatch("mars");
    for (let m = 0; m < 12; m++) {
      expect(monthState(match.months, m)).toEqual({
        best: monthsOf(match.months.best)[m],
        freeze: monthsOf(match.months.freeze)[m],
        rain: monthsOf(match.months.rain)[m],
      });
    }
    expect(monthState({ best: 0b1, freeze: 0b10, rain: 0b100000000000, usable: null }, 0)).toEqual({ best: true, freeze: false, rain: false });
    expect(monthState({ best: 0b1, freeze: 0b10, rain: 0b100000000000, usable: null }, 11)).toEqual({ best: false, freeze: false, rain: true });
  });
});

describe("hot and cold", () => {
  it("Moon: the coldest from Diviner in kelvin, then the yearly swing", async () => {
    const { target, match } = await bestMatch("moon");
    const pairs = tempPairs(manifest, target, match);
    expect(pairs.map((p) => p.row.trait.id)).toEqual(["cold", "season_swing"]);
    const [cold, swing] = pairs;
    expect(cold.world.kelvin).toBe(target.shown.t_min_k.value);
    expect(cold.world.value).toBe(target.shown.t_min_k.value! - 273.15);
    expect(cold.world.value).toBeCloseTo(target.values.cold.value!, 6);
    expect(cold.world.dataset?.id).toBe("diviner-polar-south");
    expect(swing.world.value).toBe(target.values.season_swing.value);
    expect(swing.world.kelvin).toBeNull();
    for (const p of pairs) {
      expect(p.earth.value).toBe(match.rows.find((r) => r.trait.id === p.row.trait.id)!.earth);
      expect(p.earth.dataset?.id).toBe(p.row.trait.earth_dataset);
    }
  });

  it("Mars: the night minimum and the daily air swing, as published", async () => {
    const { target, match } = await bestMatch("mars");
    const pairs = tempPairs(manifest, target, match);
    expect(pairs.map((p) => p.row.trait.id)).toEqual(["cold", "day_swing_air"]);
    expect(pairs[0].world.value).toBe(target.values.cold.value);
    expect(pairs[0].world.kelvin).toBeNull();
    expect(pairs[1].world.value).toBe(target.values.day_swing_air.value);
    expect(pairs.every((p) => p.earth.value !== null)).toBe(true);
  });

  it("shows one decimal and the kelvin it came from", async () => {
    const { target, match } = await bestMatch("moon");
    const [cold] = tempPairs(manifest, target, match);
    expect(tempText(cold.world, cold.row)).toBe(formatValue(target.values.cold.value, { ...cold.row.trait, digits: 1 }) + " (54.3 K)");
    expect(tempText(cold.world, cold.row)).toMatch(/^−218\.[89]°C \(54\.3 K\)$/);
  });

  it("kelvin to Celsius is a plain offset", () => {
    expect(kelvinToC(273.15)).toBe(0);
    expect(kelvinToC(54.3)).toBeCloseTo(-218.85, 10);
  });
});

describe("photos", () => {
  it("four pairs, each an Earth photo and a Moon or Mars photo", () => {
    expect(photos.map((p) => p.pair)).toEqual(["dust", "ice", "volcanoes", "lava tubes"]);
    for (const p of photos) {
      expect(p.photos.map((x) => x.world)[0]).toBe("Earth");
      expect(["Moon", "Mars"]).toContain(p.photos[1].world);
      for (const x of p.photos) expect(x.alt.length).toBeGreaterThan(30);
    }
  });
});

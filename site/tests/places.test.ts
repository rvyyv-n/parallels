import { describe, expect, it } from "vitest";
import { distinctPlaces, kmBetween, MIN_KM_APART } from "../src/data/places";
import { Store } from "../src/data/store";
import { nodeSource, readManifest } from "./node-source";

const manifest = await readManifest();
const store = new Store(nodeSource);
const [lat, lon, region, terrain] = await Promise.all(
  ["lat", "lon", "region", "terrain_type"].map((id) => store.column(manifest.grid, id)),
);

describe("top places", () => {
  for (const target of manifest.targets) {
    for (const filter of manifest.filters) {
      for (const suffix of ["", ":yr"]) {
        it(`${target.id} ${filter.id}${suffix}: distinct, ranked, best first`, async () => {
          const score = await store.column(target.bin, `score:${filter.id}${suffix}`);
          const picks = distinctPlaces({ score, lat, lon, region, regions: manifest.regions });
          expect(picks.length).toBeGreaterThan(0);
          expect(picks.length).toBeLessThanOrEqual(5);
          for (let a = 0; a < picks.length; a++) {
            expect(score[picks[a].cell]).not.toBe(65535);
            if (a > 0) expect(picks[a].score).toBeLessThanOrEqual(picks[a - 1].score);
            for (let b = a + 1; b < picks.length; b++) {
              expect(kmBetween(picks[a].lat, picks[a].lon, picks[b].lat, picks[b].lon)).toBeGreaterThanOrEqual(MIN_KM_APART);
              if (picks[a].region) expect(picks[b].region).not.toBe(picks[a].region);
            }
          }
          let best = 0;
          for (let i = 0; i < score.length; i++) if (score[i] !== 65535 && score[i] > best) best = score[i];
          expect(score[picks[0].cell]).toBe(best);
        });
      }
    }
  }

  it("opens on the headline place of each checked target", async () => {
    for (const target of manifest.targets.filter((t) => t.headline)) {
      const score = await store.column(target.bin, "score:rover");
      const picks = distinctPlaces({ score, lat, lon, region, regions: manifest.regions });
      expect(picks[0].cell).toBe(target.headline!.cell);
    }
  });

  it("shows fewer than five rather than pad when a terrain type is rare", async () => {
    const cave = manifest.terrain_types.find((t) => t.key === "cave")!;
    const score = await store.column(manifest.targets[0].bin, "score:rover");
    const picks = distinctPlaces({ score, lat, lon, region, regions: manifest.regions, keep: (i) => terrain[i] === cave.id });
    expect(picks.length).toBeLessThan(5);
    for (const p of picks) expect(terrain[p.cell]).toBe(cave.id);
  });
});

describe("reading one place", () => {
  it("gives the same values by range request as from a whole column", async () => {
    const headline = manifest.targets[0].headline!;
    const one = await new Store(nodeSource).cell(manifest.grid, ["lat", "lon", "nearest_analog_km"], headline.cell);
    expect(one.lat).toBeCloseTo(lat[headline.cell] / 100, 6);
    expect(one.lon).toBeCloseTo(lon[headline.cell] / 100, 6);
    expect(headline.title).toContain(`${one.lat!.toFixed(2)}°, ${one.lon!.toFixed(2)}°`);
    expect(headline.why).toContain(`${one.nearest_analog_km} km from the nearest known analog`);
  });

  it("decodes no-data as null", async () => {
    const cell = manifest.targets[1].headline!.cell;
    const one = await new Store(nodeSource).cell(manifest.targets[1].bin, ["rank:minerals"], cell);
    expect(one["rank:minerals"]).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { bestPerChallenge, tieSteps } from "../src/data/base";
import { nodata } from "../src/data/bin";
import { Store } from "../src/data/store";
import { nodeSource, readManifest } from "./node-source";

const manifest = await readManifest();
const store = new Store(nodeSource);
const unchecked = manifest.targets.find(
  (t) => !t.default && manifest.challenges[t.body].some((c) => c.traits.length && !t.bin.columns.some((x) => x.id === `ch:${c.id}`)),
)!;

async function raw(bin: (typeof manifest.targets)[number]["bin"], id: string) {
  const spec = bin.columns.find((c) => c.id === id)!;
  const values = await store.column(bin, id);
  return (cell: number) => (values[cell] === nodata(spec) ? 0 : values[cell]);
}

describe("best place for each part of the base", () => {
  for (const id of ["moon-south-pole", "mars-jezero", unchecked.id]) {
    const target = manifest.targets.find((t) => t.id === id)!;

    it(`${id}: each part's square holds the top of its column and wins its ties by the stated rule`, async () => {
      const plan = await bestPerChallenge(store, manifest, target);
      for (const place of plan.places) {
        for (const part of place.parts) {
          const challenge = part.challenge;
          const spec = target.bin.columns.find((c) => c.id === `ch:${challenge.id}`)!;
          const column = await store.column(target.bin, spec.id);
          let top = 0;
          for (const v of column) if (v !== nodata(spec) && v > top) top = v;
          expect(column[place.cell]).toBe(top);
          expect(part.score).toBeCloseTo(top * spec.scale!, 9);

          let rivals: number[] = [];
          column.forEach((v, cell) => v === top && cell !== place.cell && rivals.push(cell));
          for (const step of tieSteps(manifest, target, challenge)) {
            const sums = await Promise.all(step.map((s) => raw(target.bin, s)));
            const sum = (cell: number) => sums.reduce((s, f) => s + f(cell), 0);
            for (const r of rivals) expect(sum(r)).toBeLessThanOrEqual(sum(place.cell));
            rivals = rivals.filter((r) => sum(r) === sum(place.cell));
          }
          for (const r of rivals) expect(r).toBeGreaterThan(place.cell);
        }
      }
    });

    it(`${id}: gives the same squares on every run`, async () => {
      const a = await bestPerChallenge(store, manifest, target);
      const b = await bestPerChallenge(new Store(nodeSource), manifest, target);
      expect(b.places.map((p) => [p.cell, p.parts.map((x) => x.challenge.id)])).toEqual(
        a.places.map((p) => [p.cell, p.parts.map((x) => x.challenge.id)]),
      );
    });

    it(`${id}: lists each square once, numbers them 1..n, and places every part`, async () => {
      const plan = await bestPerChallenge(store, manifest, target);
      const cells = plan.places.map((p) => p.cell);
      expect(new Set(cells).size).toBe(cells.length);
      expect(plan.places.map((p) => p.n)).toEqual(cells.map((_, i) => i + 1));
      const placed = plan.places.flatMap((p) => p.parts.map((x) => x.challenge.id));
      const unscored = plan.unscored.map((c) => c.id);
      expect(new Set(placed).size).toBe(placed.length);
      expect([...placed, ...unscored].sort()).toEqual(manifest.challenges[target.body].map((c) => c.id).sort());
      for (const c of plan.unscored) expect(target.bin.columns.some((x) => x.id === `ch:${c.id}`)).toBe(false);
      const order = manifest.challenges[target.body].map((c) => c.id);
      const firsts = plan.places.map((p) => order.indexOf(p.parts[0].challenge.id));
      expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
    });

    it(`${id}: shows the trait with the highest rank among those with values on both sides`, async () => {
      const plan = await bestPerChallenge(store, manifest, target);
      for (const place of plan.places) {
        const grid = await store.cell(manifest.grid, ["lat", "lon"], place.cell);
        expect(place.lat).toBe(grid.lat);
        expect(place.lon).toBe(grid.lon);
        for (const part of place.parts) {
          const ranks: number[] = [];
          for (const { id } of part.challenge.traits) {
            const trait = manifest.traits.find((t) => t.id === id)!;
            const column = trait.column[target.body];
            if (!column || target.values[id]?.value == null || !target.bin.columns.some((c) => c.id === `rank:${id}`)) continue;
            const earth = (await store.cell(manifest.grid, [column], place.cell))[column];
            const rank = (await store.cell(target.bin, [`rank:${id}`], place.cell))[`rank:${id}`];
            if (earth !== null && rank !== null) ranks.push(rank);
          }
          if (!ranks.length) {
            expect(part.best).toBeUndefined();
            continue;
          }
          const best = part.best!;
          expect(best.rank).toBe(Math.max(...ranks));
          expect(best.target).toBe(target.values[best.trait.id]);
          const column = best.trait.column[target.body]!;
          expect(best.earth).toBe((await store.cell(manifest.grid, [column], place.cell))[column]);
        }
      }
    });
  }

  it("leaves out parts with only labels, and parts the base site has no values for", async () => {
    const plan = await bestPerChallenge(store, manifest, unchecked);
    const ids = plan.unscored.map((c) => c.id);
    expect(plan.unscored.some((c) => c.traits.length === 0)).toBe(true);
    expect(plan.unscored.some((c) => c.traits.length > 0)).toBe(true);
    for (const c of plan.unscored.filter((c) => c.traits.length > 0)) {
      for (const t of c.traits) expect(unchecked.values[t.id]?.value ?? null).toBeNull();
    }
    expect(ids).toContain("shelter");
  });
});

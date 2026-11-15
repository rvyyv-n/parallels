import { describe, expect, it } from "vitest";
import { buildMatch, formatValue, gridColumns, monthsOf, targetColumns } from "../src/data/match";
import { Store } from "../src/data/store";
import { nodeSource, readManifest } from "./node-source";

const manifest = await readManifest();
const store = new Store(nodeSource);
const rover = manifest.filters.find((f) => f.id === "rover")!;

async function matchFor(targetId: string, cell: number, filter = rover) {
  const target = manifest.targets.find((t) => t.id === targetId)!;
  const [grid, ranks] = await Promise.all([
    store.cell(manifest.grid, gridColumns(manifest, target), cell),
    store.cell(target.bin, targetColumns(manifest, target, filter), cell),
  ]);
  return { target, match: buildMatch(manifest, target, filter, cell, grid, ranks) };
}

describe("match for the headline places", () => {
  for (const target of manifest.targets.filter((t) => t.headline)) {
    it(`${target.id}: numbers agree with the data's own headline text`, async () => {
      const { match } = await matchFor(target.id, target.headline!.cell);
      const why = target.headline!.why;
      expect(why).toContain(`${match.nearestAnalogKm} km from the nearest known analog`);

      const closest = why.slice(why.indexOf("Closest matches"), why.indexOf("Where it breaks"));
      const breaks = why.slice(why.indexOf("Where it breaks"));
      const said = (row: (typeof match.rows)[number]) =>
        `${row.trait.label.toLowerCase()} ${formatValue(row.earth, row.trait).replace("−", "-").replace(" ", " ")}`;
      expect(closest.toLowerCase()).toContain(said(match.bestMatch!).toLowerCase().split(" against")[0].slice(0, 20));
      expect(breaks.toLowerCase()).toContain(match.worstBreak!.trait.label.toLowerCase());
      expect(match.worstBreak!.rank).toBeLessThan(0.05);
      expect(match.bestMatch!.rank).toBeGreaterThan(0.9);
      expect(match.bestMatch!.inFilter).toBe(true);
    });
  }

  it("keeps missing data missing", async () => {
    const jezero = manifest.targets.find((t) => t.id === "mars-jezero")!;
    const { match } = await matchFor(jezero.id, jezero.headline!.cell);
    const minerals = match.rows.find((r) => r.trait.id === "minerals")!;
    expect(minerals.earth).toBeNull();
    expect(minerals.rank).toBeNull();
    expect(formatValue(minerals.earth, minerals.trait)).toBe("no data");
    expect([...match.similar, ...match.different]).not.toContain(minerals);
  });

  it("gives every trait a dataset on both sides", async () => {
    for (const target of manifest.targets) {
      const { match } = await matchFor(target.id, manifest.targets[0].headline!.cell);
      expect(match.rows.length).toBeGreaterThan(0);
      for (const row of match.rows) {
        expect(row.earthDataset, `${target.id} ${row.trait.id} earth`).toBeDefined();
        expect(row.targetDataset, `${target.id} ${row.trait.id} target`).toBeDefined();
      }
      expect(match.challenges.length).toBeGreaterThan(0);
    }
  });

  it("reads month masks with bit 0 as January", () => {
    expect(monthsOf(1)).toEqual([true, ...Array(11).fill(false)]);
    expect(monthsOf(4095).every(Boolean)).toBe(true);
    expect(monthsOf(1 << 11)[11]).toBe(true);
  });
});

describe("formatValue", () => {
  it("drops the minus sign when a value rounds to zero", () => {
    expect(formatValue(-0.3, { unit: "°C", digits: 0 })).toBe("0°C");
    expect(formatValue(-0.04, { unit: "", digits: 1 })).toBe("0.0");
    expect(formatValue(-0.6, { unit: "°C", digits: 0 })).toBe("−1°C");
    expect(formatValue(-10.3, { unit: "°C", digits: 1 })).toBe("−10.3°C");
  });
});

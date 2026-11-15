import { describe, expect, it } from "vitest";
import type { PlaceInfo } from "../src/data/load";
import type { BasePlan } from "../src/data/base";
import { CHAPTERS } from "../src/scene/keyframes";
import { secondSite, SECTIONS, starts, STEPS, total, type Scene } from "../src/ui/tour-steps";
import { readManifest } from "./node-source";

const manifest = await readManifest();
const target = manifest.targets.find((t) => t.default)!;
const filter = manifest.filters[0];
const place = { cell: 1, region: "Nowhereland Plateau, Testonia", lat: 0, lon: 0 } as PlaceInfo;
const plan = { target: target.id, places: [{ parts: [{}, {}] }, { parts: [{}] }], unscored: [] } as unknown as BasePlan;
const scene: Scene = { manifest, target, filter, place, plan, checks: { passed: 7, total: 13 } };

describe("guided tour steps", () => {
  it("lasts between 30 and 60 seconds and ends on Build the whole base", () => {
    expect(total(STEPS)).toBeGreaterThanOrEqual(30);
    expect(total(STEPS)).toBeLessThanOrEqual(60);
    expect(STEPS.at(-1)!.section).toBe("base");
  });

  it("brings only sections that exist on the page, with unique step ids", () => {
    for (const s of STEPS) expect(SECTIONS).toContain(s.section);
    for (const c of CHAPTERS) expect(SECTIONS).toContain(c);
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
  });

  it("starts each step when the one before ends", () => {
    const at = starts(STEPS);
    expect(at[0]).toBe(0);
    for (let i = 1; i < STEPS.length; i++) expect(at[i]).toBe(at[i - 1] + STEPS[i - 1].seconds);
    expect(at.at(-1)! + STEPS.at(-1)!.seconds).toBe(total(STEPS));
  });

  it("starts from the default view and switches to the other checked base site", () => {
    expect(STEPS[0].view!(manifest)).toEqual({ target: "moon-south-pole", filter: "rover", terrain: null, yearRound: false, place: null });
    const other = secondSite(manifest);
    expect(other.default).toBe(true);
    expect(other.id).not.toBe(target.id);
    expect(STEPS.find((s) => s.view && s.id !== STEPS[0].id)!.view!(manifest).target).toBe(other.id);
  });

  it("reads places and numbers from what it is given", () => {
    const text = STEPS.map((s) => s.caption(scene)).join(" ");
    expect(text).toContain("Nowhereland Plateau");
    expect(text).not.toContain("Testonia");
    expect(text).toContain(manifest.grid.n.toLocaleString("en"));
    expect(text).toContain(filter.name.toLowerCase());
    expect(text).toContain("7 of 13 checks pass");
    expect(text).toContain("2 places cover 3 parts");
    for (const c of manifest.cant_copy) expect(text).toContain(c.name.toLowerCase());
    const renamed = { ...target, name: "Testo Crater (somewhere)" };
    expect(STEPS.find((s) => s.id === "switch")!.caption({ ...scene, target: renamed })).toContain("Testo Crater");
  });

  it("leaves out what it does not know yet instead of guessing", () => {
    const empty: Scene = { ...scene, place: undefined, plan: undefined, checks: undefined };
    for (const s of STEPS) {
      const text = s.caption(empty);
      expect(text).not.toMatch(/undefined|NaN/);
      expect(text.length).toBeGreaterThan(20);
    }
    expect(STEPS.find((s) => s.id === "checked")!.caption(empty)).toContain("Not every check passes");
  });
});

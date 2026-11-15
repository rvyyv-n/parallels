import { describe, expect, it } from "vitest";
import type { Validation } from "../../dataset/contract";
import { checked } from "../src/data/checked";
import { percent } from "../src/data/match";
import { readJson } from "./node-source";

const c = checked(await readJson<Validation>("validation.json"));
const panel = (id: string) => c.panels.find((p) => p.id === id)!;
const counts = (id: string) =>
  Object.fromEntries(panel(id).strips.map((s) => [s.group, [s.dots.length, s.missing.length]]));
const shown = (id: string) => panel(id).checks.map((k) => [k.group, percent(k.result), percent(k.passMark), k.passed]);

describe("how we checked it", () => {
  it("counts the runs", () => {
    expect(c.first).toEqual({ passed: 1, total: 4 });
    expect(c.fourth).toEqual({ passed: 10, total: 15, uncounted: 6 });
    expect(c.uses).toBe(4);
    expect(c.weightsCommit).toBe("16b6a1c");
    expect(c.configCommit).toBe("b070766");
  });

  it("shows the three headline tests in order", () => {
    expect(c.panels.map((p) => p.id)).toEqual(["fourth-mars", "fourth-moon-polar", "fourth-moon-terrain"]);
  });

  it("gives each check its result and pass mark", () => {
    expect(shown("fourth-mars")).toEqual([
      ["ordinary", "84%", "80%", true],
      ["desert", "74%", "60%", true],
    ]);
    expect(shown("fourth-moon-polar")).toEqual([["ordinary", "72%", "80%", false]]);
    expect(shown("fourth-moon-terrain")).toEqual([["ordinary", "85%", "80%", true]]);
  });

  it("places every scored test place and keeps the rest as no data", () => {
    expect(counts("fourth-mars")).toEqual({ "mars-analog": [28, 1], ordinary: [16, 0], desert: [6, 0] });
    expect(counts("fourth-moon-polar")).toEqual({ "moon-analog": [4, 0], ordinary: [16, 0] });
    expect(counts("fourth-moon-terrain")).toEqual({ "moon-basalt": [12, 1], ordinary: [16, 0] });
    expect(panel("fourth-mars").strips[0].missing).toEqual(["Don Juan Pond, Wright Valley"]);
  });

  it("labels the analog row and keeps the data's names for the others", () => {
    expect(panel("fourth-mars").strips.map((s) => [s.label, s.analog])).toEqual([
      ["Known analogs", true],
      ["Ordinary places", false],
      ["Plain deserts", false],
    ]);
  });
});

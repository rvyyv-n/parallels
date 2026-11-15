import { describe, expect, it } from "vitest";
import type { Dataset } from "../../dataset/contract";
import { AGENCIES, byAgency, sentences } from "../src/data/judges";
import { readManifest } from "./node-source";

const manifest = await readManifest();

describe("for judges", () => {
  it("keeps every dataset when grouping by agency, NASA first", () => {
    const groups = byAgency(manifest.datasets);
    expect(groups.flatMap((g) => g.datasets).map((d) => d.id).sort()).toEqual(manifest.datasets.map((d) => d.id).sort());
    expect(groups[0].agency).toBe("NASA");
    expect(groups.map((g) => AGENCIES.indexOf(g.agency))).toEqual([...groups.map((g) => AGENCIES.indexOf(g.agency))].sort());
  });

  it("drops empty agencies and keeps their order", () => {
    const d = (id: string, agency: Dataset["agency"]): Dataset => ({ id, name: id, agency, url: null, licence: "x", used_for: "y" });
    expect(byAgency([d("a", "computed"), d("b", "ESA"), d("c", "NASA")]).map((g) => g.agency)).toEqual(["NASA", "ESA", "computed"]);
  });

  it("gives every dataset in the manifest a licence", () => {
    for (const d of manifest.datasets) expect(d.licence.trim(), d.id).not.toBe("");
  });

  it("splits text into sentences without breaking numbers", () => {
    expect(sentences("We ran it 1,000 times. Top-20 held 0.9 of runs. Done.")).toEqual([
      "We ran it 1,000 times.",
      "Top-20 held 0.9 of runs.",
      "Done.",
    ]);
  });
});

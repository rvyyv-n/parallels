import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { BasePlan } from "../data/base";
import type { PlaceInfo } from "../data/load";
import { DEFAULT_VIEW, type View } from "../state";
import { placeName } from "./Feature";
import { isChecked, shortName } from "./Picker";

export const SECTIONS = ["intro", "find", "match", "breaks", "test", "base", "checked"] as const;
export type Section = (typeof SECTIONS)[number];

export type Need = "result" | "plan" | "checks";

export interface Scene {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  place: PlaceInfo | undefined;
  plan: BasePlan | undefined;
  checks: { passed: number; total: number } | undefined;
}

export interface Step {
  id: string;
  section: Section;
  seconds: number;
  need: Need;
  view?: (manifest: Manifest) => Partial<View>;
  caption: (s: Scene) => string;
}

export const siteName = (t: Target) => (t.body === "moon" ? `the ${shortName(t)}` : shortName(t));

const named = (place: PlaceInfo | undefined) => place && placeName(place.region).name;

const list = (words: string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`);

export const secondSite = (manifest: Manifest) => manifest.targets.find((t) => isChecked(t) && t.id !== DEFAULT_VIEW.target)!;

export const STEPS: Step[] = [
  {
    id: "intro",
    section: "intro",
    seconds: 6,
    need: "result",
    view: () => ({ target: DEFAULT_VIEW.target, filter: DEFAULT_VIEW.filter, terrain: null, yearRound: false, place: null }),
    caption: () => "No place on Earth copies a Moon or Mars base. But each part of a base has a best place to practise.",
  },
  {
    id: "find",
    section: "find",
    seconds: 7,
    need: "result",
    caption: ({ manifest, target, filter, place }) =>
      `We searched ${manifest.grid.n.toLocaleString("en")} squares of Earth's land with NASA data.` +
      (place ? ` For ${filter.name.toLowerCase()} at ${siteName(target)}, the best is ${named(place)}.` : ""),
  },
  {
    id: "match",
    section: "match",
    seconds: 5,
    need: "result",
    caption: ({ target, place }) =>
      `Where it matches: each row sets a value from ${named(place) ?? "the place"} beside ${siteName(target)}, and names its dataset.`,
  },
  {
    id: "breaks",
    section: "breaks",
    seconds: 5,
    need: "result",
    caption: ({ manifest }) =>
      `Where it breaks, in the same detail. No place on Earth copies the ${list(manifest.cant_copy.map((c) => c.name.toLowerCase()))}.`,
  },
  {
    id: "test",
    section: "test",
    seconds: 5,
    need: "result",
    caption: ({ place }) => `What to test at ${named(place) ?? "this place"} and in which months, with links to check every value yourself.`,
  },
  {
    id: "switch",
    section: "find",
    seconds: 6,
    need: "result",
    view: (manifest) => ({ target: secondSite(manifest).id, place: null }),
    caption: ({ target, place }) =>
      `Switch the base site to ${siteName(target)}, and the globe answers.` + (place ? ` The best place is now ${named(place)}.` : ""),
  },
  {
    id: "base",
    section: "base",
    seconds: 6,
    need: "plan",
    caption: ({ target, plan }) =>
      `Build the whole base: each part of a base at ${siteName(target)} has its own best place on Earth.` +
      (plan ? ` ${plan.places.length} places cover ${plan.places.reduce((n, p) => n + p.parts.length, 0)} parts.` : ""),
  },
  {
    id: "checked",
    section: "checked",
    seconds: 6,
    need: "checks",
    caption: ({ checks }) =>
      "How we checked it: known analogs should score above ordinary places." +
      (checks ? ` ${checks.passed} of ${checks.total} checks pass, not all of them.` : " Not every check passes."),
  },
  {
    id: "end",
    section: "base",
    seconds: 4,
    need: "plan",
    caption: () => "Choose any place to open it, or pick your own base site at the top.",
  },
];

export const total = (steps: Step[]) => steps.reduce((t, s) => t + s.seconds, 0);

export const starts = (steps: Step[]) => steps.map((_, i) => total(steps.slice(0, i)));

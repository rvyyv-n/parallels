export type Body = "moon" | "mars";

export interface Trait {
  label: string;
  unit: string;
  digits: number;
  scale?: number;
  plain: string;
  earth?: string[];
}

export interface Value {
  value: number | null;
  sample: boolean;
  missing?: boolean;
  ideal?: boolean;
  source?: string;
  url?: string;
  kind?: string;
  note?: string;
}

export interface Part {
  name: string;
  why: string;
  traits: string[];
}

export interface Label {
  name: string;
  reason: string;
}

export interface Unscored {
  name: string;
  earth_text: string;
  target_key: string;
  reason: string;
}

export interface Challenge {
  id: string;
  name: string;
  question: string;
  only?: string;
  built_from?: string;
  parts: Part[];
  labels?: Label[];
  unscored?: Unscored[];
  ideal?: Record<string, number>;
  ideal_note?: string;
}

export interface Fact {
  text: string;
  source: string;
  url?: string;
}

export interface Target {
  id: string;
  body: Body;
  name: string;
  lat: number;
  lon: number;
  anchorNote?: string;
  anchorUrl?: string;
  facts: Fact[];
  values: Record<string, Value>;
  extra: Record<string, Value>;
}

export interface Site {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  groups: string[];
  coordsEstimate: boolean;
  coordSource?: string;
  coordNote?: string;
  values: Record<Body, Record<string, Value>>;
  context: Record<string, number | null>;
}

export interface Result {
  site: string;
  score: number;
  sample: boolean;
  ranks: Record<string, number | null>;
}

export interface CantCopy {
  name: string;
  earth: string;
  moon: string;
  mars: string;
  source: string;
  url: string;
}

export interface Check {
  label: string;
  value: number;
  pass_mark: number;
  passed: boolean;
}

export interface Validation {
  traits: string[];
  challenges: string[];
  groups: { id: string; label: string; points: { site: string; rank: number; heldOut: boolean }[] }[];
  checks: Check[];
  note: string;
  firstRun: string;
}

export interface Source {
  name: string;
  url: string;
  use: string;
  kind: "real" | "sample";
  partner?: boolean;
}

export interface App {
  generated: string;
  traits: Record<string, Trait>;
  challenges: Record<Body, Challenge[]>;
  cantCopy: CantCopy[];
  terrainScale: Record<Body, number>;
  referenceSize: number;
  targets: Target[];
  sites: Site[];
  results: Record<string, Record<string, Result[]>>;
  previews: Record<string, string[]>;
  validation: Record<Body, Validation>;
  sources: Source[];
}

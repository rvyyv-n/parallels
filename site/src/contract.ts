export type Body = "moon" | "mars";
export type DType = "u8" | "u16" | "i16" | "f32";

export interface Column {
  id: string;
  dtype: DType;
  offset: number;
  scale?: number;
  add?: number;
  nodata?: number;
}

export interface BinFile {
  file: string;
  n: number;
  columns: Column[];
}

export interface Dataset {
  id: string;
  name: string;
  agency: "NASA" | "USGS" | "ESA" | "partner" | "other" | "computed";
  url: string | null;
  licence: string;
  used_for: string;
  archive?: string;
}

export interface Trait {
  id: string;
  label: string;
  unit: string;
  digits: number;
  plain: string;
  column: Partial<Record<Body, string>>;
  earth_stat: string;
  earth_dataset: string;
  earth_resolution: string;
  scored_by?: "distance" | "ideal" | "presence";
  note?: string;
}

export interface Unscored {
  name: string;
  reason: string;
  earth_text?: string;
  target_key?: string;
}

export interface Challenge {
  id: string;
  name: string;
  question: string;
  only?: string;
  what_to_test: string;
  traits: { id: string; weight: number; why: string }[];
  labels: Unscored[];
}

export interface MissionFilter {
  id: string;
  name: string;
  plain: string;
  weights: Record<Body, Record<string, number>>;
  reasons: Record<string, string>;
}

export interface TerrainType {
  id: number;
  key: "none" | "arid_basin" | "volcanic_high" | "salt_flat" | "frozen_ground" | "cave";
  name: string;
  rule: string;
  cells: number;
}

export interface TargetValue {
  value: number | null;
  stat: string;
  dataset: string;
  resolution: string;
  kind: "computed" | "published" | "derived";
  note?: string;
}

export interface Target {
  id: string;
  body: Body;
  name: string;
  short: string;
  lat: number;
  lon: number;
  anchor_note: string;
  default: boolean;
  bin: BinFile;
  values: Record<string, TargetValue>;
  shown: Record<string, TargetValue>;
  facts: { text: string; source: string; url: string }[];
  regions?: { id: string; name: string; lat: number; lon: number; anchor_note: string; values: Record<string, TargetValue> }[];
  headline?: { cell: number; title: string; why: string; what_to_test: string };
}

export interface CantCopy {
  name: string;
  earth: string;
  moon: string;
  mars: string;
  source: string;
  url: string;
}

export interface Manifest {
  version: 1;
  generated: string;
  sample: boolean;
  grid: BinFile & { res_deg: number; land_rule: string };
  regions: string[];
  datasets: Dataset[];
  traits: Trait[];
  challenges: Record<Body, Challenge[]>;
  filters: MissionFilter[];
  scoring: { floor: number; missing_rank: number; min_weight_with_data: number; rule: string; layout?: string; yearround_rule: string };
  terrain_types: TerrainType[];
  clustering: { k: number; method: string; inputs: string[]; agreement: { cluster: number; cells: number; top_type: string; share: number }[]; summary: string };
  targets: Target[];
  cant_copy: CantCopy[];
  not_in_version: { item: string; reason: string }[];
  benchmarks: { n: number; guide_words: string; how: string; where: string }[];
  questions: { n: number; question: string; answer: string }[];
}

export interface LabelPoint {
  id: string;
  name: string;
  kind: "known_analog" | "cave" | "ordinary" | "plain_desert";
  lat: number;
  lon: number;
  country?: string;
  groups?: string[];
  note?: string;
  source: string;
  analog_source?: string;
}

export interface ValidationPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  group: string;
  cell: number | null;
  score: number | null;
  land_rank: number | null;
  best_target?: string;
  held_out: boolean;
  blind: boolean;
  note?: string;
}

export interface ValidationTest {
  id: string;
  title: string;
  body: Body;
  plain: string;
  groups: { id: string; name: string; plain: string }[];
  places: ValidationPlace[];
  checks: { name: string; pass_mark: number; result: number | null; passed: boolean | null; n_pairs: number; held_out_only?: number | null; blind_only?: number | null }[];
  misses: { place: string; why: string }[];
}

export interface Validation {
  weights_commit: string;
  summary?: string;
  not_blind_note: string;
  prototype_runs: { date: string; result: string }[];
  tests: ValidationTest[];
  stability?: string;
  data_checks: { name: string; result: string; passed: boolean }[];
}

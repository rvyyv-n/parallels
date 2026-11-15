import type { Challenge, Dataset, Manifest, MissionFilter, Target, TargetValue, Trait, Unscored } from "../../../dataset/contract";

export interface TraitRow {
  trait: Trait;
  inFilter: boolean;
  usedBy: string[];
  earth: number | null;
  target: TargetValue;
  rank: number | null;
  earthDataset: Dataset | undefined;
  targetDataset: Dataset | undefined;
}

export interface ChallengeRow {
  challenge: Challenge;
  weight: number;
  reason: string | undefined;
  score: number | null;
  coverage: number | null;
}

export interface LabelRow {
  challenge: Challenge;
  label: Unscored;
  shown: TargetValue | undefined;
  dataset: Dataset | undefined;
}

export interface Match {
  cell: number;
  lat: number;
  lon: number;
  region: string | null;
  terrain: string;
  hasTerrainType: boolean;
  nearestAnalogKm: number | null;
  score: number | null;
  scoreYearRound: number | null;
  stable: boolean | null;
  months: { best: number; freeze: number; rain: number; usable: number | null };
  rows: TraitRow[];
  similar: TraitRow[];
  different: TraitRow[];
  bestMatch: TraitRow | undefined;
  worstBreak: TraitRow | undefined;
  challenges: ChallengeRow[];
  labels: LabelRow[];
}

export const SIMILAR_FROM = 0.5;

const PLACE_COLUMNS = ["lat", "lon", "region", "terrain_type", "nearest_analog_km", "m_best", "m_freeze", "m_rain", "usable"];

export function targetTraits(manifest: Manifest, target: Target): Trait[] {
  return manifest.traits.filter((t) => t.column[target.body] && target.values[t.id]);
}

export function gridColumns(manifest: Manifest, target: Target): string[] {
  return [...new Set([...PLACE_COLUMNS, ...targetTraits(manifest, target).map((t) => t.column[target.body]!)])];
}

export function targetColumns(manifest: Manifest, target: Target, filter: MissionFilter): string[] {
  const wanted = [
    ...targetTraits(manifest, target).map((t) => `rank:${t.id}`),
    ...manifest.challenges[target.body].flatMap((c) => [`ch:${c.id}`, `cov:${c.id}`]),
    `score:${filter.id}`,
    `score:${filter.id}:yr`,
    `stable:${filter.id}`,
  ];
  const have = new Set(target.bin.columns.map((c) => c.id));
  return wanted.filter((id) => have.has(id));
}

export function buildMatch(
  manifest: Manifest,
  target: Target,
  filter: MissionFilter,
  cell: number,
  grid: Record<string, number | null>,
  ranks: Record<string, number | null>,
): Match {
  const dataset = (id: string) => manifest.datasets.find((d) => d.id === id);
  const weights = filter.weights[target.body];
  const challenges = manifest.challenges[target.body];

  const rows: TraitRow[] = targetTraits(manifest, target).map((trait) => {
    const using = challenges.filter((c) => c.traits.some((t) => t.id === trait.id));
    return {
      trait,
      inFilter: using.some((c) => weights[c.id] > 0),
      usedBy: using.map((c) => c.name),
      earth: grid[trait.column[target.body]!] ?? null,
      target: target.values[trait.id],
      rank: ranks[`rank:${trait.id}`] ?? null,
      earthDataset: dataset(trait.earth_dataset),
      targetDataset: dataset(target.values[trait.id].dataset),
    };
  });

  const ranked = rows.filter((r) => r.rank !== null && r.earth !== null && r.target.value !== null);
  const byRank = [...ranked].sort((a, b) => b.rank! - a.rank!);
  const terrain = manifest.terrain_types.find((t) => t.id === grid.terrain_type) ?? manifest.terrain_types[0];

  return {
    cell,
    lat: grid.lat!,
    lon: grid.lon!,
    region: grid.region !== null && grid.region >= 0 ? (manifest.regions[grid.region] ?? null) : null,
    terrain: terrain.name,
    hasTerrainType: terrain.key !== "none",
    nearestAnalogKm: grid.nearest_analog_km,
    score: ranks[`score:${filter.id}`] ?? null,
    scoreYearRound: ranks[`score:${filter.id}:yr`] ?? null,
    stable: ranks[`stable:${filter.id}`] === undefined ? null : ranks[`stable:${filter.id}`] === 1,
    months: { best: grid.m_best ?? 0, freeze: grid.m_freeze ?? 0, rain: grid.m_rain ?? 0, usable: grid.usable },
    rows,
    similar: byRank.filter((r) => r.rank! >= SIMILAR_FROM),
    different: byRank.filter((r) => r.rank! < SIMILAR_FROM).reverse(),
    bestMatch: byRank.find((r) => r.inFilter),
    worstBreak: byRank.at(-1),
    challenges: challenges
      .filter((c) => weights[c.id] > 0)
      .map((challenge) => ({
        challenge,
        weight: weights[challenge.id],
        reason: filter.reasons[`${target.body}:${challenge.id}`],
        score: ranks[`ch:${challenge.id}`] ?? null,
        coverage: ranks[`cov:${challenge.id}`] ?? null,
      })),
    labels: challenges
      .filter((c) => weights[c.id] > 0 || c.traits.length === 0)
      .flatMap((challenge) =>
        challenge.labels.map((label) => {
          const shown = label.target_key ? target.shown[label.target_key] : undefined;
          return { challenge, label, shown, dataset: shown ? dataset(shown.dataset) : undefined };
        }),
      ),
  };
}

export const monthsOf = (mask: number) => Array.from({ length: 12 }, (_, m) => (mask & (1 << m)) !== 0);

export const fixed = (value: number, digits: number) => value.toFixed(digits).replace(/^-(0(\.0+)?)$/, "$1");

export function formatValue(value: number | null, trait: Pick<Trait, "unit" | "digits">): string {
  if (value === null) return "no data";
  const n = fixed(value, trait.digits).replace("-", "−");
  if (!trait.unit) return n;
  return /^[°%]/.test(trait.unit) ? n + trait.unit : `${n} ${trait.unit}`;
}

export function formatCoords(lat: number, lon: number): string {
  const part = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return `${part(lat, "N", "S")} ${part(lon, "E", "W")}`;
}

export const percent = (share: number) => `${Math.round(share * 100)}%`;

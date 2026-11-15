import type { Challenge, Column, Manifest, Target, TargetValue, TerrainType, Trait } from "../../../dataset/contract";
import { decode, nodata, type Raw } from "./bin";
import type { Store } from "./store";

export interface BaseTrait {
  trait: Trait;
  earth: number;
  target: TargetValue;
  rank: number;
}

export interface BasePart {
  challenge: Challenge;
  score: number;
  best: BaseTrait | undefined;
}

export interface BasePlace {
  n: number;
  cell: number;
  lat: number;
  lon: number;
  region: string | null;
  terrain: TerrainType;
  parts: BasePart[];
}

export interface BasePlan {
  target: string;
  places: BasePlace[];
  unscored: Challenge[];
}

export const TIE_RULE =
  "When squares tie on a part's score, the one with more data wins, then the one closer on that part's own traits, then the one that suits more of the other parts, then the lower square number.";

interface Loaded {
  spec: Column;
  raw: Raw;
}

const rawAt = ({ spec, raw }: Loaded, cell: number) => (raw[cell] === nodata(spec) ? 0 : raw[cell]);

const sumAt = (columns: Loaded[], cell: number) => columns.reduce((s, c) => s + rawAt(c, cell), 0);

function keepTop(cells: number[], value: (cell: number) => number) {
  let top = -Infinity;
  for (const cell of cells) top = Math.max(top, value(cell));
  return cells.filter((cell) => value(cell) === top);
}

export function tieSteps(manifest: Manifest, target: Target, challenge: Challenge): string[][] {
  const has = (id: string) => target.bin.columns.some((c) => c.id === id);
  const ranks = challenge.traits.map((t) => `rank:${t.id}`).filter(has);
  const parts = manifest.challenges[target.body].map((c) => `ch:${c.id}`).filter(has);
  return [[`cov:${challenge.id}`].filter(has), ranks, parts];
}

async function bestTrait(store: Store, manifest: Manifest, target: Target, challenge: Challenge, cell: number) {
  const traits = challenge.traits
    .map((t) => manifest.traits.find((x) => x.id === t.id)!)
    .filter((t) => t.column[target.body] && target.values[t.id]?.value != null && store.has(target.bin, `rank:${t.id}`));
  const [earth, ranks] = await Promise.all([
    store.cell(
      manifest.grid,
      traits.map((t) => t.column[target.body]!),
      cell,
    ),
    store.cell(
      target.bin,
      traits.map((t) => `rank:${t.id}`),
      cell,
    ),
  ]);
  let best: BaseTrait | undefined;
  for (const trait of traits) {
    const value = earth[trait.column[target.body]!];
    const rank = ranks[`rank:${trait.id}`];
    if (value === null || rank === null || (best && best.rank >= rank)) continue;
    best = { trait, earth: value, target: target.values[trait.id], rank };
  }
  return best;
}

export async function bestPerChallenge(store: Store, manifest: Manifest, target: Target): Promise<BasePlan> {
  const bin = target.bin;
  const spec = (id: string) => bin.columns.find((c) => c.id === id)!;
  const load = (ids: string[]) =>
    Promise.all(
      ids.map(async (id) => ({
        spec: spec(id),
        raw: await store.column(bin, id),
      })),
    );
  const challenges = manifest.challenges[target.body];
  const scored = challenges.filter((c) => store.has(bin, `ch:${c.id}`));
  const columns = await load(scored.map((c) => `ch:${c.id}`));

  const winners: { challenge: Challenge; cell: number; score: number }[] = [];
  for (const [i, challenge] of scored.entries()) {
    const column = columns[i];
    let cells: number[] = [];
    let top = -1;
    for (let cell = 0; cell < bin.n; cell++) {
      const raw = column.raw[cell];
      if (raw === nodata(column.spec) || raw < top) continue;
      if (raw > top) {
        top = raw;
        cells = [];
      }
      cells.push(cell);
    }
    for (const step of tieSteps(manifest, target, challenge)) {
      if (cells.length === 1) break;
      const by = await load(step);
      cells = keepTop(cells, (cell) => sumAt(by, cell));
    }
    winners.push({
      challenge,
      cell: cells[0],
      score: decode(top, column.spec)!,
    });
  }

  const cells = [...new Set(winners.map((w) => w.cell))];
  const places = await Promise.all(
    cells.map(async (cell, i): Promise<BasePlace> => {
      const grid = await store.cell(manifest.grid, ["lat", "lon", "region", "terrain_type"], cell);
      const won = winners.filter((w) => w.cell === cell);
      const parts = await Promise.all(
        won.map(async ({ challenge, score }) => ({
          challenge,
          score,
          best: await bestTrait(store, manifest, target, challenge, cell),
        })),
      );
      return {
        n: i + 1,
        cell,
        lat: grid.lat!,
        lon: grid.lon!,
        region: grid.region !== null && grid.region >= 0 ? (manifest.regions[grid.region] ?? null) : null,
        terrain: manifest.terrain_types.find((t) => t.id === grid.terrain_type) ?? manifest.terrain_types[0],
        parts,
      };
    }),
  );

  return {
    target: target.id,
    places,
    unscored: challenges.filter((c) => !scored.includes(c)),
  };
}

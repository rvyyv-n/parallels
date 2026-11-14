import type { Manifest, MissionFilter, Target, TerrainType, Validation } from "../../../dataset/contract";
import type { Raw } from "./bin";
import { buildMatch, gridColumns, targetColumns, type Match } from "./match";
import { distinctPlaces, type Place } from "./places";
import { httpSource, Store } from "./store";

const DATA = import.meta.env.BASE_URL + "data/";
const store = new Store(httpSource(DATA));
const json = new Map<string, Promise<unknown>>();

function loadJson<T>(name: string): Promise<T> {
  let p = json.get(name);
  if (!p) {
    p = fetch(DATA + name).then((r) => {
      if (!r.ok) throw new Error(`${name}: ${r.status}`);
      return r.json();
    });
    json.set(name, p);
  }
  return p as Promise<T>;
}

export const loadManifest = () => loadJson<Manifest>("manifest.json");
export const loadValidation = () => loadJson<Validation>("validation.json");

export interface PlaceInfo extends Place {
  terrain: TerrainType;
  nearestAnalogKm: number | null;
}

export interface Listing {
  key: string;
  places: PlaceInfo[];
  score: Raw;
  lat: Raw;
  lon: Raw;
  kept: ((cell: number) => boolean) | undefined;
}

export interface Query {
  target: Target;
  filter: MissionFilter;
  yearRound: boolean;
  terrain: TerrainType | undefined;
}

export const queryKey = (q: Query) => `${q.target.id}|${q.filter.id}|${q.yearRound}|${q.terrain?.key ?? ""}`;

export async function listPlaces(manifest: Manifest, q: Query): Promise<Listing> {
  const grid = manifest.grid;
  const [score, lat, lon, region, terrainType] = await Promise.all([
    store.column(q.target.bin, `score:${q.filter.id}${q.yearRound ? ":yr" : ""}`),
    store.column(grid, "lat"),
    store.column(grid, "lon"),
    store.column(grid, "region"),
    q.terrain ? store.column(grid, "terrain_type") : undefined,
  ]);
  const kept = terrainType && q.terrain ? (cell: number) => terrainType[cell] === q.terrain!.id : undefined;
  const picks = distinctPlaces({ score, lat, lon, region, regions: manifest.regions, keep: kept });
  const places = await Promise.all(
    picks.map(async (p) => {
      const extra = await store.cell(grid, ["terrain_type", "nearest_analog_km"], p.cell);
      return {
        ...p,
        terrain: manifest.terrain_types.find((t) => t.id === extra.terrain_type) ?? manifest.terrain_types[0],
        nearestAnalogKm: extra.nearest_analog_km,
      };
    }),
  );
  return { key: queryKey(q), places, score, lat, lon, kept };
}

export async function loadMatch(manifest: Manifest, target: Target, filter: MissionFilter, cell: number): Promise<Match> {
  const [grid, ranks] = await Promise.all([
    store.cell(manifest.grid, gridColumns(manifest, target), cell),
    store.cell(target.bin, targetColumns(manifest, target, filter), cell),
  ]);
  return buildMatch(manifest, target, filter, cell, grid, ranks);
}

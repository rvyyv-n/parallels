import type { Raw } from "./bin";

export interface Place {
  cell: number;
  score: number;
  lat: number;
  lon: number;
  region: string | null;
}

export interface PlacesInput {
  score: Raw;
  lat: Raw;
  lon: Raw;
  region: Raw;
  regions: string[];
  keep?: (cell: number) => boolean;
  max?: number;
  minKm?: number;
}

export const MIN_KM_APART = 300;
export const MAX_PLACES = 5;
const NOT_RANKED = 65535;

export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function placeAt({ score, lat, lon, region, regions }: Pick<PlacesInput, "score" | "lat" | "lon" | "region" | "regions">, cell: number): Place {
  const name = region[cell] >= 0 ? (regions[region[cell]] ?? null) : null;
  return { cell, score: score[cell] / 10000, lat: lat[cell] / 100, lon: lon[cell] / 100, region: name };
}

export function distinctPlaces(input: PlacesInput): Place[] {
  const { score, keep, max = MAX_PLACES, minKm = MIN_KM_APART } = input;
  const order: number[] = [];
  for (let i = 0; i < score.length; i++) if (score[i] !== NOT_RANKED && (!keep || keep(i))) order.push(i);
  order.sort((a, b) => score[b] - score[a] || a - b);

  const picks: Place[] = [];
  for (const i of order) {
    const place = placeAt(input, i);
    if (picks.some((p) => (place.region !== null && p.region === place.region) || kmBetween(place.lat, place.lon, p.lat, p.lon) < minKm)) continue;
    picks.push(place);
    if (picks.length === max) break;
  }
  return picks;
}

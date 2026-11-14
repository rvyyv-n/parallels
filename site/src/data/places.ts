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
const NOT_RANKED = 65535;

export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export function distinctPlaces({ score, lat, lon, region, regions, keep, max = 5, minKm = MIN_KM_APART }: PlacesInput): Place[] {
  const order: number[] = [];
  for (let i = 0; i < score.length; i++) if (score[i] !== NOT_RANKED && (!keep || keep(i))) order.push(i);
  order.sort((a, b) => score[b] - score[a] || a - b);

  const picks: Place[] = [];
  for (const i of order) {
    const la = lat[i] / 100;
    const lo = lon[i] / 100;
    const name = region[i] >= 0 ? (regions[region[i]] ?? null) : null;
    if (picks.some((p) => (name !== null && p.region === name) || kmBetween(la, lo, p.lat, p.lon) < minKm)) continue;
    picks.push({ cell: i, score: score[i] / 10000, lat: la, lon: lo, region: name });
    if (picks.length === max) break;
  }
  return picks;
}

import type { Manifest } from "./contract";
import type { Cols } from "./data";

export function coverage(cov: Float32Array | undefined, ch: number, i: number): number {
  if (!cov) return Number.isNaN(ch) ? 0 : 1;
  const v = cov[i];
  if (Number.isNaN(v)) return 0;
  return v > 1 ? v / 100 : v;
}

export function handScore(m: Manifest, t: Cols, w: Record<string, number>, n: number): Float32Array {
  const { floor, missing_rank, min_weight_with_data } = m.scoring;
  const ids = Object.keys(w).filter((id) => w[id] > 0 && t[`ch:${id}`]);
  const total = ids.reduce((s, id) => s + w[id], 0);
  const out = new Float32Array(n).fill(NaN);
  if (!total) return out;
  const cols = ids.map((id) => t[`ch:${id}`]);
  const covs = ids.map((id) => t[`cov:${id}`]);
  const ws = ids.map((id) => w[id] / total);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let have = 0;
    for (let k = 0; k < cols.length; k++) {
      const r = cols[k][i];
      have += ws[k] * coverage(covs[k], r, i);
      sum += ws[k] * Math.log(Math.max(Number.isNaN(r) ? missing_rank : r, floor));
    }
    if (have >= min_weight_with_data) out[i] = Math.exp(sum);
  }
  return out;
}

export interface Picks {
  ids: number[];
  near: number[];
}

const APART_KM = 150;

export function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function top(score: Float32Array, k: number, geo: Cols, keep?: (i: number) => boolean): Picks {
  const order: number[] = [];
  for (let i = 0; i < score.length; i++) if (!Number.isNaN(score[i]) && (!keep || keep(i))) order.push(i);
  order.sort((a, b) => score[b] - score[a] || a - b);
  const ids: number[] = [];
  const near: number[] = [];
  for (const i of order) {
    if (ids.length === k) break;
    const j = ids.findIndex((p) => km(geo.lat[p], geo.lon[p], geo.lat[i], geo.lon[i]) < APART_KM);
    if (j >= 0) near[j]++;
    else {
      ids.push(i);
      near.push(0);
    }
  }
  return { ids, near };
}

export function rankOf(score: Float32Array, i: number): number {
  const s = score[i];
  if (Number.isNaN(s)) return NaN;
  let r = 1;
  for (let j = 0; j < score.length; j++) if (score[j] > s) r++;
  return r;
}

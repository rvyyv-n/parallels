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

export function top(score: Float32Array, k: number, keep?: (i: number) => boolean): number[] {
  const best: number[] = [];
  for (let i = 0; i < score.length; i++) {
    const s = score[i];
    if (Number.isNaN(s) || (keep && !keep(i))) continue;
    if (best.length === k && s <= score[best[k - 1]]) continue;
    let j = best.length < k ? best.length : k - 1;
    while (j > 0 && score[best[j - 1]] < s) {
      best[j] = best[j - 1];
      j--;
    }
    best[j] = i;
  }
  return best;
}

export function rankOf(score: Float32Array, i: number): number {
  const s = score[i];
  if (Number.isNaN(s)) return NaN;
  let r = 1;
  for (let j = 0; j < score.length; j++) if (score[j] > s) r++;
  return r;
}

export interface Zones {
  keep: Uint8Array;
  outline: number[];
}

export interface Geo {
  lat: Float32Array;
  lon: Float32Array;
}

const C = 720;
const R = 360;
const RES = 0.5;

function median3(a: number, b: number, c: number) {
  return a < b ? (b < c ? b : a < c ? c : a) : a < c ? a : b < c ? c : b;
}

function selectDesc(a: Float32Array, lo: number, hi: number, k: number): number {
  while (lo < hi) {
    const p = median3(a[lo], a[(lo + hi) >>> 1], a[hi]);
    let lt = lo;
    let i = lo;
    let gt = hi;
    while (i <= gt) {
      const v = a[i];
      if (v > p) {
        a[i] = a[lt];
        a[lt] = v;
        lt++;
        i++;
      } else if (v < p) {
        a[i] = a[gt];
        a[gt] = v;
        gt--;
      } else {
        i++;
      }
    }
    if (k < lt) hi = lt - 1;
    else if (k > gt) lo = gt + 1;
    else return p;
  }
  return a[lo];
}

export function cut(score: Float32Array, share: number) {
  if (share >= 1) return -Infinity;
  const buf = new Float32Array(score.length);
  let n = 0;
  for (let i = 0; i < score.length; i++) {
    const v = score[i];
    if (Number.isFinite(v)) buf[n++] = v;
  }
  if (!n) return Infinity;
  const k = Math.min(n - 1, Math.max(0, Math.ceil(share * n) - 1));
  return selectDesc(buf, 0, n - 1, k);
}

function trace(on: Uint8Array) {
  const at = (r: number, c: number) => (r >= 0 && r < R ? on[r * C + ((c + C) % C)] : 0);
  const lon = (x: number) => -180 + x * RES;
  const lat = (y: number) => 90 - y * RES;
  const out: number[] = [];
  for (let r = -1; r < R; r++)
    for (let c = 0; c < C; c++) {
      const tl = at(r, c);
      const tr = at(r, c + 1);
      const br = at(r + 1, c + 1);
      const bl = at(r + 1, c);
      if (tl === tr && tr === br && br === bl) continue;
      const x = c + 0.5;
      const y = r + 0.5;
      const mid: [number, number][] = [];
      if (tl !== tr) mid.push([x + 0.5, y]);
      if (tr !== br) mid.push([x + 1, y + 0.5]);
      if (br !== bl) mid.push([x + 0.5, y + 1]);
      if (bl !== tl) mid.push([x, y + 0.5]);
      const pairs = mid.length === 4 ? (tl ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]]) : [[0, 1]];
      for (const [a, b] of pairs) out.push(lon(mid[a][0]), lat(mid[a][1]), lon(mid[b][0]), lat(mid[b][1]));
    }
  return out;
}

export function focus(score: Float32Array, share: number, geo?: Geo): Zones {
  const keep = new Uint8Array(score.length);
  const t = cut(score, share);
  for (let i = 0; i < score.length; i++) if (score[i] >= t) keep[i] = 1;
  if (!geo || share >= 1) return { keep, outline: [] };
  const on = new Uint8Array(R * C);
  for (let i = 0; i < score.length; i++) {
    if (!keep[i]) continue;
    const r = Math.floor((90 - geo.lat[i]) / RES);
    const c = Math.floor((geo.lon[i] + 180) / RES);
    if (r >= 0 && r < R && c >= 0 && c < C) on[r * C + c] = 1;
  }
  return { keep, outline: trace(on) };
}

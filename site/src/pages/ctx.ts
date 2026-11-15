import type { Body, LabelPoint, Manifest, Target, Validation } from "../contract";
import { BASE, load, loadLabels, loadValidation, targetCols, type Cols, type Data } from "../data";
import { handScore } from "../score";

export interface State {
  target: string;
  filter: string;
  yr: boolean;
  type: number | null;
  hand: Record<string, number> | null;
  cell: number;
  known: boolean;
  cmp: number[];
}

export interface Ctx {
  m: Manifest;
  data(): Promise<Data>;
  ranges(): Promise<Map<string, [number, number]>>;
  labels(): Promise<LabelPoint[]>;
  validation(): Promise<Validation | null>;
  cols(t: Target): Promise<Cols>;
  site(t: Target | null): void;
}

const once = <T>(f: () => Promise<T>) => {
  let p: Promise<T> | null = null;
  return () =>
    (p ??= f().catch((e) => {
      p = null;
      throw e;
    }));
};

function ranges(d: Data) {
  const out = new Map<string, [number, number]>();
  for (const t of d.m.traits)
    for (const col of Object.values(t.column)) {
      if (!col || out.has(col) || !d.cells[col]) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of d.cells[col]) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      out.set(col, [lo, hi]);
    }
  return out;
}

export function createCtx(m: Manifest, site: (t: Target | null) => void): Ctx {
  const data = once(() => load(m));
  return {
    m,
    data,
    ranges: once(async () => ranges(await data())),
    labels: once(() => loadLabels().catch(() => [])),
    validation: once(() => loadValidation().catch(() => null)),
    cols: (t) => targetCols(BASE, t),
    site,
  };
}

export const home = (m: Manifest, b: Body) => m.targets.find((t) => t.body === b && t.default) ?? m.targets.find((t) => t.body === b);

export function readState(m: Manifest, q: URLSearchParams): State {
  const target = m.targets.find((t) => t.id === q.get("t"))?.id ?? (m.targets.find((t) => t.default) ?? m.targets[0]).id;
  const filter = m.filters.find((f) => f.id === q.get("f"))?.id ?? (m.filters.find((f) => f.id === "balanced") ?? m.filters[0]).id;
  const type = q.get("type") != null && m.terrain_types.some((t) => String(t.id) === q.get("type")) ? Number(q.get("type")) : null;
  const w = q.get("w");
  const hand = w
    ? Object.fromEntries(
        w.split(",").map((p) => {
          const [k, v] = p.split(":");
          return [k, Math.max(0, Math.min(5, Number(v) || 0))];
        }),
      )
    : null;
  const c = Number(q.get("c"));
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v < m.grid.n;
  const cmp = [...new Set((q.get("cmp") ?? "").split(",").filter(Boolean).map(Number))].filter(ok).slice(0, 3);
  return { target, filter, yr: q.get("yr") === "1", type, hand, cell: q.has("c") && ok(c) ? c : -1, known: q.get("known") === "1", cmp };
}

export function query(s: State, cell = s.cell) {
  const q = new URLSearchParams();
  q.set("t", s.target);
  q.set("f", s.filter);
  if (s.yr) q.set("yr", "1");
  if (s.type != null) q.set("type", String(s.type));
  if (s.hand) q.set("w", Object.entries(s.hand).map(([k, v]) => `${k}:${Math.round(v * 100) / 100}`).join(","));
  if (s.known) q.set("known", "1");
  if (s.cmp.length) q.set("cmp", s.cmp.join(","));
  if (cell >= 0) q.set("c", String(cell));
  return q.toString();
}

export const targetOf = (m: Manifest, s: State) => m.targets.find((t) => t.id === s.target)!;
export const filterOf = (m: Manifest, s: State) => m.filters.find((f) => f.id === s.filter)!;
export const weightsOf = (m: Manifest, s: State) => s.hand ?? filterOf(m, s).weights[targetOf(m, s).body] ?? {};

export const scoreOf = (m: Manifest, cols: Cols, s: State, n: number) =>
  s.hand ? handScore(m, cols, s.hand, n) : (cols[`score:${s.filter}${s.yr ? ":yr" : ""}`] ?? new Float32Array(n).fill(NaN));

export const rankedOf = (score: Float32Array) => {
  let n = 0;
  for (const v of score) if (!Number.isNaN(v)) n++;
  return n;
};

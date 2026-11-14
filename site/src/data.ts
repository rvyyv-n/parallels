import type { BinFile, Column, LabelPoint, Manifest, Target, Validation } from "./contract";

export type Cols = Record<string, Float32Array>;

export interface Data {
  m: Manifest;
  n: number;
  cells: Cols;
  labels: LabelPoint[];
  validation: Validation | null;
  base: string;
}

const READ = {
  u8: (v: DataView, o: number) => v.getUint8(o),
  u16: (v: DataView, o: number) => v.getUint16(o, true),
  i16: (v: DataView, o: number) => v.getInt16(o, true),
  f32: (v: DataView, o: number) => v.getFloat32(o, true),
};
const SIZE = { u8: 1, u16: 2, i16: 2, f32: 4 };

function defaults(c: Column): Column {
  if (c.id.startsWith("rank:") || c.id.startsWith("ch:")) return { scale: 1 / 250, nodata: 255, ...c };
  if (c.id.startsWith("score:")) return { scale: 1 / 10000, nodata: 65535, ...c };
  if (c.id.startsWith("cov:")) return { scale: 1 / 100, nodata: 255, ...c };
  return c;
}

export function decode(buf: ArrayBuffer, bin: BinFile, target = false): Cols {
  const view = new DataView(buf);
  const out: Cols = {};
  for (const raw of bin.columns) {
    const c = target ? defaults(raw) : raw;
    const a = new Float32Array(bin.n);
    const read = READ[c.dtype];
    const size = SIZE[c.dtype];
    const scale = c.scale ?? 1;
    const add = c.add ?? 0;
    for (let i = 0; i < bin.n; i++) {
      const r = read(view, c.offset + i * size);
      a[i] = r === c.nodata || Number.isNaN(r) ? NaN : r * scale + add;
    }
    out[c.id] = a;
  }
  return out;
}

async function bytes(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.arrayBuffer();
}

async function json<T>(url: string): Promise<T | null> {
  const r = await fetch(url);
  return r.ok ? r.json() : null;
}

export async function load(base = `${import.meta.env.BASE_URL}data/`): Promise<Data> {
  const m = await json<Manifest>(`${base}manifest.json`);
  if (!m) throw new Error("manifest.json is missing");
  const [cells, labels, validation] = await Promise.all([
    bytes(base + m.grid.file).then((b) => decode(b, m.grid)),
    json<LabelPoint[]>(`${base}labels.json`),
    json<Validation>(`${base}validation.json`),
  ]);
  return { m, n: m.grid.n, cells, labels: labels ?? [], validation, base };
}

const cache = new Map<string, Promise<Cols>>();

export function targetCols(d: Data, t: Target): Promise<Cols> {
  if (!cache.has(t.id)) cache.set(t.id, bytes(d.base + t.bin.file).then((b) => decode(b, t.bin, true)));
  return cache.get(t.id)!;
}

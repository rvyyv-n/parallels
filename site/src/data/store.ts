import type { BinFile, Column } from "../../../dataset/contract";
import { bytesPer, decode, typed, type Raw } from "./bin";

export interface Source {
  bytes(file: string, offset: number, length: number): Promise<ArrayBuffer>;
}

export function httpSource(base: string): Source {
  const whole = new Map<string, Promise<ArrayBuffer>>();
  const ask = (file: string, offset: number, length: number, cache: RequestCache) =>
    fetch(base + file, { headers: { Range: `bytes=${offset}-${offset + length - 1}` }, cache });
  return {
    async bytes(file, offset, length) {
      const full = whole.get(file);
      if (full) return (await full).slice(offset, offset + length);
      let res = await ask(file, offset, length, "default");
      for (let again = 0; ; again++) {
        if (!res.ok) throw new Error(`${file}: ${res.status}`);
        if (res.status !== 206) break;
        const part = await res.arrayBuffer();
        if (part.byteLength === length) return part;
        if (again) throw new Error(`${file}: asked for ${length} bytes, got ${part.byteLength}`);
        res = await ask(file, offset, length, "no-store");
      }
      const all = res.arrayBuffer();
      whole.set(file, all);
      return (await all).slice(offset, offset + length);
    },
  };
}

export class Store {
  private columns = new Map<string, Promise<Raw>>();
  private loaded = new Map<string, Raw>();

  constructor(private source: Source) {}

  private spec(bin: BinFile, id: string): Column {
    const c = bin.columns.find((c) => c.id === id);
    if (!c) throw new Error(`${bin.file} has no column ${id}`);
    return c;
  }

  has(bin: BinFile, id: string) {
    return bin.columns.some((c) => c.id === id);
  }

  column(bin: BinFile, id: string): Promise<Raw> {
    const key = `${bin.file}#${id}`;
    let p = this.columns.get(key);
    if (!p) {
      const c = this.spec(bin, id);
      p = this.source.bytes(bin.file, c.offset, bin.n * bytesPer(c)).then((b) => {
        const raw = typed(b, c);
        this.loaded.set(key, raw);
        return raw;
      });
      this.columns.set(key, p);
    }
    return p;
  }

  async cell(bin: BinFile, ids: string[], cell: number): Promise<Record<string, number | null>> {
    const out: Record<string, number | null> = {};
    await Promise.all(
      ids.map(async (id) => {
        const c = this.spec(bin, id);
        const whole = this.loaded.get(`${bin.file}#${id}`);
        const raw = whole
          ? whole[cell]
          : typed(await this.source.bytes(bin.file, c.offset + cell * bytesPer(c), bytesPer(c)), c)[0];
        out[id] = decode(raw, c);
      }),
    );
    return out;
  }
}

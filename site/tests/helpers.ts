import fs from "node:fs";
import path from "node:path";
import type { Manifest } from "../src/contract";
import { decode } from "../src/data";

const dir = path.join(import.meta.dirname, "..", "public", "data");

export const manifest = (): Manifest => JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));

const buf = (f: string) => {
  const b = fs.readFileSync(path.join(dir, f));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

export function cols(m: Manifest, target: string) {
  const t = m.targets.find((x) => x.id === target)!;
  return { cells: decode(buf(m.grid.file), m.grid), t: decode(buf(t.bin.file), t.bin, true), target: t };
}

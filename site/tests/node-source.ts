import { open, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "../../dataset/contract";
import type { Source } from "../src/data/store";

export const dataDir = join(import.meta.dirname, "..", "..", "dataset");

export const nodeSource: Source = {
  async bytes(file, offset, length) {
    const f = await open(join(dataDir, file));
    try {
      const buf = Buffer.alloc(length);
      await f.read(buf, 0, length, offset);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + length);
    } finally {
      await f.close();
    }
  },
};

export const readJson = async <T>(name: string): Promise<T> => JSON.parse(await readFile(join(dataDir, name), "utf8"));

export const readManifest = () => readJson<Manifest>("manifest.json");

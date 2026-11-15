import { afterEach, expect, test, vi } from "vitest";
import { httpSource } from "../src/data/store";

const part = (bytes: number[]) => new Response(new Uint8Array(bytes), { status: 206 });

afterEach(() => vi.unstubAllGlobals());

test("a slice that comes back short is fetched again without the cache", async () => {
  const fetched = vi.fn().mockResolvedValueOnce(part([])).mockResolvedValueOnce(part([7, 8, 9]));
  vi.stubGlobal("fetch", fetched);
  const got = await httpSource("/data/").bytes("cells.bin", 4, 3);
  expect([...new Uint8Array(got)]).toEqual([7, 8, 9]);
  expect(fetched.mock.calls.map(([, init]) => [init.headers.Range, init.cache])).toEqual([
    ["bytes=4-6", "default"],
    ["bytes=4-6", "no-store"],
  ]);
});

test("a slice that stays short is an error, not wrong data", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => part([1])));
  await expect(httpSource("/data/").bytes("cells.bin", 0, 2)).rejects.toThrow("asked for 2 bytes, got 1");
});

test("a server without byte ranges sends the whole file once", async () => {
  const fetched = vi.fn().mockImplementation(async () => new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), { status: 200 }));
  vi.stubGlobal("fetch", fetched);
  const source = httpSource("/data/");
  expect([...new Uint8Array(await source.bytes("cells.bin", 2, 2))]).toEqual([2, 3]);
  expect([...new Uint8Array(await source.bytes("cells.bin", 4, 2))]).toEqual([4, 5]);
  expect(fetched).toHaveBeenCalledTimes(1);
});

import { describe, expect, it } from "vitest";
import { blankShare, box, decode, MIN_SAMPLES, terrarium, tilesFor, TILE, type Box } from "../src/terrain/tiles";

const ground = (b: Box) => b.n * b.metres;

function covers(b: Box) {
  const tiles = tilesFor(b);
  expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
  expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(0);
  expect(Math.max(...tiles.map((t) => t.left))).toBeGreaterThan(b.n - TILE - 1);
  expect(Math.max(...tiles.map((t) => t.top))).toBeGreaterThan(b.n - TILE - 1);
  return tiles.map((t) => [t.z, t.x, t.y]);
}

describe("the box", () => {
  it("near the equator", () => {
    const b = box(0.25, 10.25)!;
    expect(b.z).toBe(10);
    expect(b.n).toBeGreaterThanOrEqual(MIN_SAMPLES);
    expect(ground(b)).toBeCloseTo(50_000, -3);
    expect(covers(b)).toEqual([
      [10, 540, 510],
      [10, 541, 510],
      [10, 540, 511],
      [10, 541, 511],
    ]);
  });

  it("at high latitude, where tiles stretch", () => {
    const b = box(78.25, 15.75)!;
    expect(b.z).toBe(7);
    expect(b.n).toBeGreaterThanOrEqual(MIN_SAMPLES);
    expect(ground(b)).toBeCloseTo(50_000, -3);
    expect(covers(b)).toEqual([
      [7, 69, 17],
      [7, 69, 18],
    ]);
  });

  it("across the date line", () => {
    const b = box(-16.75, 179.9)!;
    expect(b.z).toBe(10);
    expect(ground(b)).toBeCloseTo(50_000, -3);
    const tiles = covers(b);
    expect(tiles.map(([, x]) => x)).toEqual([1023, 0, 1023, 0, 1023, 0]);
    expect(new Set(tiles.map(([, , y]) => y)).size).toBe(3);
  });

  it("next to the date line, without crossing it", () => {
    const b = box(-16.75, 179.75)!;
    expect(new Set(tilesFor(b).map((t) => t.x))).toEqual(new Set([1022, 1023]));
  });

  it("imagery tiles cover the same ground two zoom levels deeper", () => {
    const b = box(28.25, 61.75)!;
    const tiles = tilesFor(b, b.z + 2);
    expect(new Set(tiles.map((t) => t.z))).toEqual(new Set([b.z + 2]));
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.left)) + TILE).toBeGreaterThanOrEqual(b.n * 4);
  });

  it("stops where the tiles end", () => {
    expect(box(85.5, 0)).toBeUndefined();
    expect(box(-89.75, 120)).toBeUndefined();
    expect(box(-85.0, 120)).toBeUndefined();
    expect(box(84.0, 0)).toBeDefined();
  });
});

describe("Terrarium heights", () => {
  it("decodes known pixels", () => {
    expect(terrarium(128, 0, 0)).toBe(0);
    expect(terrarium(0, 0, 0)).toBe(-32768);
    expect(terrarium(130, 92, 128)).toBe(604.5);
    expect(terrarium(162, 144, 0)).toBe(8848);
    expect(terrarium(126, 214, 0)).toBe(-298);
  });

  it("reads a grid with its lowest and highest point", () => {
    const h = decode([128, 0, 0, 255, 130, 92, 128, 255, 126, 214, 0, 255, 162, 144, 0, 255], 2, 100);
    expect([...h.data]).toEqual([0, 604.5, -298, 8848]);
    expect(h.min).toBe(-298);
    expect(h.max).toBe(8848);
  });
});

describe("empty tiles", () => {
  const fill = (rgba: number[]) => Array.from({ length: 256 * 4 }, (_, i) => rgba[i % 4]);
  it("spots no-data black and transparent tiles", () => {
    expect(blankShare(fill([0, 0, 0, 255]))).toBe(1);
    expect(blankShare(fill([255, 255, 255, 0]))).toBe(1);
    expect(blankShare(fill([240, 240, 245, 255]))).toBe(0);
    expect(blankShare(fill([150, 120, 90, 255]))).toBe(0);
  });
});

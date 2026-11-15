import { test, type Page } from "@playwright/test";
import { crc32, deflateSync } from "node:zlib";
import { expect, expectedView, manifest, ready } from "./helpers";

test.describe.configure({ timeout: 90_000 });
test.use({ reducedMotion: "reduce" });

const TILES = /s3\.amazonaws\.com\/elevation-tiles-prod|gibs\.earthdata\.nasa\.gov|tiles\.maps\.eox\.at/;
const LOW = 300;
const HIGH = 930;

function png(pixel: (x: number, y: number) => number[]) {
  const rows = Buffer.alloc(256 * (1 + 256 * 3));
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) rows.set(pixel(x, y), y * (1 + 256 * 3) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(256, 0);
  head.writeUInt32BE(256, 4);
  head.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

const ridges = png((x) => {
  const v = Math.round((LOW + HIGH) / 2 + ((HIGH - LOW) / 2) * Math.sin((x / 64) * 2 * Math.PI)) + 32768;
  return [v >> 8, v & 255, 0];
});
const ground = png((x, y) => [150 + (x >> 3), 120 + (y >> 4), 90]);

async function serveTiles(page: Page) {
  const asked: string[] = [];
  await page.route(TILES, (route) => {
    const url = route.request().url();
    asked.push(url);
    return route.fulfill({
      body: url.includes("terrarium") ? ridges : ground,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return asked;
}

async function open(page: Page, hash = "") {
  await ready(page, hash);
  await page.locator("#test").scrollIntoViewIfNeeded();
  const button = page.getByTestId("terrain-open");
  await button.click();
  return button;
}

for (const targetId of ["moon-south-pole", "mars-jezero"]) {
  test(`the 3D close-up opens for ${targetId}'s best place`, async ({ page }) => {
    const target = manifest.targets.find((t) => t.id === targetId)!;
    const want = await expectedView(targetId, manifest.filters[0].id);
    const name = want.region!.slice(0, want.region!.lastIndexOf(", "));
    const asked = await serveTiles(page);
    const button = await open(page, targetId === "moon-south-pole" ? "" : `#t=${targetId}`);

    const dialog = page.getByRole("dialog", { name: new RegExp(name) });
    await expect(dialog).toHaveAttribute("data-state", "ready");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toContainText(`Lowest ${LOW} m · Highest ${HIGH} m · Heights stretched ×2`);
    await expect(dialog).toContainText("Not a picture of the Moon or Mars");
    await expect(page.getByTestId("terrain-credit")).toContainText("Terrain Tiles on AWS Open Data");
    await expect(page.getByTestId("terrain-credit")).toContainText("NASA GIBS, Landsat WELD");
    expect(new Set(asked).size).toBe(asked.length);
    expect(asked.some((u) => u.includes("gibs"))).toBe(true);
    expect(asked.some((u) => u.includes("eox"))).toBe(false);

    const canvas = page.locator(".terrain-canvas");
    const sun = page.getByTestId("terrain-sun");
    await sun.fill("60");
    await expect(page.locator("label[for=terrain-sun]")).toHaveText("Sun height 60°");
    await page.waitForTimeout(300);
    const high = await canvas.screenshot();
    await sun.focus();
    for (let i = 0; i < 100; i++) await page.keyboard.press("ArrowLeft");
    await expect(page.locator("label[for=terrain-sun]")).toHaveText("Sun height 10°");
    await expect.poll(async () => (await canvas.screenshot()).equals(high)).toBe(false);

    const pole = page.getByTestId("terrain-pole");
    const value = target.values.sun_height?.value ?? null;
    if (value === null) await expect(pole).toHaveCount(0);
    else {
      await expect(pole).toContainText(`${value}°`);
      if (target.body === "moon") await expect(pole).toContainText("South pole light");
      await pole.click();
      await expect(page.locator("label[for=terrain-sun]")).toHaveText(`Sun height ${value}°`);
      await expect(pole).toHaveAttribute("aria-pressed", "true");
      await expect(dialog).toContainText(target.values.sun_height.stat);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("terrain")).toHaveCount(0);
    await expect(button).toBeFocused();
    await expect(page.locator("ol.runners .terrain").first()).toHaveCSS("position", "static");
  });
}

test("the image falls back to Sentinel-2 cloudless when NASA GIBS fails", async ({ page }) => {
  const asked = await serveTiles(page);
  await page.route(/gibs\.earthdata\.nasa\.gov/, (route) => route.fulfill({ status: 500 }));
  await open(page);
  await expect(page.getByTestId("terrain")).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("terrain-credit")).toContainText("Sentinel-2 cloudless 2016 by EOX");
  await expect(page.getByTestId("terrain-credit")).not.toContainText("GIBS");
  expect(asked.some((u) => u.includes("eox"))).toBe(true);
});

test("the close-up says so when the tile servers are blocked", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));
  await page.route(TILES, (route) => route.abort());
  const button = await open(page);

  await expect(page.getByTestId("terrain")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("terrain-error")).toContainText("We could not load the map tiles for this place");
  await expect(page.getByTestId("terrain-close")).toBeFocused();
  await page.getByTestId("terrain-close").click();
  await expect(page.getByTestId("terrain")).toHaveCount(0);
  await expect(button).toBeFocused();

  await page.locator('[data-chapter="find"]').scrollIntoViewIfNeeded();
  const second = page.locator("ol.runners li button").nth(1);
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("the close-up fits a 390 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await serveTiles(page);
  await open(page);
  await expect(page.getByTestId("terrain")).toHaveAttribute("data-state", "ready");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const id of ["terrain-close", "terrain-sun", "terrain-pole", "terrain-credit"]) {
    const b = (await page.getByTestId(id).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390);
    expect(b.y + b.height).toBeLessThanOrEqual(844);
  }
});

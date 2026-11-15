import { test, type Page } from "@playwright/test";
import type { LabelPoint } from "../../dataset/contract";
import { buildMatch, formatValue, gridColumns, targetColumns } from "../src/data/match";
import { distinctPlaces } from "../src/data/places";
import { analogsOf, baseTarget, gravity, MONTH_COLUMNS, monthState, placeMonths, tempPairs, type World } from "../src/learn/learn";
import loads from "../src/learn/loads.json" with { type: "json" };
import photos from "../src/learn/photos.json" with { type: "json" };
import { readJson } from "../tests/node-source";
import { expect, manifest, store } from "./helpers";

test.describe.configure({ timeout: 60_000 });

const labels = await readJson<LabelPoint[]>("labels.json");
const SECTIONS = ["learn-meet", "learn-temps", "learn-year", "learn-cant", "learn-analogs", "learn-photos"];
const FIND: Record<World, string> = { moon: "./", mars: "./#t=mars-jezero" };

async function expected(world: World) {
  const target = baseTarget(manifest, world);
  const filter = manifest.filters[0];
  const [score, lat, lon, region] = await Promise.all([
    store.column(target.bin, `score:${filter.id}`),
    store.column(manifest.grid, "lat"),
    store.column(manifest.grid, "lon"),
    store.column(manifest.grid, "region"),
  ]);
  const places = distinctPlaces({ score, lat, lon, region, regions: manifest.regions });
  const [grid, ranks] = await Promise.all([
    store.cell(manifest.grid, gridColumns(manifest, target), places[0].cell),
    store.cell(target.bin, targetColumns(manifest, target, filter), places[0].cell),
  ]);
  const match = buildMatch(manifest, target, filter, places[0].cell, grid, ranks);
  const months = await Promise.all(places.map((p) => store.cell(manifest.grid, MONTH_COLUMNS, p.cell).then(placeMonths)));
  return { target, places, pairs: tempPairs(manifest, target, match), months };
}

async function open(page: Page, world: World) {
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.goto(`/learn.html?world=${world}`);
  await page.locator('[data-testid="year-place"]').first().waitFor({ state: "attached" });
  await page.locator('[data-testid="temp-world"]').waitFor({ state: "attached" });
  await page.locator('[data-testid="analog-card"]').waitFor({ state: "attached" });
  return problems;
}

const states = (page: Page) =>
  page.locator('[data-testid="year-place"]').evaluateAll((els) =>
    els.map((el) => ({ best: el.dataset.best === "true", freeze: el.dataset.freeze === "true", rain: el.dataset.rain === "true" })),
  );

for (const world of ["moon", "mars"] as World[]) {
  test.describe(`learn page: ${world}`, () => {
    test("loads with every section, no errors, and links back to the main page", async ({ page }) => {
      const problems = await open(page, world);
      for (const id of SECTIONS) await expect(page.getByTestId(id)).toHaveCount(1);
      await expect(page.getByTestId("learn-find")).toHaveAttribute("href", FIND[world]);
      await expect(page.locator(".learn-top .wordmark")).toHaveAttribute("href", "./");
      expect(problems).toEqual([]);
    });

    test("temperatures on screen are the data's own values", async ({ page }) => {
      const { pairs } = await expected(world);
      await open(page, world);
      const switches = page.locator(".learn-temps .learn-switch .chip");
      await expect(switches).toHaveCount(pairs.length);
      for (const [k, pair] of pairs.entries()) {
        await switches.nth(k).click();
        const digits = { ...pair.row.trait, digits: 1 };
        const kelvin = pair.world.kelvin === null ? "" : ` (${pair.world.kelvin} K)`;
        await expect(page.getByTestId("temp-world")).toHaveText(formatValue(pair.world.value, digits) + kelvin);
        await expect(page.getByTestId("temp-earth")).toHaveText(formatValue(pair.earth.value, digits));
      }
    });

    test("the month slider shows each place's month masks", async ({ page }) => {
      const { months } = await expected(world);
      await open(page, world);
      const slider = page.locator("#learn-month");
      await slider.focus();
      await page.keyboard.press("Home");
      const seen = new Set<string>();
      for (let m = 0; m < 12; m++) {
        if (m > 0) await page.keyboard.press("ArrowRight");
        await expect(slider).toHaveValue(String(m));
        const shown = await states(page);
        expect(shown).toEqual(months.map((mask) => monthState(mask, m)));
        seen.add(JSON.stringify(shown));
      }
      expect(seen.size).toBeGreaterThan(1);
    });

    test("weight is mass times the manifest's gravity", async ({ page }) => {
      await open(page, world);
      const g = gravity(manifest);
      const rover = loads.find((l) => l.id === "rover")!;
      await page.locator(".learn-cant .chip", { hasText: rover.short }).click();
      const n = Math.round(rover.mass_kg * g[world]).toLocaleString("en");
      await expect(page.getByTestId(`weight-${world}`)).toHaveText(`${rover.mass_kg.toLocaleString("en")} kg × ${g[world]} m/s² = ${n} N`);
      await expect(page.locator(".learn-load a")).toHaveAttribute("href", rover.url);
    });

    test("choosing a known analog shows its name and source", async ({ page }) => {
      await open(page, world);
      const points = analogsOf(labels, world);
      await expect(page.locator(".learn-pin")).toHaveCount(points.length);
      const point = points.at(-1)!;
      await page.locator(`.learn-pin[data-id="${point.id}"]`).click();
      const card = page.getByTestId("analog-card");
      await expect(card.locator("h3")).toHaveText(point.name);
      await expect(card.locator("a")).toHaveAttribute("href", point.analog_source ?? point.source);
      const other = points[0];
      await page.locator(`.learn-pin[data-id="${other.id}"]`).focus();
      await page.keyboard.press("Enter");
      await expect(card.locator("h3")).toHaveText(other.name);
    });

    test("the eight photos come from the site itself", async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const outside: string[] = [];
      page.on("request", (r) => {
        if (!r.url().startsWith(origin) && !r.url().startsWith("data:")) outside.push(r.url());
      });
      await open(page, world);
      const imgs = page.locator(".learn-photos img");
      await expect(imgs).toHaveCount(8);
      for (const img of await imgs.all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
      }
      const srcs = await imgs.evaluateAll((els) => els.map((el) => (el as HTMLImageElement).src));
      expect(srcs.map((s) => new URL(s).pathname.split("/").pop())).toEqual(photos.flatMap((p) => p.photos.map((x) => x.file)));
      expect(srcs.every((s) => s.startsWith(origin))).toBe(true);
      expect(outside).toEqual([]);
    });
  });
}

test("no sideways scroll at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const world of ["moon", "mars"] as World[]) {
    await open(page, world);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});

test("nothing moves under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "moon");
  await expect(page.locator(".learn-globe")).toHaveCSS("animation-name", "none");
  await page.locator(".learn-temps .learn-switch .chip").nth(1).click();
  await page.locator(".learn-cant .chip").nth(2).click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("the globe turns when motion is allowed", async ({ page }) => {
  await open(page, "mars");
  await expect(page.locator(".learn-globe")).toHaveCSS("animation-name", "learn-spin");
});

import { test, type Page } from "@playwright/test";
import { bestPerChallenge } from "../src/data/base";
import { formatValue } from "../src/data/match";
import { distinctPlaces } from "../src/data/places";
import { expect, manifest, ready, store, words } from "./helpers";

test.describe.configure({ timeout: 90_000 });

function nameOf(region: string | null) {
  if (!region) return "Unnamed land";
  const cut = region.lastIndexOf(", ");
  return cut < 0 ? region : region.slice(0, cut);
}

async function fiveBest(targetId: string) {
  const target = manifest.targets.find((t) => t.id === targetId)!;
  const [score, lat, lon, region] = await Promise.all([
    store.column(target.bin, `score:${manifest.filters[0].id}`),
    store.column(manifest.grid, "lat"),
    store.column(manifest.grid, "lon"),
    store.column(manifest.grid, "region"),
  ]);
  return distinctPlaces({ score, lat, lon, region, regions: manifest.regions }).map((p) => p.cell);
}

async function toBase(page: Page, hash = "") {
  await ready(page, hash);
  const base = page.locator("#base");
  await base.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-testid="base-part"]').first()).toBeVisible();
  return base;
}

for (const [targetId, hash] of [
  ["moon-south-pole", ""],
  ["mars-jezero", "#t=mars-jezero"],
]) {
  test(`${targetId}: each part shows its best place and the trait that matches best`, async ({ page }) => {
    const target = manifest.targets.find((t) => t.id === targetId)!;
    const plan = await bestPerChallenge(store, manifest, target);
    await toBase(page, hash);
    const parts = page.locator('[data-testid="base-part"]');
    await expect(parts).toHaveCount(plan.places.reduce((n, p) => n + p.parts.length, 0));
    for (const place of plan.places) {
      const row = page.locator(".base-place", { has: page.locator(`[data-cell="${place.cell}"]`) });
      await expect(row.locator(".base-n")).toHaveText(String(place.n));
      await expect(row.locator(".base-name")).toHaveText(nameOf(place.region));
      for (const part of place.parts) {
        const line = page.locator(`[data-testid="base-part"][data-part="${part.challenge.id}"]`);
        await expect(line).toHaveAttribute("data-cell", String(place.cell));
        await expect(line).toContainText(part.challenge.name);
        if (part.best) {
          await expect(line).toContainText(part.best.trait.label);
          await expect(line.locator(".base-v")).toHaveText(
            `${formatValue(part.best.earth, part.best.trait)}=${formatValue(part.best.target.value, part.best.trait)}`,
          );
        }
      }
    }
    const unscored = page.locator('[data-testid="base-unscored"]');
    await expect(unscored).not.toHaveAttribute("open");
    await expect(unscored.locator("summary")).toContainText(`Parts we could not score (${plan.unscored.length})`);
    for (const c of plan.unscored) await expect(unscored.locator("li", { hasText: c.name })).toHaveCount(1);
  });

  test(`${targetId}: choosing a part opens its place above`, async ({ page }) => {
    const target = manifest.targets.find((t) => t.id === targetId)!;
    const plan = await bestPerChallenge(store, manifest, target);
    const five = await fiveBest(targetId);
    await toBase(page, hash);
    const place = plan.places.find((p) => !five.includes(p.cell)) ?? plan.places[0];
    const button = page.locator(".base-place", { has: page.locator(`[data-cell="${place.cell}"]`) });
    await button.click();
    const card = page.locator('[data-testid="feature"]');
    await expect(card.locator(".place-name")).toHaveText(nameOf(place.region));
    if (!five.includes(place.cell)) {
      await expect(card.locator(".kicker")).toHaveText(
        `Best place on Earth for ${place.parts
          .map((p) => p.challenge.name)
          .join(" and ")
          .toLowerCase()}`,
      );
    }
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('.base-place[aria-pressed="true"]')).toHaveCount(1);
  });
}

test("the chapter stays within 95 words", async ({ page }) => {
  for (const hash of ["", "#t=mars-jezero", "#t=mars-arcadia-planitia"]) {
    const base = await toBase(page, hash);
    const count = words(await base.evaluate((e) => (e as HTMLElement).innerText));
    console.log(`WORDS base ${hash || "default"} ${count}`);
    expect(count, hash).toBeLessThanOrEqual(95);
  }
});

test("no sideways scroll at 390 px, and every row can be reached by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const hash of ["", "#t=mars-jezero"]) {
    const base = await toBase(page, hash);
    const right = await base.evaluate((b) => Math.max(...[...b.querySelectorAll("*")].map((e) => e.getBoundingClientRect().right)));
    expect(right, hash).toBeLessThanOrEqual(390);
  }
  await page.locator(".base-place").first().focus();
  const buttons = page.locator(".base-place");
  for (let i = 1; i < (await buttons.count()); i++) {
    await page.keyboard.press("Tab");
    await expect(buttons.nth(i)).toBeFocused();
  }
});

import { test, type Page } from "@playwright/test";
import { CHAPTERS, loaded, manifest, ready, shortName, words, expect } from "./helpers";

test.describe.configure({ timeout: 90_000 });

const text = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText).join(" "));

const siteChip = (page: Page, name: string) =>
  page.locator('[role="group"][aria-label="Base site"] button.chip', { hasText: name }).first();
const filterChip = (page: Page, name: string) =>
  page.locator('[role="group"][aria-label="What to practise"] button.chip', { hasText: name }).first();

test("word budgets", async ({ page }) => {
  await loaded(page);
  const first = words(await text(page, 'header.top, [data-chapter="intro"]'));
  await ready(page);
  const card = words(await text(page, '[data-testid="feature"]'));
  const body = words(
    await page.evaluate(() => {
      const copy = document.body.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("script, style, details:not([open]) > :not(summary)").forEach((n) => n.remove());
      return copy.textContent ?? "";
    }),
  );
  const visible = words(await text(page, "body"));
  console.log(`WORDS first screen ${first}, card ${card}, page ${body} (innerText of the visible chapter only: ${visible})`);
  expect(first, "first screen").toBeLessThanOrEqual(120);
  expect(card, "collapsed match card").toBeLessThanOrEqual(60);
  expect(body, "whole main page").toBeLessThanOrEqual(900);
});

for (const target of manifest.targets) {
  for (const filter of manifest.filters) {
    test(`two clicks: ${target.id} + ${filter.id}`, async ({ page }) => {
      await ready(page);
      await siteChip(page, shortName(target.name)).click();
      await filterChip(page, filter.name).click();
      await expect(page.locator('[data-testid="feature"] .kicker')).toContainText(filter.name.toLowerCase());
      await expect(page.locator('[data-testid="feature"] table.pairs')).toBeVisible();
      await expect(page.locator('.pairs-box[aria-busy="false"]')).toBeVisible();
      const hash = new URLSearchParams(new URL(page.url()).hash.slice(1));
      expect(hash.get("t") ?? manifest.targets[0].id).toBe(target.id);
      expect(hash.get("f") ?? manifest.filters[0].id).toBe(filter.id);
    });
  }
}

for (const hash of ["", "#t=mars-jezero", "#t=mars-jezero&f=life_support", "#t=mars-gale&f=habitat"]) {
  test(`no sideways scroll at 390 px: ${hash || "default view"}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, hash);
    for (const more of await page.locator("button.more").all()) await more.click();
    for (const id of [...CHAPTERS, "base", "checked"]) {
      const selector = id === "checked" ? "#checked" : `[data-chapter="${id}"]`;
      await page.locator(selector).scrollIntoViewIfNeeded();
      const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      expect(widths.scroll, id).toBeLessThanOrEqual(widths.inner);
    }
  });
}

test("reduced motion: nothing animates and the first screen is still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loaded(page);
  await page.waitForLoadState("networkidle");
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  const first = await page.screenshot();
  await page.waitForTimeout(1000);
  const second = await page.screenshot();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(second.equals(first)).toBe(true);
});

test("a copied address reopens the same view", async ({ page, context }) => {
  await ready(page);
  const site = manifest.targets.find((t) => t.id !== manifest.targets[0].id)!;
  const filter = manifest.filters[1];
  await siteChip(page, shortName(site.name)).click();
  await filterChip(page, filter.name).click();
  await expect(page.locator('[data-testid="feature"] .kicker')).toContainText(filter.name.toLowerCase());
  const third = page.locator("ol.runners li button").nth(2);
  await third.click();
  await expect(third).toHaveAttribute("aria-pressed", "true");
  const href = page.url();
  expect(href).toContain("p=");

  const list = (p: Page) =>
    p.locator("ol.runners li").evaluateAll((lis) => lis.map((li) => [li.textContent, li.querySelector("button")!.getAttribute("aria-pressed")]));
  const before = await list(page);

  const other = await context.newPage();
  await other.goto(href);
  await expect(other.locator("ol.runners li")).toHaveCount(before.length);
  await expect(other.locator("ol.runners li button").nth(2)).toHaveAttribute("aria-pressed", "true");
  expect(await list(other)).toEqual(before);
  await expect(other.locator('[data-testid="feature"] .kicker')).toContainText(filter.name.toLowerCase());
});

test("terrain and year-round are kept in a copied address", async ({ page, context }) => {
  const salt = manifest.terrain_types.find((t) => t.key === "salt_flat")!;
  await ready(page);
  await page.locator(".refine summary").click();
  await page.locator('[role="group"][aria-label="Terrain type"] .chip', { hasText: salt.name }).click();
  await page.locator('button[role="switch"]').click();
  await expect(page).toHaveURL(/tt=salt_flat/);
  await expect(page).toHaveURL(/yr=1/);
  const tags = page.locator("ol.runners li .terrain");
  await expect(tags.first()).toHaveText(salt.name);
  for (const tag of await tags.allTextContents()) expect(tag).toBe(salt.name);
  const names = await page.locator("ol.runners li .name").allTextContents();

  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.locator("ol.runners li .name")).toHaveText(names);
  await expect(other.locator('[role="group"][aria-label="Terrain type"] .chip[aria-pressed="true"]')).toContainText(salt.name);
  await expect(other.locator('button[role="switch"]')).toHaveAttribute("aria-checked", "true");
});

test("a rare terrain type says how few places it gives", async ({ page }) => {
  const cave = manifest.terrain_types.find((t) => t.key === "cave")!;
  await page.goto("/#tt=cave");
  const few = page.locator('[data-testid="few"]');
  await expect(few).toContainText(cave.name.toLowerCase());
  await expect(few).toContainText(`${cave.cells.toLocaleString("en")} of ${manifest.grid.n.toLocaleString("en")}`);
  expect(await page.locator("ol.runners li").count()).toBeLessThan(5);
});

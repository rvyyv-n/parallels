import { test } from "@playwright/test";
import { formatCoords } from "../src/data/match";
import { expectedView, expect, manifest, ready, store } from "./helpers";

test.describe.configure({ timeout: 90_000 });

test("an address can open a place outside the five best", async ({ page }) => {
  const cell = 38131;
  const want = await expectedView("mars-jezero", "life_support");
  const grid = await store.cell(manifest.grid, ["lat", "lon", "region"], cell);
  const region = manifest.regions[grid.region!];
  expect(want.regions).not.toContain(region);

  await ready(page, `#t=mars-jezero&f=life_support&p=${cell}`);
  const card = page.locator('[data-testid="feature"]');
  await expect(card.locator(".kicker")).toHaveText("A place opened by its address");
  await expect(card.locator(".place-name")).toHaveText(region.slice(0, region.lastIndexOf(", ")));
  await expect(card.locator(".coords")).toContainText(formatCoords(grid.lat!, grid.lon!));
  await expect(page.locator('ol.runners li button[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator("ol.runners li")).toHaveCount(5);
});

test("an address with a cell that does not exist falls back to the best place", async ({ page }) => {
  const want = await expectedView("moon-south-pole", "rover");
  await ready(page, `#p=${manifest.grid.n + 5}`);
  await expect(page.locator('[data-testid="feature"] .place-name')).toHaveText(want.region!.slice(0, want.region!.lastIndexOf(", ")));
});

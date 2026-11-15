import { test } from "@playwright/test";
import { expect, expectedView, loaded, ready } from "./helpers";

test.describe.configure({ timeout: 90_000 });

const noWebGL = () => {
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    return type.includes("webgl") ? null : (real as (...a: unknown[]) => unknown).call(this, type, ...rest);
  } as typeof real;
};

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test(`without WebGL a flat map shows the places: ${width} px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.addInitScript(noWebGL);
    const want = await expectedView("moon-south-pole", "rover");
    await ready(page);

    const map = page.locator(".world[data-failed] .pins");
    await expect(map).toBeVisible();
    const pins = map.locator("button.pin:not(.base-pin)");
    await expect(pins).toHaveCount(5);
    const box = (await map.boundingBox())!;
    for (const pin of await pins.all()) {
      const at = (await pin.boundingBox())!;
      expect(at.x + at.width / 2).toBeGreaterThanOrEqual(box.x);
      expect(at.x + at.width / 2).toBeLessThanOrEqual(box.x + box.width);
      expect(at.y + at.height / 2).toBeGreaterThanOrEqual(box.y);
      expect(at.y + at.height / 2).toBeLessThanOrEqual(box.y + box.height);
    }

    await pins.nth(2).dispatchEvent("click");
    await expect(page.locator("ol.runners li button").nth(2)).toHaveAttribute("aria-pressed", "true");
    const third = want.regions[2]!;
    await expect(page.locator('[data-testid="feature"] .place-name')).toHaveText(third.slice(0, third.lastIndexOf(", ")));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}

test("the keyboard reaches the picker from the first screen, in order", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loaded(page);
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    seen.push(await page.evaluate(() => (document.activeElement as HTMLElement).innerText.trim().split("\n")[0]));
  }
  expect(seen.slice(0, 7)).toEqual([
    "Parallels",
    "How we checked it",
    "For judges",
    "Tour",
    "Find a place",
    "Take the tour",
    "New to the Moon and Mars?",
  ]);
  const focused = page.locator(":focus");
  await expect(focused).toHaveClass(/chip/);
  await expect(page.locator('[data-chapter="find"]')).not.toHaveAttribute("data-away");
  await expect(focused).toBeInViewport();
  await expect.poll(() => page.locator('[data-chapter="find"] .copy').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
});

test("a chapter that is scrolled away takes no clicks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loaded(page);
  expect(await page.locator('[data-chapter="match"] .copy').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
});

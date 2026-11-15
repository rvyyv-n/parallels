import { test, type Page } from "@playwright/test";
import { secondSite, STEPS, total } from "../src/ui/tour-steps";
import { expect, manifest } from "./helpers";

test.describe.configure({ timeout: 150_000 });
test.use({ hasTouch: true });

const tour = (page: Page) => page.getByTestId("tour");

const done = (page: Page) =>
  page.getByTestId("tour-progress").evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--done")) || 0);

async function record(page: Page) {
  await page.addInitScript(() => {
    const seen: { step: string; caption: string }[] = [];
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    setInterval(() => {
      const step = document.documentElement.dataset.step;
      const caption = document.querySelector('[data-testid="tour-caption"]')?.textContent ?? "";
      const last = seen.at(-1);
      if (step && (last?.step !== step || last.caption !== caption)) seen.push({ step, caption });
    }, 20);
  });
}

async function atStep(page: Page, id: string) {
  await page.locator(`html[data-step="${id}"]`).waitFor({ state: "attached", timeout: 60_000 });
}

async function stillAfterInput(page: Page, input: () => Promise<void>) {
  await page.goto("/?tour=1&speed=0.5");
  await atStep(page, "find");
  await page.waitForFunction(() => scrollY > 0);
  await input();
  await expect(tour(page)).toHaveCount(0);
  await expect(page.locator("html[data-step]")).toHaveCount(0);
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  const find = await page.locator("#find").evaluate((el) => el.getBoundingClientRect().top + scrollY);
  expect(Math.abs(y - find)).toBeGreaterThan(40);
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height } });

    test("plays every step in order, switches the base site and ends on Build the whole base", async ({ page }) => {
      await record(page);
      await page.goto("/?tour=1&speed=8");
      await expect(tour(page)).toBeVisible();
      await expect(tour(page)).toHaveAttribute("data-state", "playing");
      await expect(tour(page)).toHaveCount(0, { timeout: 120_000 });

      const seen = await page.evaluate(() => (window as unknown as { __seen: { step: string; caption: string }[] }).__seen);
      const order = seen.map((s) => s.step).filter((s, i, all) => all[i - 1] !== s);
      expect(order).toEqual(STEPS.map((s) => s.id));
      const captions = STEPS.map((s) => seen.filter((x) => x.step === s.id).at(-1)!.caption);
      expect(new Set(captions).size).toBe(STEPS.length);
      expect(captions[STEPS.findIndex((s) => s.id === "switch")]).toContain(secondSite(manifest).name);

      await expect(page.locator("#base")).toBeInViewport();
      await expect(page.locator("html[data-step]")).toHaveCount(0);
      expect(page.url()).toContain(`t=${secondSite(manifest).id}`);
      const info = await page.evaluate(() => window.__tour!);
      expect(info.total).toBe(total(STEPS));
      expect(info.steps.map((s) => s.id)).toEqual(STEPS.map((s) => s.id));
      expect(info.played.map((s) => s.id)).toEqual(STEPS.map((s) => s.id));

      const y = await page.evaluate(() => scrollY);
      await page.waitForTimeout(800);
      expect(await page.evaluate(() => scrollY)).toBe(y);
    });

    test("pause stops the clock and play resumes it", async ({ page }) => {
      await page.goto("/?tour=1");
      await expect.poll(() => done(page), { timeout: 60_000 }).toBeGreaterThan(0);
      await page.getByTestId("tour-pause").click();
      await expect(tour(page)).toHaveAttribute("data-state", "paused");
      const held = await done(page);
      await page.waitForTimeout(1500);
      expect(await done(page)).toBe(held);
      await expect(page.locator("html")).toHaveAttribute("data-step", "intro");
      await page.getByTestId("tour-pause").click();
      await expect(tour(page)).toHaveAttribute("data-state", "playing");
      await expect.poll(() => done(page)).toBeGreaterThan(held);
    });

    test("Escape ends it and leaves the page where it is", async ({ page }) => {
      await stillAfterInput(page, () => page.keyboard.press("Escape"));
    });

    test("an arrow key ends it", async ({ page }) => {
      await stillAfterInput(page, () => page.keyboard.press("ArrowDown"));
    });

    test("a mouse wheel ends it", async ({ page }) => {
      await stillAfterInput(page, () => page.mouse.wheel(0, 1));
    });

    test("a touch on the page ends it", async ({ page }) => {
      await stillAfterInput(page, () => page.touchscreen.tap(width - 20, 120));
    });

    test("the picker stays clickable while the tour runs", async ({ page }) => {
      await page.goto("/?tour=1");
      await atStep(page, "find");
      await page.waitForTimeout(1500);
      const chip = page.locator(".picker .chip", { hasText: manifest.filters[2].name });
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      expect(page.url()).toContain(`f=${manifest.filters[2].id}`);
    });

    test("its own buttons keep it going, and Tour starts it again from the first step", async ({ page }) => {
      await page.goto("/?tour=1&speed=2");
      await atStep(page, "find");
      await page.getByTestId("tour-next").click();
      await atStep(page, "match");
      await expect(tour(page)).toBeVisible();
      await page.getByTestId("tour-start").first().click();
      await atStep(page, "intro");
      await expect(page.getByTestId("tour-caption")).toHaveText(STEPS[0].caption({} as never));
      await page.getByTestId("tour-exit").click();
      await expect(tour(page)).toHaveCount(0);
      await page.getByTestId("tour-start").first().click();
      await atStep(page, "intro");
      await expect(tour(page)).toHaveAttribute("data-state", "playing");
    });

    test("with reduced motion nothing moves until Next", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/?tour=1");
      await page.locator('.pairs-box[aria-busy="false"]').waitFor({ state: "attached", timeout: 60_000 });
      await expect(tour(page)).toHaveAttribute("data-state", "paused");
      await expect(page.getByTestId("tour-pause")).toHaveCount(0);
      await page.waitForTimeout(2500);
      await expect(page.locator("html")).toHaveAttribute("data-step", "intro");
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await page.getByTestId("tour-next").click();
      await atStep(page, "find");
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      const y = await page.evaluate(() => scrollY);
      await page.waitForTimeout(2000);
      expect(await page.evaluate(() => scrollY)).toBe(y);
      await expect(page.locator("html")).toHaveAttribute("data-step", "find");
    });

    test("with chrome=0 it plays without drawing anything and still stops on input", async ({ page }) => {
      await page.goto("/?tour=1&chrome=0&speed=2");
      await atStep(page, "find");
      await expect(tour(page)).toHaveCount(1);
      await expect(page.getByTestId("tour-caption")).toHaveCount(0);
      await expect(tour(page).locator("button")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(tour(page)).toHaveCount(0);
    });
  });
}

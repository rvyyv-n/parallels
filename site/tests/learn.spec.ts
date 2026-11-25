import { expect, test } from "@playwright/test";
import { latlon } from "../src/format";
import { top } from "../src/score";
import { cols, manifest } from "./helpers";

const m = manifest();
const home = (b: "moon" | "mars") => m.targets.find((t) => t.body === b && t.default) ?? m.targets.find((t) => t.body === b)!;
const page$ = ".page:not([hidden]) ";

test("every Learn section renders for the Moon", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/#/learn");
  await expect(page).toHaveTitle(/^Learn/);
  for (const id of ["learn-meet", "learn-temps", "learn-year", "learn-cant", "learn-analogs", "learn-photos"]) await expect(page.locator(`${page$}[data-testid="${id}"]`)).toBeVisible();
  await expect(page.locator(`${page$}h1`)).toHaveText("Meet the Moon");
  await expect(page.locator(`${page$}[data-testid="year-place"]`)).toHaveCount(5);
  await expect(page.locator(`${page$}[data-testid="temp-world"]`)).toContainText("°C");
  await expect(page.locator(`${page$}.ln-pin`).first()).toBeAttached();
  await expect(page.locator(`${page$}[data-testid="analog-card"] h3`)).not.toBeEmpty();
  await expect(page.locator(`${page$}.ln-pair`)).toHaveCount(4);
  await expect(page.locator(`${page$}[data-testid="learn-find"]`)).toHaveAttribute("href", `#/find?t=${home("moon").id}`);
  expect(errors).toEqual([]);
});

test("the month slider and the load switch change the view", async ({ page }) => {
  await page.goto("/#/learn?world=moon");
  const slider = page.locator(`${page$}#ln-month`);
  await slider.fill("0");
  await expect(page.locator(`${page$}[data-testid="month-name"]`)).toHaveText("January");
  await slider.fill("6");
  await expect(page.locator(`${page$}[data-testid="month-name"]`)).toHaveText("July");
  const moon = page.locator(`${page$}[data-testid="weight-moon"]`);
  const before = await moon.innerText();
  await page.locator(`${page$}[data-load="rover"]`).click();
  await expect(moon).not.toHaveText(before);
  await expect(moon).toContainText("1,025 kg");
});

test("the Moon/Mars switch changes the view", async ({ page }) => {
  await page.goto("/#/learn?world=moon");
  await expect(page.locator(`${page$}[data-testid="year-place"]`)).toHaveCount(5);
  const moonPlaces = await page.locator(`${page$}[data-testid="year-place"] .ln-place`).allInnerTexts();
  await page.locator(`${page$}.ln-worlds a[data-world="mars"]`).click();
  await expect(page).toHaveURL(/#\/learn\?world=mars/);
  await expect(page.locator(`${page$}h1`)).toHaveText("Meet Mars");
  await expect(page.locator(`${page$}[data-testid="learn"]`)).toHaveAttribute("data-world", "mars");
  await expect(page.locator(`${page$}.ln-worlds a[data-world="mars"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(`${page$}[data-testid="year-place"]`)).toHaveCount(5);
  expect(await page.locator(`${page$}[data-testid="year-place"] .ln-place`).allInnerTexts()).not.toEqual(moonPlaces);
  await expect(page.locator(`${page$}[data-testid="learn-find"]`)).toHaveAttribute("href", `#/find?t=${home("mars").id}`);
  await page.goBack();
  await expect(page.locator(`${page$}h1`)).toHaveText("Meet the Moon");
});

test("at 390 px the Learn page stacks and nothing overflows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const w of ["moon", "mars"]) {
    await page.goto(`/#/learn?world=${w}`);
    await expect(page.locator(`${page$}[data-testid="year-place"]`)).toHaveCount(5);
    const wide = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const bad = [...document.querySelectorAll(".page:not([hidden]) .ln *")].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && !e.closest(".ln-map") && (r.right > W + 1 || r.left < -1);
      });
      return { scroll: document.documentElement.scrollWidth, W, bad: bad.length };
    });
    expect(wide.scroll).toBeLessThanOrEqual(wide.W);
    expect(wide.bad).toBe(0);
  }
});

test("Learn uses balanced scores, clickable month cells, 44px analog pins, and a photo lightbox", async ({ page }) => {
  const moonTarget = home("moon");
  const balanced = m.filters.find((f) => f.id === "balanced") ?? m.filters[0];
  const { t, cells } = cols(m, moonTarget.id);
  const want = top(t[`score:${balanced.id}`], 5, cells).ids.map((i) => {
    const r = cells.region?.[i];
    const full = (Number.isFinite(r) && m.regions[r]) || latlon(cells.lat[i], cells.lon[i], 2);
    const comma = full.lastIndexOf(", ");
    return comma < 0 ? full : full.slice(0, comma);
  });

  await page.goto("/#/learn?world=moon");
  await expect(page.locator(`${page$}[data-testid="year-place"]`)).toHaveCount(5);
  const got = (await page.locator(`${page$}[data-testid="year-place"] .ln-place`).allInnerTexts()).map((s) => s.split("\n")[0].trim());
  expect(got).toEqual(want);

  const pinBox = await page.locator(`${page$}.ln-pin`).first().boundingBox();
  expect(pinBox!.width).toBeGreaterThanOrEqual(44);
  expect(pinBox!.height).toBeGreaterThanOrEqual(44);

  await page.locator(`${page$}[data-testid="year-place"]`).first().locator('[data-m="6"]').click();
  await expect(page.locator(`${page$}#ln-month`)).toHaveValue("6");
  await expect(page.locator(`${page$}[data-testid="month-name"]`)).toHaveText("July");

  await page.locator(`${page$}.ln-pair .ln-photo`).first().click();
  const dlg = page.locator(`${page$}dialog.ln-lightbox[open]`);
  await expect(dlg).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
});

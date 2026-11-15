import { expect, test, type Page } from "@playwright/test";
import { manifest } from "./helpers";

const m = manifest();
const on = (b: "moon" | "mars") => {
  const ts = m.targets.filter((t) => t.body === b);
  return [...ts.filter((t) => t.default), ...ts.filter((t) => !t.default)];
};
const here = (p: Page) => p.locator(".page:not([hidden])");
const sites = (p: Page) => here(p).locator(".sp-list a.site");

for (const b of ["moon", "mars"] as const) {
  test(`the ${b} page lists every ${b} target with its image, and the default site first`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`/#/${b}`);
    await expect(here(page).locator("h1")).toHaveText(b === "moon" ? /^The Moon$/i : /^Mars$/i);
    await expect(here(page).locator(".sp-lede")).toHaveText(`Choose a ${b === "moon" ? "lunar" : "Mars"} site to see how Earth compares`);
    const ts = on(b);
    await expect(sites(page)).toHaveCount(ts.length);
    await expect(sites(page).locator(".site-n")).toHaveText(ts.map((t) => t.name));
    await expect(sites(page).first()).toHaveAttribute("aria-current", "true");
    await expect(here(page).locator(".w-site h2")).toContainText(ts[0].name);
    await expect
      .poll(() =>
        here(page)
          .locator("canvas.site-thumb")
          .evaluateAll((cs) =>
            cs.every((c) => {
              const d = (c as HTMLCanvasElement).getContext("2d")!.getImageData(32, 32, 1, 1).data;
              return d[3] === 255;
            }),
          ),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
}

test("picking the third Moon site opens the Finder for it", async ({ page }) => {
  const t = on("moon")[2];
  await page.goto("/#/moon");
  await sites(page).nth(2).click();
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${t.id}$`));
});

test("hovering a site shows its values, check note and the Finder link", async ({ page }, info) => {
  test.skip(info.project.name === "phone", "no hover on a phone");
  const ts = on("moon");
  const i = ts.findIndex((t) => t.check_note);
  const t = ts[i];
  await page.goto("/#/moon");
  await sites(page).nth(i).hover();
  await expect(sites(page).nth(i)).toHaveAttribute("aria-current", "true");
  const panel = here(page).locator(".w-site");
  await expect(panel.locator("h2")).toContainText(t.name);
  await expect(panel.locator(".w-check")).toHaveText(t.check_note!);
  await expect(panel.locator(".w-go")).toHaveAttribute("href", `#/find?t=${t.id}`);
  await expect(panel.locator(".w-val").first()).toBeVisible();
  const used = new Set([...Object.values(t.values), ...Object.values(t.shown)].map((v) => m.datasets.find((d) => d.id === v.dataset)?.name));
  for (const n of await panel.locator(".w-val small").allInnerTexts()) expect(used.has(n), n).toBe(true);
});

test("the arrow keys move through the sites and change the details; Enter picks", async ({ page }) => {
  const ts = on("moon");
  await page.goto("/#/moon");
  await expect(here(page).locator("h1")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sites(page).first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(sites(page).nth(1)).toBeFocused();
  await expect(here(page).locator(".w-site h2")).toContainText(ts[1].name);
  await page.keyboard.press("ArrowDown");
  await expect(here(page).locator(".w-site h2")).toContainText(ts[2].name);
  await page.keyboard.press("ArrowUp");
  await expect(sites(page).nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(sites(page).last()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(sites(page).first()).toBeFocused();
  await expect(here(page).locator(".w-site h2")).toContainText(ts[0].name);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${ts[1].id}$`));
});

test("each body page makes one planet, kept when the page is shown again", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/#/moon");
  await expect(here(page).locator(".sp-planet.live canvas")).toHaveCount(1);
  await page.evaluate(() => (location.hash = "#/mars"));
  await expect(here(page).locator(".sp-planet.live canvas")).toHaveCount(1);
  await page.evaluate(() => (location.hash = "#/moon"));
  await expect(page.locator(".sp-planet canvas")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("at 390 px the Moon and Mars pages don't scroll sideways, and the planet sits above the list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const b of ["moon", "mars"] as const) {
    await page.goto(`/#/${b}`);
    await expect(sites(page)).toHaveCount(on(b).length);
    await expect(here(page).locator(".w-analog").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), b).toBeLessThanOrEqual(390);
    const stage = await here(page).locator(".sp-stage").boundingBox();
    const list = await here(page).locator(".sp-list").boundingBox();
    expect(stage!.y + stage!.height).toBeLessThanOrEqual(list!.y);
    for (const r of await sites(page).evaluateAll((as) => as.map((a) => a.getBoundingClientRect().toJSON()))) {
      expect(r.right).toBeLessThanOrEqual(390);
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
  }
});

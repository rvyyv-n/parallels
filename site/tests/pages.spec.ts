import { cols, expect, manifest, test, type Page } from "./helpers";
import { targetName } from "../src/format";
import { spread } from "../src/rank";

const m = manifest();
const main = m.targets.find((x) => x.default) ?? m.targets[0];
const f0 = m.filters[0];
const best = () => {
  const { t, cells } = cols(m, main.id);
  return spread(m, t[`score:${f0.id}`], cells, () => true, false).ids;
};
const here = (p: Page) => p.locator(".page:not([hidden])");
const h1 = (p: Page) => here(p).locator("h1");

const ROUTES = [
  { path: "", h: /No place on Earth is/, title: /^Parallels: / },
  { path: "find", h: /Earth's best places/, title: /^Finder · Parallels$/ },
  { path: "learn", h: /Meet /, title: /^Learn · Parallels$/ },
  { path: "about", h: /About Parallels/, title: /^About · Parallels$/ },
  { path: "checks", h: /About Parallels/, title: /^About · Parallels$/ },
];

test("every route opens its page with its heading, focus and title", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const r of ROUTES) {
    await page.goto(`/#/${r.path}`);
    await expect(h1(page)).toHaveText(r.h);
    await expect(h1(page)).toBeFocused();
    await expect(page).toHaveTitle(r.title);
  }
  const c = best()[0];
  await page.goto(`/#/place?t=${main.id}&f=${f0.id}&c=${c}`);
  await expect(page.locator(".pl-for")).toContainText(targetName(main.name));
  await expect(h1(page)).not.toHaveText("A match on Earth");
  await expect(page).toHaveTitle(`${(await h1(page).textContent())?.trim()} · Parallels`);
  expect(errors).toEqual([]);
});

test("the nav moves between pages and Back returns to the previous page", async ({ page }, info) => {
  await page.goto("/#/");
  await expect(h1(page)).toHaveText(ROUTES[0].h);
  const nav = async (name: string) => {
    if (info.project.name === "phone") await page.locator("#menu-btn").click();
    await page.locator(".top nav a", { hasText: name }).click();
  };
  await nav("Learn");
  await expect(page).toHaveURL(/#\/learn/);
  await expect(h1(page)).toHaveText(/Meet /);
  await expect(page.locator('.top nav a[aria-current="page"]')).toHaveText("Learn");
  await nav("About");
  await expect(h1(page)).toHaveText(/About Parallels/);
  await expect(page).toHaveTitle(/^About/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/learn/);
  await expect(h1(page)).toHaveText(/Meet /);
  await expect(page).toHaveTitle(/^Learn/);
  await page.goBack();
  await expect(h1(page)).toHaveText(ROUTES[0].h);
  await page.goForward();
  await expect(h1(page)).toHaveText(/Meet /);
});

test("each page leaves out what belongs on other pages", async ({ page }) => {
  const c = best()[0];
  const NOT: [string, string[]][] = [
    ["", ["#rank", ".card", "#earth", ".ab-chart", ".ab-table", "[data-filter]", ".w-analogs"]],
    ["find", [".card", ".ab-chart", ".ab-table", ".w-analogs"]],
    [`place?t=${main.id}&f=${f0.id}&c=${c}`, ["#rank", "#earth", ".ab-chart", ".ab-table", ".w-analogs"]],
    ["about", ["#rank", ".card", "#earth", ".w-analogs"]],
  ];
  for (const [path, sels] of NOT) {
    await page.goto("about:blank");
    await page.goto(`/#/${path}`);
    await expect(h1(page)).toBeVisible();
    if (path.startsWith("place")) await expect(page.locator(".card")).toHaveCount(1);
    if (path === "find") await expect(page.locator("#rank li[data-i]")).toHaveCount(20);
    if (path === "about") await expect(page.locator(".ab-table")).toBeAttached();
    for (const s of sels) expect(await page.locator(s).count(), `${s} on #/${path}`).toBe(0);
  }
  await page.goto("/#/");
  for (const b of ["moon", "mars"] as const) await expect(page.locator(`#ch-${b} a.site`)).toHaveCount(m.targets.filter((t) => t.body === b).length);
  await expect(page.locator(".choice, .chip.site, #ch-choose")).toHaveCount(0);
});

test("Home and About don't wait for the land file", async ({ page }) => {
  await page.route("**/data/cells.bin", () => {});
  await page.goto("/#/");
  for (const b of ["moon", "mars"] as const) {
    await expect(page.locator(`#ch-${b} .cant dl > div`)).toHaveCount(m.cant_copy.length);
    await expect(page.locator(`#ch-${b} a.site`)).toHaveCount(m.targets.filter((t) => t.body === b).length);
  }
  await expect(page.locator(".places a.place-link")).toHaveCount(6);
  await expect(page.locator("#count-ranked")).toHaveText(/^[\d,]+$/);
  await page.locator('.top nav a[data-route="about"]').evaluate((a) => (a as HTMLElement).click());
  await expect(page.locator(".ab-table tbody tr:not(.ab-tg)")).toHaveCount(m.datasets.length);
});

test("each data file loads once, and the map and intro are made once", async ({ page }) => {
  const seen = new Map<string, number>();
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes("/data/")) seen.set(u.pathname, (seen.get(u.pathname) ?? 0) + 1);
  });
  const c = best()[0];
  const go = (h: string) => page.evaluate((x) => (location.hash = x), h);
  await page.goto("/#/");
  await go("#/moon");
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("#ch-moon")).toBeInViewport();
  await go(`#/find?t=${main.id}`);
  await expect(page.locator("#rank li[data-i]")).toHaveCount(20);
  await expect(page.locator("#earth canvas.maplibregl-canvas")).toHaveCount(1);
  await go(`#/place?t=${main.id}&f=${f0.id}&c=${c}`);
  await expect(page.locator(".card")).toHaveCount(1);
  await go("#/learn");
  await expect(page.locator(".page:not([hidden]) h1")).toHaveText(/Meet /);
  await go(`#/find?t=${main.id}`);
  await expect(page.locator("#earth canvas.maplibregl-canvas")).toBeVisible();
  await go("#/");
  await go("#/about");
  await expect(page.locator("#checked .ab-chart")).toBeAttached();
  await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(1);
  expect(await page.locator(".intro-view canvas").count()).toBeLessThanOrEqual(1);
  expect(await page.locator(".page").count()).toBe(5);
  for (const [path, n] of seen) expect(n, path).toBe(1);
  expect([...seen.keys()].some((p) => p.endsWith("cells.bin"))).toBe(true);
});

test("settings on the Finder replace the history entry, so Back leaves the page", async ({ page }) => {
  await page.goto("/#/moon");
  const site = page.locator("#ch-moon a.site").first();
  await site.click();
  await expect(page).toHaveURL(/#\/find\?t=/);
  await expect(page.locator("#rank li[data-i]")).toHaveCount(20);
  await page.locator("#weights > summary").click();
  await page.locator("#pick-yr").check({ force: true });
  await expect(page).toHaveURL(/yr=1/);
  await page.locator(`.presets [data-filter="${m.filters[m.filters.length - 1].id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`f=${m.filters[m.filters.length - 1].id}`));
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  await expect(h1(page)).toHaveText(ROUTES[0].h);
  await page.goForward();
  await expect(page).toHaveURL(/yr=1/);
  await expect(page.locator("#pick-yr")).toBeChecked();
});

test("old shared links open the new pages and leave no old URL behind", async ({ page }) => {
  const f = m.filters[1] ?? f0;
  const { t, cells } = cols(m, main.id);
  const c = spread(m, t[`score:${f.id}`], cells, () => true, false).ids[4];
  await page.goto(`/?t=${main.id}&f=${f.id}&c=${c}`);
  await expect(page).toHaveURL(new RegExp(`/#/place\\?t=${main.id}&f=${f.id}&c=${c}$`));
  expect(new URL(page.url()).search).toBe("");
  await expect(page.locator("#place-h")).not.toHaveText("A match on Earth");
  await expect(page.locator("#back-find")).toHaveAttribute("href", new RegExp(`c=${c}`));
  await page.goto(`/?t=${main.id}`);
  await expect(page).toHaveURL(new RegExp(`/#/find\\?t=${main.id}$`));
  await expect(page.locator("#pick-target")).toHaveAttribute("data-value", main.id);
  await page.goto("/#third-run");
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.locator("#checked")).toBeInViewport();
  await page.goto(`/#/place?t=${main.id}`);
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${main.id}`));
  await expect(page.locator("#rank li[data-i]")).toHaveCount(20);
});

test("a plain anchor to another page opens that page at the anchor", async ({ page }) => {
  await page.goto("/#/learn");
  await page.locator('footer a[href="#data"]').click();
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.locator("#data")).toBeInViewport();
  await page.goBack();
  await expect(h1(page)).toHaveText(/Meet /);
});

test("at 390 px every nav item is reachable through the menu and no page scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/");
  const btn = page.locator("#menu-btn");
  const links = page.locator(".top nav a");
  await expect(btn).toBeVisible();
  await expect(links.first()).toBeHidden();
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await expect(links).toHaveText(["Home", "Finder", "Learn", "About"]);
  for (const b of await links.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().toJSON()))) {
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.right).toBeLessThanOrEqual(390);
  }
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await expect(btn).toBeFocused();
  await expect(links.first()).toBeHidden();
  const c = best()[0];
  for (const path of ["", `find?t=${main.id}`, `place?t=${main.id}&f=${f0.id}&c=${c}`, "learn", "about"]) {
    await page.goto(`/#/${path}`);
    await expect(h1(page)).toBeVisible();
    if (path.startsWith("place")) await expect(page.locator(".card")).toHaveCount(1);
    if (path.startsWith("find")) await expect(page.locator("#rank li[data-i]")).toHaveCount(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `#/${path}`).toBeLessThanOrEqual(390);
  }
  await btn.click();
  await links.filter({ hasText: "About" }).click();
  await expect(h1(page)).toHaveText(/About Parallels/);
  await expect(btn).toHaveAttribute("aria-expanded", "false");
});

test("a check of a preset shows only as that preset's total on About", async ({ page, request }) => {
  const v = await (await request.get("/data/validation.json")).json();
  const base = v.second_run ?? { title: "Run", plain: "", designed_after_first_run: true, config_commit: "x", summary: "", tests: v.tests, unchecked: [] };
  const run = { ...base, title: "Balanced preset check test", preset: "balanced", adopted: true, tests: base.tests.map((t: { checks: { passed: boolean | null }[] }) => ({ ...t, checks: t.checks.map((c) => ({ ...c, passed: c.passed == null ? null : false })) })) };
  const more = [...(v.more_runs ?? []).filter((r: { preset?: string }) => !r.preset), run];
  await page.route("**/data/validation.json", (r) => r.fulfill({ json: { ...v, more_runs: more } }));
  await page.goto("/#/about");
  const n = run.tests.flatMap((t: { checks: { passed: boolean | null }[] }) => t.checks).filter((c: { passed: boolean | null }) => c.passed != null).length;
  await expect(page.locator("#checked .ab-total")).toContainText(`the Balanced preset passes 0 of ${n}`);
  await expect(page.locator("#checked .ab-total")).not.toContainText(`, 0 of ${n} checks pass`);
});

test("About agency filter pills filter dataset rows and val-runs expands cleanly with zero ML", async ({ page }) => {
  await page.goto("/#/about");
  const visibleRows = page.locator(".ab-table tbody:not([hidden]) tr:not(.ab-tg)");
  await expect(visibleRows).toHaveCount(m.datasets.length);

  const nasaCount = m.datasets.filter((d) => d.agency === "NASA").length;
  await page.locator('.ab-agency-pills [data-agency="NASA"]').click();
  await expect(page.locator('.ab-agency-pills [data-agency="NASA"]')).toHaveAttribute("aria-pressed", "true");
  await expect(visibleRows).toHaveCount(nasaCount);

  await page.locator('.ab-agency-pills [data-agency="all"]').click();
  await expect(visibleRows).toHaveCount(m.datasets.length);

  const valRuns = page.locator("#val-runs");
  await expect(valRuns).toBeAttached();
  await expect(valRuns).not.toHaveAttribute("open", "");
  await valRuns.locator("> summary").click();
  await expect(valRuns).toHaveAttribute("open", "");
  expect(await valRuns.locator(".ab-prog-card").count()).toBeGreaterThanOrEqual(4);
  expect(await valRuns.locator(".ab-vtable tbody tr:not(.ab-vtg)").count()).toBeGreaterThan(0);
  await expect(valRuns).not.toContainText("ML");
  await expect(page.locator(".page:not([hidden])")).not.toContainText("ML");
});

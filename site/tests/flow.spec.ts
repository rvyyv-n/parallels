import { cols, expect, manifest, test, type Page } from "./helpers";
import { targetName } from "../src/format";
import { handScore } from "../src/score";
import { spread } from "../src/rank";

const m = manifest();
const rows = (p: Page) => p.locator("#rank li[data-i]");
const order = (p: Page) =>
  rows(p).evaluateAll((els) => els.map((e) => [Number((e as HTMLElement).dataset.rank), Number((e as HTMLElement).dataset.i)]).sort((a, b) => a[0] - b[0]).map((x) => x[1]));
const main = m.targets.find((x) => x.default) ?? m.targets[0];
const row = (p: Page, r: number) => p.locator(`#rank li[data-rank="${r}"]`);
const nameOf = async (p: Page, i: number) => (await row(p, i + 1).locator(".rk-name").innerText()).trim();

async function ready(p: Page, q = "") {
  await p.goto(`/#/find${q ? `?${q}` : ""}`);
  await expect(rows(p)).toHaveCount(20);
}

type V = { tests: { checks: { passed: boolean | null }[] }[]; adopted?: boolean; preset?: string; title: string };
const nowRun = (v: { third_run?: V; more_runs?: V[] }) => [v.third_run, ...(v.more_runs ?? [])].filter((r): r is V => !!r && !r.preset).reverse().find((r) => r.adopted);

test("main flow: pick a site in its world's chapter on Home, pick a filter, open a match, read the scorecard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const target = m.targets[m.targets.length - 1];
  const filter = m.filters[m.filters.length - 1];
  await page.goto(`/#/${target.body}`);
  if (m.sample) await expect(page.getByRole("note")).toContainText("Sample data");
  await expect(page.locator(`#ch-${target.body}`)).toBeInViewport();
  await page.locator(`#ch-${target.body} a.site[data-site="${target.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${target.id}`));
  await expect(rows(page)).toHaveCount(20);
  await expect(page.locator("#find-h")).toContainText(targetName(target.name));
  await expect(page.locator("#pick-target")).toHaveAttribute("data-value", target.id);
  await page.locator(`.presets [data-filter="${filter.id}"]`).click();
  await expect(page.locator(`.presets [data-filter="${filter.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".card")).toHaveCount(0);

  const third = row(page, 3);
  const id = await third.getAttribute("data-i");
  const name = await nameOf(page, 2);
  await third.locator(".rk-row").click();
  await expect(page).toHaveURL(new RegExp(`#/place\\?t=${target.id}&f=${filter.id}.*c=${id}`));
  await expect(page.locator(".pl-for")).toContainText(targetName(target.name));
  await expect(page.locator("#place-h")).toHaveText(name);

  await expect(page.locator(".card .ring b")).not.toBeEmpty();
  await expect(page.locator(".card .ch")).toHaveCount(m.challenges[target.body].length);
  const open = page.locator(".card .ch details[open]");
  await expect(open).toHaveCount(1);
  expect(await open.locator(".trait").count()).toBeGreaterThan(0);
  const units = m.traits.filter((t) => t.unit).map((t) => t.unit);
  const vals = await open.locator(".t-vals dd").allInnerTexts();
  expect(vals.some((v) => units.some((u) => v.includes(u)))).toBe(true);
  await expect(open.locator(".t-src").first()).toContainText("Earth");
  await expect(page.locator(".card h2", { hasText: "Where it breaks" })).toBeVisible();
  await expect(page.locator(".card h2", { hasText: "Earth cannot copy" })).toBeVisible();
  await expect(page.locator(".card .cant .cant-row")).toHaveCount(m.cant_copy.length);
  await expect(page.locator(".card .cant .cant-src a").first()).toHaveAttribute("href", /^https?:\/\//);
  await expect(page.locator(".card h2", { hasText: "Seasons" })).toBeVisible();
  await expect(page.locator(".card .se-strip .se-m")).toHaveCount(12);

  await page.locator("#back-find").click();
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${target.id}&f=${filter.id}`));
  await expect(page.locator(`#rank li[data-i="${id}"] .rk-row`)).toHaveClass(/on/);
  expect(errors).toEqual([]);
});

test("a shared link opens the same place", async ({ page }) => {
  const f = m.filters[1] ?? m.filters[0];
  const { t, cells } = cols(m, main.id);
  const { ids } = spread(m, t[`score:${f.id}`], cells, () => true, false);
  await ready(page, `t=${main.id}&f=${f.id}`);
  const name = await nameOf(page, 4);
  await page.goto("about:blank");
  await page.goto(`/?t=${main.id}&f=${f.id}&c=${ids[4]}`);
  await expect(page).toHaveURL(new RegExp(`#/place\\?t=${main.id}&f=${f.id}&c=${ids[4]}$`));
  await expect(page.locator("#place-h")).toHaveText(name);
  await page.locator("#back-find").click();
  await expect(page.locator(`.presets [data-filter="${f.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`#rank li[data-i="${ids[4]}"] .rk-row`)).toHaveAttribute("aria-current", "true");
});

test("Previous and Next on a place step through the Finder's top list for the same settings", async ({ page }) => {
  const f = m.filters[1] ?? m.filters[0];
  const { t, cells } = cols(m, main.id);
  const { ids } = spread(m, t[`score:${f.id}`], cells, () => true, false);
  await page.goto(`/#/place?t=${main.id}&f=${f.id}&c=${ids[0]}`);
  await expect(page.locator("#pl-pos")).toContainText(`1 of ${ids.length}`);
  await expect(page.locator("#pl-prev")).toHaveAttribute("aria-disabled", "true");
  await page.locator("#pl-next").click();
  await expect(page).toHaveURL(new RegExp(`#/place\\?t=${main.id}&f=${f.id}&c=${ids[1]}$`));
  await expect(page.locator("#pl-pos")).toContainText(`2 of ${ids.length}`);
  await page.locator("#pl-prev").click();
  await expect(page).toHaveURL(new RegExp(`c=${ids[0]}$`));
  await expect(page.locator("#back-find")).toHaveAttribute("href", new RegExp(`f=${f.id}.*c=${ids[0]}`));
});

test("year-round switch reorders the list exactly as the year-round scores say", async ({ page }) => {
  const f = m.filters[0];
  const { t, cells } = cols(m, main.id);
  const plain = spread(m, t[`score:${f.id}`], cells, () => true, false).ids;
  const yr = spread(m, t[`score:${f.id}:yr`], cells, () => true, false).ids;
  await ready(page, `t=${main.id}&f=${f.id}`);
  expect(await order(page)).toEqual(plain);
  await page.locator("#weights > summary").click();
  await page.locator("#pick-yr").check({ force: true });
  await expect.poll(() => order(page)).toEqual(yr);
  if (JSON.stringify(plain) !== JSON.stringify(yr)) expect(await order(page)).not.toEqual(plain);
  await expect(page).toHaveURL(/yr=1/);
});

test("a weight slider multiplies the preset and re-ranks the list", async ({ page }) => {
  const f = m.filters.find((x) => x.id === "balanced") ?? m.filters[0];
  const fw = f.weights[main.body];
  const { t, cells } = cols(m, main.id);
  await ready(page, `t=${main.id}&f=${f.id}`);
  const before = await order(page);
  await expect(page.locator("#weights")).not.toHaveAttribute("open", "");
  await page.locator("#weights > summary").click();
  const live = Object.keys(fw).filter((id) => fw[id] > 0 && t[`ch:${id}`]);
  const off = live[0];
  await page.locator(`#sliders input[data-ch="${off}"]`).fill("0");
  await expect(page.locator(`#sliders output[for="w-${off}"]`)).toHaveText("0.0×");
  const w = Object.fromEntries(live.map((id) => [id, id === off ? 0 : fw[id]]));
  const expected = spread(m, handScore(m, t, w, m.grid.n), cells, () => true, false).ids;
  await expect.poll(() => order(page)).toEqual(expected);
  expect(expected).not.toEqual(before);
  await expect(page.locator("#w-mine")).toBeVisible();
  await expect(page.locator("#pick-yr")).toBeDisabled();
  await expect(page).toHaveURL(/w=/);
  await page.locator("#w-reset").click();
  await expect.poll(() => order(page)).toEqual(before);
  await expect(page).not.toHaveURL(/w=/);
});

test("no horizontal scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await rows(page).first().locator(".rk-row").click();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.locator(".card .ch details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("every internal link resolves to a page or an anchor", async ({ page }) => {
  await ready(page);
  const c = await rows(page).first().getAttribute("data-i");
  for (const h of ["#/", `#/place?t=${main.id}&c=${c}`, "#/learn", "#/about"]) await page.evaluate((x) => (location.hash = x), h);
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator("#checked .ab-chart")).toBeAttached();
  await expect(page.locator(".page")).toHaveCount(5);
  const hrefs = await page.locator("a[href^='#']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  const routes = ["", "find", "place", "learn", "about"];
  const badRoutes = hrefs.filter((h) => h.startsWith("#/")).filter((h) => !routes.includes(h.slice(2).split("?")[0]));
  expect(badRoutes).toEqual([]);
  const missing = await page.evaluate((hs) => hs.filter((h) => !h.startsWith("#/")).map((h) => h.slice(1)).filter((id) => !id || !document.getElementById(id)), hrefs);
  expect(missing).toEqual([]);
});

test("footer carries the AI note on every page", async ({ page }) => {
  for (const h of ["", "find", "learn", "about"]) {
    await page.goto(`/#/${h}`);
    await expect(page.locator("footer .ai")).toContainText("How we used AI");
    await expect(page.locator("footer .ai")).toHaveCount(1);
  }
});

test("sample banner shows only for sample data", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".sample")).toHaveCount(m.sample ? 1 : 0);
  await page.route("**/data/manifest.json", async (r) => r.fulfill({ json: { ...m, sample: true } }));
  await page.goto("about:blank");
  await ready(page);
  await expect(page.locator(".sample")).toHaveCount(1);
});

test("About shows the current run's held-out results and its honest totals", async ({ page, request }) => {
  type C = { name: string; result: number | null; held_out_only: number | null; pass_mark: number; passed: boolean | null };
  type R = { title: string; tests: { title: string; checks: C[] }[]; adopted?: boolean; preset?: string };
  const v = await (await request.get("/data/validation.json")).json();
  const runs: R[] = [{ title: "First run", tests: v.tests }, ...[v.second_run, v.third_run, ...(v.more_runs ?? [])].filter(Boolean)];
  const now = [...runs].reverse().find((r) => r.adopted && !r.preset) ?? runs[0];
  const bal = [...runs].reverse().find((r) => r.preset === "balanced");
  const tally = (r: R) => {
    const cs = r.tests.flatMap((t) => t.checks).filter((c) => c.passed != null);
    return `${cs.filter((c) => c.passed).length} of ${cs.length}`;
  };
  const pc = (x: number) => `${Math.floor(x * 100 + 1e-9)}%`;
  await page.goto("/#/about");
  const box = page.locator("#checked");
  await expect(box.locator(".ab-chart")).toBeVisible();
  for (const b of ["moon", "mars"]) {
    const t = now.tests.find((x) => x.title.toLowerCase().startsWith(b) && x.title.toLowerCase().includes("challenge by challenge"));
    const c = t?.checks.find((x) => /^all challenges pooled/i.test(x.name));
    if (!c?.held_out_only) continue;
    await expect(box.locator(`.ab-tile[data-body="${b}"] b`)).toHaveText(pc(c.held_out_only));
    expect(await box.locator(`.ab-fill[data-body="${b}"]`).first().evaluate((e) => parseFloat((e as HTMLElement).style.width))).toBeCloseTo(c.held_out_only * 100, 1);
  }
  await expect(box.locator(".ab-total")).toContainText(`${tally(now)} checks pass`);
  if (bal) await expect(box.locator(".ab-total")).toContainText(`the Balanced preset passes ${tally(bal)}`);
  await expect(box).not.toContainText("ML");
});

test("works with NASA GIBS tiles blocked, and makes no other outside calls", async ({ page }) => {
  const outside: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.hostname !== "localhost" && !u.protocol.startsWith("data") && !u.protocol.startsWith("blob")) outside.push(u.hostname);
  });
  await page.route("**://gibs.earthdata.nasa.gov/**", (r) => r.abort());
  await ready(page);
  await expect(page.locator("#earth canvas.maplibregl-canvas")).toBeVisible();
  await rows(page).first().locator(".rk-row").click();
  await page.locator(".card .eimg").scrollIntoViewIfNeeded();
  await expect(page.locator(".card .eimg.fb")).toHaveCount(1);
  await page.evaluate(() => (location.hash = "#/about"));
  await page.locator("#checked .ab-chart").waitFor();
  await page.evaluate(() => (location.hash = "#/"));
  await expect(page.locator("#intro-h")).toBeVisible();
  expect(errors).toEqual([]);
  expect([...new Set(outside)].filter((h) => h !== "gibs.earthdata.nasa.gov" && h !== "tiles.maps.eox.at" && h !== "trek.nasa.gov")).toEqual([]);
});

test("keyboard alone reaches the pickers, the ranked list, the scorecard and the sliders", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "keyboard path is a laptop check");
  await ready(page);
  const pick = page.locator("#pick-target");
  const other = m.targets.find((x) => x.id !== main.id)!;
  await pick.focus();
  await page.keyboard.press("Enter");
  await expect(pick).toHaveAttribute("aria-expanded", "true");
  await page.locator(`#pick-target-listbox [role="option"][data-value="${other.id}"]`).click();
  await expect(pick).toHaveAttribute("aria-expanded", "false");
  await expect(pick).toHaveAttribute("data-value", other.id);
  await expect(page).toHaveURL(new RegExp(`t=${other.id}`));
  await expect(rows(page)).toHaveCount(20);
  const second = row(page, 2).locator(".rk-row");
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#place-h")).toBeFocused();
  const summary = page.locator(".card .ch summary").nth(1);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".card .ch details").nth(1)).toHaveAttribute("open", "");
  await page.locator("#back-find").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#find-h")).toBeFocused();
  await page.locator("#weights > summary").focus();
  await page.keyboard.press("Enter");
  const slider = page.locator("#sliders input:not([disabled])").first();
  await slider.focus();
  const before = await slider.inputValue();
  await page.keyboard.press("ArrowRight");
  expect(await slider.inputValue()).not.toBe(before);
  await expect(page.locator("#w-mine")).toBeVisible();
});

test("two-column Finder with the list beside the map, and no scorecard on it", async ({ page }, info) => {
  await ready(page);
  await expect(page.locator(".tglobe, #link, .card, #card")).toHaveCount(0);
  if (info.project.name !== "laptop") return;
  const [l, e] = await Promise.all([page.locator(".fd-side").boundingBox(), page.locator(".earth-col").boundingBox()]);
  expect(l!.x + l!.width).toBeLessThanOrEqual(e!.x + 1);
  expect(Math.abs(l!.y - e!.y)).toBeLessThan(2);
  await expect(page.locator(".status .maplibregl-ctrl-scale")).toBeVisible();
});

test("list rows and map pins highlight each other, and the map can fly back to the pick", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "hover is a laptop check");
  await ready(page);
  await expect(page.locator(".pin")).toHaveCount(20);
  const fourth = row(page, 4);
  const id = await fourth.getAttribute("data-i");
  await fourth.hover();
  await expect(page.locator(`.pin.hot[data-i="${id}"]`)).toHaveCount(1);
  await fourth.locator(".rk-row").focus();
  await expect(page.locator(`.pin.hot[data-i="${id}"]`)).toHaveCount(1);
  const pin = page.locator(`.pin[data-i="${await row(page, 1).getAttribute("data-i")}"]`);
  await pin.dispatchEvent("mouseenter");
  await expect(page.locator("#rank li.hot")).toHaveCount(1);
  await expect(row(page, 1)).toHaveClass(/hot/);
  await expect(page.locator("#back")).toBeHidden();
  for (let k = 0; k < 3; k++) await page.locator(".maplibregl-ctrl-zoom-in").click();
  const box = (await page.locator("#earth").boundingBox())!;
  await expect(page.locator("#back")).toBeHidden();
  for (let k = 0; k < 2; k++) {
    await page.mouse.move(box.x + box.width * 0.35, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.98, box.y + 100, { steps: 15 });
    await page.mouse.up();
  }
  await expect(page.locator("#back")).toBeVisible();
  await page.locator("#back").click();
  await expect(page.locator("#back")).toBeHidden({ timeout: 8000 });
});

test("old Moon and Mars links open Home at their chapter, and a base there opens the Finder", async ({ page }) => {
  await page.goto("/#/mars");
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("#ch-mars")).toBeInViewport();
  const ts = m.targets.filter((t) => t.body === "mars");
  const sites = page.locator("#ch-mars a.site");
  await expect(sites).toHaveCount(ts.length);
  await expect(sites.first()).toHaveAttribute("aria-current", "true");
  await sites.nth(1).hover();
  await expect(sites.nth(1)).toHaveAttribute("aria-current", "true");
  await sites.nth(1).focus();
  await page.keyboard.press("ArrowDown");
  await expect(sites.nth(2)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${ts[2].id}`));
  await page.locator("#now-change").evaluate((a) => (a as HTMLElement).click());
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("#ch-mars")).toBeInViewport();
  await page.goto("/#/moon");
  await expect(page.locator("#ch-moon")).toBeInViewport();
});

test("page nav fits, marks the current page, and links open folded blocks", async ({ page }, info) => {
  await page.goto("/#/about");
  const nav = page.locator(".top nav a");
  if (info.project.name === "phone") await page.locator("#menu-btn").click();
  await expect(nav).toHaveText(["Home", "Finder", "Learn", "About"]);
  for (const box of await nav.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().toJSON()))) expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator(".top nav").evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
  await expect(nav.nth(3)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".top nav a[aria-current]")).toHaveCount(1);
  if (info.project.name === "phone") await page.keyboard.press("Escape");
  await expect(page.locator("#terrain")).not.toHaveAttribute("open", "");
  await page.locator(".ab-toc a[href='#challenge']").click();
  await expect(page.locator("#challenge")).toBeInViewport();
  await page.locator("#terrain > summary").click();
  await expect(page.locator("#terrain")).toHaveAttribute("open", "");
  await page.locator("#terrain a[href='#/find']").click();
  await expect(page).toHaveURL(/#\/find/);
  await expect(rows(page)).toHaveCount(20);
  await page.goto("/#/checks");
  await expect(page).toHaveURL(/#\/about$/);
  await expect(page.locator("#checked")).toBeInViewport();
});

test("an old link to a validation run lands on About's How we checked it", async ({ page }) => {
  await page.goto("/#third-run");
  await expect(page.locator("#checked")).toBeVisible();
  await expect(page.locator("#checked")).toBeInViewport();
});

test("the guided tour starts from the Finder, steps on, and closes on Escape", async ({ page }) => {
  await ready(page);
  await page.locator("#tour").click();
  const box = page.locator(".tour-box");
  await expect(box).toBeVisible();
  await expect(box.locator(".tour-n")).toHaveText(/^1 of \d+$/);
  await box.locator(".tour-next").click();
  await expect(box.locator(".tour-n")).toHaveText(/^2 of \d+$/);
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
  await expect(page.locator("#tour")).toBeFocused();
});

test("Home counts the land, says what Earth can't copy for each world, and turns to known analog places", async ({ page }) => {
  const { t } = cols(m, main.id);
  const ranked = [...t[`score:${m.filters[0].id}`]].filter((v) => !Number.isNaN(v)).length;
  await page.goto("/#/");
  const counts = page.locator("#ch-count .counts > div");
  await expect(counts).toHaveCount(3);
  await expect(counts.nth(0).locator("dt")).toHaveText(m.grid.n.toLocaleString("en-US"));
  await expect(page.locator("#count-ranked")).toHaveText(ranked.toLocaleString("en-US"));
  await expect(page.locator("#count-known")).toHaveText(/^\d+$/);
  const tops = await counts.evaluateAll((ds) => ds.map((d) => Math.round(d.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  for (const b of ["moon", "mars"] as const) {
    await expect(page.locator(`#ch-${b} .cant dl > div`)).toHaveCount(m.cant_copy.length);
    await expect(page.locator(`#ch-${b} .w-val, #ch-${b} .w-solve, #ch-${b} .w-analog`)).toHaveCount(0);
  }
  const places = page.locator(".places a.place-link");
  await expect(places).toHaveCount(6);
  await expect(places.first()).toHaveAttribute("aria-current", "true");
  await places.nth(3).focus();
  await expect(places.nth(3)).toHaveAttribute("aria-current", "true");
  await expect(places.first()).not.toHaveAttribute("aria-current");
  await expect(page.locator("#place-note .place-open")).toBeVisible();
  await places.nth(3).click();
  await expect(page).toHaveURL(/#\/place\?.*known=1.*c=\d+/);
  await expect(page.locator(".card")).toHaveCount(1);
  await page.goBack();
  await page.locator("#ch-go a.go").click();
  await expect(page).toHaveURL(/#\/find/);
});

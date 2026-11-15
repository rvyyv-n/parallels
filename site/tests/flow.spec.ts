import { expect, test, type Page } from "@playwright/test";
import { cols, manifest } from "./helpers";
import { handScore, top } from "../src/score";

const m = manifest();
const rows = (p: Page) => p.locator("#ledger li[data-i]");
const order = (p: Page) => rows(p).evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.i)));
const main = m.targets.find((x) => x.default) ?? m.targets[0];
const nameOf = async (p: Page, i: number) => (await rows(p).nth(i).locator(".r-name").innerText()).replace(/\s*(rarely used|ice sheet)\s*/gi, "").trim();

async function ready(p: Page, q = "") {
  await p.goto(`/#/find${q ? `?${q}` : ""}`);
  await expect(rows(p)).toHaveCount(10);
}

type V = { tests: { checks: { passed: boolean | null }[] }[]; adopted?: boolean; preset?: string; title: string };
const nowRun = (v: { third_run?: V; more_runs?: V[] }) => [v.third_run, ...(v.more_runs ?? [])].filter((r): r is V => !!r && !r.preset).reverse().find((r) => r.adopted);

test("main flow: pick a site on its world's page, pick a filter, open a match, read the scorecard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const target = m.targets[m.targets.length - 1];
  const filter = m.filters[m.filters.length - 1];
  await page.goto(`/#/${target.body}`);
  if (m.sample) await expect(page.getByRole("note")).toContainText("Sample data");
  await page.locator(`.page:not([hidden]) .chip.site[data-site="${target.id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${target.id}`));
  await expect(rows(page)).toHaveCount(10);
  await expect(page.locator("#find-h")).toContainText(target.name);
  await expect(page.locator(`[data-target="${target.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await page.locator(`.presets [data-filter="${filter.id}"]`).click();
  await expect(page.locator(`.presets [data-filter="${filter.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#find-h")).toContainText(filter.name);
  await expect(page.locator(".card")).toHaveCount(0);

  const row = rows(page).nth(2);
  const id = await row.getAttribute("data-i");
  const name = await nameOf(page, 2);
  await row.locator(".row").click();
  await expect(page).toHaveURL(new RegExp(`#/place\\?t=${target.id}&f=${filter.id}.*c=${id}`));
  await expect(page.locator("#place-h")).toContainText(target.name);
  await expect(page.locator("#card h3")).toHaveText(name);

  await expect(page.locator(".card .o-num b")).not.toBeEmpty();
  await expect(page.locator(".card .ch")).toHaveCount(m.challenges[target.body].length);
  const open = page.locator(".card .ch details[open]");
  await expect(open).toHaveCount(1);
  expect(await open.locator(".trait").count()).toBeGreaterThan(0);
  const units = m.traits.filter((t) => t.unit).map((t) => t.unit);
  const vals = await open.locator(".t-vals dd").allInnerTexts();
  expect(vals.some((v) => units.some((u) => v.includes(u)))).toBe(true);
  await expect(open.locator(".t-src").first()).toContainText("Earth");
  await expect(page.locator(".card h4", { hasText: "Where it breaks" })).toBeVisible();
  await expect(page.locator(".card h4", { hasText: "Earth can't copy" })).toBeVisible();
  await expect(page.locator(".card .cant tbody tr")).toHaveCount(m.cant_copy.length);
  await expect(page.locator(".card h4", { hasText: "Seasons" })).toBeVisible();

  await page.locator("#back-find").click();
  await expect(page).toHaveURL(new RegExp(`#/find\\?t=${target.id}&f=${filter.id}`));
  await expect(page.locator(`#ledger li[data-i="${id}"] .row`)).toHaveClass(/on/);
  expect(errors).toEqual([]);
});

test("a shared link opens the same place", async ({ page }) => {
  const f = m.filters[1] ?? m.filters[0];
  const { t, cells } = cols(m, main.id);
  const { ids } = top(t[`score:${f.id}`], 10, cells);
  await ready(page, `t=${main.id}&f=${f.id}`);
  const name = await nameOf(page, 4);
  await page.goto("about:blank");
  await page.goto(`/?t=${main.id}&f=${f.id}&c=${ids[4]}`);
  await expect(page).toHaveURL(new RegExp(`#/place\\?t=${main.id}&f=${f.id}&c=${ids[4]}$`));
  await expect(page.locator("#card h3")).toHaveText(name);
  await page.locator("#back-find").click();
  await expect(page.locator(`.presets [data-filter="${f.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`#ledger li[data-i="${ids[4]}"] .row`)).toHaveAttribute("aria-current", "true");
});

test("year-round switch reorders the list exactly as the year-round scores say", async ({ page }) => {
  const f = m.filters[0];
  const { t, cells } = cols(m, main.id);
  const plain = top(t[`score:${f.id}`], 10, cells).ids;
  const yr = top(t[`score:${f.id}:yr`], 10, cells).ids;
  await ready(page, `t=${main.id}&f=${f.id}`);
  expect(await order(page)).toEqual(plain);
  await page.locator("#pick-yr").check({ force: true });
  await expect.poll(() => order(page)).toEqual(yr);
  if (JSON.stringify(plain) !== JSON.stringify(yr)) expect(await order(page)).not.toEqual(plain);
  await expect(page).toHaveURL(/yr=1/);
});

test("hand-set weights change the ranking", async ({ page }) => {
  const f = m.filters[0];
  const fw = f.weights[main.body];
  const { t, cells } = cols(m, main.id);
  await ready(page, `t=${main.id}&f=${f.id}`);
  const before = await order(page);
  await page.locator("#hand summary").click();
  const chs = m.challenges[main.body].filter((c) => t[`ch:${c.id}`]);
  const w: Record<string, number> = { ...Object.fromEntries(chs.map((c) => [c.id, 0])), ...fw };
  const off = Object.keys(fw)[0];
  const on = chs.find((c) => !(fw[c.id] > 0))!.id;
  for (const [id, v] of [
    [on, 5],
    [off, 0],
  ] as const) {
    await page.locator(`#sliders input[data-ch="${id}"]`).fill(String(v));
    w[id] = v;
  }
  const expected = top(handScore(m, t, w, m.grid.n), 10, cells).ids;
  await expect.poll(() => order(page)).toEqual(expected);
  expect(expected).not.toEqual(before);
  await expect(page.locator('.presets [data-filter="__hand"]')).toBeVisible();
  await expect(page.locator('.presets [data-filter="__hand"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#pick-yr")).toBeDisabled();
  await expect(page).toHaveURL(/w=/);
});

test("the top 10 never lists two cells within 150 km of each other", async ({ page }) => {
  for (const t of m.targets) {
    await ready(page, `t=${t.id}`);
    await expect.poll(() => page.locator(`[data-target="${t.id}"]`).getAttribute("aria-pressed")).toBe("true");
    const ids = await order(page);
    const { cells } = cols(m, t.id);
    const r = Math.PI / 180;
    const km = (a: number, b: number) =>
      12742 *
      Math.asin(
        Math.sqrt(
          Math.sin(((cells.lat[b] - cells.lat[a]) * r) / 2) ** 2 +
            Math.cos(cells.lat[a] * r) * Math.cos(cells.lat[b] * r) * Math.sin(((cells.lon[b] - cells.lon[a]) * r) / 2) ** 2,
        ),
      );
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) expect(km(ids[a], ids[b])).toBeGreaterThanOrEqual(150);
  }
});

test("no horizontal scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await rows(page).first().locator(".row").click();
  await expect(page.locator(".card")).toHaveCount(1);
  await page.locator(".card .ch details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("every internal link resolves to a page or an anchor", async ({ page }) => {
  await ready(page);
  const c = await rows(page).first().getAttribute("data-i");
  for (const h of ["#/", "#/moon", "#/mars", `#/place?t=${main.id}&c=${c}`, "#/checks", "#/about"]) await page.evaluate((x) => (location.hash = x), h);
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.locator("#checked .run-hist")).toBeAttached();
  await expect(page.locator(".page")).toHaveCount(7);
  const hrefs = await page.locator("a[href^='#']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  const routes = ["", "moon", "mars", "find", "place", "checks", "about"];
  const badRoutes = hrefs.filter((h) => h.startsWith("#/")).filter((h) => !routes.includes(h.slice(2).split("?")[0]));
  expect(badRoutes).toEqual([]);
  const missing = await page.evaluate((hs) => hs.filter((h) => !h.startsWith("#/")).map((h) => h.slice(1)).filter((id) => !id || !document.getElementById(id)), hrefs);
  expect(missing).toEqual([]);
});

test("footer carries the AI note on every page", async ({ page }) => {
  for (const h of ["", "moon", "mars", "find", "checks", "about"]) {
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

test("validation shows the first run, then later runs when present", async ({ page, request }) => {
  const v = await (await request.get("/data/validation.json")).json();
  const checks = async () => {
    await page.goto("about:blank");
    await page.goto("/#/checks");
    await page.locator("#first-run").waitFor({ state: "attached" });
  };
  await checks();
  const count = (r: { tests: { checks: { passed: boolean | null }[] }[] }) => r.tests.flatMap((t) => t.checks).filter((c) => c.passed != null).length;
  await expect(page.locator("#first-run .v-checks tbody tr")).toHaveCount(count(v));
  const now = nowRun(v);
  if (now) {
    const id = now === v.third_run ? "third-run" : `run-${[v.second_run, v.third_run].filter(Boolean).length + 2 + (v.more_runs ?? []).indexOf(now)}`;
    await expect(page.locator(".chk-head + div")).toHaveAttribute("id", id);
    await expect(page.locator(`#${id} .v-checks`).first().locator("tbody tr")).toHaveCount(count(now));
    await expect(page.locator(`#${id}`)).toContainText(now.title);
    const big = page.locator(".chk-score .v-count-big");
    await expect(big).toBeVisible();
    await expect(big).toContainText(`${now.tests.flatMap((t) => t.checks).filter((c) => c.passed).length} of ${count(now)}`);
    const fails = page.locator(`#${id} .v-fail-list`);
    const failed = (now.tests as { checks: { name: string; pass_mark: number; passed: boolean | null }[] }[]).flatMap((t) => t.checks).filter((c) => c.passed === false);
    await expect(fails.locator(".cbar")).toHaveCount(failed.length);
    for (const c of failed) {
      await expect(fails).toBeVisible();
      await expect(fails).toContainText(c.name);
      await expect(fails).toContainText(`against a pass mark of ${Math.round(c.pass_mark * 100)}%`);
    }
    await expect(fails.locator(".cbar-st").first()).toContainText("Not passed");
    await expect(page.locator(".current-box")).toContainText(now.title.match(/method version ([\d.]+)/i)?.[1] ?? now.title);
    await expect(page.locator(".run-hist li")).toHaveCount([v.tests, v.second_run, v.third_run, ...(v.more_runs ?? [])].filter(Boolean).length);
    await expect(page.locator(".run-hist .rh-now")).toContainText("Used now");
  }
  for (const [i, r] of (v.more_runs ?? []).entries()) await expect(page.locator(`#run-${[v.second_run, v.third_run].filter(Boolean).length + 2 + i}`)).toContainText(r.title);
  await expect(page.locator("#second-run")).toHaveCount(v.second_run ? 1 : 0);
  await expect(page.locator("#third-run")).toHaveCount(v.third_run ? 1 : 0);
  const base = v.second_run ?? { title: "Run", plain: "", designed_after_first_run: true, config_commit: "x", summary: "", tests: v.tests, unchecked: [] };
  await page.route("**/data/validation.json", async (r) =>
    r.fulfill({ json: { ...v, third_run: { ...base, title: "Third run test", method_change: "Changed X", adopted: false, adoption_rule: "Rule Y" } } }),
  );
  await checks();
  await expect(page.locator("#third-run")).toContainText("Third run test");
  await expect(page.locator("#third-run")).toContainText("Changed X");
  await expect(page.locator("#third-run")).toContainText("Rule Y");
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
  await rows(page).first().locator(".row").click();
  await page.locator(".card .eimg").scrollIntoViewIfNeeded();
  await expect(page.locator(".card .eimg.fb")).toHaveCount(1);
  await page.evaluate(() => (location.hash = "#/checks"));
  await page.locator("#checked .run-hist").waitFor();
  await page.evaluate(() => (location.hash = "#/"));
  await expect(page.locator("#intro-h")).toBeVisible();
  expect(errors).toEqual([]);
  expect([...new Set(outside)].filter((h) => h !== "gibs.earthdata.nasa.gov" && h !== "trek.nasa.gov")).toEqual([]);
});

test("keyboard alone reaches the pickers, the top 10, the scorecard and the sliders", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "keyboard path is a laptop check");
  await ready(page);
  const chips = page.locator(".bar [data-target]");
  await chips.nth(1).focus();
  await page.keyboard.press("Tab");
  await expect(chips.nth(2)).toBeFocused();
  await chips.nth(2).press("Enter");
  await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(10);
  const second = rows(page).nth(1).locator(".row");
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
  await page.locator("#hand summary").focus();
  await page.keyboard.press("Enter");
  const slider = page.locator("#sliders input").first();
  await slider.focus();
  const before = await slider.inputValue();
  await page.keyboard.press("ArrowRight");
  expect(await slider.inputValue()).not.toBe(before);
  await expect(page.locator('.presets [data-filter="__hand"]')).toHaveAttribute("aria-pressed", "true");
});

test("two-column Finder with the list beside the map, and no scorecard on it", async ({ page }, info) => {
  await ready(page);
  await expect(page.locator(".tglobe, #link, .card, #card")).toHaveCount(0);
  if (info.project.name !== "laptop") return;
  const [l, e] = await Promise.all([page.locator(".ledger-col").boundingBox(), page.locator(".earth-col").boundingBox()]);
  expect(l!.x + l!.width).toBeLessThanOrEqual(e!.x + 1);
  expect(Math.abs(l!.y - e!.y)).toBeLessThan(2);
  await expect(page.locator(".status .maplibregl-ctrl-scale")).toBeVisible();
});

test("list rows and map pins highlight each other, and the map can fly back to the pick", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "hover is a laptop check");
  await ready(page);
  await expect(page.locator(".pin")).toHaveCount(10);
  const row = rows(page).nth(3);
  const id = await row.getAttribute("data-i");
  await row.hover();
  await expect(page.locator(`.pin.hot[data-i="${id}"]`)).toHaveCount(1);
  await row.locator(".row").focus();
  await expect(page.locator(`.pin.hot[data-i="${id}"]`)).toHaveCount(1);
  const pin = page.locator(`.pin[data-i="${await rows(page).nth(0).getAttribute("data-i")}"]`);
  await pin.dispatchEvent("mouseenter");
  await expect(page.locator("#ledger li.hot")).toHaveCount(1);
  await expect(rows(page).nth(0)).toHaveClass(/hot/);
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

test("Home's two choices open the Moon and Mars pages", async ({ page }) => {
  await page.goto("/#/");
  await page.locator('.choice[href="#/mars"]').click();
  await expect(page).toHaveURL(/#\/mars$/);
  await expect(page.locator("#mars-h")).toBeVisible();
  await page.goBack();
  await page.locator('.choice[href="#/moon"]').click();
  await expect(page.locator("#moon-h")).toBeVisible();
});

test("page nav fits, marks the current page, and links open folded blocks", async ({ page }, info) => {
  await page.goto("/#/about");
  const nav = page.locator(".top nav a");
  if (info.project.name === "phone") await page.locator("#menu-btn").click();
  await expect(nav).toHaveText(["Home", "The Moon", "Mars", "Finder", "Checks", "About"]);
  for (const box of await nav.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().toJSON()))) expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator(".top nav").evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
  await expect(nav.nth(5)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".top nav a[aria-current]")).toHaveCount(1);
  if (info.project.name === "phone") await page.keyboard.press("Escape");
  await expect(page.locator("#benchmarks")).not.toHaveAttribute("open", "");
  await page.locator("#benchmarks > summary").click();
  await page.locator("#benchmarks a[href='#terrain']").first().click();
  await expect(page.locator("#terrain")).toHaveAttribute("open", "");
  await expect(page.locator("#terrain")).toBeInViewport();
  await page.locator("#benchmarks a[href='#explore']").first().click();
  await expect(page).toHaveURL(/#\/find/);
  await expect(rows(page)).toHaveCount(10);
  await page.goto("/#/checks");
  await page.locator(".run-hist a[href='#second-run']").click();
  await expect(page.locator("#second-run")).toBeVisible();
  await expect(page.locator("#second-run")).toBeInViewport();
});

test("a link with a hash to a folded block opens it on load", async ({ page }) => {
  await page.goto("/#third-run");
  await expect(page.locator("#third-run")).toBeVisible();
  await expect(page.locator("#third-run")).toBeInViewport();
});

test("each check of the current run is a bar against its pass mark, failed first and visible", async ({ page, request }) => {
  type C = { name: string; pass_mark: number; result: number | null; passed: boolean | null };
  const v = await (await request.get("/data/validation.json")).json();
  const now = nowRun(v) ?? { tests: v.tests };
  const cs = (now.tests as { checks: C[] }[]).flatMap((t) => t.checks);
  const failed = cs.filter((c) => c.passed === false);
  const passed = cs.filter((c) => c.passed === true);
  await page.goto("/#/checks");
  const box = page.locator(".chk-head + div");
  const bars = box.locator(".verdict > .v-fail-list .cbar");
  await expect(bars).toHaveCount(failed.length);
  for (const [i, c] of failed.entries()) {
    const b = bars.nth(i);
    await expect(b).toBeVisible();
    await expect(b.locator(".cbar-st")).toHaveText(/Not passed/);
    if (c.result != null) expect(await b.locator(".cbar-fill").evaluate((e) => parseFloat((e as HTMLElement).style.width))).toBeCloseTo(c.result * 100, 3);
    expect(await b.locator(".cbar-mark").evaluate((e) => parseFloat((e as HTMLElement).style.left))).toBeCloseTo(c.pass_mark * 100, 3);
  }
  const ok = box.locator(".verdict > .v-passed");
  await expect(ok.locator("summary")).toContainText(`Passed (${passed.length})`);
  await ok.locator("summary").click();
  await expect(ok.locator(".cbar .cbar-st", { hasText: "Passed" })).toHaveCount(passed.length);
  if (cs.some((c) => c.passed == null)) await expect(box.locator(".not-run")).toBeVisible();
});

test("the guided tour steps through the Finder and closes on Escape", async ({ page }) => {
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

test("Home shows what Earth can't copy for both worlds, and each world's page its known analog sites", async ({ page }) => {
  await page.goto("/#/");
  await expect(page.locator("#ch-moon .facts dl > div")).toHaveCount(m.cant_copy.length);
  await expect(page.locator("#ch-mars .facts dl > div")).toHaveCount(m.cant_copy.length);
  for (const b of ["moon", "mars"] as const) {
    await page.goto(`/#/${b}`);
    await expect(page.locator(`#w-${b} .w-analog`).first()).toBeVisible();
    await expect(page.locator(`#w-${b} .w-val`).first()).toBeVisible();
    await expect(page.locator(`#w-${b} .w-solve li`)).toHaveCount(m.challenges[b].length);
  }
});

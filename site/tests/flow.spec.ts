import { expect, test, type Page } from "@playwright/test";
import { cols, manifest } from "./helpers";
import { handScore, top } from "../src/score";

const m = manifest();
const rows = (p: Page) => p.locator("#ledger li[data-i]");
const order = (p: Page) => rows(p).evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.i)));
const main = m.targets.find((x) => x.default) ?? m.targets[0];

async function ready(p: Page, q = "") {
  await p.goto(`/${q}`);
  await expect(rows(p)).toHaveCount(10);
}

test("main flow: pick a target and a filter, open a match, read the scorecard", async ({ page }) => {
  await ready(page);
  if (m.sample) await expect(page.getByRole("note")).toContainText("Sample data");
  await expect(page.locator("#card h3")).not.toBeEmpty();

  const target = m.targets[m.targets.length - 1];
  const filter = m.filters[m.filters.length - 1];
  await page.locator(`.intro [data-target="${target.id}"]`).click();
  await page.locator(`.intro [data-filter="${filter.id}"]`).click();
  await expect(page.locator(`.bar [data-target="${target.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#now")).toContainText(target.name);
  await expect(page.locator("#intro-best")).toContainText("Best match now");
  await expect(page.locator("#tcap")).toContainText(target.name);

  const row = rows(page).nth(2);
  const name = (await row.locator(".r-name").innerText()).replace(/\s*rarely used\s*$/i, "").trim();
  await row.locator("button").click();
  await expect(row.locator("button")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#card h3")).toHaveText(name);
  await expect(page).toHaveURL(new RegExp(`t=${target.id}.*f=${filter.id}.*c=${await row.getAttribute("data-i")}`));

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
});

test("a shared link opens the same view", async ({ page }) => {
  const f = m.filters[1] ?? m.filters[0];
  const { t, cells } = cols(m, main.id);
  const { ids } = top(t[`score:${f.id}`], 10, cells);
  await ready(page, `?t=${main.id}&f=${f.id}&c=${ids[4]}`);
  await expect(page.locator(`.intro [data-filter="${f.id}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#explore")).toBeInViewport();
  await expect(page.locator(`#ledger li[data-i="${ids[4]}"] button`)).toHaveAttribute("aria-pressed", "true");
});

test("year-round switch reorders the list exactly as the year-round scores say", async ({ page }) => {
  const f = m.filters[0];
  const { t, cells } = cols(m, main.id);
  const plain = top(t[`score:${f.id}`], 10, cells).ids;
  const yr = top(t[`score:${f.id}:yr`], 10, cells).ids;
  await ready(page, `?t=${main.id}&f=${f.id}`);
  expect(await order(page)).toEqual(plain);
  await page.locator("#pick-yr").check({ force: true });
  await expect.poll(() => order(page)).toEqual(yr);
  if (JSON.stringify(plain) !== JSON.stringify(yr)) expect(await order(page)).not.toEqual(plain);
});

test("hand-set weights change the ranking", async ({ page }) => {
  const f = m.filters[0];
  const fw = f.weights[main.body];
  const { t, cells } = cols(m, main.id);
  await ready(page, `?t=${main.id}&f=${f.id}`);
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
  await expect(page.locator('.intro [data-filter="__hand"]')).toBeVisible();
  await expect(page.locator('.intro [data-filter="__hand"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#pick-yr")).toBeDisabled();
});

test("the top 10 never lists two cells within 150 km of each other", async ({ page }) => {
  for (const t of m.targets) {
    await ready(page, `?t=${t.id}`);
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
  await page.locator(".card .ch details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("every internal anchor resolves", async ({ page }) => {
  await ready(page);
  await page.locator("#checked").waitFor();
  const missing = await page
    .locator("a[href^='#']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")!.slice(1)).filter((id) => !id || !document.getElementById(id)));
  expect(missing).toEqual([]);
});

test("footer carries the AI note", async ({ page }) => {
  await ready(page);
  await expect(page.locator("footer .ai")).toContainText("How we used AI");
});

test("sample banner shows only for sample data", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".sample")).toHaveCount(m.sample ? 1 : 0);
  await page.route("**/data/manifest.json", async (r) => r.fulfill({ json: { ...m, sample: true } }));
  await ready(page);
  await expect(page.locator(".sample")).toHaveCount(1);
});

test("validation shows the first run, then later runs when present", async ({ page, request }) => {
  const v = await (await request.get("/data/validation.json")).json();
  await ready(page);
  const count = (r: { tests: { checks: { passed: boolean | null }[] }[] }) => r.tests.flatMap((t) => t.checks).filter((c) => c.passed != null).length;
  await expect(page.locator("#first-run .v-checks tbody tr")).toHaveCount(count(v));
  const later = [v.third_run, ...(v.more_runs ?? [])].filter(Boolean);
  const now = [...later].reverse().find((r) => r.adopted);
  if (now) {
    const id = now === v.third_run ? "third-run" : `run-${[v.second_run, v.third_run].filter(Boolean).length + 2 + (v.more_runs ?? []).indexOf(now)}`;
    await expect(page.locator(".chk-head + div")).toHaveAttribute("id", id);
    await expect(page.locator(`#${id} .v-checks`).first().locator("tbody tr")).toHaveCount(count(now));
    await expect(page.locator(`#${id}`)).toContainText(now.title);
    const big = page.locator(".chk-score .v-count-big");
    await expect(big).toBeVisible();
    await expect(big).toContainText(`${now.tests.flatMap((t: { checks: { passed: boolean | null }[] }) => t.checks).filter((c: { passed: boolean | null }) => c.passed).length} of ${count(now)}`);
    const fails = page.locator(`#${id} .v-fail-list`);
    const failed = now.tests.flatMap((t: { checks: { name: string; pass_mark: number; passed: boolean | null }[] }) => t.checks).filter((c: { passed: boolean | null }) => c.passed === false);
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
  await ready(page);
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
  await page.locator(".card .eimg").scrollIntoViewIfNeeded();
  await expect(page.locator(".card .eimg.fb")).toHaveCount(1);
  await page.locator("#checked").waitFor();
  expect(errors).toEqual([]);
  expect([...new Set(outside)].filter((h) => h !== "gibs.earthdata.nasa.gov" && h !== "trek.nasa.gov")).toEqual([]);
});

test("keyboard alone reaches the pickers, the top 10, the scorecard and the sliders", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "keyboard path is a laptop check");
  await ready(page);
  const chips = page.locator(".intro .chip:visible");
  await chips.nth(1).focus();
  await page.keyboard.press("Tab");
  await expect(chips.nth(2)).toBeFocused();
  await chips.nth(2).press("Enter");
  await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "true");
  await page.locator("#go").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#explore")).toBeInViewport();
  const second = rows(page).nth(1).locator("button");
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  const summary = page.locator(".card .ch summary").nth(1);
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".card .ch details").nth(1)).toHaveAttribute("open", "");
  await page.locator("#hand summary").focus();
  await page.keyboard.press("Enter");
  const slider = page.locator("#sliders input").first();
  await slider.focus();
  const before = await slider.inputValue();
  await page.keyboard.press("ArrowRight");
  expect(await slider.inputValue()).not.toBe(before);
  await expect(page.locator('.intro [data-filter="__hand"]')).toHaveAttribute("aria-pressed", "true");
});

test("two-column explorer with the match view below it, no inner scroll", async ({ page }, info) => {
  await ready(page);
  await page.locator("#explore").evaluate((e) => e.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator(".tglobe, #link")).toHaveCount(0);
  await expect(page.locator("#match .match-head #tcap")).toContainText(main.name);
  await expect(page.locator("#match .ask-note #ask-sub")).toBeAttached();
  const card = page.locator("#card");
  expect(await card.evaluate((c) => c.scrollHeight <= c.clientHeight + 1)).toBe(true);
  if (info.project.name !== "laptop") return;
  const [l, e] = await Promise.all([page.locator(".ledger-col").boundingBox(), page.locator(".earth-col").boundingBox()]);
  expect(l!.x + l!.width).toBeLessThanOrEqual(e!.x + 1);
  expect(Math.abs(l!.y - e!.y)).toBeLessThan(2);
  await expect(page.locator("#card h3")).toBeInViewport();
  await expect(page.locator(".status .maplibregl-ctrl-scale")).toBeVisible();
  await page.locator("#ledger .why").click();
  await expect(card).toBeInViewport();
});

test("list rows and map pins highlight each other, and the map can fly back to the pick", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "hover is a laptop check");
  await ready(page);
  await page.locator("#explore").evaluate((e) => e.scrollIntoView({ behavior: "instant" }));
  await expect(page.locator(".pin")).toHaveCount(10);
  const row = rows(page).nth(3);
  const id = await row.getAttribute("data-i");
  await row.hover();
  await expect(page.locator(`.pin.hot[data-i="${id}"]`)).toHaveCount(1);
  await row.locator("button").focus();
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

test("skip intro goes straight to the explorer", async ({ page }) => {
  await ready(page);
  await page.locator("#skip-intro").click();
  await expect(page.locator("#explore")).toBeInViewport();
});

test("section nav fits, marks the current section, and links open folded blocks", async ({ page }) => {
  await ready(page);
  await page.locator("#checked").waitFor();
  const nav = page.locator(".top nav a");
  await expect(nav).toHaveText(["Worlds", "Checks", "Challenge", "Data", "Limits"]);
  for (const box of await nav.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().toJSON())))
    expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator(".top nav").evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
  await nav.nth(3).click();
  await expect(nav.nth(3)).toHaveAttribute("aria-current", /.+/);
  await expect(page.locator(".top nav a[aria-current]")).toHaveCount(1);
  await expect(page.locator("#benchmarks")).not.toHaveAttribute("open", "");
  await page.locator("#benchmarks > summary").click();
  await page.locator("#benchmarks a[href='#terrain']").first().click();
  await expect(page.locator("#terrain")).toHaveAttribute("open", "");
  await expect(page.locator("#terrain")).toBeInViewport();
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
  const runs = [v.third_run, ...(v.more_runs ?? [])].filter(Boolean);
  const now = [...runs].reverse().find((r) => r.adopted) ?? { tests: v.tests };
  const cs: C[] = now.tests.flatMap((t: { checks: C[] }) => t.checks);
  const failed = cs.filter((c) => c.passed === false);
  const passed = cs.filter((c) => c.passed === true);
  await ready(page);
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

test("the guided tour steps through the page and closes on Escape", async ({ page }) => {
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

test("the worlds section shows both worlds and their known analog sites", async ({ page }) => {
  await ready(page);
  await expect(page.locator("#w-moon .w-fact")).toHaveCount(m.cant_copy.length);
  await expect(page.locator("#w-moon .w-analog").first()).toBeVisible();
  await page.locator('#worlds [data-show="mars"]').click();
  await expect(page.locator("#w-moon")).toBeHidden();
  await expect(page.locator("#w-mars .w-fact")).toHaveCount(m.cant_copy.length);
});

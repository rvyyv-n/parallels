import { expect, test, type Page } from "@playwright/test";
import { cols, manifest } from "./helpers";
import { score100 } from "../src/format";
import { km } from "../src/score";
import { APART_KM, bandOf, countryOf, isNew, PER_COUNTRY, spread, worldOf } from "../src/rank";

const m = manifest();
const main = m.targets.find((x) => x.default) ?? m.targets[0];
const balanced = m.filters.find((f) => f.id === "balanced") ?? m.filters[0];
const rows = (p: Page) => p.locator("#rank li[data-i]");
const order = (p: Page) =>
  rows(p).evaluateAll((els) => els.map((e) => [Number((e as HTMLElement).dataset.rank), Number((e as HTMLElement).dataset.i)]).sort((a, b) => a[0] - b[0]).map((x) => x[1]));

async function ready(p: Page, q = "") {
  await p.goto(`/#/find${q ? `?${q}` : ""}`);
  await expect(rows(p)).toHaveCount(20);
}

test("C0: the sidebar sits left of the map, scrolls on its own, and nothing overflows on a phone", async ({ page }, info) => {
  await ready(page);
  if (info.project.name === "laptop") {
    const vp = page.viewportSize()!;
    const [side, map] = await Promise.all([page.locator(".fd-side").boundingBox(), page.locator(".earth-col").boundingBox()]);
    expect(side!.x).toBeLessThan(2);
    expect(side!.width).toBeGreaterThan(300);
    expect(side!.width).toBeLessThan(420);
    expect(Math.abs(side!.x + side!.width - map!.x)).toBeLessThan(2);
    expect(map!.x + map!.width).toBeGreaterThanOrEqual(vp.width - 2);
    const before = await page.locator("#earth").boundingBox();
    await page.locator(".fd-side").evaluate((e) => (e.scrollTop = 600));
    expect(await page.locator(".fd-side").evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator("#earth").boundingBox()).toEqual(before);
  } else {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
});

test("C1: the summary card counts come from the data", async ({ page }) => {
  await ready(page, `t=${main.id}`);
  const { cells, t } = cols(m, main.id);
  const s = t[`score:${balanced.id}`];
  const { ids } = spread(m, s, cells, () => true, false);
  const sum = page.locator("#summary");
  await expect(sum.locator(".sum-name")).toHaveText(m.regions[cells.region[ids[0]]]);
  await expect(sum.locator(".sum-score b")).toHaveText(score100(s[ids[0]]));
  const facts = sum.locator(".sum-facts li");
  const countries = new Set(ids.map((i) => countryOf(m, cells, i))).size;
  await expect(facts.nth(0)).toHaveText(`20 sites in ${countries} countries`);
  await expect(facts.nth(1)).toContainText(`${ids.filter((i) => isNew(m, cells, i)).length} are new: not in our list of known analog sites`);
  await expect(facts.nth(2)).toHaveText(`${ids.filter((i) => t[`stable:${balanced.id}`][i] === 1).length} of 20 hold their place in every robustness test`);
  await sum.locator("#known").click();
  await expect(page).toHaveURL(/known=1/);
  await expect.poll(() => order(page)).toEqual(spread(m, s, cells, () => true, true).ids);
});

test("C2: top 20 with spread, one list by rank by default, grouped by world region on request, with the rules note", async ({ page }) => {
  for (const tg of [main, m.targets.find((x) => x.body === "mars")!]) {
    await ready(page, `t=${tg.id}`);
    const { cells, t } = cols(m, tg.id);
    const s = t[`score:${balanced.id}`];
    const want = spread(m, s, cells, () => true, false);
    await expect(page.locator(".rk-grp")).toHaveCount(0);
    await expect(page.locator('[data-sort="rank"]')).toHaveAttribute("aria-pressed", "true");
    expect(await rows(page).evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.i)))).toEqual(want.ids);
    await page.locator('[data-sort="region"]').click();
    await expect(page).toHaveURL(/by=region/);
    await expect(page.locator(".rk-grp").first()).toBeVisible();
    const ids = await order(page);
    expect(ids).toEqual(want.ids);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) expect(km(cells.lat[ids[a]], cells.lon[ids[a]], cells.lat[ids[b]], cells.lon[ids[b]])).toBeGreaterThanOrEqual(APART_KM);
    const per = new Map<string, number>();
    for (const i of ids) {
      const c = countryOf(m, cells, i);
      if (c) per.set(c, (per.get(c) ?? 0) + 1);
    }
    expect(Math.max(...per.values())).toBeLessThanOrEqual(PER_COUNTRY);
    expect(ids.every((i) => isNew(m, cells, i))).toBe(true);
    await expect(page.locator("#rules")).toHaveText(`Top 20 of ${want.pool.toLocaleString("en-US")} land cells · new sites only · 800 km apart · 2 per country at most`);
    for (const g of await page.locator(".rk-grp").all()) {
      const name = await g.getAttribute("data-group");
      const gi = await g.locator("li[data-i]").evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.i)));
      expect(gi.every((i) => worldOf(countryOf(m, cells, i)) === name)).toBe(true);
      const sc = gi.map((i) => s[i]);
      expect([...sc].sort((a, b) => b - a)).toEqual(sc);
      await expect(g.locator(".g-m")).toHaveText(`${gi.length} ${gi.length === 1 ? "site" : "sites"} · best ${score100(sc[0])}`);
    }
  }
});

test("C3: one chip per challenge, coloured by its band, with the band in the label", async ({ page }) => {
  await ready(page, `t=${main.id}`);
  const { t } = cols(m, main.id);
  const chs = m.challenges[main.body];
  for (const li of (await rows(page).all()).slice(0, 5)) {
    const i = Number(await li.getAttribute("data-i"));
    const chips = li.locator(".rk-chips .fc");
    await expect(chips).toHaveCount(chs.length);
    for (const [k, c] of chs.entries()) {
      const v = t[`ch:${c.id}`]?.[i] ?? NaN;
      const b = bandOf(v);
      await expect(chips.nth(k)).toHaveClass(new RegExp(b ? b.cls : "b-na"));
      await expect(chips.nth(k)).toHaveAttribute("aria-label", b ? `${c.name}: ${score100(v)} / 100, ${b.word}` : `${c.name}: no data`);
    }
  }
  await expect(page.locator("#key")).toContainText("Each strip shows how close a site is on every challenge:");
  await expect(page.locator("#rank")).not.toContainText("%  match");
});

test("C4: presets in one row, folded weights, all sliders at 1.0× equal the Balanced preset", async ({ page }) => {
  await ready(page, `t=${main.id}`);
  await expect(page.locator(".presets [data-filter]").first()).toHaveAttribute("data-filter", "balanced");
  await expect(page.locator('.presets [data-filter="balanced"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#weights")).not.toHaveAttribute("open", "");
  await page.locator("#weights > summary").click();
  const { cells, t } = cols(m, main.id);
  for (const c of m.challenges[main.body]) {
    const out = page.locator(`#sliders output[for="w-${c.id}"]`);
    if (t[`ch:${c.id}`]) await expect(out).toHaveText("1.0×");
    else {
      await expect(out).toHaveText("n/a");
      await expect(page.locator(`#sliders input[data-ch="${c.id}"]`)).toBeDisabled();
    }
  }
  const base = await order(page);
  expect(base).toEqual(spread(m, t[`score:${balanced.id}`], cells, () => true, false).ids);
  const id = m.challenges[main.body].find((c) => t[`ch:${c.id}`])!.id;
  await page.locator(`#sliders input[data-ch="${id}"]`).fill("2");
  await expect(page.locator(".rk-move").first()).toBeVisible();
  await page.locator(`#sliders input[data-ch="${id}"]`).fill("1");
  await expect.poll(() => order(page)).toEqual(base);
  await expect(page).not.toHaveURL(/w=/);
});

test("C5: ticking two rows shows both in the compare strip, and the URL keeps them", async ({ page }) => {
  await ready(page, `t=${main.id}`);
  const a = rows(page).nth(0);
  const b = rows(page).nth(1);
  const ids = [await a.getAttribute("data-i"), await b.getAttribute("data-i")];
  const names = [await a.locator(".rk-name").innerText(), await b.locator(".rk-name").innerText()];
  await a.locator("input[data-cmp]").check();
  await expect(page.locator("#compare")).toContainText("one more");
  await b.locator("input[data-cmp]").check();
  const strip = page.locator("#compare");
  for (const n of names) await expect(strip.locator(".cmp-name", { hasText: n })).toHaveCount(1);
  await expect(strip.locator(".cmp-open")).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(`cmp=${ids[0]}%2C${ids[1]}`));
  await page.reload();
  await expect(page.locator("#compare .cmp-name")).toHaveCount(2);
  await page.locator("#cmp-clear").click();
  await expect(page.locator("#compare")).toBeHidden();
});

test("E3: the tour from Home picks a Moon site, walks the Finder, opens a Place, pauses on a click outside, and closes on Finish", async ({ page }) => {
  await page.goto("/#/");
  await page.locator("#tour-home").click();
  const box = page.locator(".tour-box");
  await expect(box.locator(".tour-n")).toHaveText("1 of 9");
  await expect(page.locator("#ch-moon .sites")).toBeInViewport();
  await box.locator(".tour-next").click();
  await expect(box.locator(".tour-n")).toHaveText("2 of 9");
  await expect(page).toHaveURL(/#\/find\?t=moon-/);
  for (let k = 3; k <= 9; k++) {
    await box.locator(".tour-next").click();
    await expect(box.locator(".tour-n")).toHaveText(`${k} of 9`);
  }
  await expect(page).toHaveURL(/#\/place\?/);
  await expect(page.locator("#pl-mb")).toBeVisible();
  await page.mouse.click(10, 300);
  await expect(box.locator('[data-tour="play"]')).toHaveText("Play");
  await expect(box).toBeVisible();
  await box.locator(".tour-next").click();
  await expect(box).toBeHidden();
});

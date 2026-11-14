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
  await page.locator("#pick-target").selectOption(target.id);
  await page.locator("#pick-filter").selectOption(filter.id);
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
  const { t } = cols(m, main.id);
  const ids = top(t[`score:${f.id}`], 10);
  await ready(page, `?t=${main.id}&f=${f.id}&c=${ids[4]}`);
  await expect(page.locator("#pick-filter")).toHaveValue(f.id);
  await expect(page.locator(`#ledger li[data-i="${ids[4]}"] button`)).toHaveAttribute("aria-pressed", "true");
});

test("year-round switch reorders the list exactly as the year-round scores say", async ({ page }) => {
  const f = m.filters[0];
  const { t } = cols(m, main.id);
  const plain = top(t[`score:${f.id}`], 10);
  const yr = top(t[`score:${f.id}:yr`], 10);
  await ready(page, `?t=${main.id}&f=${f.id}`);
  expect(await order(page)).toEqual(plain);
  await page.locator("#pick-yr").check({ force: true });
  await expect.poll(() => order(page)).toEqual(yr);
  if (JSON.stringify(plain) !== JSON.stringify(yr)) expect(await order(page)).not.toEqual(plain);
});

test("hand-set weights change the ranking", async ({ page }) => {
  const f = m.filters[0];
  const fw = f.weights[main.body];
  const { t } = cols(m, main.id);
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
  const expected = top(handScore(m, t, w, m.grid.n), 10);
  await expect.poll(() => order(page)).toEqual(expected);
  expect(expected).not.toEqual(before);
  await expect(page.locator("#pick-filter")).toHaveValue("__hand");
  await expect(page.locator("#pick-yr")).toBeDisabled();
});

test("no horizontal scroll at 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ready(page);
  await page.locator(".card .ch details").evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("every internal anchor resolves", async ({ page }) => {
  await ready(page);
  const missing = await page
    .locator("a[href^='#']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")!.slice(1)).filter((id) => !id || !document.getElementById(id)));
  expect(missing).toEqual([]);
});

test("footer carries the AI note", async ({ page }) => {
  await ready(page);
  await expect(page.locator("footer .ai")).toContainText("How we used AI");
});

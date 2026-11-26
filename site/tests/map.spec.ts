import { cols, expect, manifest, test, type Page } from "./helpers";
import { latlon, score100 } from "../src/format";
import { cut } from "../src/zones";

const m = manifest();
const main = m.targets.find((x) => x.default) ?? m.targets[0];
const filter = m.filters[0];
const { cells, t } = cols(m, main.id);
const score = t[`score:${filter.id}`];
const rows = (p: Page) => p.locator("#rank li[data-i]");
const legend = (p: Page) => p.locator("#legend");
const card = (p: Page) => p.locator(".hovercard");
const pop = (p: Page) => p.locator(".mpop");
const row = (p: Page, r: number) => p.locator(`#rank li[data-rank="${r}"]`);
const nameOf = async (p: Page, i: number) => (await row(p, i + 1).locator(".rk-name").innerText()).trim();

async function ready(p: Page) {
  await p.goto(`/#/find?t=${main.id}&f=${filter.id}`);
  await expect(rows(p)).toHaveCount(20);
  await expect(p.locator(".pin")).toHaveCount(20);
}

const ranked = score.filter((v) => !Number.isNaN(v)).length;
const painted = (share: number) => {
  const c = cut(score, share);
  return score.filter((v) => v >= c).length;
};

test("the map colours only the best 2% of land by default, and the switch changes the share", async ({ page }) => {
  await ready(page);
  await expect(legend(page).locator("#lg-fold")).toHaveAttribute("aria-expanded", "false");
  await expect(legend(page).locator(".lg-title")).toHaveText("Best 2% of land");
  await expect(legend(page)).toHaveAttribute("data-ranked", String(ranked));
  const n2 = Number(await legend(page).getAttribute("data-painted"));
  expect(n2).toBe(painted(0.02));
  expect(n2).toBeGreaterThanOrEqual(Math.ceil(0.02 * ranked));
  expect(n2 - Math.ceil(0.02 * ranked)).toBeLessThan(0.002 * ranked);
  expect(Number(await legend(page).getAttribute("data-edges"))).toBeGreaterThan(0);
  await legend(page).locator("#lg-fold").click();
  await expect(legend(page).locator("#lg-fold")).toHaveAttribute("aria-expanded", "true");
  for (const [label, share] of [["5%", 0.05], ["1%", 0.01], ["10%", 0.1]] as const) {
    await legend(page).getByRole("button", { name: label, exact: true }).click();
    await expect(legend(page)).toHaveAttribute("data-painted", String(painted(share)));
    await expect(legend(page).getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await legend(page).getByRole("button", { name: "All land" }).click();
  await expect(legend(page).locator(".lg-title")).toHaveText("All ranked land");
  await expect(legend(page)).toHaveAttribute("data-painted", String(ranked));
  await expect(legend(page)).toHaveAttribute("data-edges", "0");
});

test("the terrain filter still applies on top of the zones", async ({ page }) => {
  await ready(page);
  const type = m.terrain_types.find((x) => x.key !== "none")!;
  await page.locator("#weights > summary").click();
  await page.locator("#pick-type").click();
  await page.locator(`#pick-type-listbox [role="option"][data-value="${type.id}"]`).click();
  await expect(page.locator("#pick-type")).toHaveAttribute("data-value", String(type.id));
  const c = cut(score, 0.02);
  const want = score.filter((v, i) => v >= c && cells.terrain_type[i] === type.id).length;
  await expect(legend(page)).toHaveAttribute("data-painted", String(want));
});

test("hovering pin 1 shows the same place as list row 1, and the card leaves the pin clear", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "hover is a laptop check");
  await ready(page);
  const id = Number(await row(page, 1).getAttribute("data-i"));
  const name = await nameOf(page, 0);
  const pin = page.locator(`.pin[data-i="${id}"]`);
  await pin.hover();
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator(".hc-name")).toHaveText(`#1 ${name}`);
  await expect(card(page).locator(".hc-ll")).toContainText(latlon(cells.lat[id], cells.lon[id], 2));
  await expect(card(page).locator(".hc-score")).toHaveText(`${score100(score[id])} / 100 match score`);
  await expect(row(page, 1).locator(".rk-score b")).toHaveText(score100(score[id]));
  await expect(card(page)).toContainText("Click to open");
  await expect(card(page)).not.toContainText("%");
  const fresh = cells.nearest_analog_km[id] > (m.scoring.rare_km ?? 100);
  await expect(card(page).locator(".newc")).toHaveCount(fresh ? 1 : 0);
  if (fresh) await expect(card(page).locator(".newc")).toHaveAttribute("title", "Not in our list of known analog sites");
  const [c, p, e] = await Promise.all([card(page).boundingBox(), pin.boundingBox(), page.locator(".earth-col").boundingBox()]);
  const cx = p!.x + p!.width / 2;
  const cy = p!.y + p!.height / 2;
  expect(cx >= c!.x && cx <= c!.x + c!.width && cy >= c!.y && cy <= c!.y + c!.height).toBe(false);
  expect(c!.x).toBeGreaterThanOrEqual(e!.x);
  expect(c!.y).toBeGreaterThanOrEqual(e!.y);
  expect(c!.x + c!.width).toBeLessThanOrEqual(e!.x + e!.width);
  expect(c!.y + c!.height).toBeLessThanOrEqual(e!.y + e!.height);
  await page.keyboard.press("Escape");
  await expect(card(page)).toBeHidden();
  await page.locator("#find-h").hover();
  await pin.hover();
  await expect(card(page)).toBeVisible();
  await page.locator("#find-h").hover();
  await expect(card(page)).toBeHidden();
});

test("hovering a list row shows the card beside that row's pin", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "hover is a laptop check");
  await ready(page);
  const third = row(page, 3);
  const id = Number(await third.getAttribute("data-i"));
  await third.hover();
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator(".hc-name")).toHaveText(`#3 ${await nameOf(page, 2)}`);
  const [c, p] = await Promise.all([card(page).boundingBox(), page.locator(`.pin[data-i="${id}"]`).boundingBox()]);
  const cx = p!.x + p!.width / 2;
  const cy = p!.y + p!.height / 2;
  expect(cx >= c!.x && cx <= c!.x + c!.width && cy >= c!.y && cy <= c!.y + c!.height).toBe(false);
  const gap = Math.max(c!.x - cx, cx - (c!.x + c!.width), c!.y - cy, cy - (c!.y + c!.height));
  expect(gap).toBeLessThan(60);
  await page.locator("#find-h").hover();
  await expect(card(page)).toBeHidden();
});

test("the top three pins carry a name and score label", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".pin-tag")).toHaveCount(3);
  const id = Number(await row(page, 1).getAttribute("data-i"));
  await expect(page.locator(`.pin-tag[data-i="${id}"]`)).toContainText(`${score100(score[id])} / 100`);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const overlaps: string[] = [];
        const pins = [...document.querySelectorAll<HTMLElement>(".pin")]
          .map((el) => ({ id: el.dataset.i ?? "", op: getComputedStyle(el).opacity, r: el.getBoundingClientRect() }))
          .filter((p) => p.op !== "0" && p.r.width > 0 && p.r.height > 0);
        const tags = [...document.querySelectorAll<HTMLElement>(".pin-tag:not(.is-dim)")]
          .map((el) => ({ id: el.dataset.i ?? "", op: getComputedStyle(el).opacity, r: el.getBoundingClientRect() }))
          .filter((t) => t.op !== "0" && t.r.width > 0 && t.r.height > 0);
        for (const t of tags) {
          for (const p of pins) {
            if (p.id === t.id) continue;
            if (t.r.left < p.r.right && t.r.right > p.r.left && t.r.top < p.r.bottom && t.r.bottom > p.r.top) {
              overlaps.push(`tag:${t.id}@pin:${p.id}`);
            }
          }
        }
        return overlaps;
      }),
    )
    .toEqual([]);
});

test("clicking a pin opens a popup, and Details opens that place", async ({ page }, info) => {
  await ready(page);
  const id = Number(await row(page, 1).getAttribute("data-i"));
  const name = await nameOf(page, 0);
  await expect(card(page)).toBeHidden();
  const pin = page.locator(`.pin[data-i="${id}"]`);
  if (info.project.name === "phone") await pin.tap();
  else await pin.click();
  await expect(pop(page)).toBeVisible();
  await expect(pop(page)).toBeFocused();
  await expect(card(page)).toBeHidden();
  await expect(pop(page).locator("h3")).toHaveText(`#1 ${name}`);
  await expect(pop(page)).toContainText(latlon(cells.lat[id], cells.lon[id], 2));
  await expect(pop(page).locator(".mpop-ring")).toHaveAttribute("aria-label", `${score100(score[id])} / 100 match score`);
  await expect(pop(page).locator(".mpop-txt")).toContainText(/in the top \d+(\.\d)?% of land/);
  await expect(pop(page).locator(".mpop-txt")).not.toContainText(/top 0(\.0)?%/);
  await expect(page).toHaveURL(/#\/find/);
  await pop(page).getByRole("button", { name: "Details" }).click();
  await expect(page).toHaveURL(new RegExp(`#/place\\?t=${main.id}&f=${filter.id}.*c=${id}`));
  await expect(page.locator("#place-h")).toHaveText(name);
});

test("the popup closes with ×, Escape and a click elsewhere", async ({ page }, info) => {
  await ready(page);
  const pin = page.locator(`.pin[data-i="${await row(page, 1).getAttribute("data-i")}"]`);
  const open = async () => {
    if (info.project.name === "phone") await pin.tap();
    else await pin.click();
    await expect(pop(page)).toBeVisible();
  };
  await open();
  await pop(page).getByRole("button", { name: "Close" }).click();
  await expect(pop(page)).toBeHidden();
  await open();
  await page.keyboard.press("Escape");
  await expect(pop(page)).toBeHidden();
  await open();
  await page.locator("#find-h").click();
  await expect(pop(page)).toBeHidden();
  await expect(page).toHaveURL(/#\/find/);
});

test("list rows stay plain links to the Place page", async ({ page }) => {
  await ready(page);
  const id = await row(page, 2).getAttribute("data-i");
  await row(page, 2).locator(".rk-row").click();
  await expect(page).toHaveURL(new RegExp(`#/place\\?.*c=${id}`));
});

test("the hover card works with NASA GIBS tiles blocked", async ({ page }, info) => {
  test.skip(info.project.name !== "laptop", "hover is a laptop check");
  await page.route("**://gibs.earthdata.nasa.gov/**", (r) => r.abort());
  await ready(page);
  await row(page, 1).hover();
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toHaveClass(/noimg/);
  await expect(card(page).locator(".hc-score")).toBeVisible();
});

test("legend renders a live 36-bin score histogram synced with the active share", async ({ page }) => {
  await ready(page);
  const bins = legend(page).locator(".lg-hist .lg-bin");
  await expect(bins).toHaveCount(36);
  await legend(page).locator("#lg-fold").click();
  await expect(legend(page).locator("#lg-fold")).toHaveAttribute("aria-expanded", "true");
  const activeCount = () => legend(page).locator(".lg-hist .lg-bin.is-active").count();
  const at2 = await activeCount();
  expect(at2).toBeGreaterThan(0);
  expect(at2).toBeLessThan(36);
  await legend(page).getByRole("button", { name: "10%", exact: true }).click();
  const at10 = await activeCount();
  expect(at10).toBeGreaterThanOrEqual(at2);
  await legend(page).getByRole("button", { name: "All land" }).click();
  const atAll = await activeCount();
  expect(atAll).toBeGreaterThan(at10);
});

test("pins use rank-priority z-index and tier ranks 11 to 20 as minor dots", async ({ page }) => {
  await ready(page);
  const id1 = Number(await row(page, 1).getAttribute("data-i"));
  const id18 = Number(await row(page, 18).getAttribute("data-i"));
  const z1 = await page.locator(`.pin[data-i="${id1}"]`).evaluate((e) => Number(getComputedStyle(e).zIndex));
  const z18 = await page.locator(`.pin[data-i="${id18}"]`).evaluate((e) => Number(getComputedStyle(e).zIndex));
  expect(z1).toBeGreaterThan(z18);
  await expect(page.locator(".pin.pin-minor")).toHaveCount(10);
  await expect(page.locator(`.pin[data-i="${id1}"]`)).not.toHaveClass(/pin-minor/);
  await expect(page.locator(`.pin[data-i="${id18}"]`)).toHaveClass(/pin-minor/);
});

test("clicking a known analog opens its note and a link to that cell's scorecard", async ({ page }) => {
  await ready(page);
  const search = page.locator("#fd-search");
  await search.fill("Rio Tinto");
  await page.locator("#fd-search-list [role='option']").first().click();
  await expect(pop(page)).toBeVisible();
  await expect(pop(page).locator("h3")).toContainText("Rio Tinto");
  // Close the search-opened popup, then click the rendered analog marker at the map center.
  await pop(page).getByRole("button", { name: "Close" }).click();
  await expect(pop(page)).toBeHidden();
  const box = (await page.locator("#earth").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(pop(page)).toBeVisible();
  await expect(pop(page).locator("h3")).toContainText("Rio Tinto");
  await expect(pop(page).locator(".mpop-note")).toContainText("hematite");
  await expect(pop(page).locator('a[href^="#/place?"]')).toBeVisible();
});

test("clicking a ranked land cell outside the best 2% zone still opens the popup", async ({ page }) => {
  await ready(page);
  const threshold = cut(score, 0.02);
  let targetIdx = -1;
  for (let i = 0; i < score.length; i++) {
    if (
      Number.isFinite(score[i]) &&
      score[i] < threshold &&
      cells.lat[i] > 46 &&
      cells.lat[i] < 49 &&
      cells.lon[i] > 0 &&
      cells.lon[i] < 4
    ) {
      targetIdx = i;
      break;
    }
  }
  expect(targetIdx).toBeGreaterThanOrEqual(0);
  const lat = cells.lat[targetIdx];
  const lon = cells.lon[targetIdx];
  const search = page.locator("#fd-search");
  await search.fill(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
  await page.keyboard.press("Enter");
  await expect(pop(page)).toBeVisible();
  await pop(page).getByRole("button", { name: "Close" }).click();
  await expect(pop(page)).toBeHidden();
  const box = (await page.locator("#earth").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(pop(page)).toBeVisible();
  await expect(pop(page).locator(".mpop-out")).toContainText("Outside the best 2%");
  await expect(pop(page).locator(".mpop-ring")).toHaveAttribute("aria-label", `${score100(score[targetIdx])} / 100 match score`);
});

test("local search finds Haughton and parses direct coordinates 41.25, 96.75", async ({ page }) => {
  await ready(page);
  const search = page.locator("#fd-search");
  await search.fill("Haughton");
  const opt = page.locator("#fd-search-list [role='option']", { hasText: "Haughton" }).first();
  await expect(opt).toBeVisible();
  await opt.click();
  await expect(pop(page)).toBeVisible();
  await expect(pop(page).locator("h3")).toContainText("Haughton");
  await pop(page).getByRole("button", { name: "Close" }).click();
  await expect(pop(page)).toBeHidden();

  await search.fill("41.25, 96.75");
  await expect(page.locator("#fd-search-list [role='option']").first()).toContainText("41.25");
  await page.keyboard.press("Enter");
  await expect(pop(page)).toBeVisible();
  await expect(pop(page)).toContainText("41.25° N, 96.75° E");
});

test("on phone, tapping a pin opens the popup unclipped above the sidebar sheet", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "mobile sheet stacking check");
  await ready(page);
  const id = Number(await row(page, 1).getAttribute("data-i"));
  await page.locator(`.pin[data-i="${id}"]`).tap();
  await expect(pop(page)).toBeVisible();
  const vp = page.viewportSize()!;
  const box = (await pop(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  const onTop = await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return !!hit?.closest(".mpop");
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  expect(onTop).toBe(true);
});

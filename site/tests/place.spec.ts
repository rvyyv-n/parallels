import fs from "node:fs";
import { trekUrl, worldviewUrl } from "../src/export";
import { latlon, score100, targetName } from "../src/format";
import { spread } from "../src/rank";
import { cols, expect, manifest, test } from "./helpers";

const m = manifest();
const moonPole = m.targets.find((t) => t.id === "moon-south-pole") ?? m.targets.find((t) => t.body === "moon")!;
const haworth = m.targets.find((t) => t.id === "moon-haworth") ?? moonPole;
const marsJezero = m.targets.find((t) => t.id === "mars-jezero") ?? m.targets.find((t) => t.body === "mars")!;
const balanced = m.filters.find((f) => f.id === "balanced") ?? m.filters[0];
const rover = m.filters.find((f) => f.id === "rover") ?? m.filters[0];

const placeLabel = (cells: ReturnType<typeof cols>["cells"], id: number) => {
  const r = cells.region?.[id];
  return (Number.isFinite(r) && m.regions[r]) || latlon(cells.lat[id], cells.lon[id], 2);
};

const topCell = (targetId: string, filterId = balanced.id) => {
  const { cells, t } = cols(m, targetId);
  const { ids } = spread(m, t[`score:${filterId}`], cells, () => true, false);
  return { id: ids[0], cells, t };
};

test("honest range-and-gap bullet plots encode Earth value as a centered dot and band-tinted gap", async ({ page }) => {
  const { id } = topCell(moonPole.id);
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);
  await expect(page.locator(".card .ring .ring-svg .ring-arc")).toBeVisible();

  await page.locator(".pl-toggle-all").click();
  await expect(page.locator(".card .bb-here")).toHaveCount(0);

  const plots = page.locator(".card .bb");
  const count = await plots.count();
  expect(count).toBeGreaterThan(3);

  const checks = await plots.evaluateAll((els) =>
    els.map((bb) => {
      const bbRect = bb.getBoundingClientRect();
      const dot = bb.querySelector<HTMLElement>(".bb-here-dot");
      const gap = bb.querySelector<HTMLElement>(".bb-gap");
      const tick = bb.querySelector<HTMLElement>(".bb-tick");
      if (!dot || !gap || !tick) return { ok: false, reason: "missing marker" };
      const hx = parseFloat(dot.style.left);
      const tx = parseFloat(tick.style.left);
      const gl = parseFloat(gap.style.left);
      const gw = parseFloat(gap.style.width);
      const dotRect = dot.getBoundingClientRect();
      return {
        ok:
          hx >= 0 &&
          hx <= 100 &&
          tx >= 0 &&
          tx <= 100 &&
          dotRect.width <= 14 &&
          dotRect.left >= bbRect.left - 8 &&
          dotRect.right <= bbRect.right + 8 &&
          Math.abs(gl - Math.min(hx, tx)) < 0.05 &&
          Math.abs(gw - Math.abs(hx - tx)) < 0.05,
        hx,
        tx,
        gl,
        gw,
        dotWidth: dotRect.width,
      };
    }),
  );

  for (const c of checks) expect(c.ok, JSON.stringify(c)).toBe(true);
});

test("inline preset switcher and Year-round toggle update URL, score ring, and Finder back link", async ({ page }) => {
  const { id, t } = topCell(moonPole.id);
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);
  const preset = page.locator(".pl-for #pl-preset");
  const yrBtn = page.locator(".pl-for #pl-yr");
  const pickPreset = async (val: string) => {
    await page.locator(".pl-for #pl-preset").click();
    await page.locator(`#pl-preset-listbox [role="option"][data-value="${val}"]`).click();
  };

  await expect(preset).toHaveAttribute("data-value", balanced.id);
  await expect(yrBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".card .ring b")).toHaveText(score100(t[`score:${balanced.id}`][id]));

  await pickPreset(rover.id);
  await expect(page).toHaveURL(new RegExp(`#/place\\?.*f=${rover.id}.*c=${id}`));
  await expect(page.locator(".pl-for #pl-preset")).toHaveAttribute("data-value", rover.id);
  await expect(page.locator(".card .ring b")).toHaveText(score100(t[`score:${rover.id}`][id]));
  await expect(page.locator("#back-find")).toHaveAttribute("href", new RegExp(`f=${rover.id}`));

  await page.locator(".pl-for #pl-yr").click();
  await expect(page).toHaveURL(/yr=1/);
  await expect(page.locator(".pl-for #pl-yr")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".card .ring b")).toHaveText(score100(t[`score:${rover.id}:yr`][id]));
  await expect(page.locator("#back-find")).toHaveAttribute("href", /yr=1/);

  await page.locator(".pl-for #pl-yr").click();
  await expect(page).not.toHaveURL(/yr=1/);
  await expect(page.locator(".pl-for #pl-yr")).toHaveAttribute("aria-pressed", "false");

  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&w=surface:2,heat:1&c=${id}`);
  await expect(page.locator(".pl-for #pl-preset")).toHaveAttribute("data-value", "__custom");
  await expect(page.locator(".pl-for #pl-yr")).toBeDisabled();
  await pickPreset(balanced.id);
  await expect(page).not.toHaveURL(/w=/);
  await expect(page.locator(".pl-for #pl-yr")).toBeEnabled();
});

test("Download CSV exports UTF-8 BOM, CRLF lines, metadata, challenge scores, and trait rows", async ({ page }) => {
  const { id, cells, t } = topCell(moonPole.id);
  const expectedName = placeLabel(cells, id);
  const expectedScore = `${Math.round(t[`score:${balanced.id}`][id] * 100)} / 100`;

  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);
  await expect(page.locator("#pl-csv")).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#pl-csv").click()]);
  expect(download.suggestedFilename()).toMatch(new RegExp(`^parallels-.*-${moonPole.id}-${balanced.id}\\.csv$`));

  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const raw = fs.readFileSync(filePath!, "utf8");

  expect(raw.startsWith("\uFEFF")).toBe(true);
  expect(raw).toContain("\r\n");
  expect(raw.replace(/\r\n/g, "")).not.toContain("\n");

  expect(raw).toContain(expectedName);
  expect(raw).toContain(`Metadata,Cell ID,${id}`);
  expect(raw).toContain(targetName(moonPole.name));
  expect(raw).toContain(`Metadata,Overall match score,${expectedScore}`);
  expect(raw).toContain(`Metadata,Generated,${m.generated}`);
  if (m.method_version) expect(raw).toContain(m.method_version);

  expect(raw).toContain("\r\nChallenges\r\n");
  for (const c of m.challenges.moon) {
    expect(raw).toContain(c.name);
  }

  expect(raw).toContain("\r\nTraits\r\n");
  const sampleTrait = m.challenges.moon[0].traits[0];
  const tr = m.traits.find((x) => x.id === sampleTrait.id)!;
  expect(raw).toContain(tr.label);
  const ds = m.datasets.find((d) => d.id === tr.earth_dataset)!;
  expect(raw).toContain(ds.name);
});

test("NASA Worldview and Moon/Mars Trek links carry exact projection, bbox, and date URLs with no unsolicited requests", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (req) => {
    const u = new URL(req.url());
    if (u.hostname !== "localhost" && !u.protocol.startsWith("data") && !u.protocol.startsWith("blob")) {
      externalRequests.push(u.hostname);
    }
  });

  const haworthPick = topCell(haworth.id);
  await page.goto(`/#/place?t=${haworth.id}&f=${balanced.id}&c=${haworthPick.id}`);
  const wvMoon = page.locator("#pl-worldview");
  const trekMoon = page.locator("#pl-trek");

  const expectedWvMoon = worldviewUrl(haworthPick.cells.lat[haworthPick.id], haworthPick.cells.lon[haworthPick.id], m.generated);
  const expectedTrekMoon = trekUrl(haworth);
  await expect(wvMoon).toHaveAttribute("href", expectedWvMoon);
  await expect(wvMoon).toHaveAttribute("target", "_blank");
  await expect(wvMoon).toHaveAttribute("rel", /noopener/);
  await expect(trekMoon).toHaveAttribute("href", expectedTrekMoon);
  await expect(trekMoon).toContainText("Open in NASA Moon Trek");
  expect(expectedTrekMoon).toContain("urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120");
  expect(expectedTrekMoon).toContain("&z=4&");

  const marsPick = topCell(marsJezero.id);
  await page.goto(`/#/place?t=${marsJezero.id}&f=${balanced.id}&c=${marsPick.id}`);
  const wvMars = page.locator("#pl-worldview");
  const trekMars = page.locator("#pl-trek");

  const expectedWvMars = worldviewUrl(marsPick.cells.lat[marsPick.id], marsPick.cells.lon[marsPick.id], m.generated);
  const expectedTrekMars = trekUrl(marsJezero);
  await expect(wvMars).toHaveAttribute("href", expectedWvMars);
  await expect(trekMars).toHaveAttribute("href", expectedTrekMars);
  await expect(trekMars).toContainText("Open in NASA Mars Trek");
  expect(expectedTrekMars).toBe(
    `https://trek.nasa.gov/mars/#v=0.1&x=${marsJezero.lon.toFixed(4)}&y=${marsJezero.lat.toFixed(4)}&z=8&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104905`,
  );

  expect([...new Set(externalRequests)].filter((h) => h !== "gibs.earthdata.nasa.gov" && h !== "tiles.maps.eox.at" && h !== "trek.nasa.gov")).toEqual([]);
});

test("image compare Overlays toggle hides markers and Side by side / Wipe segmented control switches cleanly", async ({ page }) => {
  const { id } = topCell(moonPole.id);
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);

  const cmp = page.locator(".cmp");
  const modeSeg = cmp.locator('.cmp-seg[data-cmp-seg="mode"]');
  const layerSeg = cmp.locator('.cmp-seg[data-cmp-seg="layer"]');
  const kmSeg = cmp.locator('.cmp-seg[data-cmp-seg="km"]');
  const splitBtn = cmp.locator('[data-cmp-mode="split"]');
  const wipeBtn = cmp.locator('[data-cmp-mode="wipe"]');
  const ovBtn = cmp.locator(".cmp-ov");

  for (const seg of [modeSeg, layerSeg, kmSeg]) {
    await expect(seg).toHaveClass(/seg-has-thumb/);
    await expect(seg.locator("> .seg-thumb")).toHaveCount(1);
  }
  await expect(cmp).toHaveAttribute("data-mode", "split");
  await expect(splitBtn).toHaveAttribute("aria-pressed", "true");
  await expect(wipeBtn).toHaveAttribute("aria-pressed", "false");

  await wipeBtn.click();
  await expect(cmp).toHaveAttribute("data-mode", "wipe");
  await expect(wipeBtn).toHaveAttribute("aria-pressed", "true");
  await expect(splitBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cmp.locator(".cmp-puck")).toBeVisible();

  const wipeStack = await cmp.evaluate((el) => {
    const eimg = el.querySelector<HTMLElement>(".eimg")!;
    const timg = el.querySelector<HTMLElement>(".timg")!;
    const eStyle = getComputedStyle(eimg);
    const tStyle = getComputedStyle(timg);
    const stage = el.querySelector<HTMLElement>(".cmp-stage")!;
    const r = stage.getBoundingClientRect();
    const hits = document.elementsFromPoint(r.left + r.width * 0.75, r.top + r.height * 0.5);
    const tIdx = hits.indexOf(timg);
    const eIdx = hits.indexOf(eimg);
    return {
      eIso: eStyle.isolation,
      tIso: tStyle.isolation,
      eZ: Number(eStyle.zIndex),
      tZ: Number(tStyle.zIndex),
      eClip: eStyle.clipPath,
      tClip: tStyle.clipPath,
      tAboveE: tIdx >= 0 && (eIdx < 0 || tIdx < eIdx),
    };
  });
  expect(wipeStack.eIso).toBe("isolate");
  expect(wipeStack.tIso).toBe("isolate");
  expect(wipeStack.tZ).toBeGreaterThan(wipeStack.eZ);
  expect(wipeStack.eClip).toContain("inset");
  expect(wipeStack.tClip).toContain("inset");
  expect(wipeStack.tAboveE).toBe(true);

  await splitBtn.click();
  await expect(cmp).toHaveAttribute("data-mode", "split");
  await expect(splitBtn).toHaveAttribute("aria-pressed", "true");

  await expect(ovBtn).toHaveAttribute("aria-pressed", "true");
  await expect(cmp).not.toHaveClass(/cmp-clean/);
  if ((await cmp.locator(".cmp-cell").count()) > 0) {
    await expect(cmp.locator(".cmp-cell")).toBeVisible();
  }

  await ovBtn.click();
  await expect(ovBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cmp).toHaveClass(/cmp-clean/);
  if ((await cmp.locator(".cmp-cell").count()) > 0) {
    await expect(cmp.locator(".cmp-cell")).toBeHidden();
  }
  await expect(cmp.locator(".cmp-x")).toBeHidden();

  await ovBtn.click();
  await expect(ovBtn).toHaveAttribute("aria-pressed", "true");
  await expect(cmp).not.toHaveClass(/cmp-clean/);
});

test("image compare defaults to 70 km ground width and toggles 70 km / 140 km scale cleanly", async ({ page }) => {
  const { id } = topCell(marsJezero.id);
  await page.goto(`/#/place?t=${marsJezero.id}&f=${balanced.id}&c=${id}`);

  const cmp = page.locator(".cmp");
  const km70 = cmp.locator('[data-cmp-km="70"]');
  const km140 = cmp.locator('[data-cmp-km="140"]');

  await expect(cmp).toHaveAttribute("data-km", "70");
  await expect(km70).toHaveAttribute("aria-pressed", "true");
  await expect(km140).toHaveAttribute("aria-pressed", "false");
  await expect(cmp.locator(".cmp-scale")).toContainText("25 km");
  await expect(cmp.locator(".cmp-scale")).toContainText("70 km wide");

  const cell70 = await cmp.locator(".cmp-cell").evaluate((el) => parseFloat((el as HTMLElement).style.height));
  const win70 = await cmp.locator(".cmp-win").evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(win70).toBeCloseTo((10 / 70) * 100, 1);

  await km140.click();
  await expect(cmp).toHaveAttribute("data-km", "140");
  await expect(km140).toHaveAttribute("aria-pressed", "true");
  await expect(km70).toHaveAttribute("aria-pressed", "false");
  await expect(cmp.locator(".cmp-scale")).toContainText("50 km");
  await expect(cmp.locator(".cmp-scale")).toContainText("140 km wide");

  const cell140 = await cmp.locator(".cmp-cell").evaluate((el) => parseFloat((el as HTMLElement).style.height));
  const win140 = await cmp.locator(".cmp-win").evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(win140).toBeCloseTo((10 / 140) * 100, 1);
  expect(cell70 / cell140).toBeCloseTo(2, 1);

  await expect(cmp.locator(".eimg.fb")).toHaveCount(1);
  await expect(cmp.locator(".timg.fb")).toHaveCount(1);

  await km70.click();
  await expect(cmp).toHaveAttribute("data-km", "70");
  await expect(cmp.locator(".cmp-scale")).toContainText("25 km");
  await expect(cmp.locator(".cmp-scale")).toContainText("70 km wide");
});

test("Earth layer defaults to Relief on Moon South Pole and Satellite on Mars, and toggles cleanly", async ({ page }) => {
  const tileUrls: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("gibs.earthdata.nasa.gov") || u.includes("tiles.maps.eox.at")) tileUrls.push(u);
  });

  const moonPick = topCell(moonPole.id);
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${moonPick.id}`);

  const cmp = page.locator(".cmp");
  const reliefBtn = cmp.locator('[data-cmp-layer="relief"]');
  const satBtn = cmp.locator('[data-cmp-layer="satellite"]');

  await expect(cmp).toHaveAttribute("data-layer", "relief");
  await expect(reliefBtn).toHaveAttribute("aria-pressed", "true");
  await expect(satBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cmp.locator(".eimg .cmp-tag")).toContainText("Relief");
  await expect(cmp.locator(".eimg-cap .cmp-src")).toContainText("ASTER GDEM");
  await expect.poll(() => tileUrls.some((u) => u.includes("ASTER_GDEM_Greyscale_Shaded_Relief"))).toBe(true);
  await expect(cmp.locator(".eimg.fb")).toHaveCount(1);

  const asterZooms = tileUrls
    .filter((u) => u.includes("ASTER_GDEM_Greyscale_Shaded_Relief"))
    .map((u) => Number(u.match(/GoogleMapsCompatible_Level12\/(\d+)\//)?.[1]));
  expect(asterZooms.length).toBeGreaterThan(0);
  for (const z of asterZooms) expect(z).toBeLessThanOrEqual(12);

  tileUrls.length = 0;
  await satBtn.click();
  await expect(cmp).toHaveAttribute("data-layer", "satellite");
  await expect(satBtn).toHaveAttribute("aria-pressed", "true");
  await expect(reliefBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cmp.locator(".eimg .cmp-tag")).toContainText("Satellite");
  await expect(cmp.locator(".eimg-cap .cmp-src")).toContainText("Sentinel-2");
  await expect.poll(() => tileUrls.some((u) => u.includes("tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857"))).toBe(true);
  await expect(cmp.locator(".eimg.fb")).toHaveCount(1);

  await cmp.locator('[data-cmp-mode="wipe"]').click();
  await expect(cmp).toHaveAttribute("data-mode", "wipe");
  await reliefBtn.click();
  await expect(cmp).toHaveAttribute("data-layer", "relief");
  await expect(cmp).toHaveAttribute("data-mode", "wipe");

  tileUrls.length = 0;
  const marsPick = topCell(marsJezero.id);
  await page.goto(`/#/place?t=${marsJezero.id}&f=${balanced.id}&c=${marsPick.id}`);

  await expect(cmp).toHaveAttribute("data-layer", "satellite");
  await expect(satBtn).toHaveAttribute("aria-pressed", "true");
  await expect(reliefBtn).toHaveAttribute("aria-pressed", "false");
  await expect(cmp.locator(".eimg .cmp-tag")).toContainText("Satellite");
  await expect(cmp.locator(".eimg-cap .cmp-src")).toContainText("Sentinel-2");
  await expect.poll(() => tileUrls.some((u) => u.includes("tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857"))).toBe(true);

  tileUrls.length = 0;
  await reliefBtn.click();
  await expect(cmp).toHaveAttribute("data-layer", "relief");
  await expect(reliefBtn).toHaveAttribute("aria-pressed", "true");
  await expect(cmp.locator(".eimg-cap .cmp-src")).toContainText("ASTER GDEM");
  await expect.poll(() => tileUrls.some((u) => u.includes("ASTER_GDEM_Greyscale_Shaded_Relief"))).toBe(true);
});

test("Expand all / Collapse all toggles every challenge while initial load keeps exactly one open", async ({ page }) => {
  const { id } = topCell(moonPole.id);
  const total = m.challenges.moon.length;
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);

  const toggle = page.locator(".pl-toggle-all");
  const openDetails = page.locator(".card .ch > details[open]");

  await expect(page.locator(".card .ch details[open]")).toHaveCount(1);
  await expect(openDetails).toHaveCount(1);
  await expect(toggle).toHaveText("Expand all");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(openDetails).toHaveCount(total);
  await expect(page.locator(".card .ch details[open]")).toHaveCount(total);
  await expect(toggle).toHaveText("Collapse all");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.locator(".card .ch > details > summary").first().click();
  await expect(openDetails).toHaveCount(total - 1);
  await expect(toggle).toHaveText("Expand all");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  await expect(openDetails).toHaveCount(total);
  await expect(toggle).toHaveText("Collapse all");

  await toggle.click();
  await expect(openDetails).toHaveCount(0);
  await expect(toggle).toHaveText("Expand all");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("Copy link and Copy coords work and Place has zero horizontal overflow on narrow viewports", async ({ page }, info) => {
  const { id } = topCell(moonPole.id);
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);

  const copyLink = page.locator('.pl-copy[data-copy="link"]');
  const copyCoords = page.locator('.pl-copy[data-copy="coords"]');
  await expect(copyLink).toBeVisible();
  await expect(copyCoords).toBeVisible();

  await copyCoords.click();
  await expect(copyCoords).toHaveAttribute("data-copied", "true");
  await expect(copyCoords).toContainText("Copied");

  await copyLink.click();
  await expect(copyLink).toHaveAttribute("data-copied", "true");
  await expect(copyLink).toContainText("Copied");

  const vpWidth = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vpWidth);

  await page.locator(".pl-toggle-all").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vpWidth);
});

test("Place header shows Focus prefix, mission descriptions, Year-round dot, interactive Seasons strip, and left-anchored telemetry", async ({ page }) => {
  expect(targetName("Moon's south pole (Artemis III regions)")).toBe("Moon's South Pole (Artemis III Regions)");
  expect(targetName("Shackleton rim")).toBe("Shackleton Rim");
  expect(targetName("Arsia Mons caves")).toBe("Arsia Mons Caves");
  expect(targetName("de Gerlache Rim 2")).toBe("de Gerlache Rim 2");

  const { id } = topCell(moonPole.id);
  await page.goto(`/#/place?t=${moonPole.id}&f=${balanced.id}&c=${id}`);

  await expect(page.locator(".pl-for-txt")).toHaveText("Moon's South Pole (Artemis III Regions)");
  await expect(page.locator("#pl-preset .pk-pre")).toHaveText("Focus");
  await expect(page.locator("#pl-yr .pl-yr-dot")).toBeVisible();

  await page.locator("#pl-preset").click();
  const opts = page.locator('#pl-preset-listbox [role="option"]');
  await expect(opts).toHaveCount(m.filters.length);
  await expect(page.locator('#pl-preset-listbox [role="option"][data-value="balanced"] .pk-opt-sub')).toHaveText(balanced.plain);
  await expect(page.locator('#pl-preset-listbox [role="option"][data-value="rover"] .pk-opt-sub')).toHaveText(rover.plain);
  await page.keyboard.press("Escape");

  const months = page.locator(".se-strip .se-m");
  await expect(months).toHaveCount(12);
  await expect(page.locator(".se-legend li")).toHaveCount(4);
  await months.nth(5).click();
  await expect(months.nth(5)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".se-readout .se-ro-m")).toHaveText("Jun");

  const cantRows = page.locator(".card .cant .cant-row");
  await expect(cantRows).toHaveCount(m.cant_copy.length);
  await expect(cantRows.locator("sup").first()).toBeVisible();
  const cantText = await page.locator(".card .cant").innerText();
  expect(cantText).not.toMatch(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/);
  await expect(page.locator(".card .cant .cant-src a").first()).toHaveAttribute("href", /^https?:\/\//);
});

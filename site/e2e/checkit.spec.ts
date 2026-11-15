import { readFile } from "node:fs/promises";
import { test, type Page } from "@playwright/test";
import { formatValue } from "../src/data/match";
import { trekUrl, worldviewUrl } from "../src/data/sheet";
import { expect, manifest, ready, words } from "./helpers";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[i++];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  return rows;
}

async function screenRows(page: Page) {
  await page.locator("#match .more, #breaks .more").evaluateAll((els) => els.forEach((el) => (el as HTMLElement).click()));
  return page.locator("#match details.row summary, #breaks details.row summary").evaluateAll((els) =>
    els.map((s) => {
      const label = s.querySelector(".label")!.cloneNode(true) as HTMLElement;
      label.querySelector(".sr")?.remove();
      const [earth, site] = [...s.querySelectorAll("b.v")].map((b) => b.textContent!.trim());
      return { label: label.textContent!.trim(), earth, site };
    }),
  );
}

async function downloadCsv(page: Page) {
  await page.locator("#test").evaluate((el) => el.scrollIntoView({ block: "start" }));
  const button = page.getByTestId("checkit-csv");
  await expect(button).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  const text = await readFile((await download.path())!, "utf8");
  return { name: download.suggestedFilename(), text };
}

for (const [targetId, hash] of [
  ["moon-south-pole", ""],
  ["mars-jezero", "#t=mars-jezero"],
]) {
  test(`${targetId}: the CSV agrees with the rows on screen and the links point at the right places`, async ({ page }) => {
    await ready(page, hash);
    const target = manifest.targets.find((t) => t.id === targetId)!;
    const { name, text } = await downloadCsv(page);
    expect(text.startsWith("﻿")).toBe(true);
    const rows = parseCsv(text.slice(1));
    const cell = rows.find((r) => r[0] === "Cell")![1];
    expect(name).toBe(`parallels-${targetId}-rover-${cell}.csv`);
    expect(rows.find((r) => r[0] === "This view")![1]).toContain(`p=${cell}`);

    const table = rows.slice(rows.findIndex((r) => r[0] === "Trait") + 1);
    const byLabel = new Map(table.map((r) => [r[0], r]));
    const shown = await screenRows(page);
    expect(shown.length).toBeGreaterThan(3);
    for (const s of shown) {
      const row = byLabel.get(s.label)!;
      expect(row, s.label).toBeDefined();
      const trait = manifest.traits.find((t) => t.label === s.label)!;
      const asShown = (v: string) => (v === "" ? formatValue(null, trait) : formatValue(1, { ...trait, digits: 0 }).replace("1", v.replace("-", "−")));
      expect(asShown(row[1]), `${s.label} Earth`).toBe(s.earth);
      expect(asShown(row[2]), `${s.label} base site`).toBe(s.site);
    }

    const lat = Number(rows.find((r) => r[0] === "Latitude")![1]);
    const lon = Number(rows.find((r) => r[0] === "Longitude")![1]);
    const worldview = page.getByTestId("checkit-worldview");
    await expect(worldview).toHaveAttribute("href", worldviewUrl(lat, lon, manifest.generated));
    await expect(worldview).toHaveAttribute("target", "_blank");
    const trek = page.getByTestId("checkit-trek");
    await expect(trek).toHaveAttribute("href", trekUrl(target));
    await expect(trek).toHaveAttribute("href", new RegExp(`^https://trek\\.nasa\\.gov/${target.body}/`));
    await expect(trek).toHaveAttribute("target", "_blank");
    await expect(trek).toHaveAttribute("rel", "noreferrer");
  });
}

test("the block is short and reachable by keyboard", async ({ page }) => {
  await ready(page);
  const block = page.getByTestId("checkit");
  expect(words((await block.textContent()) ?? "")).toBeLessThanOrEqual(20);
  await page.locator("#test").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.getByTestId("terrain-open").focus();
  const reached: string[] = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    reached.push(await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? ""));
  }
  expect(reached).toEqual(["checkit-csv", "checkit-worldview", "checkit-trek"]);
});

test("no sideways scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.locator("#test").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect(page.getByTestId("checkit")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

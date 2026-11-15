import { test, type Page } from "@playwright/test";
import { CHAPTERS, manifest, ready, expect } from "./helpers";

test.use({
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  },
});

test.describe.configure({ timeout: 90_000 });

const urls = [
  ...new Set([
    ...manifest.datasets.map((d) => d.url),
    ...manifest.cant_copy.map((c) => c.url),
    ...manifest.targets.flatMap((t) => t.facts.map((f) => f.url)),
  ].filter((u): u is string => !!u)),
];

const ANSWERED = [401, 403, 405, 429];
const DEAD = [404, 410];

test.describe.configure({ mode: "parallel" });

for (const url of urls) {
  test(`link answers: ${url}`, async ({ request }) => {
    test.setTimeout(90_000);
    let status: number | undefined;
    let failure = "";
    for (let attempt = 0; attempt < 2 && (status === undefined || status >= 500); attempt++) {
      try {
        status = (await request.get(url, { timeout: 30_000 })).status();
        failure = "";
      } catch (e) {
        status = undefined;
        failure = String(e).split("\n")[0];
      }
    }
    test.info().annotations.push({ type: "status", description: `${url} ${status ?? failure}` });
    console.log(`LINK ${status ?? failure} ${url}`);
    if (status === undefined) {
      expect(failure, "DNS failure or refused connection").not.toMatch(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/);
      test.info().annotations.push({ type: "warning", description: `no answer: ${failure}` });
      return;
    }
    expect(DEAD, "dead link").not.toContain(status);
    if (status >= 500) test.info().annotations.push({ type: "warning", description: `server error ${status}` });
    else if (!ANSWERED.includes(status)) expect(status, "answered").toBeLessThan(400);
  });
}

async function visit(page: Page, hash: string, problems: string[]) {
  await ready(page, hash);
  for (const id of [...CHAPTERS, "checked"]) {
    await page.locator(id === "checked" ? "#checked" : `[data-chapter="${id}"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
  }
  await page.locator('[data-chapter="match"]').scrollIntoViewIfNeeded();
  await page.locator("details.row summary").first().click();
  await expect(page.locator("details.row[open]")).toHaveCount(1);
  await page.waitForTimeout(300);
  expect(problems).toEqual([]);
}

for (const [name, hash] of [["default view", ""], ["Jezero", "#t=mars-jezero"]]) {
  test(`no console or page errors: ${name}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    await visit(page, hash, problems);
  });
}

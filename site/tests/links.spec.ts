import { expect, test } from "@playwright/test";

test.skip(!process.env.RUN_NETWORK, "set RUN_NETWORK=1 to check every link answers");

test("every source link answers", async ({ page, request }, info) => {
  test.skip(info.project.name !== "laptop", "links are the same on every screen size");
  test.setTimeout(600_000);
  await page.goto("/");
  await expect(page.locator("#ledger li[data-i]")).toHaveCount(10);
  const urls = new Set<string>(await page.locator("a[href^='http']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)));
  for (const f of ["manifest.json", "labels.json", "validation.json"]) {
    const text = await (await request.get(`/data/${f}`)).text();
    text.replace(/https?:\/\/[^"\s)]+/g, (u) => (urls.add(u), u));
  }
  const bad: string[] = [];
  const opts = { timeout: 30_000, maxRedirects: 5, failOnStatusCode: false };
  for (const u of urls) {
    const doi = u.match(/^https:\/\/doi\.org\/(.+)$/);
    if (doi) {
      const r = await request.get(`https://doi.org/api/handles/${doi[1]}`, opts);
      if ((await r.json()).responseCode !== 1) bad.push(`unknown DOI ${u}`);
      continue;
    }
    const file = /\.(tif|img|pds|tab|lbl)$/i.test(u);
    let r = await (file ? request.head(u, opts) : request.get(u, opts)).catch(() => null);
    for (let wait = 2000; r?.status() === 429 && wait <= 16000; wait *= 2) {
      await page.waitForTimeout(wait);
      r = await request.get(u, opts).catch(() => null);
    }
    if (u.includes("wikipedia.org")) await page.waitForTimeout(400);
    if (r && r.status() < 400) continue;
    let inBrowser = false;
    if (!r) {
      inBrowser = await page.evaluate((x) => fetch(x, { method: "HEAD", mode: "no-cors" }).then(() => true, () => false), u);
    } else if (r.status() === 403) {
      const tab = await page.context().newPage();
      inBrowser = ((await tab.goto(u, { timeout: 30_000 }).catch(() => null))?.status() ?? 999) < 400;
      await tab.close();
    }
    if (!inBrowser) bad.push(`${r?.status() ?? "error"} ${u}`);
  }
  expect(bad).toEqual([]);
});

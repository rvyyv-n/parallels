import { expect, test } from "@playwright/test";

test.skip(!process.env.RUN_NETWORK, "set RUN_NETWORK=1 to check every link answers");

test("every source link answers", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  for (const body of ["Moon", "Mars"]) {
    await page.getByRole("radio", { name: body }).check();
  }
  const data = await (await request.get("/data/app.json")).json();
  const urls = new Set<string>(await page.locator("a[href^='http']").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)));
  JSON.stringify(data).replace(/https:\/\/[^"\s)]+/g, (u) => (urls.add(u), u));
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
    const r = await (file ? request.head(u, opts) : request.get(u, opts)).catch(() => null);
    if (r && r.status() < 400) continue;
    const inBrowser = r ? false : await page.evaluate((x) => fetch(x, { method: "HEAD", mode: "no-cors" }).then(() => true, () => false), u);
    if (!inBrowser) bad.push(`${r?.status() ?? "error"} ${u}`);
  }
  expect(bad).toEqual([]);
});

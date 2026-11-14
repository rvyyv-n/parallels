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
  for (const u of urls) {
    const r = await request.get(u, { timeout: 30_000, maxRedirects: 5, ignoreHTTPSErrors: true, failOnStatusCode: false }).catch(() => null);
    if (!r || r.status() >= 400) bad.push(`${r?.status() ?? "error"} ${u}`);
  }
  expect(bad).toEqual([]);
});

import { expect, test } from "@playwright/test";

const MOON = ["Surface", "Resources", "Heat swing", "Shelter", "Polar light and power", "Industrial sites", "Dust"];
const MARS = ["Surface", "Resources", "Heat swing", "Shelter", "Atmosphere and dust", "Signs of life"];

test("a match is open on arrival", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("match");
  await expect(card.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(card.getByText("What's similar")).toBeVisible();
  await expect(card.getByText("How similar")).toBeVisible();
  await expect(card.getByText("Where it breaks")).toBeVisible();
  await expect(card.getByText("Earth can't copy")).toBeVisible();
});

test("main flow: Mars, a challenge, a site, its match", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Mars" }).check();
  await page.getByLabel("Compare against").selectOption({ label: "Gale" });
  await page.getByRole("button", { name: /^Heat swing/ }).click();
  const rows = page.getByTestId("ranking").getByRole("button");
  await expect(rows).toHaveCount(10);
  const second = rows.nth(1);
  const name = (await second.getAttribute("data-name"))!;
  await second.click();
  const card = page.getByTestId("match");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(name);
  await expect(card.getByText(/Gale/).first()).toBeVisible();
  await expect(card.getByTestId("score")).toHaveText(/\d+/);
});

for (const [body, names] of [["Moon", MOON], ["Mars", MARS]] as const) {
  test(`every ${body} challenge is listed`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: body }).check();
    const list = page.getByTestId("challenges");
    for (const n of names) await expect(list.getByRole("button", { name: new RegExp(`^${n}`) })).toBeVisible();
  });
}

test("label-only challenges say why they are not scored", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Dust/ }).click();
  await expect(page.getByText("Not scored", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Apollo samples/)).toBeVisible();
  await page.getByRole("button", { name: /^Shelter/ }).click();
  await expect(page.getByText(/no global map of caves/)).toBeVisible();
});

test("sample values are labelled as sample", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Resources/ }).click();
  await expect(page.getByTestId("match").getByText("sample", { exact: true }).first()).toBeVisible();
});

test("validation chart is shown and says what data it uses", async ({ page }) => {
  await page.goto("/");
  const v = page.getByTestId("validation");
  await v.scrollIntoViewIfNeeded();
  await expect(v.getByRole("heading", { name: "How we checked it" })).toBeVisible();
  expect(await v.locator("svg circle").count()).toBeGreaterThan(20);
  await expect(v.getByText(/real data only/i).first()).toBeVisible();
});

test("footer carries the AI note", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer").getByText("How we used AI")).toBeVisible();
});

test("external links are https and open in a new tab", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator("a[href^='http']").evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.getAttribute("target")]));
  expect(hrefs.length).toBeGreaterThan(5);
  for (const [href, target] of hrefs) {
    expect(href).toMatch(/^https:\/\//);
    expect(target).toBe("_blank");
  }
});

test("no page-level horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(1);
});

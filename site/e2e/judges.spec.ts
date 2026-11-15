import { test } from "@playwright/test";
import { expect, manifest, validation } from "./helpers";

test.describe.configure({ timeout: 90_000 });

test("the judges view lists benchmarks, questions, datasets and the AI note", async ({ page }) => {
  await page.goto("/#v=judges");
  const judges = page.locator('[data-testid="judges"]');
  await expect(judges).toBeVisible();
  await expect(judges.locator('[data-testid="benchmark"]')).toHaveCount(6);
  await expect(judges.locator('[data-testid="question"]')).toHaveCount(7);
  const datasets = judges.locator('[data-testid="dataset"]');
  await expect(datasets).toHaveCount(manifest.datasets.length);
  for (const d of manifest.datasets) {
    const row = datasets.filter({ hasText: d.name }).first();
    await expect(row.locator('[data-testid="licence"]')).toHaveText(d.licence);
    if (d.url) await expect(row.locator(`a[href="${d.url}"]`)).toBeAttached();
  }
  const run = validation.more_runs![0];
  await expect(judges.locator('[data-testid="check"]')).toHaveCount(run.tests.flatMap((t) => t.checks).length);
  await expect(page.locator('[data-testid="ai-note"]').first()).not.toBeEmpty();
});

test("the back link returns to the main page", async ({ page }) => {
  await page.goto("/#v=judges");
  await page.locator('[data-testid="judges-back"]').click();
  await expect(page.locator('[data-testid="feature"]')).toBeAttached();
  expect(page.url()).not.toContain("v=judges");
});

test("the judges view has no sideways scroll at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#v=judges");
  await expect(page.locator('[data-testid="judges"]')).toBeVisible();
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
});

import { test } from "@playwright/test";
import { expectedView, manifest, ready, expect } from "./helpers";

test.describe.configure({ timeout: 90_000 });

const views = [
  { name: "default view", hash: "", target: "moon-south-pole", filter: "rover" },
  { name: "Jezero with life support", hash: "#t=mars-jezero&f=life_support", target: "mars-jezero", filter: "life_support" },
  { name: "an unchecked base site", hash: "#t=mars-arcadia-planitia", target: "mars-arcadia-planitia", filter: "rover" },
];

for (const view of views) {
  test(`featured card and runners match the data files: ${view.name}`, async ({ page }) => {
    const want = await expectedView(view.target, view.filter);
    await ready(page, view.hash);
    const card = page.locator('[data-testid="feature"]');

    const name = await card.locator(".place-name").innerText();
    const coords = await card.locator(".coords").innerText();
    const country = coords.includes(" · ") ? coords.split(" · ")[0] : "";
    expect(country ? `${name}, ${country}` : name).toBe(want.region ?? "Unnamed land");
    expect(coords.endsWith(want.coords)).toBe(true);

    const cells = await card.locator("table.pairs tbody tr").evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent)),
    );
    expect(cells).toEqual(want.pairs);

    const runners = await page.locator("ol.runners li").evaluateAll((lis) =>
      lis.map((li) => {
        const name = li.querySelector(".name")!.textContent!;
        const country = li.querySelector(".country")?.textContent;
        return country ? `${name}, ${country}` : name;
      }),
    );
    expect(runners).toEqual(want.regions.map((r) => r ?? "Unnamed land"));
  });
}

test("intro numbers match the manifest", async ({ page }) => {
  await ready(page);
  await expect(page.locator(".hero-stats dd > span[aria-hidden]")).toHaveText([
    manifest.grid.n.toLocaleString("en"),
    String(manifest.targets.length),
    String(manifest.filters.length),
  ]);
});

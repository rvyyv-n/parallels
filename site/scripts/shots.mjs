// Usage: node scripts/shots.mjs <name> [hash] [url]
// Saves shots/<name>-390.png and shots/<name>-1440.png of the running preview.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [name = "first", hash = "", url = "http://localhost:4173/"] = process.argv.slice(2);
mkdirSync("shots", { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [w, h, scale] of [[390, 844, 2], [1440, 900, 1]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto(url + hash);
  await page.waitForSelector("[data-testid=feature] .pairs tbody tr", { timeout: 20000 }).catch(() => console.log("no feature yet"));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `shots/${name}-${w}.png` });
  await page.close();
}
await browser.close();

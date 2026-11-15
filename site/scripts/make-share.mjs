// Usage: node scripts/make-share.mjs [url]
// Writes public/share.jpg (a 1200x630 screenshot of the first screen of the running site)
// and public/icon-180.png (the site's icon), for link previews and phone home screens.
import { chromium } from "@playwright/test";
import sharp from "sharp";

const [url = "http://localhost:4173/"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(url);
await page.waitForSelector("[data-testid=feature] .pairs tbody tr", { state: "attached", timeout: 30000 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(4000);
await sharp(await page.screenshot()).jpeg({ quality: 84, mozjpeg: true }).toFile("public/share.jpg");
await browser.close();

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#050607"/><path d="M7 12h18M7 20h18" stroke="#ffc965" stroke-width="3" stroke-linecap="round"/></svg>`;
await sharp(Buffer.from(icon), { density: 600 }).resize(180, 180).png().toFile("public/icon-180.png");

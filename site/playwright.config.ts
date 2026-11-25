import { defineConfig, devices } from "@playwright/test";

// Phone tests only need touch, mobile UA, and narrow-viewport specs unless PW_ALL_PHONE=1.
const PHONE_GREP = /(on phone|390 px|375 px|narrow viewports|page nav|nav moves|clicking a pin|popup closes|C0:|main flow)/i;

const CHROMIUM_ARGS = [
  ...(process.env.PW_GPU ? [] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-extensions",
  "--disable-sync",
  "--metrics-recording-only",
  "--mute-audio",
  "--no-first-run",
];

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  fullyParallel: false,
  workers: Number(process.env.PW_WORKERS) || 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:4319",
    reducedMotion: "reduce",
    launchOptions: { args: CHROMIUM_ARGS },
  },
  projects: [
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 },
    },
    {
      name: "phone",
      grep: process.env.PW_ALL_PHONE ? undefined : PHONE_GREP,
      use: { ...devices["Pixel 7"], deviceScaleFactor: 1 },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run build && npm run preview", url: "http://localhost:4319", reuseExistingServer: false, timeout: 120_000 },
});

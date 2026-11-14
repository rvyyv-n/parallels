import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:4319", launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
  projects: [
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 800 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run build && npm run preview", url: "http://localhost:4319", reuseExistingServer: false, timeout: 120_000 },
});

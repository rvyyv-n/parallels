import { defineConfig } from "@playwright/test";

const baseURL = process.env.SITE_URL ?? "http://localhost:4173";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL },
  webServer: process.env.SITE_URL
    ? undefined
    : { command: "npm run preview", url: baseURL, reuseExistingServer: true },
});

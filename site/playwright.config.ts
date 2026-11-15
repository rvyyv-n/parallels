import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "4173";
const baseURL = process.env.SITE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL,
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
  },
  webServer: process.env.SITE_URL
    ? undefined
    : { command: `npx vite preview --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false },
});

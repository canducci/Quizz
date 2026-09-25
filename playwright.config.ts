import { defineConfig, devices } from "@playwright/test";

// Runs against a running stack: `docker compose up -d --build --wait` first.
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: process.env.APP_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

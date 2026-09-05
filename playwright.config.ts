import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 14"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { SKIP_ENV_VALIDATION: "1", NEXT_TELEMETRY_DISABLED: "1" },
  },
});

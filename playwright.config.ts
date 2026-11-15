import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3001",
    channel: "chrome",
    launchOptions: { executablePath: process.env.EVALO_BROWSER_PATH },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1050 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "pnpm start --port 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
});

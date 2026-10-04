import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/frontend",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.SANTOS_BROWSER_PATH
      ? { executablePath: process.env.SANTOS_BROWSER_PATH }
      : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60000,
    // Render the form without production credentials. Every checkout request
    // below is intercepted; this non-secret fixture can never charge a card.
    env: {
      STRIPE_SECRET_KEY: "sk_test_frontend_fixture_not_a_real_key",
    },
  },
});

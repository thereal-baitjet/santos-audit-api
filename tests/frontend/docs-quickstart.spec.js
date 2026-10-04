import { test, expect } from "@playwright/test";
import { docsQuickstart } from "../../lib/docs-quickstart.js";

test("docs quickstart renders the tested SDK example and complete run instructions", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const response = await page.goto("/docs#quickstart");
  expect(response.status()).toBe(200);
  const consent = page.getByRole("button", { name: "Essential only", exact: true });
  if (await consent.isVisible()) await consent.click();
  const quickstart = page.locator("#quickstart");
  await expect(quickstart.getByRole("heading")).toHaveText("First call in 30 seconds");
  const example = quickstart.locator("pre code").filter({ hasText: "import { wrapFetchWithPaymentFromConfig }" });
  expect(await example.textContent()).toBe(docsQuickstart);
  await expect(quickstart).toContainText("Node.js 22 or newer");
  await expect(quickstart).toContainText("never in browser code or version control");
  await expect(quickstart).toContainText("node --env-file=.env quickstart.mjs");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
  await quickstart.screenshot({ path: "test-results/docs-quickstart-mobile.png" });
  expect(errors).toEqual([]);
});

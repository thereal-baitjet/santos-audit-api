import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiProducts, humanProducts, usdLabel, usdcLabel } from "../../lib/products.js";

test("pricing loads directly and shows canonical prices with working checkout links", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const response = await page.goto("/pricing");
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle("Pricing | Santos Website Intelligence");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.santosautomation.com/pricing");
  await page.getByRole("button", { name: "Essential only", exact: true }).click();

  for (const product of humanProducts()) {
    const card = page.getByRole("article", { name: product.name, exact: true });
    await expect(card.locator(".s-price")).toContainText(usdLabel(product.priceUsd));
    await expect(card.getByRole("link")).toHaveAttribute("href", product.tier === "deep" ? `${product.url}?tier=deep` : product.url);
  }
  const rows = page.getByRole("list", { name: "API prices" }).getByRole("listitem");
  await expect(rows).toHaveCount(apiProducts().length);
  for (const product of apiProducts()) {
    const row = rows.filter({ has: page.getByRole("heading", { name: product.name, exact: true }) });
    await expect(row).toContainText(usdcLabel(product.priceUsdc));
    await expect(row).toContainText(product.route);
    await expect(row).toContainText(product.billingUnit);
  }
  for (const path of ["/agent-readiness/buy", "/agent-readiness/buy?tier=deep", "/monitoring", "/docs", "/integrations"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  await page.getByRole("link", { name: "Get Deep Report", exact: true }).click();
  await expect(page).toHaveURL(/\/agent-readiness\/buy\?tier=deep$/);
  await expect(page.getByRole("button", { name: /^Deep/ })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("desktop pricing navigation works and pricing is accessible at mobile widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Essential only", exact: true }).click();
  const navigation = page.waitForResponse((response) => new URL(response.url()).pathname === "/pricing" && response.request().isNavigationRequest());
  await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Pricing", exact: true }).click();
  expect((await navigation).status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Clear pricing.Better decisions.");
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `overflow at ${width}px`).toBeLessThanOrEqual(width);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/pricing-${width}.png`, fullPage: true });
  }
});

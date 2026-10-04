import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function essentialOnly(page) {
  const consent = page.getByRole("button", {
    name: "Essential only",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
}

test("homepage renders without browser errors or horizontal overflow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Be agent-ready.",
  );
  await essentialOnly(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);
  }
  await page.locator(".s-founder img").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".s-founder img").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/screenshots/frontend-desktop.png" });
  await page.screenshot({
    path: "docs/screenshots/frontend-full.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/screenshots/frontend-mobile.png" });
  expect(errors).toEqual([]);
});

test("sample report supports keyboard tabs, evidence, and JSON copy", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await essentialOnly(page);
  const preview = page.getByRole("region", {
    name: "Interactive sample report",
  });
  await preview.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    preview.getByRole("tab", { name: "Evidence 3" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(preview.getByText("MCP registry unconfirmed")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    preview.getByRole("tab", { name: "JSON", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await preview.getByRole("button", { name: "Copy JSON" }).click();
  await expect(
    preview.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  const report = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  expect(report.website_intelligence_score).toBe(82);
  expect(report.sample).toBe(true);
});

test("developer code tabs and copy return the selected integration", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await essentialOnly(page);
  await page.getByRole("tab", { name: "cURL", exact: true }).click();
  await expect(
    page.getByText(
      "# Inspect the payment terms. This does not purchase an audit.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy integration code" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "curl -i",
  );
  await page.getByRole("tab", { name: "MCP", exact: true }).click();
  await expect(page.locator(".developer-example pre")).toContainText(
    "https://api.santosautomation.com/mcp",
  );
});

test("mobile navigation closes with Escape and returns keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await essentialOnly(page);
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(page.locator("#mobile-navigation")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobile-navigation")).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page
    .locator("#mobile-navigation")
    .getByRole("link", { name: "Pricing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("FAQ and cookie choices remain usable", async ({ page }) => {
  await page.goto("/");
  await essentialOnly(page);
  await expect(
    page.getByRole("dialog", { name: "Cookie consent" }),
  ).toHaveCount(0);
  await page.locator(".s-faq-list summary").first().click();
  await expect(page.locator(".s-faq-list details").first()).toHaveAttribute(
    "open",
    "",
  );
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Cookie consent" }),
  ).toBeVisible();
  await essentialOnly(page);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Cookie consent" }),
  ).toHaveCount(0);
});

test("Deep CTA preserves the selected tier and handles checkout errors", async ({
  page,
}) => {
  let purchase;
  await page.route("**/api/checkout", async (route) => {
    purchase = route.request().postDataJSON();
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Please check your website URL." }),
    });
  });
  await page.goto("/");
  await essentialOnly(page);
  await page
    .getByRole("link", { name: "Get Deep Report", exact: true })
    .click();
  await expect(page).toHaveURL(/tier=deep/);
  const selected = page.getByRole("button", { name: /^Deep/ });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Website URL to audit").fill("https://example.com");
  await page
    .getByLabel("Where should we email your report?")
    .fill("frontend-test@example.com");
  await page.getByRole("button", { name: /Buy deep report/ }).click();
  await expect(page.locator(".buy-form").getByRole("alert")).toHaveText(
    "Please check your website URL.",
  );
  await expect(
    page.getByRole("button", { name: /Buy deep report/ }),
  ).toBeEnabled();
  expect(purchase).toEqual({
    tier: "deep",
    url: "https://example.com",
    email: "frontend-test@example.com",
  });
});

test("homepage passes automated WCAG A/AA checks on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await essentialOnly(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  }
});

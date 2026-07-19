// Screenshot & PDF render: the lean subset of the deep-audit browser pass.
// One guarded Chromium session → PNG/JPEG screenshot or PDF, stored as an
// artifact on the job like every other browser product.
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { BrowserGuard } from "./browser-guard.js";

const NAV_TIMEOUT = Number(process.env.BROWSER_NAVIGATION_TIMEOUT_MS ?? 45000);
const UA_SUFFIX = "SantosScreenshotBot/1.0 (+https://api.santosautomation.com/llms.txt)";

const CONTENT_TYPES = { png: "image/png", jpeg: "image/jpeg", pdf: "application/pdf" };

export async function runScreenshot(request, heartbeat = async () => {}) {
  const started = Date.now();
  const { url, format = "png", device = "desktop", full_page = false } = request;
  const isMobile = device === "mobile";

  await heartbeat("launching-browser", 10);
  const browser = await chromium.launch({
    args: ["--no-first-run", "--disable-extensions", "--disable-background-networking"],
  });

  try {
    const guard = new BrowserGuard();
    const context = await browser.newContext({
      viewport: isMobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
      deviceScaleFactor: isMobile ? 3 : 1,
      isMobile,
      hasTouch: isMobile,
      serviceWorkers: "block",
      acceptDownloads: false,
      extraHTTPHeaders: { "x-audited-by": UA_SUFFIX },
    });
    await context.route("**/*", (route) => guard.handleRoute(route));
    const page = await context.newPage();
    page.on("popup", (p) => p.close().catch(() => {}));
    page.on("response", (res) => guard.trackResponse(res));

    await heartbeat("rendering", 40);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    // Let late assets paint, but never block on busy pages.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    await heartbeat("capturing", 75);
    let data;
    if (format === "pdf") {
      data = await page.pdf({ format: "A4", printBackground: true });
    } else {
      data = await page.screenshot({
        fullPage: Boolean(full_page),
        type: format,
        ...(format === "jpeg" ? { quality: 85 } : {}),
      });
    }

    const artifact = {
      id: `art_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      type: format === "pdf" ? "pdf_render" : (full_page ? "screenshot_fullpage" : "screenshot_viewport"),
      device,
      content_type: CONTENT_TYPES[format],
      data,
    };
    const report = {
      schema_version: "1.0.0",
      profile: "screenshot",
      target: { requested_url: url, final_url: page.url() },
      http_status: response?.status() ?? null,
      format,
      device,
      full_page: Boolean(full_page),
      bytes: data.length,
      duration_ms: Date.now() - started,
    };
    return { report, artifacts: [artifact] };
  } finally {
    await browser.close().catch(() => {});
  }
}

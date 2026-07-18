// Deep Page Audit engine: drives one isolated Chromium session per job.
// Order matters: the Playwright evidence pass runs FIRST with full per-request
// SSRF filtering; Lighthouse runs second over CDP (its own navigation is not
// per-request filtered — documented limitation; rely on egress policy too).
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { BrowserGuard } from "./browser-guard.js";

const NAV_TIMEOUT = Number(process.env.BROWSER_NAVIGATION_TIMEOUT_MS ?? 45000);
const CDP_PORT = Number(process.env.WORKER_CDP_PORT ?? 9223);
const MAX_FRAMES = Number(process.env.BROWSER_MAX_FRAMES ?? 30);
const MAX_RENDERED_HTML_BYTES = Number(process.env.AGENT_READINESS_RENDERED_HTML_MAX_BYTES ?? 1024 * 1024);
const UA_SUFFIX = "SantosDeepAuditBot/1.0 (+https://api.santosautomation.com/llms.txt)";

function redactUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}${u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return "(unparseable)";
  }
}

export async function runBrowserPass(url, device, heartbeat) {
  const browser = await chromium.launch({
    args: [
      `--remote-debugging-port=${CDP_PORT}`,
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-networking",
    ],
  });

  const evidence = {
    console_errors: [], console_warnings: [], page_errors: [],
    failed_requests: [], requests: [], third_party_domains: new Set(),
    mixed_content: [], insecure_forms: [], cookies: [],
    main_response: null, redirect_chain: [], frames: 0,
    blocked_requests: [], caps_hit: false,
    screenshots: {},
  };

  const guard = new BrowserGuard();
  const isMobile = device === "mobile";
  const context = await browser.newContext({
    viewport: isMobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    deviceScaleFactor: isMobile ? 3 : 1,
    isMobile,
    hasTouch: isMobile,
    serviceWorkers: "block",
    acceptDownloads: false,
    userAgent: undefined, // keep engine default, append via extra header below
    extraHTTPHeaders: { "x-audited-by": UA_SUFFIX },
  });
  await context.route("**/*", (route) => guard.handleRoute(route));

  const page = await context.newPage();
  page.on("popup", (p) => p.close().catch(() => {}));
  page.on("console", (msg) => {
    const entry = { type: msg.type(), text: msg.text().slice(0, 300) };
    if (msg.type() === "error") evidence.console_errors.push(entry);
    else if (msg.type() === "warning" && evidence.console_warnings.length < 50) evidence.console_warnings.push(entry);
  });
  page.on("pageerror", (err) => evidence.page_errors.push({ message: String(err.message ?? err).slice(0, 300) }));
  page.on("requestfailed", (req) => {
    if (evidence.failed_requests.length < 100) {
      evidence.failed_requests.push({ url: redactUrl(req.url()), type: req.resourceType(), error: req.failure()?.errorText });
    }
  });
  page.on("frameattached", () => {
    if (++evidence.frames > MAX_FRAMES) page.close().catch(() => {});
  });

  const pageOrigin = new URL(url).hostname;
  page.on("response", (res) => {
    guard.trackResponse(res);
    const rurl = res.url();
    try {
      const u = new URL(rurl);
      if (u.hostname !== pageOrigin && !u.hostname.endsWith(`.${pageOrigin}`)) evidence.third_party_domains.add(u.hostname);
      if (u.protocol === "http:" && url.startsWith("https://")) evidence.mixed_content.push(redactUrl(rurl));
    } catch { /* ignore */ }
    if (evidence.requests.length < 300) {
      evidence.requests.push({
        url: redactUrl(rurl),
        status: res.status(),
        type: res.request().resourceType(),
        size: Number(res.headers()["content-length"] ?? 0) || undefined,
      });
    }
  });

  let axeResults = null;
  let navError = null;
  try {
    const resp = await page.goto(url, { timeout: NAV_TIMEOUT, waitUntil: "load" });
    await page.waitForTimeout(2000); // settle: late JS, layout shifts

    if (resp) {
      evidence.main_response = {
        status: resp.status(),
        final_url: redactUrl(page.url()),
        headers: resp.headers(), // header names+values of the AUDITED site's main doc
      };
      let chain = resp.request().redirectedFrom();
      while (chain) { evidence.redirect_chain.unshift(redactUrl(chain.url())); chain = chain.redirectedFrom(); }
    }

    const renderedHtml = await page.content();
    if (Buffer.byteLength(renderedHtml) <= MAX_RENDERED_HTML_BYTES) {
      evidence.rendered_html = renderedHtml;
    } else {
      evidence.rendered_html = renderedHtml.slice(0, MAX_RENDERED_HTML_BYTES);
      evidence.rendered_html_truncated = true;
    }

    await heartbeat?.("browser-evidence");
    evidence.screenshots.viewport = await page.screenshot({ type: "jpeg", quality: 70 });
    try {
      evidence.screenshots.fullpage = await page.screenshot({ type: "jpeg", quality: 60, fullPage: true });
    } catch { /* very tall/broken pages — viewport shot is enough */ }

    evidence.insecure_forms = await page.evaluate(() =>
      [...document.querySelectorAll("form[action]")]
        .map((f) => f.getAttribute("action"))
        .filter((a) => a?.startsWith("http://"))
        .slice(0, 20)
    ).catch(() => []);

    evidence.cookies = (await context.cookies()).map((c) => ({
      name: c.name, domain: c.domain, path: c.path,
      secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
      session: !c.expires || c.expires === -1,
      // cookie VALUES intentionally never captured
    }));

    await heartbeat?.("accessibility");
    try {
      axeResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
    } catch (e) {
      axeResults = { error: String(e.message ?? e) };
    }
  } catch (e) {
    navError = String(e.message ?? e).slice(0, 300);
  }

  evidence.blocked_requests = guard.blocked.slice(0, 50);
  evidence.caps_hit = guard.capped;
  evidence.request_count = guard.requestCount;
  evidence.total_bytes = guard.totalBytes;
  evidence.third_party_domains = [...evidence.third_party_domains].slice(0, 100);

  await context.close().catch(() => {});
  return { browser, evidence, axeResults, navError };
}

export async function runLighthouse(url, device, browser) {
  const flags = {
    port: CDP_PORT,
    output: ["json", "html"],
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  };
  const config = device === "desktop" ? desktopConfig : undefined; // default config is mobile
  try {
    const result = await lighthouse(url, flags, config);
    return { lhr: result.lhr, reportJson: result.report[0], reportHtml: result.report[1] };
  } catch (e) {
    return { error: String(e.message ?? e).slice(0, 300) };
  } finally {
    await browser.close().catch(() => {});
  }
}

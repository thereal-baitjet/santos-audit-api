// Per-request nonce Content-Security-Policy for HTML routes.
//
// A static `script-src 'self'` blocks Next.js's inline bootstrap/hydration
// scripts, so client components silently fail and every visitor logs CSP
// violations. Next.js reads the nonce from the REQUEST's Content-Security-Policy
// header and stamps it onto its inline scripts automatically, so a per-request
// nonce + 'strict-dynamic' keeps CSP strict (no 'unsafe-inline') while letting
// hydration run.
//
// JSON/API routes keep their static headers from next.config.js; this only
// runs on HTML pages (see matcher).
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const API_ORIGIN = process.env.PUBLIC_API_BASE_URL ?? "https://api.santosautomation.com";

// Pages that redirect to Stripe Checkout need Stripe's origins for form-action
// (the POST that redirects) and connect/frame per Stripe's CSP guidance.
const STRIPE_PATHS = ["/agent-readiness/buy"];

// Admin auth: /admin/dashboard requires a Supabase Auth session whose email is
// on this allowlist. RLS on agent_logs enforces the same list independently,
// so a stray signup through the public auth API still reads nothing.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "baitjet@gmail.com,info@santosautomation.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export async function proxy(request) {
  // Apex canonicalization lives here (not as a Vercel domain-level redirect) so
  // /.well-known/* — excluded from this middleware's matcher — is served
  // directly on the apex. The MCP registry's domain verifier refuses redirects.
  const host = request.headers.get("host");
  if (host === "santosautomation.com") {
    const to = request.nextUrl.clone();
    to.host = "www.santosautomation.com";
    return NextResponse.redirect(to, 308);
  }

  const nonce = btoa(crypto.randomUUID());
  const path = request.nextUrl.pathname;
  const stripe = STRIPE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const admin = path === "/admin" || path.startsWith("/admin/");

  // Admin pages talk to Supabase (auth + realtime websocket).
  const supabaseOrigins = admin && SUPABASE_URL
    ? [SUPABASE_URL, SUPABASE_URL.replace(/^https:/, "wss:")]
    : [];
  const connectSrc = ["'self'", API_ORIGIN, ...supabaseOrigins, ...(stripe ? ["https://api.stripe.com"] : [])].join(" ");
  const formAction = ["'self'", ...(stripe ? ["https://checkout.stripe.com"] : [])].join(" ");
  const frameSrc = stripe ? "https://checkout.stripe.com https://js.stripe.com" : "'none'";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self'",
    "img-src 'self' data:",
    `connect-src ${connectSrc}`,
    `form-action ${formAction}`,
    "base-uri 'self'",
    "frame-ancestors 'none'",
    `frame-src ${frameSrc}`,
    "object-src 'none'",
  ].join("; ");

  // Next.js consumes the nonce from the request CSP header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  if (admin) {
    // Without Supabase env the dashboard can't work at all — send everything
    // to the login page, which renders a configuration hint.
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      if (path !== "/admin/login") {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
      return response;
    }

    // Reads the session from cookies and, when the access token is stale,
    // writes refreshed tokens onto this response's cookies.
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));

    if (!isAdmin && path !== "/admin/login") {
      const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
      // Keep any refreshed auth cookies on the redirect.
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
    if (isAdmin && (path === "/admin/login" || path === "/admin")) {
      const redirect = NextResponse.redirect(new URL("/admin/dashboard", request.url));
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  }

  return response;
}

// HTML routes only. Exclude static assets, image optimizer, favicon, and the
// JSON/well-known/api surfaces that don't execute scripts (they keep the
// next.config.js headers).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|audit-widget.js|webmcp.js|api/|openapi.json|capabilities.json|llms.txt|robots.txt|sitemap.xml|.well-known/|mcp).*)",
  ],
};

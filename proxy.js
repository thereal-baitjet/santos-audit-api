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

const API_ORIGIN = process.env.PUBLIC_API_BASE_URL ?? "https://api.santosautomation.com";

// Pages that redirect to Stripe Checkout need Stripe's origins for form-action
// (the POST that redirects) and connect/frame per Stripe's CSP guidance.
const STRIPE_PATHS = ["/agent-readiness/buy"];

export function proxy(request) {
  const nonce = btoa(crypto.randomUUID());
  const path = request.nextUrl.pathname;
  const stripe = STRIPE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  const connectSrc = ["'self'", API_ORIGIN, ...(stripe ? ["https://api.stripe.com"] : [])].join(" ");
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
  return response;
}

// HTML routes only. Exclude static assets, image optimizer, favicon, and the
// JSON/well-known/api surfaces that don't execute scripts (they keep the
// next.config.js headers).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|audit-widget.js|api/|openapi.json|capabilities.json|llms.txt|robots.txt|sitemap.xml|.well-known/|mcp).*)",
  ],
};

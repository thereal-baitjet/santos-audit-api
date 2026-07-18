// CSP for HTML routes is set per-request (with a nonce) in middleware.js.
// A static script-src 'self' here would block Next.js's inline hydration
// scripts, so it is intentionally NOT emitted. The other security headers are
// safe as static values and apply to every route.
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg"],
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Link", value: "<https://api.santosautomation.com/openapi.json>; rel=\"service-desc\"; type=\"application/vnd.oai.openapi+json\", <https://www.santosautomation.com/.well-known/agent-capabilities.json>; rel=\"describedby\"; type=\"application/json\"" },
        ],
      },
    ];
  },
};

export default nextConfig;

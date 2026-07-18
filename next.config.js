const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Link", value: "<https://api.santosautomation.com/openapi.json>; rel=\"service-desc\"; type=\"application/vnd.oai.openapi+json\", <https://www.santosautomation.com/.well-known/agent-capabilities.json>; rel=\"describedby\"; type=\"application/json\"" },
        ],
      },
    ];
  },
};

export default nextConfig;

import "./globals.css";
import { headers } from "next/headers";

export const metadata = {
  metadataBase: new URL("https://www.santosautomation.com"),
  title: "AI Website Intelligence & Agent Readiness API | Santos",
  description:
    "Audit any website for AI Agent Readiness, MCP, llms.txt, OpenAPI, structured data, crawler access, SEO, accessibility, performance and security. Get structured JSON with evidence and prioritized fixes.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "AI Website Intelligence & Agent Readiness API | Santos",
    description: "Measure whether a website can be discovered, understood, trusted, and used by AI agents.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/assets/santos-og.png",
        width: 1200,
        height: 630,
        alt: "Santos Website Intelligence gold eagle emblem",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Website Intelligence & Agent Readiness API | Santos",
    description: "From discoverable to callable: structured website intelligence with evidence and prioritized fixes.",
    images: [
      {
        url: "/assets/santos-og.png",
        alt: "Santos Website Intelligence gold eagle emblem",
      },
    ],
  },
  robots: { index: true, follow: true },
  verification: { google: "0r_77rJapSGFUca8wAeqhf4VYpi7YAG-CsU2NEUUmeo" },
  icons: {
    icon: [
      {
        url: "/assets/santos-eagle.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
    ],
    shortcut: "/assets/santos-eagle.svg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService", "@id": "https://www.santosautomation.com/#organization",
      name: "Santos Automation", url: "https://www.santosautomation.com", email: "info@santosautomation.com",
      image: "https://www.santosautomation.com/assets/santos-og.png",
      founder: { "@type": "Person", name: "Juan Santos" }, areaServed: "US",
      description: "Operator of Santos Website Intelligence, an evidence-based AI Website Intelligence and Agent Readiness API.",
      sameAs: ["https://github.com/thereal-baitjet", "https://instagram.com/mr.j.c.santos"],
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "info@santosautomation.com" },
    },
    {
      "@type": "WebSite", "@id": "https://www.santosautomation.com/#website",
      name: "Santos Website Intelligence", alternateName: "Santos Automation",
      url: "https://www.santosautomation.com",
      publisher: { "@id": "https://www.santosautomation.com/#organization" },
      description: "Website intelligence for the agentic web—from discoverable to callable.",
    },
  ],
};

export default async function RootLayout({ children }) {
  // Read the per-request nonce set by proxy.js. Touching headers() also opts
  // every route into dynamic rendering, which is what lets Next stamp the
  // matching nonce onto its inline scripts (a static render would ship a stale
  // nonce and get blocked by strict-dynamic). The nonce is also handed to the
  // JSON-LD script below so it isn't blocked.
  const nonce = (await headers()).get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
  return (
    <html lang="en">
      <head>
        <link rel="service-desc" type="application/vnd.oai.openapi+json" href="https://api.santosautomation.com/openapi.json" />
        <link rel="alternate" type="text/plain" href="https://api.santosautomation.com/llms.txt" title="Agent-readable service guide" />
        <link rel="alternate" type="application/json" href="https://api.santosautomation.com/capabilities.json" title="Vendor-specific capability manifest" />
        <link rel="alternate" type="application/json" href="https://www.santosautomation.com/.well-known/agent-capabilities.json" title="Agent capability manifest" />
      </head>
      <body>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}

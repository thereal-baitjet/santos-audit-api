import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://www.santosautomation.com"),
  title: "Santos Automation — Software, Systems & Machine-Payable APIs",
  description:
    "Custom web apps, automation systems, and x402 machine-payable APIs. Run a free site audit in seconds — humans welcome, agents pay per call.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Santos Automation",
    description: "Software, automation systems, and machine-payable APIs. Audit your site free in seconds.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/assets/santos-logo.png",
        width: 1024,
        height: 1024,
        alt: "Gold mountain mark for Santos Automation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Santos Automation",
    description: "Software, automation systems, and machine-payable x402 APIs. Audit your site free in seconds.",
    images: [
      {
        url: "/assets/santos-logo.png",
        alt: "Gold mountain mark for Santos Automation",
      },
    ],
  },
  robots: { index: true, follow: true },
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
      "@type": "ProfessionalService", "@id": "https://santosautomation.com/#organization",
      name: "Santos Automation", url: "https://santosautomation.com", email: "baitjet@gmail.com",
      founder: { "@type": "Person", name: "Juan Santos" }, areaServed: "US",
      description: "Custom web apps, automation systems, and machine-payable x402 APIs.",
      sameAs: ["https://github.com/thereal-baitjet", "https://instagram.com/mr.j.c.santos"],
    },
    {
      "@type": "WebAPI", "@id": "https://api.santosautomation.com/#api",
      name: "Santos Site Audit API", url: "https://api.santosautomation.com/api",
      documentation: "https://api.santosautomation.com/openapi.json",
      termsOfService: "https://santosautomation.com/terms",
      provider: { "@id": "https://santosautomation.com/#organization" },
      description: "Quick, deep-page, and passive Agent Readiness audits for public websites and services.",
      offers: [
        { "@type": "Offer", name: "Quick Audit", price: "0.005", priceCurrency: "USDC" },
        { "@type": "Offer", name: "Deep Page Audit", price: process.env.DEEP_AUDIT_PRICE_USDC ?? "0.075", priceCurrency: "USDC" },
        ...(process.env.AGENT_READINESS_PRICE_USDC ? [{ "@type": "Offer", name: "Agent Readiness Audit", price: process.env.AGENT_READINESS_PRICE_USDC, priceCurrency: "USDC" }] : []),
      ],
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="service-desc" type="application/vnd.oai.openapi+json" href="https://api.santosautomation.com/openapi.json" />
        <link rel="alternate" type="text/plain" href="https://api.santosautomation.com/llms.txt" title="Agent-readable service guide" />
        <link rel="alternate" type="application/json" href="https://api.santosautomation.com/capabilities.json" title="Vendor-specific capability manifest" />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}

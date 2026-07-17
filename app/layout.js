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
    images: ["/assets/santos-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Santos Automation",
    description: "Software, automation systems, and machine-payable x402 APIs. Audit your site free in seconds.",
    images: ["/assets/santos-logo.png"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/assets/santos-logo.png" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Santos Automation",
  url: "https://santosautomation.com",
  email: "baitjet@gmail.com",
  founder: { "@type": "Person", name: "Juan Santos" },
  areaServed: "US",
  description: "Custom web apps, automation systems, and machine-payable x402 APIs.",
  sameAs: ["https://github.com/thereal-baitjet", "https://instagram.com/mr.j.c.santos"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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

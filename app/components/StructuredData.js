import { headers } from "next/headers";

export default async function StructuredData({ data }) {
  // ld+json is data, not executable, but nonce it anyway so a strict CSP never
  // flags it (reading headers also keeps rendering dynamic for the nonce).
  const nonce = (await headers()).get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

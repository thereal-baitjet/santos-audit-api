import { PageShell } from "../components/SiteChrome.js";

export const metadata = {
  title: "Terms, Privacy & Data Retention — Santos Automation",
  description: "Plain-language terms, privacy, acceptable-use, payment, and data-retention information for Santos Website Intelligence services.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell>
    <article className="legal-page">
      <a className="legal-back" href="/">← Santos Website Intelligence</a>
      <h1>Terms, privacy, and data retention.</h1>
      <p>
        Effective July 18, 2026. This page explains the public operating rules for
        Santos Website Intelligence API and its Quick Intelligence, Deep Website
        Intelligence, and Agent Readiness services.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Audit only public targets you are authorized to assess. Do not use the service
        to evade access controls, overload a target, probe private networks, collect
        credentials, or perform unlawful or abusive activity. Private, loopback,
        reserved, metadata, credential-bearing, and disallowed-port targets are blocked.
      </p>

      <h2>What the audits do</h2>
      <p>
        Reports are automated technical observations, not legal, compliance,
        accessibility-certification, financial, or security guarantees. Quick and Agent
        Readiness audits use bounded public requests. Deep Website Intelligence uses an isolated
        browser and remains a single-page laboratory assessment, not a penetration test.
      </p>

      <h2 id="privacy">Privacy and collected data</h2>
      <ul>
        <li>Target URLs and operational request metadata may be processed to run and protect the service.</li>
        <li>Agent Readiness never authenticates to or pays the audited target, creates target accounts, submits forms, or invokes target business tools.</li>
        <li>Cookie values, API keys, credentials, payment signatures, and target-user personal data are not intentionally collected.</li>
        <li>Query strings, fragments, credentials, and sensitive headers are redacted from audit evidence where applicable.</li>
      </ul>

      <h2>Retention</h2>
      <p>
        Synchronous audit responses are generated for the requesting client and are not
        promised as permanent storage. Deep reports and artifacts may be retained for a
        limited operational period and then expire. Security, rate-limit, payment, and
        reliability logs may be retained as reasonably necessary to operate, troubleshoot,
        prevent abuse, and meet applicable obligations.
      </p>

      <h2>Payments and retries</h2>
      <p>
        Enforced prices and billing units appear in the live x402 challenge. Safe Fetch, Content Extraction,
        Structured Extraction, Quick Intelligence, Screenshot &amp; PDF Render, and the $0.075 USDC Agent
        Readiness Audit settle only on a successful response.
        Deep Website Intelligence payment purchases one bounded compute reservation and settles when the
        job is accepted. Use an Idempotency-Key for Deep job retries. Never rely on a price
        that is not enforced by the live route.
      </p>
      <p>
        Card purchases: the human Agent Readiness Report is a one-time $5 USD charge
        processed by Stripe (no account is created by Santos). The price is fixed
        server-side. After payment you receive a private, tokened link to your report by
        email. Refunds for card purchases are handled manually — email{" "}
        <a href="mailto:info@santosautomation.com">info@santosautomation.com</a> with your
        purchase email and we will review the request.
      </p>

      <h2>Availability and support</h2>
      <p>
        Services are provided as available and may change through versioned contracts.
        Report problems, replacement-run requests caused by Santos infrastructure, or
        privacy questions to <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>.
        These plain-language terms should be reviewed by qualified counsel as the service grows.
      </p>
    </article>
    </PageShell>
  );
}

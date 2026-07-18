export const metadata = {
  title: "Terms, Privacy & Data Retention — Santos Automation",
  description: "Plain-language operating terms, privacy, acceptable-use, and data-retention information for Santos Automation audit services.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="wrap legal-page">
      <a className="legal-back" href="/">← Santos Automation</a>
      <h1>Terms, privacy, and data retention.</h1>
      <p>
        Effective July 18, 2026. This page explains the public operating rules for
        Santos Site Audit API and its Quick, Deep Page, and Agent Readiness services.
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
        Readiness audits use bounded public requests. Deep Page Audit uses an isolated
        browser and remains a single-page laboratory assessment, not a penetration test.
      </p>

      <h2>Privacy and collected data</h2>
      <ul>
        <li>Target URLs and operational request metadata may be processed to run and protect the service.</li>
        <li>Agent Readiness never authenticates, creates accounts, submits forms, signs payments, or invokes target business tools.</li>
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
        Enforced prices and billing units appear in the live x402 challenge. Quick Audit
        and the $0.025 USDC Agent Readiness Audit settle only on a successful response.
        Deep Page payment purchases one bounded compute reservation and settles when the
        job is accepted. Use an Idempotency-Key for Deep job retries. Never rely on a price
        that is not enforced by the live route.
      </p>

      <h2>Availability and support</h2>
      <p>
        Services are provided as available and may change through versioned contracts.
        Report problems, replacement-run requests caused by Santos infrastructure, or
        privacy questions to <a href="mailto:baitjet@gmail.com">baitjet@gmail.com</a>.
        These plain-language terms should be reviewed by qualified counsel as the service grows.
      </p>
    </main>
  );
}

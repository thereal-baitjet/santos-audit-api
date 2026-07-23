import { headers } from "next/headers";
import { PageShell } from "../components/SiteChrome.js";

// Paste-a-report signature verifier — the human front end for POST /v1/verify.
const path = "/verify";
export const metadata = {
  title: "Verify a Signed Report | Santos",
  description: "Paste any Santos audit report JSON to verify its HMAC-SHA256 signature and confirm the score, URL, and signing time are unmodified.",
  alternates: { canonical: path },
};

export default async function VerifyPage() {
  // Same nonce pattern as AuditWidget: under the strict-dynamic CSP, external
  // scripts need the per-request nonce middleware set.
  const nonce = (await headers()).get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1];
  return (
    <PageShell>
      <article className="article-page report-page">
        <div className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Verify</span></div>
        <header className="page-hero">
          <p className="kicker">Signed reports · HMAC-SHA256</p>
          <h1>Verify an audit report</h1>
          <p className="lede">Every Santos audit report is signed. Paste the full JSON below to confirm it came from Santos and hasn’t been modified — the score, the audited URL, nothing.</p>
        </header>

        <section className="content-section">
          <div className="verify-widget" data-verify-widget>
            <form className="verify-form" data-verify-form>
              <label className="sr-only" htmlFor="verify-json">Report JSON</label>
              <textarea
                id="verify-json"
                name="report"
                rows="12"
                spellCheck="false"
                placeholder='Paste the full report JSON here — including the "signature" field…'
                required
              />
              <button className="btn primary" type="submit">Verify signature</button>
            </form>
            <div className="verify-result" aria-live="polite" data-verify-result hidden />
          </div>
          <p className="sub sub--tight">Machines: <code>POST /v1/verify</code> with the report JSON as the body → <code>{"{ valid, url, score, signed_at }"}</code>. Free, 30 verifications per hour per IP.</p>
        </section>
      </article>
      <script src="/verify-report.js" defer nonce={nonce} />
    </PageShell>
  );
}

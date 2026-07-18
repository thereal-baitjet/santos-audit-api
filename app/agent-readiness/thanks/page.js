import { PageShell } from "../../components/SiteChrome.js";

export const metadata = {
  title: "Thanks — your report is on the way | Santos Website Intelligence",
  description: "Your Agent Readiness Report purchase is confirmed. Check your email for the link.",
  robots: { index: false, follow: false }, // post-payment page — not for indexing
};

export default function ThanksPage() {
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">Payment confirmed</p>
          <h1>Thanks — your report is on the way</h1>
          <p className="lede">
            Check your email for a private link to your Agent Readiness Report. It's
            usually ready within a few minutes. If it hasn't arrived in 15 minutes,
            check spam or email{" "}
            <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>{" "}
            and we'll sort it out.
          </p>
        </header>
        <section className="ar-section">
          <p><a className="btn" href="/">Back to home</a> <a className="btn" href="/reports/sample-agent-readiness">See a sample report</a></p>
        </section>
      </article>
    </PageShell>
  );
}

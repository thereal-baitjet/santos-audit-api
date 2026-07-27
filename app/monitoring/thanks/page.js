import { PageShell } from "../../components/SiteChrome.js";

export const metadata = {
  title: "Thanks — monitoring is on | Santos Website Intelligence",
  description: "Your Santos Monitoring subscription is confirmed. Check your email for your first score.",
  robots: { index: false, follow: false }, // post-payment page — not for indexing
};

export default function MonitoringThanksPage() {
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">Subscription confirmed</p>
          <h1>Thanks — monitoring is on</h1>
          <p className="lede">
            Check your email for your first AI Website Intelligence score — it's
            usually ready within a few minutes. From here on we re-audit weekly and
            email you the moment your score moves 5 points or more. If nothing
            arrives in 15 minutes, check spam or email{" "}
            <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>{" "}
            and we'll sort it out.
          </p>
        </header>
        <section className="ar-section">
          <p className="fine">Every email carries a signed manage link — cancel anytime, no account needed.</p>
          <p><a className="btn" href="/">Back to home</a> <a className="btn" href="/reports/sample-agent-readiness">See a sample report</a></p>
        </section>
      </article>
    </PageShell>
  );
}

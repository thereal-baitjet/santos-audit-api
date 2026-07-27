import { PageShell } from "../components/SiteChrome.js";
import MonitoringForm from "./MonitoringForm.js";
import { stripeConfigured, tierPriceUsd } from "../../lib/stripe/client.js";
import { monitoringPriceUsd } from "../../lib/monitoring/checkout.js";

const MONITORING_PRICE = monitoringPriceUsd();
const DEEP_PRICE = tierPriceUsd("deep");
// Weekly browser-rendered deep reports bought one at a time, per month.
const DEEP_ALA_CARTE = DEEP_PRICE * 4;

export const metadata = {
  title: `Santos Monitoring — weekly website intelligence, $${MONITORING_PRICE}/mo | Santos Website Intelligence`,
  description:
    "Santos Monitoring re-audits your website every week with the same agent-readiness engine, emails you the moment your score moves 5 points or more, and sends a monthly digest when everything is stable. Cancel anytime.",
  alternates: { canonical: "/monitoring" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Santos Monitoring — weekly website intelligence",
    description: "Weekly re-audit, regression alerts, monthly digest. Cancel anytime.",
    url: "/monitoring",
    type: "website",
  },
};

export default function MonitoringPage() {
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">For humans · card subscription</p>
          <h1>Know the moment your score moves</h1>
          <p className="lede">
            One audit tells you where you stand today. <strong>Santos Monitoring</strong> re-audits
            your website every week with the same agent-readiness engine — and emails you the
            moment something regresses, so a broken deploy or a vanished llms.txt never sits
            unnoticed for months.
          </p>
        </header>

        <section className="ar-section two-tracks" aria-labelledby="benefits-h">
          <h2 id="benefits-h">What you get</h2>
          <div className="track-grid">
            <div className="track">
              <h3>Weekly re-audit</h3>
              <p>Your URL is re-scored every week with the same checks as the paid Agent Readiness Report — discovery, OpenAPI, MCP, trust, and commerce evidence.</p>
            </div>
            <div className="track">
              <h3>Regression alerts</h3>
              <p>An email lands the moment your score moves 5 points or more, with the top issues from the new run — improvements and regressions alike.</p>
            </div>
            <div className="track">
              <h3>Monthly digest</h3>
              <p>When everything is stable you get a short monthly digest instead of silence — current score, no noise.</p>
            </div>
          </div>
          <p className="fine">
            Weekly deep evidence à la carte would cost ${DEEP_ALA_CARTE}/mo — monitoring is ${MONITORING_PRICE}/mo.
          </p>
        </section>

        <section className="ar-section" aria-labelledby="start-h">
          <h2 id="start-h" className="sr-only">Start monitoring</h2>
          <div className="audit-box">
            {stripeConfigured() ? (
              <MonitoringForm price={MONITORING_PRICE} />
            ) : (
              <div className="ar-form buy-form" role="status">
                <p><strong>Card checkout is almost ready.</strong> We're finishing setup
                  with our payment provider — check back shortly.</p>
                <p className="fine">
                  Can't wait? Email{" "}
                  <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>{" "}
                  and we'll set up monitoring for you manually.
                </p>
              </div>
            )}
          </div>
          <p className="fine">
            Cancel anytime — every email we send carries a signed manage link, no account
            and no support ticket needed. Questions? Contact{" "}
            <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>.
          </p>
        </section>
      </article>
    </PageShell>
  );
}

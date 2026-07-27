import { PageShell } from "../../components/SiteChrome.js";
import UnsubscribeButton from "./UnsubscribeButton.js";
import { verifyMonitoringToken } from "../../../lib/monitoring/tokens.js";
import { getSubscriptionById } from "../../../lib/monitoring/store.js";

export const dynamic = "force-dynamic"; // per-subscription, token-gated — never cache

export const metadata = {
  title: "Manage monitoring | Santos Website Intelligence",
  description: "Manage or cancel your Santos Monitoring subscription.",
  robots: { index: false, follow: false }, // tokened manage link — not for indexing
};

function InvalidLink() {
  return (
    <article className="content-page ar-page">
      <header>
        <p className="kicker">Santos Monitoring</p>
        <h1>This manage link isn't valid</h1>
        <p className="lede">
          The link may be truncated or outdated. Open the latest monitoring email we
          sent you and use the "Manage or unsubscribe" link at the bottom — or email{" "}
          <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>{" "}
          and we'll cancel for you.
        </p>
      </header>
    </article>
  );
}

export default async function ManagePage({ searchParams }) {
  const { t } = await searchParams;
  const subscriptionId = verifyMonitoringToken(t);
  const sub = subscriptionId ? await getSubscriptionById(subscriptionId).catch(() => null) : null;

  if (!sub) {
    return (
      <PageShell>
        <InvalidLink />
      </PageShell>
    );
  }

  const canceled = sub.status === "canceled";
  return (
    <PageShell>
      <article className="content-page ar-page">
        <header>
          <p className="kicker">Santos Monitoring</p>
          <h1>Manage your subscription</h1>
          <p className="lede">Weekly website intelligence for <strong>{sub.target_url}</strong>.</p>
        </header>
        <section className="ar-section" aria-labelledby="status-h">
          <h2 id="status-h" className="sr-only">Subscription status</h2>
          <div className="track-grid">
            <div className="track">
              <h3>Status</h3>
              <p className="track-price">{sub.status}</p>
              <p>{sub.status === "active" ? "Weekly re-audits are running." : sub.status === "past_due" ? "A payment failed — monitoring is paused until your card goes through." : "Monitoring has ended."}</p>
            </div>
            <div className="track">
              <h3>Latest score</h3>
              <p className="track-price">{sub.last_score ?? "—"} <span>/ 100</span></p>
              <p>{sub.last_run_at ? `Last re-audit: ${new Date(sub.last_run_at).toUTCString().slice(0, 16)}` : "First audit hasn't run yet."}</p>
            </div>
          </div>
        </section>
        <section className="ar-section" aria-labelledby="cancel-h">
          <h2 id="cancel-h">Cancel</h2>
          {canceled ? (
            <p>This subscription is already canceled{sub.canceled_at ? ` (since ${new Date(sub.canceled_at).toUTCString().slice(0, 16)})` : ""} — no further charges will be made.</p>
          ) : (
            <>
              <p>Canceling stops the weekly re-audits and all future charges immediately. This can't be undone from here — you'd start a new subscription on the <a href="/monitoring">monitoring page</a>.</p>
              <UnsubscribeButton token={t} />
            </>
          )}
          <p className="fine">Questions or a refund request? Email{" "}
            <a href="mailto:info@santosautomation.com" data-analytics-event="contact_clicked">info@santosautomation.com</a>.</p>
        </section>
      </article>
    </PageShell>
  );
}

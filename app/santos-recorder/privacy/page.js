import { PageShell } from "../../components/SiteChrome.js";

export const metadata = {
  title: "Santos Recorder Privacy Policy — Santos Automation",
  description:
    "Santos Recorder for macOS collects no data: recordings stay on your Mac, with no accounts, analytics, tracking, or network connections.",
  alternates: { canonical: "/santos-recorder/privacy" },
};

export default function SantosRecorderPrivacyPage() {
  return (
    <PageShell>
      <article className="legal-page">
        <a className="legal-back" href="/">← Santos Automation</a>
        <h1>Santos Recorder Privacy Policy</h1>
        <p>
          Effective October 12, 2026. Santos Recorder is a screen recorder for macOS made
          by Santos Automation. It is built to keep everything you record on your own Mac.
        </p>

        <h2 id="collection">What we collect</h2>
        <p>
          Nothing. Santos Recorder does not collect, transmit, sell, or share any personal
          data. There are no accounts, no analytics, no advertising, no tracking, and no
          crash reporting.
        </p>

        <h2 id="recordings">Your recordings</h2>
        <p>
          Recordings, project files, thumbnails, exports, settings, and logs are stored only
          on your Mac (by default in your Movies folder and in the app&apos;s own folders in
          your Library). They are readable only by your macOS user account. Santos Recorder
          never uploads them. You decide where your exported videos go.
        </p>

        <h2 id="permissions">Screen, microphone, camera, and system audio</h2>
        <p>
          Santos Recorder asks macOS for access to your screen, microphone, camera, and
          system audio only to record what you choose. This media is processed on your Mac
          and saved only to your Mac.
        </p>

        <h2 id="network">Network</h2>
        <p>
          Santos Recorder does not connect to the internet. The only exception is when you
          click a link in the app (for example our Instagram page, website, GitHub page, or
          email address): macOS opens it in your web browser or mail app, and that
          service&apos;s own privacy policy applies.
        </p>

        <h2 id="logs">Logs</h2>
        <p>
          A local log file helps with troubleshooting. It contains app states, timings,
          device names, and error messages — never screen images, audio, or window
          contents. It stays on your Mac unless you choose to send it to us.
        </p>

        <h2 id="children">Children</h2>
        <p>
          Santos Recorder does not knowingly collect information from anyone, including
          children.
        </p>

        <h2 id="changes">Changes</h2>
        <p>
          If this policy changes, the updated version will be published with the app and on
          this page.
        </p>

        <h2 id="contact">Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:info@santosautomation.com">info@santosautomation.com</a>.
        </p>
      </article>
    </PageShell>
  );
}

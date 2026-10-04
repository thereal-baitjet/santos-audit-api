"use client";

import { useEffect, useState } from "react";
import { Tabs } from "./ui/Tabs.js";
import { useAnimate, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleAlert,
  Code2,
  Copy,
  FileJson2,
  Fingerprint,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { REPORT_PREVIEW } from "../../lib/report-preview.js";

const reportJson = JSON.stringify(
  {
    website_intelligence_score: REPORT_PREVIEW.score,
    dimensions: Object.fromEntries(
      REPORT_PREVIEW.dimensions.map(({ name, value }) => [
        name.toLowerCase(),
        value,
      ]),
    ),
    coverage: { tests_executed: 36, tests_available: 40 },
    sample: true,
  },
  null,
  2,
);

export default function IntelligencePreview() {
  const [scope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => {
    if (reduceMotion) {
      scope.current.style.opacity = "";
      scope.current.style.transform = "";
      return;
    }
    const playback = animate(
      scope.current,
      { opacity: [0.6, 1], y: [16, 0] },
      { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
    );
    return () => playback.stop();
  }, [animate, reduceMotion, scope]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportJson);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <div className="intelligence-visual" ref={scope}>
      <div className="orbit-field" aria-hidden="true">
        <div className="intelligence-orbit" />
      </div>
      <div className="preview-note">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>Evidence, not guesswork.</span>
      </div>
      <section
        className="intelligence-window"
        aria-label="Interactive sample report"
      >
        <div className="window-toolbar">
          <div className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <span>
            <Globe2 size={12} aria-hidden="true" /> example.com
          </span>
          <span className="sample-tag">SAMPLE</span>
        </div>
        <div className="window-heading">
          <div>
            <span className="s-eyebrow">WEBSITE INTELLIGENCE</span>
            <h2>Your website. Decoded.</h2>
          </div>
          <FileJson2 size={22} aria-hidden="true" />
        </div>
        <Tabs.Root defaultValue="overview" className="preview-tabs">
          <Tabs.List
            className="preview-tab-list"
            aria-label="Sample report views"
          >
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
            <Tabs.Trigger value="evidence">
              Evidence <span>3</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="json">
              <Code2 size={13} aria-hidden="true" /> JSON
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="overview" className="preview-panel">
            <div className="preview-overview">
              <div
                className="score-gauge"
                role="img"
                aria-label="Sample website intelligence score: 82 out of 100"
              >
                <svg viewBox="0 0 140 140" aria-hidden="true">
                  <circle cx="70" cy="70" r="58" className="gauge-track" />
                  <circle
                    cx="70"
                    cy="70"
                    r="58"
                    className="gauge-value"
                    pathLength="100"
                    strokeDasharray="82 100"
                  />
                </svg>
                <div>
                  <strong>
                    {REPORT_PREVIEW.score}
                    <span>/100</span>
                  </strong>
                  <small>Intelligence score</small>
                </div>
              </div>
              <div className="dimension-meters">
                {REPORT_PREVIEW.dimensions.map(({ name, value }) => (
                  <div key={name}>
                    <div className="meter-label">
                      <span>{name}</span>
                      <strong>{value}</strong>
                    </div>
                    <progress
                      value={value}
                      max="100"
                      aria-label={`${name}: ${value} out of 100`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="evidence-coverage">
              <CheckCheck size={14} aria-hidden="true" />
              <span>36 of 40 checks executed</span>
              <span>90% coverage</span>
            </div>
            <a
              className="preview-finding"
              href="/reports/sample-agent-readiness"
            >
              <span className="finding-icon">
                <Sparkles size={16} aria-hidden="true" />
              </span>
              <div>
                <span className="finding-priority">YOUR NEXT MOVE</span>
                <strong>Make your capabilities discoverable.</strong>
                <p>Publish a complete, versioned capability manifest.</p>
              </div>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </Tabs.Content>
          <Tabs.Content
            value="evidence"
            className="preview-panel preview-evidence"
          >
            {REPORT_PREVIEW.evidence.map((item) => (
              <div
                className={`preview-evidence-row ${item.status}`}
                key={item.title}
              >
                {item.status === "passed" ? (
                  <Check size={18} aria-hidden="true" />
                ) : (
                  <CircleAlert size={18} aria-hidden="true" />
                )}
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <span>
                    {item.status === "action"
                      ? "High priority"
                      : item.status === "passed"
                        ? "Passed"
                        : "Warning"}
                  </span>
                </div>
              </div>
            ))}
          </Tabs.Content>
          <Tabs.Content value="json" className="preview-panel preview-json">
            <div className="json-tools">
              <span>report.json</span>
              <button type="button" onClick={copyReport}>
                {copied ? (
                  <Check size={13} aria-hidden="true" />
                ) : (
                  <Copy size={13} aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>
            <pre tabIndex={0} aria-label="Sample report JSON">
              <code>{reportJson}</code>
            </pre>
            <span className="sr-only" role="status">
              {copied
                ? "Sample JSON copied to clipboard."
                : copyError
                  ? "Clipboard unavailable. Select and copy the JSON manually."
                  : ""}
            </span>
            {copyError && (
              <p className="copy-error">Select and copy the JSON manually.</p>
            )}
          </Tabs.Content>
        </Tabs.Root>
        <div className="window-footer">
          <span>
            <Fingerprint size={13} aria-hidden="true" /> Sanitized sample data
          </span>
          <a
            href="/reports/sample-agent-readiness"
            data-analytics-event="sample_report_opened"
          >
            Full report <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </section>
      <div className="preview-bottom-note">
        <span className="mini-code-icon">
          <Code2 size={16} aria-hidden="true" />
        </span>
        <div>
          <strong>Human clarity. Machine precision.</strong>
          <span>One report. Every signal that matters.</span>
        </div>
        <svg viewBox="0 0 78 30" aria-hidden="true">
          <path d="M1 26L11 22L20 24L28 15L37 18L46 9L55 12L64 4L77 1" />
        </svg>
      </div>
    </div>
  );
}

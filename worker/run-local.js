// Local test harness: run one deep audit directly (no queue, no DB).
//   cd worker && npm install && npx playwright install chromium
//   node run-local.js https://example.com
import { writeFileSync } from "node:fs";
import { runDeepAudit } from "./run-audit.js";

const url = process.argv[2];
if (!url) { console.error("usage: node run-local.js <url>"); process.exit(1); }

const request = {
  url,
  profile: "deep-page",
  devices: ["mobile"],
  modules: ["lighthouse", "accessibility", "browser-network", "security-passive"],
  artifacts: { screenshots: true, lighthouse_json: false, lighthouse_html: false },
};

const { report, artifacts } = await runDeepAudit(request, async (stage, progress) => {
  console.error(`[stage] ${stage} (${progress ?? "?"}%)`);
});

for (const a of artifacts) {
  const ext = a.content_type === "image/jpeg" ? "jpg" : a.content_type === "text/html" ? "html" : "json";
  const file = `/tmp/${a.id}.${ext}`;
  writeFileSync(file, a.data);
  console.error(`[artifact] ${a.type} -> ${file} (${a.data.length} bytes)`);
}

console.log(JSON.stringify({ ...report, findings_count: report.findings.length, findings: report.findings.slice(0, 15) }, null, 2));

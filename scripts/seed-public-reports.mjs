// Seed public_reports with well-known domains so the leaderboard + report
// pages have real volume for organic discovery. Two phases:
//
//   node scripts/seed-public-reports.mjs audit          # fetch + score, write seed-results.jsonl
//   node scripts/seed-public-reports.mjs insert <pat>   # upsert results into Supabase via Mgmt API
//
// The audit phase uses the same auditSite engine as GET /api/audit (operator
// action — no x402 payment, our own infrastructure). Failures are skipped,
// never fatal. The insert phase chunks multi-row upserts through the Supabase
// Management API (a Personal Access Token, NOT the DB password).
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { auditSite } from "../audit.js";
import { quickOverallScore } from "../audit.js";

const PROJECT_REF = "sujjvmmghcsdmqsgzwzo";
const OUT = new URL("./seed-results.jsonl", import.meta.url).pathname;
const CONCURRENCY = 6;

const DOMAINS = [
  // big tech
  "apple.com", "microsoft.com", "google.com", "amazon.com", "meta.com", "netflix.com", "tesla.com", "nvidia.com", "intel.com", "amd.com",
  "ibm.com", "oracle.com", "salesforce.com", "adobe.com", "samsung.com", "sony.com", "dell.com", "hp.com", "cisco.com", "qualcomm.com",
  // dev platforms & languages
  "github.com", "gitlab.com", "bitbucket.org", "nodejs.org", "python.org", "rust-lang.org", "go.dev", "typescriptlang.org", "deno.land", "bun.sh",
  "npmjs.com", "pypi.org", "rubygems.org", "crates.io", "packagist.org", "react.dev", "vuejs.org", "angular.io", "svelte.dev", "nextjs.org",
  "tailwindcss.com", "getbootstrap.com", "jquery.com", "vitejs.dev", "webpack.js.org", "babeljs.io", "eslint.org", "prettier.io", "jestjs.io", "playwright.dev",
  // cloud & infra
  "vercel.com", "netlify.com", "cloudflare.com", "digitalocean.com", "heroku.com", "render.com", "fly.io", "railway.app", "supabase.com", "neon.tech",
  "planetscale.com", "upstash.com", "turso.tech", "docker.com", "kubernetes.io", "hashicorp.com", "jenkins.io", "circleci.com", "datadog.com", "newrelic.com",
  "splunk.com", "pagerduty.com", "sentry.io", "fastly.com", "akamai.com", "mongodb.com", "redis.io", "elastic.co", "postgresql.org", "mysql.com",
  "snowflake.com", "databricks.com", "confluent.io", "wordpress.org", "webflow.com", "squarespace.com", "wix.com", "godaddy.com", "namecheap.com", "ghost.org",
  // AI
  "openai.com", "anthropic.com", "huggingface.co", "cohere.com", "mistral.ai", "perplexity.ai", "midjourney.com", "stability.ai", "replicate.com", "together.ai",
  "groq.com", "x.ai", "runwayml.com", "elevenlabs.io", "deepseek.com", "kimi.com", "claude.ai", "gemini.google.com", "meta.ai", "copilot.microsoft.com",
  // SaaS & work tools
  "stripe.com", "shopify.com", "slack.com", "notion.so", "figma.com", "canva.com", "trello.com", "asana.com", "monday.com", "atlassian.com",
  "zoom.us", "dropbox.com", "box.com", "airtable.com", "hubspot.com", "mailchimp.com", "intercom.com", "zendesk.com", "twilio.com", "resend.com",
  "linear.app", "calendly.com", "cal.com", "loom.com", "miro.com", "discord.com", "telegram.org", "signal.org", "basecamp.com", "clickup.com",
  // commerce & consumer
  "ebay.com", "etsy.com", "walmart.com", "target.com", "bestbuy.com", "costco.com", "nike.com", "adidas.com", "spotify.com", "airbnb.com",
  "uber.com", "lyft.com", "doordash.com", "booking.com", "expedia.com", "tripadvisor.com", "yelp.com", "zillow.com", "instacart.com", "wayfair.com",
  // media & community
  "nytimes.com", "washingtonpost.com", "bbc.com", "cnn.com", "reuters.com", "bloomberg.com", "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
  "news.ycombinator.com", "reddit.com", "stackoverflow.com", "medium.com", "substack.com", "wikipedia.org", "quora.com", "linkedin.com", "pinterest.com", "twitch.tv",
  "youtube.com", "vimeo.com", "tiktok.com", "instagram.com", "facebook.com", "x.com", "mastodon.social", "blueskyweb.org", "discord.gg", "dev.to",
  // finance & crypto
  "paypal.com", "squareup.com", "coinbase.com", "kraken.com", "robinhood.com", "chase.com", "bankofamerica.com", "capitalone.com", "visa.com", "mastercard.com",
  "plaid.com", "wise.com", "revolut.com", "ethereum.org", "base.org", "solana.com", "uniswap.org", "opensea.io", "chain.link", "binance.com",
];

async function runAudit() {
  console.log(`Auditing ${DOMAINS.length} domains (concurrency ${CONCURRENCY})…`);
  const results = [];
  let done = 0, failed = 0;
  const queue = [...DOMAINS];
  async function worker() {
    while (queue.length) {
      const domain = queue.shift();
      try {
        const report = await auditSite(`https://${domain}`);
        const score = report.website_intelligence_score ?? quickOverallScore(report.scores);
        results.push({ domain, url: report.url, score, report });
        done++;
        console.log(`ok   ${domain} (${score})  [${done + failed}/${DOMAINS.length}]`);
      } catch (e) {
        failed++;
        console.log(`fail ${domain}: ${e.message?.slice(0, 80)}  [${done + failed}/${DOMAINS.length}]`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(OUT, results.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`\nWrote ${results.length} reports to ${OUT} (${failed} failed).`);
}

async function runInsert(pat) {
  if (!existsSync(OUT)) throw new Error(`Run the audit phase first (${OUT} missing).`);
  const rows = readFileSync(OUT, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  console.log(`Upserting ${rows.length} reports into public_reports…`);
  const esc = (s) => String(s).replace(/'/g, "''");
  const CHUNK = 20;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = rows.slice(i, i + CHUNK).map((r) =>
      `('${esc(r.domain)}', '${esc(r.url)}', ${Number.isFinite(r.score) ? r.score : "null"}, '${esc(JSON.stringify(r.report))}'::jsonb, 'seed')`
    );
    const query = `insert into public.public_reports (domain, url, score, report, source) values ${values.join(",\n")} on conflict (domain) do update set url = excluded.url, score = excluded.score, report = excluded.report, source = excluded.source, created_at = now()`;
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`chunk ${i / CHUNK + 1}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    console.log(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  console.log("Done. Check https://www.santosautomation.com/reports");
}

const [phase, pat] = process.argv.slice(2);
if (phase === "audit") await runAudit();
else if (phase === "insert" && pat) await runInsert(pat);
else {
  console.error("usage: node scripts/seed-public-reports.mjs audit | insert <supabase-pat>");
  process.exit(1);
}

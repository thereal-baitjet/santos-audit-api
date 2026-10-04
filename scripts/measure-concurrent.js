#!/usr/bin/env node
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.BASE ?? 'https://api.santosautomation.com';

async function runConcurrentTest(concurrency, durationSecs) {
  console.log(`\n⚡ Running ${concurrency} concurrent requests for ${durationSecs}s`);
  console.log('─'.repeat(70));

  const times = [];
  const startTime = Date.now();
  const endTime = startTime + (durationSecs * 1000);
  let count = 0;
  let errors = 0;

  const runOne = async () => {
    while (Date.now() < endTime) {
      const reqStart = Date.now();
      try {
        const res = await fetch(`${BASE}/api/audit?url=https://example.com`, {
          timeout: 15000,
        });
        const ms = Date.now() - reqStart;
        times.push(ms);
        count++;

        if (res.status !== 200) errors++;
      } catch (e) {
        errors++;
      }
    }
  };

  // Run concurrent requests
  const promises = Array(concurrency).fill(0).map(() => runOne());
  await Promise.all(promises);

  const sorted = times.sort((a, b) => a - b);
  const stats = {
    concurrency,
    duration_secs: durationSecs,
    requests: count,
    errors,
    error_rate: (errors / count * 100).toFixed(1) + '%',
    min: Math.min(...sorted),
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    max: Math.max(...sorted),
    avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    rps: (count / durationSecs).toFixed(2),
  };

  console.log(`  Total requests: ${count}`);
  console.log(`  Errors: ${errors} (${stats.error_rate})`);
  console.log(`  Throughput: ${stats.rps} req/s`);
  console.log(`\n  Latency:`);
  console.log(`    min:  ${stats.min}ms`);
  console.log(`    p50:  ${stats.p50}ms`);
  console.log(`    p95:  ${stats.p95}ms`);
  console.log(`    p99:  ${stats.p99}ms`);
  console.log(`    max:  ${stats.max}ms`);
  console.log(`    avg:  ${stats.avg}ms`);

  return stats;
}

async function main() {
  console.log('🚀 Santos API Concurrent Load Test');
  console.log(`   Base URL: ${BASE}`);
  console.log(`   Endpoint: GET /api/audit?url=https://example.com`);
  console.log(`   Time: ${new Date().toISOString()}`);

  const allResults = [];

  // Test at different concurrency levels
  for (const concurrency of [1, 5, 10, 20, 50]) {
    const stats = await runConcurrentTest(concurrency, 30);
    allResults.push(stats);
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(__dirname, `../concurrent-results-${timestamp}.json`);
  writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  console.log(`\n✅ Results saved to: ${resultsFile}`);

  // Summary table
  console.log('\n📋 Concurrency Summary:');
  console.log('┌────┬────────┬────────┬────────┬────────┬────────┐');
  console.log('│ #  │  p50   │  p95   │  p99   │  avg   │  rps   │');
  console.log('├────┼────────┼────────┼────────┼────────┼────────┤');
  for (const r of allResults) {
    console.log(`│ ${String(r.concurrency).padStart(2)} │ ${String(r.p50).padStart(6)}│ ${String(r.p95).padStart(6)}│ ${String(r.p99).padStart(6)}│ ${String(r.avg).padStart(6)}│ ${r.rps.padStart(6)}│`);
  }
  console.log('└────┴────────┴────────┴────────┴────────┴────────┘');
}

main().catch(console.error);

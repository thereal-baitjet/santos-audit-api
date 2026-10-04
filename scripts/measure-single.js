#!/usr/bin/env node
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = process.env.BASE ?? 'https://api.santosautomation.com';

const ENDPOINTS = [
  { name: 'Quick Audit', url: `${BASE}/api/audit?url=https://example.com`, method: 'GET' },
  { name: 'Agent Readiness (quick)', url: `${BASE}/api/agent-readiness?url=https://example.com&depth=quick`, method: 'GET' },
  { name: 'Extract', url: `${BASE}/v1/extract`, method: 'POST', body: { url: 'https://example.com' } },
  { name: 'Fetch', url: `${BASE}/v1/fetch?url=https://example.com`, method: 'GET' },
];

async function measureEndpoint(endpoint, iterations = 10) {
  const times = [];
  const stageBreakdowns = [];

  console.log(`\n📊 ${endpoint.name}`);
  console.log('─'.repeat(70));

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const res = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Santos-Perf-Test/1.0',
        },
        ...(endpoint.body && { body: JSON.stringify(endpoint.body) }),
        timeout: 30000,
      });
      const ms = Date.now() - start;
      times.push(ms);

      // Capture stage timings
      const responseTime = res.headers.get('x-response-time');
      const stageTimings = res.headers.get('x-stage-timings');
      if (stageTimings) stageBreakdowns.push(stageTimings);

      const statusOk = res.status === 200;
      console.log(`  ${String(i + 1).padStart(2)}. ${String(ms).padStart(5)}ms ${statusOk ? '✓' : `✗ (${res.status})`}`);

      if (!statusOk && i === 0) {
        try {
          const text = await res.text();
          console.log(`      Error: ${text.slice(0, 120)}`);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.log(`  ${String(i + 1).padStart(2)}. ERROR: ${e.message}`);
      times.push(null);
    }
  }

  const valid = times.filter(t => t !== null).sort((a, b) => a - b);
  if (valid.length === 0) {
    console.log('  ⚠️  No successful requests');
    return null;
  }

  const stats = {
    endpoint: endpoint.name,
    iterations: valid.length,
    min: Math.min(...valid),
    p50: valid[Math.floor(valid.length * 0.50)],
    p95: valid[Math.floor(valid.length * 0.95)],
    p99: valid[Math.floor(valid.length * 0.99)],
    max: Math.max(...valid),
    avg: Math.round(valid.reduce((a, b) => a + b, 0) / valid.length),
  };

  console.log('\n  Results:');
  console.log(`    min:  ${stats.min}ms`);
  console.log(`    p50:  ${stats.p50}ms`);
  console.log(`    p95:  ${stats.p95}ms`);
  console.log(`    p99:  ${stats.p99}ms`);
  console.log(`    max:  ${stats.max}ms`);
  console.log(`    avg:  ${stats.avg}ms`);

  if (stageBreakdowns.length > 0) {
    console.log('\n  Stage breakdown (first request):');
    console.log(`    ${stageBreakdowns[0]}`);
  }

  return stats;
}

async function main() {
  console.log('🚀 Santos API Performance Measurement');
  console.log(`   Base URL: ${BASE}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  const results = [];
  for (const endpoint of ENDPOINTS) {
    const stats = await measureEndpoint(endpoint);
    if (stats) results.push(stats);
  }

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = path.join(__dirname, `../results-${timestamp}.json`);
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to: ${resultsFile}`);

  // Summary table
  console.log('\n📋 Summary:');
  console.log('┌─────────────────────────┬─────┬─────┬─────┬─────┐');
  console.log('│ Endpoint                │ p50 │ p95 │ p99 │ max │');
  console.log('├─────────────────────────┼─────┼─────┼─────┼─────┤');
  for (const r of results) {
    console.log(`│ ${r.endpoint.padEnd(23)} │ ${String(r.p50).padStart(4)}│ ${String(r.p95).padStart(4)}│ ${String(r.p99).padStart(4)}│ ${String(r.max).padStart(4)}│`);
  }
  console.log('└─────────────────────────┴─────┴─────┴─────┴─────┘');
}

main().catch(console.error);

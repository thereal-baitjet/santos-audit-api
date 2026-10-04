#!/usr/bin/env node
import fetch from 'node-fetch';

const BASE = process.env.BASE ?? 'https://api.santosautomation.com';

const TEST_TARGETS = [
  { name: 'Fast (example.com)', url: 'https://example.com', category: 'fast' },
  { name: 'Medium (wikipedia.org)', url: 'https://en.wikipedia.org', category: 'medium' },
  { name: 'Medium (stripe.com)', url: 'https://stripe.com', category: 'medium' },
  { name: 'Large (npm.js)', url: 'https://www.npmjs.com', category: 'large' },
  { name: 'Slow (developer.mozilla.org)', url: 'https://developer.mozilla.org', category: 'slow' },
];

async function measureAudit(targetUrl, targetName, iterations = 3) {
  const times = [];

  console.log(`\n🎯 ${targetName}`);
  console.log('─'.repeat(60));

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const res = await fetch(
        `${BASE}/api/audit?url=${encodeURIComponent(targetUrl)}`,
        { timeout: 30000 }
      );
      const ms = Date.now() - start;
      times.push(ms);

      const statusOk = res.status === 200;
      console.log(`  ${i + 1}. ${ms.toString().padStart(5)}ms ${statusOk ? '✓' : `✗ (${res.status})`}`);

      if (statusOk && i === 0) {
        const data = await res.json();
        console.log(`     Score: ${data.overall_score}/100 | Issues: ${data.issues.length}`);
        console.log(`     TTFB: ${data.timing_ms?.ttfb}ms | Total: ${data.timing_ms?.total}ms`);
      }
    } catch (e) {
      console.log(`  ${i + 1}. ERROR: ${e.message}`);
      times.push(null);
    }
  }

  const valid = times.filter(t => t !== null).sort((a, b) => a - b);
  if (valid.length === 0) {
    console.log('  ⚠️  No successful requests');
    return null;
  }

  const avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  console.log(`\n  Avg: ${avg}ms | Min: ${Math.min(...valid)}ms | Max: ${Math.max(...valid)}ms`);

  return { target: targetName, category: TEST_TARGETS.find(t => t.url === targetUrl)?.category, avg, min: Math.min(...valid), max: Math.max(...valid) };
}

async function main() {
  console.log('🚀 Multi-Target Latency Measurement');
  console.log(`   Base URL: ${BASE}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  const results = [];
  for (const target of TEST_TARGETS) {
    const result = await measureAudit(target.url, target.name);
    if (result) results.push(result);
  }

  // Summary by category
  console.log('\n📊 Summary by Category:');
  console.log('┌──────────┬────────┬────────┬────────┐');
  console.log('│ Category │  Avg   │  Min   │  Max   │');
  console.log('├──────────┼────────┼────────┼────────┤');

  const categories = [...new Set(results.map(r => r.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const avgOfAvg = Math.round(catResults.reduce((a, b) => a + b.avg, 0) / catResults.length);
    const minOfMin = Math.min(...catResults.map(r => r.min));
    const maxOfMax = Math.max(...catResults.map(r => r.max));
    console.log(`│ ${cat.padEnd(8)} │ ${String(avgOfAvg).padStart(6)}│ ${String(minOfMin).padStart(6)}│ ${String(maxOfMax).padStart(6)}│`);
  }
  console.log('└──────────┴────────┴────────┴────────┘');
}

main().catch(console.error);

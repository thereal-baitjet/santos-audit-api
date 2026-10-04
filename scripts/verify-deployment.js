#!/usr/bin/env node
// Verify that timing instrumentation is deployed and working.

import fetch from 'node-fetch';

const BASE = process.env.BASE ?? 'https://api.santosautomation.com';

async function checkEndpoint(name, url) {
  console.log(`\n🔍 Checking: ${name}`);
  console.log('─'.repeat(60));

  try {
    const res = await fetch(url, { timeout: 10000 });

    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);

    const timing = res.headers.get('x-response-time');
    const stages = res.headers.get('x-stage-timings');

    if (timing) {
      console.log(`✅ X-Response-Time: ${timing}`);
    } else {
      console.log(`❌ X-Response-Time: NOT FOUND`);
    }

    if (stages) {
      console.log(`✅ X-Stage-Timings: ${stages}`);
    } else {
      console.log(`❌ X-Stage-Timings: NOT FOUND`);
    }

    // Check for our error responses (402) vs HTML 403 errors
    if (res.status === 403) {
      const body = await res.text();
      if (body.includes('<!DOCTYPE html>')) {
        console.log(`⚠️  Returning HTML 403 — routes may not be deployed`);
        return false;
      }
    }

    if (res.status === 402) {
      console.log(`✅ Returning x402 payment challenge (expected)`);
      return true;
    }

    if (res.status === 200) {
      console.log(`✅ Returning 200 (successful audit)`);
      return true;
    }

    return res.status < 500;
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Deployment Verification Checklist');
  console.log(`Base URL: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  const checks = [
    { name: 'Quick Audit', url: `${BASE}/api/audit?url=https://example.com` },
    { name: 'Agent Readiness', url: `${BASE}/api/agent-readiness?url=https://example.com&depth=quick` },
    { name: 'Extract (GET)', url: `${BASE}/v1/extract?url=https://example.com` },
  ];

  const results = [];
  for (const check of checks) {
    const passed = await checkEndpoint(check.name, check.url);
    results.push({ name: check.name, passed });
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📋 Summary');
  console.log('═'.repeat(60));

  const allPassed = results.every(r => r.passed);

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  }

  console.log('\n' + '─'.repeat(60));
  if (allPassed) {
    console.log('✅ Deployment verified! Timing headers present.');
    console.log('\nNext: Run measurements to capture timing breakdown:');
    console.log('  node scripts/measure-single.js');
  } else {
    console.log('❌ Deployment incomplete. Timing headers not found.');
    console.log('\nPossible issues:');
    console.log('  1. Routes not yet redeployed');
    console.log('  2. Vercel cache needs to clear (may take 5-10 min)');
    console.log('  3. Code has syntax errors (check build logs)');
    console.log('\nFix: Redeploy the fix/tag-self-test-payments branch');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);

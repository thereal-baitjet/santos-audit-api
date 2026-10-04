# Santos API Performance Measurement Plan

## Phase 1: Setup & Instrumentation

### 1.1 Add Timing Headers to API Responses

First, instrument the API to return timing breakdowns. Add this to your Next.js middleware or route handlers:

```javascript
// lib/timing.js
export function addTimingHeaders(res, startTime, stages = {}) {
  const totalMs = Date.now() - startTime;
  res.setHeader('X-Response-Time', `${totalMs}ms`);
  
  // Individual stages (if provided)
  const stageStr = Object.entries(stages)
    .map(([k, v]) => `${k}=${v}ms`)
    .join(',');
  if (stageStr) res.setHeader('X-Stage-Timings', stageStr);
  
  return totalMs;
}
```

Then in your route handlers:
```javascript
const startTime = Date.now();
const stages = {};

// Stage 1: x402 validation
const stage1Start = Date.now();
// ... validate x402 payment ...
stages.x402_validation = Date.now() - stage1Start;

// Stage 2: fetch target URL
const stage2Start = Date.now();
// ... safeFetch(...) ...
stages.fetch_target = Date.now() - stage2Start;

// ... continue for each stage ...

addTimingHeaders(res, startTime, stages);
```

---

## Phase 2: Measurement Scripts

### 2.1 Simple Single-Request Measurement (Node.js)

**File: `scripts/measure-single.js`**

```javascript
import fetch from 'node-fetch';

const ENDPOINTS = [
  { name: 'Quick Audit', url: 'https://api.santosautomation.com/api/audit?url=https://example.com', method: 'GET' },
  { name: 'Agent Readiness', url: 'https://api.santosautomation.com/api/agent-readiness?url=https://example.com&depth=quick', method: 'GET' },
  { name: 'Extract', url: 'https://api.santosautomation.com/v1/extract', method: 'POST', body: { url: 'https://example.com' } },
];

async function measureEndpoint(endpoint, iterations = 5) {
  const times = [];
  const stages = [];
  
  console.log(`\n📊 Measuring: ${endpoint.name}`);
  console.log('─'.repeat(60));
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    try {
      const res = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BUYER_PRIVATE_KEY}`, // if needed
        },
        ...(endpoint.body && { body: JSON.stringify(endpoint.body) }),
      });
      const ms = Date.now() - start;
      times.push(ms);
      
      // Extract stage timings from headers
      const stageTiming = res.headers.get('x-stage-timings');
      if (stageTiming) stages.push(stageTiming);
      
      console.log(`  ${i + 1}. ${ms}ms ${res.status === 200 ? '✓' : `✗ (${res.status})`}`);
      
      if (res.status !== 200) {
        const body = await res.text();
        console.log(`     Error: ${body.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`  ${i + 1}. ERROR: ${e.message}`);
      times.push(null);
    }
  }
  
  const valid = times.filter(t => t !== null).sort((a, b) => a - b);
  if (valid.length === 0) {
    console.log('  ⚠️  No successful requests');
    return;
  }
  
  console.log('\n  Results:');
  console.log(`    Min:  ${Math.min(...valid)}ms`);
  console.log(`    p50:  ${valid[Math.floor(valid.length * 0.5)]}ms`);
  console.log(`    p95:  ${valid[Math.floor(valid.length * 0.95)]}ms`);
  console.log(`    p99:  ${valid[Math.floor(valid.length * 0.99)]}ms`);
  console.log(`    Max:  ${Math.max(...valid)}ms`);
  console.log(`    Avg:  ${Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)}ms`);
  
  if (stages.length > 0) {
    console.log('\n  Stage breakdown (sample):');
    console.log(`    ${stages[0]}`);
  }
}

async function main() {
  for (const endpoint of ENDPOINTS) {
    await measureEndpoint(endpoint, 10);
  }
}

main().catch(console.error);
```

**Run it:**
```bash
node scripts/measure-single.js
```

---

### 2.2 Load Testing with k6 (Concurrent Requests)

**File: `scripts/load-test.js`**

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Ramp up to 10 users
    { duration: '30s', target: 10 },   // Stay at 10
    { duration: '10s', target: 50 },   // Ramp to 50
    { duration: '30s', target: 50 },   // Stay at 50
    { duration: '10s', target: 0 },    // Ramp down
  ],
};

const ENDPOINTS = [
  { name: 'quick_audit', url: 'https://api.santosautomation.com/api/audit?url=https://example.com' },
  { name: 'extract', url: 'https://api.santosautomation.com/v1/extract', method: 'POST', body: JSON.stringify({ url: 'https://example.com' }) },
];

export default function () {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: endpoint.name },
  };

  let res;
  if (endpoint.method === 'POST') {
    res = http.post(endpoint.url, endpoint.body, params);
  } else {
    res = http.get(endpoint.url, params);
  }

  check(res, {
    'status 200': (r) => r.status === 200,
    'status 400-499': (r) => r.status >= 400 && r.status < 500,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
  
  sleep(1);
}
```

**Install k6 and run:**
```bash
# macOS
brew install k6

# Then run the test
k6 run scripts/load-test.js --vus 10 --duration 60s
```

---

### 2.3 Multi-Target Testing (Fast vs Slow Sites)

**File: `scripts/measure-targets.js`**

```javascript
import fetch from 'node-fetch';

const TEST_TARGETS = [
  { name: 'Fast (example.com)', url: 'https://example.com' },
  { name: 'Medium (wikipedia.org)', url: 'https://en.wikipedia.org' },
  { name: 'Slow (large PDF or media)', url: 'https://example.com/large-page' },
];

async function measureAudit(targetUrl, targetName) {
  console.log(`\n🎯 Target: ${targetName}`);
  const start = Date.now();
  
  try {
    const res = await fetch(`https://api.santosautomation.com/api/audit?url=${encodeURIComponent(targetUrl)}`);
    const ms = Date.now() - start;
    
    console.log(`   Time: ${ms}ms`);
    console.log(`   Status: ${res.status}`);
    console.log(`   X-Response-Time: ${res.headers.get('x-response-time')}`);
    console.log(`   X-Stage-Timings: ${res.headers.get('x-stage-timings')}`);
    
    if (res.status === 200) {
      const data = await res.json();
      console.log(`   Score: ${data.overall_score}/100`);
    }
  } catch (e) {
    console.log(`   ERROR: ${e.message}`);
  }
}

async function main() {
  for (const target of TEST_TARGETS) {
    await measureAudit(target.url, target.name);
  }
}

main().catch(console.error);
```

---

### 2.4 Geographic Testing (Multiple Regions)

**Option A: Run locally from each region**
```bash
# From your US-East machine:
node scripts/measure-single.js > results-us-east.txt

# SSH to US-West, Europe, etc. and repeat:
ssh user@west.machine "cd santos-audit-api && node scripts/measure-single.js" > results-us-west.txt
```

**Option B: Use a latency simulation tool (for now)**
```bash
# Add artificial latency to simulate other regions
# On macOS with Network Link Conditioner:
# https://developer.apple.com/download/all/?q=network%20link%20conditioner

# Or use tc (Linux):
sudo tc qdisc add dev eth0 root netem latency 50ms  # simulate 50ms latency
node scripts/measure-single.js
sudo tc qdisc del dev eth0 root  # remove
```

---

### 2.5 Payment Flow Testing (x402 Overhead)

**File: `scripts/measure-with-payment.js`**

Measure with actual x402 payment to see the full cost:

```javascript
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";

async function measureWithPayment() {
  const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
  const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
  });

  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    const res = await fetchWithPay('https://api.santosautomation.com/api/audit?url=https://example.com');
    const ms = Date.now() - start;
    times.push(ms);
    console.log(`${i + 1}. ${ms}ms`);
  }

  const sorted = times.sort((a, b) => a - b);
  console.log(`\nWith x402 Payment:`);
  console.log(`  p50: ${sorted[Math.floor(times.length * 0.5)]}ms`);
  console.log(`  p95: ${sorted[Math.floor(times.length * 0.95)]}ms`);
}

measureWithPayment().catch(console.error);
```

---

## Phase 3: OpenTelemetry Setup (Optional but Recommended)

Add detailed tracing to understand where time is spent:

**File: `lib/otel.js`**

```javascript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('santos-api');

export function withTrace(spanName, fn) {
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: 0 });
      return result;
    } catch (e) {
      span.recordException(e);
      span.setStatus({ code: 1 });
      throw e;
    } finally {
      span.end();
    }
  });
}
```

Then in your route:
```javascript
await withTrace('fetch_target_url', () => safeFetch(url));
```

---

## Phase 4: Collection & Analysis Template

After running the measurement scripts, fill in this table:

| Endpoint | Location | Load | p50 (ms) | p95 (ms) | p99 (ms) | Success % | Notes |
|----------|----------|------|----------|----------|----------|-----------|-------|
| Quick Audit | US-East | 1 | ? | ? | ? | ? | |
| Quick Audit | US-East | 10 | ? | ? | ? | ? | |
| Quick Audit | US-East | 50 | ? | ? | ? | ? | |
| Agent Readiness | US-East | 1 | ? | ? | ? | ? | |
| Extract | US-East | 1 | ? | ? | ? | ? | |

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install node-fetch k6

# 2. Run single-request baseline
node scripts/measure-single.js

# 3. Run load test
k6 run scripts/load-test.js --vus 10 --duration 30s

# 4. Test different targets
node scripts/measure-targets.js

# 5. Measure payment overhead (if API ready)
node scripts/measure-with-payment.js
```

---

## What to Look For

**Red flags that need optimization:**
- p95 > 3s for Quick Audit (should be < 2.5s)
- p95 > 5s for Agent Readiness (should be < 4s)
- p99 > 10s for any endpoint
- Latency increases linearly with load (sign of bottleneck)
- Stage timing shows fetch > 60% of total time
- Payment verification adds > 500ms

**Next step:**
Run the scripts above, collect the numbers, and paste the results back with your findings.

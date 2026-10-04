# Performance Testing Guide

Quick start guide to measure and optimize Santos API latency.

## Installation

```bash
npm install node-fetch

# Optional: Install k6 for advanced load testing
# macOS:
brew install k6

# Linux:
sudo apt-get install k6

# Windows:
choco install k6
```

## Quick Start (5 minutes)

### 1. Basic Latency Measurement

Measure p50, p95, p99 latencies for all endpoints:

```bash
node scripts/measure-single.js
```

**Output:**
- 10 requests per endpoint
- Prints p50, p95, p99, min, max, avg
- Saves detailed results to `results-*.json`

### 2. Concurrent Load Test (no k6)

Test how latency changes under concurrent load (1, 5, 10, 20, 50 concurrent users):

```bash
node scripts/measure-concurrent.js
```

**Output:**
- 30-second test at each concurrency level
- Shows throughput (req/s) and latency percentiles
- Identifies bottlenecks under load

### 3. Multi-Target Test

Measure latency across different target sites (fast, medium, slow):

```bash
node scripts/measure-targets.js
```

**Output:**
- Tests fast, medium, and slow targets
- Shows how target size affects latency
- Helps identify fetch vs. processing bottlenecks

---

## Advanced: k6 Load Testing

For more detailed load testing with graphs and advanced metrics:

```bash
k6 run scripts/load-test.js

# Or with custom settings:
k6 run scripts/load-test.js --vus 50 --duration 120s

# Generate HTML report:
k6 run scripts/load-test.js --out html=report.html
```

---

## Full Measurement Suite (30 minutes)

Run everything to get a complete picture:

```bash
# 1. Baseline single-request latency
echo "=== BASELINE LATENCY ===" && node scripts/measure-single.js

# 2. Test different targets
echo "=== MULTI-TARGET TEST ===" && node scripts/measure-targets.js

# 3. Concurrent load test
echo "=== CONCURRENT LOAD ===" && node scripts/measure-concurrent.js

# 4. Optional: k6 load test (if installed)
echo "=== K6 LOAD TEST ===" && k6 run scripts/load-test.js
```

---

## Interpreting Results

### Healthy Latency Profile

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| Quick Audit | 1.2s | 2.5s | 4.0s |
| Agent Readiness | 2.0s | 4.0s | 6.0s |
| Extract | 0.8s | 1.5s | 2.5s |

### Red Flags

- **p95 > 3s for Quick Audit** → fetch or parsing bottleneck
- **Latency increases 2x when going from 1→10 concurrent** → resource contention
- **High p99 (>5s)** → outliers/GC pauses/cold starts
- **Error rate > 1%** → timeout or capacity issues

---

## Adding Instrumentation to API

To track where time is spent, add timing headers to your API responses:

**In your route handler:**
```javascript
const stages = {};

// Stage 1: x402 validation
const t1 = Date.now();
// ... verify payment ...
stages.x402 = Date.now() - t1;

// Stage 2: fetch target
const t2 = Date.now();
const { body } = await safeFetch(url);
stages.fetch = Date.now() - t2;

// Stage 3: parse & analyze
const t3 = Date.now();
const $ = cheerio.load(body);
// ... scoring logic ...
stages.analyze = Date.now() - t3;

// Return with timing headers
res.setHeader('X-Response-Time', `${Date.now() - start}ms`);
res.setHeader('X-Stage-Timings', 
  Object.entries(stages).map(([k,v]) => `${k}=${v}`).join(',')
);
```

Then the measurement scripts will capture and print these automatically.

---

## Optimization Checklist

Once you have baseline measurements:

- [ ] Measure baseline (p50, p95, p99)
- [ ] Identify biggest latency contributor (fetch? parsing? scoring?)
- [ ] Profile with Node DevTools: `node --inspect scripts/measure-single.js`
- [ ] Check for N+1 fetches or redundant parsing
- [ ] Measure impact of each optimization
- [ ] Set target latency (e.g., Quick Audit p95 < 2.5s)
- [ ] Monitor in production with OpenTelemetry

---

## Next Steps

1. **Run baseline tests** and save the numbers
2. **Paste results** into the optimization conversation
3. **Get a prioritized roadmap** of what to optimize first
4. **Measure impact** of each change before deploying

Questions? Check `perf-measurement-plan.md` for detailed explanation of each script.

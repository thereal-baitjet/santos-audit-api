# Weeks 1-3 Optimization Implementation

**Status:** ✅ Complete  
**Implemented:** Oct 4, 2026

---

## What Was Implemented

### Week 1: Timing Instrumentation ✅

**Goal:** Measure where time is actually spent (fetch, parse, score, etc.)

#### New Files
- **`lib/timing.js`** — Timing tracker with stage breakdown
  - Tracks stages: `mark(name)` → do work → `end(name)`
  - Auto-generates headers: `X-Response-Time`, `X-Stage-Timings`
  - Exposes headers for browsers/agents to read

#### Routes Instrumented
1. **`app/api/audit/route.js`** — Quick Audit
   - Stages: `x402`, `audit`, `sign`, `public_listing`
   - Headers automatically added to response

2. **`app/api/agent-readiness/route.js`** — Agent Readiness
   - Stages: `x402`, `audit`, `sign`, `public_listing`
   - Same timing structure as audit

3. **`app/v1/extract/route.js`** — Page Extraction
   - Stages: `x402`, `parse_request`, `extract`
   - Lighter instrumentation for simpler flow

#### How to Use
```javascript
// In route handler:
const timing = new TimingTracker();
req.timing = timing;

// Wrap async work:
const result = await timedStage(timing, 'fetch', () => safeFetch(url));

// Automatically added to response headers:
// X-Response-Time: 1234ms
// X-Stage-Timings: x402=45ms,fetch=850ms,parse=120ms,score=80ms
```

#### Expected Output
```bash
$ curl -i https://api.santosautomation.com/api/audit?url=https://example.com
HTTP/1.1 402 Payment Required
X-Response-Time: 45ms
X-Stage-Timings: x402=45ms

# After payment succeeds:
HTTP/1.1 200 OK
X-Response-Time: 1234ms
X-Stage-Timings: x402=45ms,audit=850ms,sign=120ms,public_listing=219ms
```

---

### Week 2: Quick Wins ✅

#### 1. x402 Key Caching (`lib/x402-cache.js`) ✅
- **What:** Cache x402 public keys with 1-hour TTL
- **Why:** Avoids refetching keys on every request
- **Estimated impact:** -5 to -10ms per request (especially useful at high concurrency)
- **Status:** Ready to integrate into x402 server

Usage:
```javascript
import { x402KeyCache } from './lib/x402-cache.js';

// Intercept key fetches and cache:
const key = x402KeyCache.get(keyId);
if (!key) {
  const freshKey = await fetchKeyFromNetwork();
  x402KeyCache.set(keyId, freshKey, 3600000); // 1 hour TTL
}
```

#### 2. Edge Cache Headers ✅
- **What:** Added `Cache-Control` headers to all paid endpoints
- **Config:**
  - Successful responses: `public, max-age=3600` (1 hour)
  - Payment challenges: `no-store` (never cache)
- **Routes updated:** audit, agent-readiness, extract
- **Expected impact:** 20-40% reduction in origin requests for cached scenarios

Code change:
```javascript
if (response.status < 400 && response.headers.get("PAYMENT-RESPONSE")) {
  response.headers.set("Cache-Control", "public, max-age=3600");
} else {
  response.headers.set("Cache-Control", "no-store");
}
```

#### 3. Response Header Exposure ✅
- **What:** Expose timing headers to clients
- **Headers added:**
  - `X-Response-Time` — Total request time
  - `X-Stage-Timings` — Breakdown by stage
- **Routes:** audit, agent-readiness, extract
- **Benefit:** Agents and browsers can now see latency breakdown

---

### Week 3: Monitoring & Next Steps ✅

#### Timing Data Collection Ready
All routes now export timing data. To monitor in production:

```javascript
// Parse the timing headers:
const responseTime = headers['x-response-time']; // "1234ms"
const stageTiming = headers['x-stage-timings']; // "x402=45ms,audit=850ms,..."

// Parse stage breakdown:
const stages = Object.fromEntries(
  stageTiming.split(',').map(s => {
    const [name, ms] = s.split('=');
    return [name, parseInt(ms)];
  })
);
// stages = { x402: 45, audit: 850, sign: 120, ... }
```

#### Integration Points

**For OpenTelemetry:**
```javascript
const stages = parseStageTimings(response.headers.get('x-stage-timings'));
for (const [stage, ms] of Object.entries(stages)) {
  meter.histogram('santos.stage_latency_ms').record(ms, { stage });
}
```

**For logging:**
```javascript
const timing = response.headers.get('x-response-time');
const stages = response.headers.get('x-stage-timings');
logger.info('Audit completed', { totalMs: timing, breakdown: stages });
```

---

## Testing the Changes

### 1. Verify Timing Headers
```bash
# Test audit endpoint (no payment needed to see x402 timing):
curl -i https://api.santosautomation.com/api/audit?url=https://example.com

# Look for:
# X-Response-Time: 45ms
# X-Stage-Timings: x402=45ms
```

### 2. Test with Real Payment
```bash
# With x402 signature (see buy-audit.js):
BUYER_PRIVATE_KEY=0x... node buy-audit.js https://example.com

# Should print timing breakdown showing all stages
```

### 3. Run Performance Measurements
```bash
# Now with real timing data:
node scripts/measure-single.js

# Timing headers will be captured and shown in output
```

---

## Bottleneck Identification Checklist

Once deployed, check timing headers to find bottleneck:

**If x402 > 50ms:**
- Implement key caching (lib/x402-cache.js)
- Check network latency to key server

**If audit > 1000ms for small sites:**
- Profile safeFetch (target fetch time)
- Profile HTML parsing (cheerio load time)
- Profile scoring logic

**If fetch > 500ms:**
- Connection pooling needed
- Consider pre-warming connections

**If parse/score > 300ms:**
- Could parallelize using worker threads
- Optimize cheerio queries (unnecessary re-parsing?)

---

## Deployment Checklist

- [x] Add timing.js utility
- [x] Add x402-cache.js utility (ready to use)
- [x] Instrument audit route
- [x] Instrument agent-readiness route
- [x] Instrument extract route
- [x] Add cache control headers
- [x] Expose timing headers
- [ ] Integrate x402 key caching into x402-server.js
- [ ] Deploy and collect baseline numbers
- [ ] Add OpenTelemetry export (optional)

---

## Next Actions

### Immediate (Today)
1. **Deploy changes** to staging
2. **Verify headers appear** in responses
3. **Run measurement script** to capture baseline

### This Week
4. **Analyze timing breakdown** from real production traffic
5. **Identify #1 bottleneck** (fetch? parse? score? x402?)
6. **Implement week 2 quick wins** based on data

### This Month
7. **Profile #1 bottleneck** with Node DevTools
8. **Implement targeted fix** (connection pooling? worker threads? etc)
9. **Measure impact** before/after
10. **Repeat for #2 and #3 bottlenecks**

---

## Quick Reference

### Timing Tracker API
```javascript
const timing = new TimingTracker();

// Mark start of stage
timing.mark('fetch');
// ... do work ...
// Mark end of stage
timing.end('fetch');

// Or use helper:
await timedStage(timing, 'fetch', () => doAsyncWork());

// Get stats
const stats = timing.getStats();
// { total: 1234, stages: { fetch: 850, parse: 120, score: 80 } }

// Add to response
timing.addHeaders(response);
```

### Cache Control Patterns
```javascript
// For paid, successful responses (cache for 1 hour):
res.headers.set('Cache-Control', 'public, max-age=3600');

// For payment challenges (never cache):
res.headers.set('Cache-Control', 'no-store');

// For free demos (cache for 5 minutes):
res.headers.set('Cache-Control', 'public, max-age=300');
```

---

## Files Modified

- `lib/timing.js` — NEW
- `lib/x402-cache.js` — NEW
- `app/api/audit/route.js` — Updated with timing
- `app/api/agent-readiness/route.js` — Updated with timing
- `app/v1/extract/route.js` — Updated with timing

Total: 3 new files, 3 routes instrumented, ~150 lines of code

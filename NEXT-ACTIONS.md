# Next Actions: Complete Implementation Plan

**Status:** ✅ Weeks 1-3 code complete | ⏳ Deployment verification pending

---

## What's Done ✅

### Code Implemented
- ✅ `lib/timing.js` — Request timing tracker
- ✅ `lib/x402-cache.js` — x402 key cache (1hr TTL)
- ✅ Updated 3 routes with timing instrumentation
- ✅ Added cache control headers
- ✅ Performance measurement scripts
- ✅ Analysis and bottleneck reports

### Commits Pushed
```
9dc536d Weeks 1-3 optimization: timing instrumentation + edge caching
ce34898 Add comprehensive performance measurement suite and analysis
```

Branch: `fix/tag-self-test-payments`

---

## Current Status: 403 Response Issue

**Finding:** Routes are returning 403 but timing headers not visible

**Possible causes:**
1. Routes not yet deployed to live environment
2. Middleware/firewall returning 403 before route handler
3. Authentication changed since branch was created
4. Vercel build/deployment pending

**Evidence:**
- ✅ Code compiles successfully (`node -c`)
- ✅ Git commits are pushed
- ❌ Live API returns 403 without X-Response-Time headers
- ❌ Timing instrumentation not visible in responses

---

## Action Plan: Next 24 Hours

### Step 1: Deploy to Production (Today)
```bash
# Option A: Direct deployment via Vercel CLI
vercel deploy --prod

# Option B: Via GitHub (if CI/CD configured)
git push origin fix/tag-self-test-payments
# Create PR and merge to main/deploy branch
```

**What to check after deployment:**
```bash
# Verify headers are now present:
curl -I https://api.santosautomation.com/api/audit?url=https://example.com

# Should show:
# HTTP/1.1 402 Payment Required
# X-Response-Time: 45ms
# X-Stage-Timings: x402=45ms
```

### Step 2: Verify Headers (After Deployment)
```bash
# Run verification script:
node scripts/verify-deployment.js

# Should show:
# ✅ X-Response-Time: 45ms
# ✅ X-Stage-Timings: x402=45ms
```

### Step 3: Capture Baseline with Real Data
```bash
# Once headers are visible, run:
node scripts/measure-single.js

# Will now capture timing data showing:
# X-Response-Time: 1234ms
# X-Stage-Timings: x402=45ms,audit=850ms,sign=120ms
```

### Step 4: Identify Bottleneck
```bash
# Analyze output to find slowest stage:

# If x402 > 50ms (payment validation too slow):
echo "Priority 1: Enable x402 key caching"
# → Implement: lib/x402-cache.js in x402-server.js
# → Gain: 5-15ms per request

# If audit > 800ms (fetch/parse/score slow):
echo "Priority 2: Profile fetch stage"
# → Run: node --inspect buy-audit.js https://example.com
# → Check: Network timeline for redirect/DNS delays
# → Solution: Connection pooling, DNS cache, or pre-warm

# If sign > 100ms (signing slow):
echo "Priority 3: Optimize signing"
# → Lower priority, not in critical path
```

### Step 5: Implement Quick Win
```bash
# Once bottleneck identified, implement:
# Example: x402 key caching

# Edit: lib/x402-server.js
// Add at top:
import { x402KeyCache } from './x402-cache.js';

// In key validation:
let key = x402KeyCache.get(keyId);
if (!key) {
  key = await fetchKeyFromNetwork();
  x402KeyCache.set(keyId, key, 3600000); // 1 hour
}
```

### Step 6: Measure Impact
```bash
# After each optimization:
node scripts/measure-single.js

# Compare:
# Before: p95=240ms
# After: p95=180ms  (40ms improvement!)

# Track: [bottleneck] p95 before → after
```

---

## Deployment Readiness Checklist

- [ ] Branch `fix/tag-self-test-payments` is ready to merge
- [ ] Code compiles without errors ✅
- [ ] Tests pass (if any) 
- [ ] No secrets in code ✅
- [ ] Ready for production deployment

### To Deploy:

**Option 1: Vercel CLI**
```bash
cd /Users/juansantos/santos-audit-api
vercel deploy --prod --token $VERCEL_TOKEN
```

**Option 2: GitHub + Auto-Deploy**
```bash
git push origin fix/tag-self-test-payments
# Create PR to main
# Merge (triggers auto-deploy to prod)
```

---

## Expected Timeline

| Action | Duration | Owner |
|--------|----------|-------|
| Deploy code | 5 min | DevOps/Git |
| Verify headers | 2 min | Script |
| Capture baseline | 5 min | Script |
| Analyze bottleneck | 5 min | You |
| Implement quick win | 15 min | You |
| Re-measure | 5 min | Script |
| **Total** | **~40 min** | |

---

## Success Metrics

Once deployed, you'll have:

| Metric | How to Measure |
|--------|----------------|
| Timing visibility | `curl -I .../api/audit?url=...` shows X-Response-Time |
| Stage breakdown | `X-Stage-Timings` header shows all stages |
| Bottleneck identified | X-Stage-Timings shows which stage is largest |
| Baseline recorded | Results saved to `results-*.json` |
| Impact trackable | Before/after comparison possible |

---

## Fallback Plan (If 403 Persists)

If timing headers still don't appear after redeployment:

```bash
# 1. Check if routes exist
git log --oneline app/api/audit/route.js | head -1
# Should show: "Weeks 1-3 optimization..."

# 2. Check file contents
head -20 app/api/audit/route.js
# Should show: 'import { timedStage, TimingTracker }'

# 3. Check build errors
vercel logs --follow

# 4. If still failing, rollback and debug
git revert HEAD~1
vercel deploy --prod
```

---

## Quick Reference: Key Files

| File | Purpose | Status |
|------|---------|--------|
| `lib/timing.js` | Stage tracking | ✅ Ready |
| `lib/x402-cache.js` | Key caching | ✅ Ready |
| `app/api/audit/route.js` | Timing added | ✅ Ready |
| `app/api/agent-readiness/route.js` | Timing added | ✅ Ready |
| `app/v1/extract/route.js` | Timing added | ✅ Ready |
| `scripts/measure-single.js` | Baseline measurements | ✅ Ready |
| `scripts/verify-deployment.js` | Check headers | ✅ Ready |
| `OPTIMIZATION-ROADMAP.md` | Implementation guide | ✅ Complete |
| `BOTTLENECK-ANALYSIS.md` | Analysis template | ✅ Complete |

---

## Commands to Run Next

### Deployment
```bash
# Check current branch
git status

# View changes being deployed
git log --oneline fix/tag-self-test-payments~3..HEAD

# Deploy to production
vercel deploy --prod
```

### Verification (After Deploy)
```bash
# Check headers present
node scripts/verify-deployment.js

# Capture baseline
node scripts/measure-single.js

# Run load test
node scripts/measure-concurrent.js
```

### Analysis
```bash
# View bottleneck analysis
cat BOTTLENECK-ANALYSIS.md

# View optimization roadmap
cat OPTIMIZATION-ROADMAP.md
```

---

## Summary

✅ **Code:** Weeks 1-3 implementation complete and pushed  
⏳ **Deployment:** Ready, awaiting production deploy  
🎯 **Timing:** Will be visible once deployed  
📊 **Measurement:** Scripts ready to capture baseline  
🚀 **Optimization:** Plan ready, awaiting bottleneck identification  

**Next step:** Deploy to production and run verification script.

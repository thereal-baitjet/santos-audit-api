# Deploy to Production NOW

**Estimated time:** 10 minutes  
**Status:** Code ready, awaiting your deployment

---

## Option A: Deploy via Vercel CLI (Recommended)

### 1. Install Vercel CLI (if needed)
```bash
npm install -g vercel
```

### 2. Authenticate
```bash
vercel login
# Follow prompts to authenticate with your Vercel account
```

### 3. Deploy to Production
```bash
cd /Users/juansantos/santos-audit-api
vercel deploy --prod
```

**Expected output:**
```
✓ Linked to thereal-baitjet/santos-audit-api (built with `Next.js`)
✓ Inspecting files for deployment...
✓ Uploading 847 files...
✓ Deployment complete
✓ Production URL: https://api.santosautomation.com
```

---

## Option B: Deploy via GitHub (If CI/CD Connected)

### 1. Create Pull Request
```bash
git push origin fix/tag-self-test-payments
# Then create PR on GitHub dashboard
# Title: "Weeks 1-3 optimization: timing instrumentation"
```

### 2. Merge to Main
```bash
# Once CI/CD passes, merge PR to main
# Auto-deploy should trigger
```

### 3. Verify Deployment
```bash
# Check Vercel dashboard for deployment status
# Should see: "fix/tag-self-test-payments" deployment success
```

---

## Post-Deployment Verification (5 minutes)

### Step 1: Verify Headers Appear (Immediately after deploy)
```bash
# Run verification script:
node scripts/verify-deployment.js

# Expected output:
# ✅ Quick Audit
# ✅ Agent Readiness
# ✅ Extract (GET)
# ✅ Deployment verified! Timing headers present.
```

**If headers DON'T appear:**
- Wait 30-60 seconds (Vercel propagation)
- Check build logs: `vercel logs --tail`
- Rollback if needed: `git revert HEAD` + redeploy

### Step 2: Capture Baseline (5 minutes after deploy)
```bash
node scripts/measure-single.js

# Will now show timing data like:
# X-Response-Time: 1234ms
# X-Stage-Timings: x402=45ms,audit=850ms,sign=120ms
```

### Step 3: Run Load Test (Optional)
```bash
node scripts/measure-concurrent.js
```

---

## Real-Time Deployment Monitoring

### Watch Vercel Logs
```bash
vercel logs --follow
```

### View Deployment Status
```bash
# Via CLI:
vercel deploy --list

# Via Dashboard:
# https://vercel.com/dashboard
```

---

## Rollback Plan (If Issues)

```bash
# If deployment causes problems:
git revert 54e59a5  # Revert our commit
git push
vercel deploy --prod

# Or deploy previous version:
vercel deploy --prod --target=production git@github.com:thereal-baitjet/santos-audit-api.git#main
```

---

## Deployment Checklist

- [ ] Run `vercel login`
- [ ] Run `vercel deploy --prod`
- [ ] Wait for deployment to complete
- [ ] Run `node scripts/verify-deployment.js`
- [ ] Confirm headers appear (X-Response-Time, X-Stage-Timings)
- [ ] Run `node scripts/measure-single.js`
- [ ] Review timing breakdown in output
- [ ] Identify bottleneck stage (see BOTTLENECK-ANALYSIS.md)
- [ ] Implement quick win (if x402 > 50ms, enable key caching)
- [ ] Re-run `node scripts/measure-single.js` to confirm improvement

---

## What Happens During Deployment

```
1. Vercel builds Next.js app (1-2 min)
2. Routes are updated with timing instrumentation
3. Deployment goes live (30-60 sec propagation)
4. Requests start including X-Response-Time headers
5. Timing breakdown becomes visible
```

---

## Commands to Run After Deployment

```bash
# 1. Verify headers (immediately)
node scripts/verify-deployment.js

# 2. Capture baseline (5 min after deploy)
node scripts/measure-single.js

# 3. Check concurrent scaling (optional)
node scripts/measure-concurrent.js

# 4. Identify bottleneck
# Look at X-Stage-Timings output, find largest stage

# 5. Implement fix
# See NEXT-ACTIONS.md for specific optimizations
```

---

## Success Criteria

✅ Deployment completes without errors  
✅ `verify-deployment.js` reports headers present  
✅ `measure-single.js` captures X-Stage-Timings  
✅ Bottleneck identified in timing breakdown  
✅ Quick win implemented (optional, but recommended)  
✅ Re-measurement confirms improvement  

---

## If You Get Stuck

**Issue: "vercel: command not found"**
```bash
npm install -g vercel
vercel login
```

**Issue: "Not authorized"**
```bash
vercel logout
vercel login
# Re-authenticate
```

**Issue: "Deployment fails with syntax error"**
```bash
# Check build logs:
vercel logs --follow

# If code error:
git log --oneline -5
# Revert if needed
git revert HEAD
git push
vercel deploy --prod
```

**Issue: "Headers still don't appear"**
```bash
# Wait 60 seconds and try again:
sleep 60
node scripts/verify-deployment.js

# If still missing, check route files:
head -20 app/api/audit/route.js
# Should show: import { timedStage, TimingTracker }

# If not, deployment may not have picked up changes
# Try: vercel deploy --prod --force
```

---

## Next After Deployment

Once headers are visible:

1. **Review timing breakdown:**
   - Look for stage that takes > 50% of total time
   - That's your bottleneck

2. **Implement quick win:**
   - If x402 > 50ms: Enable key caching
   - Takes 5 minutes, saves 5-15ms

3. **Re-measure:**
   - `node scripts/measure-single.js`
   - Compare p95 before vs after

4. **Celebrate:**
   - You've just optimized your API! 🎉

---

## Deploy Now

```bash
cd /Users/juansantos/santos-audit-api
vercel deploy --prod
```

Then run:
```bash
node scripts/verify-deployment.js
```

See you on the other side! 🚀

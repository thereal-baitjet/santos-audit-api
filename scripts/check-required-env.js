#!/usr/bin/env node
// Build gate. Runs as `prebuild`, so `npm run build` cannot produce a
// production bundle that is missing a security-critical secret.
//
// Enforces only when VERCEL_ENV=production (or SANTOS_REQUIRE_SECRETS=true), so
// local builds and preview deploys keep their dev fallbacks.
import { assertProductionSecrets, isProductionEnv, REQUIRED_PRODUCTION_SECRETS } from "../lib/required-env.js";

try {
  const result = assertProductionSecrets();
  if (result.enforced) {
    console.log(`✓ required production secrets present (${REQUIRED_PRODUCTION_SECRETS.length} checked)`);
  } else {
    console.log(
      `· secret enforcement skipped (not a production build). ` +
      `Checked names: ${REQUIRED_PRODUCTION_SECRETS.map((s) => s.name).join(", ")}`
    );
  }
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exit(1);
}

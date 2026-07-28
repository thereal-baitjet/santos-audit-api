// Production secret validation.
//
// Several security-sensitive values used to fall back to a hard-coded
// "dev-only-…" default so local runs work without configuration. That is fine
// on a laptop and unacceptable in production: this repository is public, so the
// fallback values are published. A deployment missing REPORT_ACCESS_TOKEN_SECRET
// would sign every report, report-access token, and monitoring manage-link with
// a secret anyone can read off GitHub — forgeable by design.
//
// So: dev keeps its conveniences, production fails closed. `assertProductionSecrets`
// runs before the build (scripts/check-required-env.js) and `requireSecret`
// enforces the same rule at runtime for anything that slips past.

/** Values that must never survive into production. */
const DEV_PLACEHOLDERS = new Set([
  "dev-only-report-token-secret",
  "dev-only-idem-secret",
  "santos-demo-limit",
]);

export const REQUIRED_PRODUCTION_SECRETS = [
  {
    name: "REPORT_ACCESS_TOKEN_SECRET",
    devFallback: "dev-only-report-token-secret",
    why: "Signs report HMACs, deep-report access tokens, verified-email tokens, and monitoring manage links. Without it every one of those is forgeable using a secret published in this repository.",
  },
  {
    name: "IDEMPOTENCY_HASH_SECRET",
    devFallback: "dev-only-idem-secret",
    why: "Hashes idempotency keys for paid deep audits and Stripe webhooks. A known value lets a caller predict or collide another caller's key.",
  },
  {
    name: "RATE_LIMIT_HASH_SECRET",
    devFallback: "santos-demo-limit",
    why: "Hashes IPs and emails into free-tier quota keys. A known value makes quota keys predictable and de-anonymisable by brute force over a small address space.",
  },
];

/**
 * True when this process is building or serving real production traffic.
 * VERCEL_ENV is the reliable signal on Vercel: it is "production" only for
 * production deployments, and unset locally, so previews and laptops keep
 * their dev fallbacks.
 */
export function isProductionEnv(env = process.env) {
  return env.VERCEL_ENV === "production" || env.SANTOS_REQUIRE_SECRETS === "true";
}

/**
 * Every configuration problem in one pass, so a bad deploy reports all of them
 * rather than one per attempt.
 *
 * Returns { ok, problems }. Never throws, so callers choose the consequence.
 */
export function checkProductionSecrets(env = process.env) {
  const problems = [];
  for (const secret of REQUIRED_PRODUCTION_SECRETS) {
    const value = env[secret.name]?.trim();
    if (!value) {
      problems.push({ name: secret.name, issue: "missing", why: secret.why });
    } else if (DEV_PLACEHOLDERS.has(value)) {
      problems.push({ name: secret.name, issue: "set to a published dev placeholder", why: secret.why });
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Build/boot gate: refuse production when a required secret is absent. */
export function assertProductionSecrets(env = process.env) {
  if (!isProductionEnv(env)) return { ok: true, problems: [], enforced: false };
  const { ok, problems } = checkProductionSecrets(env);
  if (!ok) {
    const detail = problems.map((p) => `  - ${p.name}: ${p.issue}\n      ${p.why}`).join("\n");
    throw new Error(
      `Refusing to build or serve production without required secrets:\n${detail}\n\n` +
        `Set them in the Vercel project (Production scope) and redeploy. ` +
        `To run a production-like check locally, export SANTOS_REQUIRE_SECRETS=true.`
    );
  }
  return { ok: true, problems: [], enforced: true };
}

/**
 * Read a secret, failing closed in production and falling back only in dev.
 * The fallback is never returned when isProductionEnv() is true.
 */
export function requireSecret(name, devFallback) {
  const value = process.env[name]?.trim();
  if (value && !DEV_PLACEHOLDERS.has(value)) return value;
  if (isProductionEnv()) {
    const known = REQUIRED_PRODUCTION_SECRETS.find((s) => s.name === name);
    throw new Error(
      `${name} is ${value ? "set to a published dev placeholder" : "not set"} in production. ` +
        (known?.why ?? "It is required for production.")
    );
  }
  return value || devFallback;
}

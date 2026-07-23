// Store for demo-exhaustion email leads. Postgres when DATABASE_URL is set
// (production), in-memory fallback for local dev/tests. Same connection and
// fallback pattern as lib/stripe/store.js.
const hasDatabase = () => !!process.env.DATABASE_URL;

let pgPool = null;
async function pg() {
  if (!pgPool) {
    const { default: pkg } = await import("pg");
    pgPool = new pkg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

const mem = []; // fallback rows

// demo_leads is append-only (one row per signup, no unique constraint on
// email), so "the lead" for verification purposes is the LATEST row for an
// address. upsertLeadCode updates that row in place, or inserts a new one
// when the address has never been seen.

export async function saveLead({ email, targetUrl, source }) {
  if (hasDatabase()) {
    const db = await pg();
    await db.query(
      "INSERT INTO demo_leads (email, target_url, source) VALUES ($1, $2, $3)",
      [email, targetUrl, source]
    );
    return;
  }
  mem.push({ email, target_url: targetUrl, source, created_at: new Date().toISOString() });
}

// Store a fresh verification code on the latest lead row for this email
// (inserting the row on first contact). codeHash = sha256 hex of the code.
export async function upsertLeadCode({ email, targetUrl, source, codeHash, expiresAt }) {
  if (hasDatabase()) {
    const db = await pg();
    const { rowCount } = await db.query(
      `UPDATE demo_leads
       SET verify_code_hash = $2, verify_expires_at = $3, target_url = $4, source = $5
       WHERE id = (
         SELECT id FROM demo_leads WHERE email = $1
         ORDER BY created_at DESC, id DESC LIMIT 1
       )`,
      [email, codeHash, expiresAt, targetUrl, source]
    );
    if (rowCount === 0) {
      await db.query(
        `INSERT INTO demo_leads (email, target_url, source, verify_code_hash, verify_expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, targetUrl, source, codeHash, expiresAt]
      );
    }
    return;
  }
  let row = [...mem].reverse().find((r) => r.email === email);
  if (!row) {
    row = { email, created_at: new Date().toISOString() };
    mem.push(row);
  }
  Object.assign(row, {
    target_url: targetUrl,
    source,
    verify_code_hash: codeHash,
    verify_expires_at: expiresAt,
  });
}

// Latest lead row for an email, or null. Shape matches the demo_leads columns.
export async function getLeadByEmail(email) {
  if (hasDatabase()) {
    const db = await pg();
    const { rows } = await db.query(
      `SELECT email, target_url, source, verified_at, verify_code_hash, verify_expires_at, created_at
       FROM demo_leads WHERE email = $1
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [email]
    );
    return rows[0] ?? null;
  }
  return [...mem].reverse().find((r) => r.email === email) ?? null;
}

// Stamp every row for this email as verified (idempotent).
export async function markLeadVerified(email) {
  const at = new Date().toISOString();
  if (hasDatabase()) {
    const db = await pg();
    await db.query(
      "UPDATE demo_leads SET verified_at = now() WHERE email = $1 AND verified_at IS NULL",
      [email]
    );
    return;
  }
  mem.forEach((r) => {
    if (r.email === email && !r.verified_at) r.verified_at = at;
  });
}

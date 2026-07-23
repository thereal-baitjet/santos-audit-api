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

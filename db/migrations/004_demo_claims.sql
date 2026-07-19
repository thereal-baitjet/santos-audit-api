-- Durable free-demo claims: one row per hashed-IP per UTC day. Backs
-- lib/demo-limit.js's Postgres adapter so the 1/day/IP quota survives
-- serverless cold starts (the in-memory fallback did not).
CREATE TABLE IF NOT EXISTS demo_claims (
  key        text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

ALTER TABLE demo_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS worker_all ON demo_claims;
CREATE POLICY worker_all ON demo_claims TO santos_worker USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON demo_claims TO santos_worker;

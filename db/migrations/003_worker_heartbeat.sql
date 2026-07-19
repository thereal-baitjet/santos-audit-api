-- Worker liveness heartbeat. The deep-audit worker upserts its row every poll;
-- POST /v1/audits refuses new (payment-settling) jobs when no worker has
-- beaten recently, so nobody is charged for a job that nothing would process.
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id text PRIMARY KEY,
  beat_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS worker_all ON worker_heartbeats;
CREATE POLICY worker_all ON worker_heartbeats TO santos_worker USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON worker_heartbeats TO santos_worker;

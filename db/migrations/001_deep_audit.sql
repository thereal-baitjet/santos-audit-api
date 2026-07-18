-- Deep Page Audit platform: jobs, events, reports, artifacts.
-- Applied automatically by lib/deep/store.js (CREATE IF NOT EXISTS) or manually via psql.

CREATE TABLE IF NOT EXISTS audit_jobs (
  id                   text PRIMARY KEY,          -- aud_...
  status               text NOT NULL DEFAULT 'queued',
  stage                text,
  progress             integer NOT NULL DEFAULT 0,
  request              jsonb NOT NULL,            -- normalized create request
  request_hash         text NOT NULL,
  idempotency_key_hash text UNIQUE,               -- null when no Idempotency-Key sent
  payment_reference    text,                      -- non-secret settlement tx reference
  price_atomic         text,
  network              text,
  attempts             integer NOT NULL DEFAULT 0,
  worker_id            text,
  lease_expires_at     timestamptz,
  error_code           text,
  error_message        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  started_at           timestamptz,
  completed_at         timestamptz,
  expires_at           timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS audit_jobs_queue_idx ON audit_jobs (status, created_at)
  WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS audit_job_events (
  id         bigserial PRIMARY KEY,
  job_id     text NOT NULL REFERENCES audit_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stage      text,
  progress   integer,
  message    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_job_events_job_idx ON audit_job_events (job_id, id);

CREATE TABLE IF NOT EXISTS audit_reports (
  id             text PRIMARY KEY,               -- rpt_...
  job_id         text NOT NULL UNIQUE REFERENCES audit_jobs(id) ON DELETE CASCADE,
  schema_version text NOT NULL,
  report         jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

-- MVP artifact storage: bytea in Postgres with size caps enforced by the worker.
-- Swap to object storage + signed URLs when volume justifies it.
CREATE TABLE IF NOT EXISTS audit_artifacts (
  id           text PRIMARY KEY,                 -- art_...
  job_id       text NOT NULL REFERENCES audit_jobs(id) ON DELETE CASCADE,
  type         text NOT NULL,                    -- screenshot | lighthouse_json | lighthouse_html
  device       text,
  content_type text NOT NULL,
  size_bytes   integer NOT NULL,
  data         bytea NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '72 hours'
);
CREATE INDEX IF NOT EXISTS audit_artifacts_job_idx ON audit_artifacts (job_id);

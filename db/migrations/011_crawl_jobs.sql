-- Site crawl + bulk page processing: jobs, events, per-page results.
-- Applied automatically by lib/crawl/store.js (CREATE IF NOT EXISTS) or manually via psql.
--
-- Payment model (x402 "upto"): at creation the buyer's Permit2 authorization for
-- budget_atomic is VERIFIED, not settled. After the job finishes, the control
-- plane settles cost_atomic (<= budget_atomic) once, using the stored payload.
-- A job that processes nothing is voided and never touches the chain.

CREATE TABLE IF NOT EXISTS crawl_jobs (
  id                       text PRIMARY KEY,          -- crl_...
  mode                     text NOT NULL CHECK (mode IN ('crawl', 'bulk')),
  status                   text NOT NULL DEFAULT 'queued',
  stage                    text,
  progress                 integer NOT NULL DEFAULT 0,
  request                  jsonb NOT NULL,            -- normalized create request
  request_hash             text NOT NULL,
  idempotency_key_hash     text UNIQUE,
  origin                   text NOT NULL,             -- scheme://host[:port]; every fetch must match
  page_cap                 integer NOT NULL,          -- min(max_pages, pages the budget can pay for)

  -- payment (upto). payment_payload is a signed authorization that can only
  -- ever pay our seller wallet, but treat it as sensitive: no API role grants.
  network                  text NOT NULL,
  payer                    text NOT NULL,             -- lowercased 0x address
  payment_nonce            text NOT NULL,             -- Permit2 nonce; one authorization funds one job
  budget_atomic            bigint NOT NULL CHECK (budget_atomic > 0),
  payment_payload          jsonb NOT NULL,
  payment_requirements     jsonb NOT NULL,
  authorization_expires_at timestamptz NOT NULL,      -- Permit2 deadline: settle before this
  settlement_status        text NOT NULL DEFAULT 'authorized'
                             CHECK (settlement_status IN ('authorized', 'settling', 'settled', 'voided', 'failed')),
  settled_atomic           bigint CHECK (settled_atomic IS NULL OR settled_atomic <= budget_atomic),
  settlement_tx            text,
  settlement_error         text,
  settled_at               timestamptz,

  -- usage, maintained by the worker
  cost_atomic              bigint NOT NULL DEFAULT 0 CHECK (cost_atomic <= budget_atomic),
  pages_fetched            integer NOT NULL DEFAULT 0,
  pages_rendered           integer NOT NULL DEFAULT 0,
  pages_failed             integer NOT NULL DEFAULT 0,
  pages_skipped            integer NOT NULL DEFAULT 0,
  bytes_stored             bigint NOT NULL DEFAULT 0,
  manifest_storage_key     text,

  attempts                 integer NOT NULL DEFAULT 0,
  worker_id                text,
  lease_expires_at         timestamptz,
  error_code               text,
  error_message            text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  started_at               timestamptz,
  completed_at             timestamptz,
  expires_at               timestamptz NOT NULL DEFAULT now() + interval '7 days',
  UNIQUE (payer, payment_nonce)
);
CREATE INDEX IF NOT EXISTS crawl_jobs_queue_idx ON crawl_jobs (status, created_at)
  WHERE status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS crawl_jobs_unsettled_idx ON crawl_jobs (authorization_expires_at)
  WHERE settlement_status IN ('authorized', 'settling');
CREATE INDEX IF NOT EXISTS crawl_jobs_payer_open_idx ON crawl_jobs (payer)
  WHERE settlement_status IN ('authorized', 'settling');

CREATE TABLE IF NOT EXISTS crawl_job_events (
  id         bigserial PRIMARY KEY,
  job_id     text NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stage      text,
  progress   integer,
  message    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crawl_job_events_job_idx ON crawl_job_events (job_id, id);

-- One row per URL the job planned or discovered. (job_id, url_hash) dedupes the
-- frontier; storage_key points at the stored body in object storage.
CREATE TABLE IF NOT EXISTS crawl_pages (
  id             bigserial PRIMARY KEY,
  job_id         text NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url            text NOT NULL,
  url_hash       text NOT NULL,
  depth          integer NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued', 'fetched', 'failed', 'skipped')),
  skip_reason    text,                             -- robots | excluded | budget | page_cap | off_origin ...
  rendered       boolean NOT NULL DEFAULT false,
  http_status    integer,
  content_type   text,
  size_bytes     integer,
  storage_key    text,
  cost_atomic    bigint NOT NULL DEFAULT 0,
  error_code     text,
  fetched_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, url_hash)
);
CREATE INDEX IF NOT EXISTS crawl_pages_frontier_idx ON crawl_pages (job_id, status, depth, id);

ALTER TABLE crawl_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_pages ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON crawl_jobs, crawl_job_events, crawl_pages FROM anon, authenticated;
  END IF;
END
$$;

import { PUBLIC_API_BASE_URL } from "../base-url.js";
import { atomicToUsdc } from "./schemas.js";

export const jobView = (job) => ({
  job_id: job.id,
  mode: job.mode,
  status: job.status,
  stage: job.stage,
  progress: job.progress,
  origin: job.origin,
  page_cap: job.page_cap,
  pages: { fetched: job.pages_fetched, rendered: job.pages_rendered, failed: job.pages_failed, skipped: job.pages_skipped },
  payment: {
    scheme: "upto",
    budget_usdc: atomicToUsdc(job.budget_atomic),
    cost_so_far_usdc: atomicToUsdc(job.cost_atomic),
    settlement_status: job.settlement_status,
    charged_usdc: job.settled_atomic == null ? null : atomicToUsdc(job.settled_atomic),
    settlement_tx: job.settlement_tx ?? undefined,
    authorization_expires_at: job.authorization_expires_at,
  },
  created_at: job.created_at,
  started_at: job.started_at,
  completed_at: job.completed_at,
  expires_at: job.expires_at,
  error_code: job.error_code ?? undefined,
  error_message: job.error_message ?? undefined,
  status_url: `${PUBLIC_API_BASE_URL}/v1/crawl/${job.id}`,
});

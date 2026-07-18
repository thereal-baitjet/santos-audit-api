// POST /v1/audits/{id}/cancel — cancel a job that has not started running.
// A running browser job finishes or fails on its own; the compute reservation
// is already spent either way (documented in the payment contract).
import { NextResponse } from "next/server";
import { getStore } from "../../../../../lib/deep/store.js";
import { verifyAccessToken } from "../../../../../lib/deep/ids.js";
import { deepAuditGate, requireJobToken, NO_STORE } from "../../../../../lib/deep/gate.js";

export async function POST(req, { params }) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const { id } = await params;
  const denied = requireJobToken(req, id, verifyAccessToken);
  if (denied) return denied;

  const store = getStore();
  const job = await store.getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });

  const cancelled = await store.cancelJob(id);
  if (!cancelled) {
    return NextResponse.json(
      { error: `Job is ${job.status} and can no longer be cancelled (only queued jobs can).`, code: "NOT_CANCELLABLE", status: job.status },
      { status: 409, headers: NO_STORE }
    );
  }
  return NextResponse.json({ job_id: id, status: cancelled.status }, { headers: NO_STORE });
}

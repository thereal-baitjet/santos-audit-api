// GET /v1/audits/{id}/report — the completed versioned JSON report.
import { NextResponse } from "next/server";
import { getStore } from "../../../../../lib/deep/store.js";
import { verifyAccessToken, signArtifact } from "../../../../../lib/deep/ids.js";
import { deepAuditGate, requireJobToken, NO_STORE } from "../../../../../lib/deep/gate.js";
import { PUBLIC_API_BASE_URL } from "../../../../../lib/base-url.js";

export async function GET(req, { params }) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const { id } = await params;
  const denied = requireJobToken(req, id, verifyAccessToken);
  if (denied) return denied;

  const store = getStore();
  const job = await store.getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  if (job.status !== "completed") {
    return NextResponse.json(
      { error: `Report not ready: job is ${job.status}`, code: "REPORT_NOT_READY", status: job.status, stage: job.stage, progress: job.progress },
      { status: 409, headers: NO_STORE }
    );
  }
  const report = await store.getReport(id);
  if (!report) return NextResponse.json({ error: "Report missing", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });

  // Attach short-lived signed download URLs to artifact metadata.
  const artifacts = (await store.listArtifacts(id)).map((a) => {
    const { exp, sig } = signArtifact(a.id);
    return {
      artifact_id: a.id, type: a.type, device: a.device, content_type: a.content_type,
      size_bytes: a.size_bytes, expires_at: a.expires_at,
      download_url: `${PUBLIC_API_BASE_URL}/v1/artifacts/${a.id}?exp=${exp}&sig=${sig}`,
    };
  });

  return NextResponse.json({ ...report, artifacts }, { headers: NO_STORE });
}

// GET /v1/audits/{id}/artifacts — list a job's artifacts with signed download
// URLs. This is the artifacts_url advertised on every job response; it 404'd
// until now because only the per-artifact download route existed.
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

  const artifacts = (await store.listArtifacts(id)).map((a) => {
    const { exp, sig } = signArtifact(a.id);
    return {
      artifact_id: a.id, type: a.type, device: a.device, content_type: a.content_type,
      size_bytes: a.size_bytes, expires_at: a.expires_at,
      download_url: `${PUBLIC_API_BASE_URL}/v1/artifacts/${a.id}?exp=${exp}&sig=${sig}`,
    };
  });

  return NextResponse.json({ job_id: id, status: job.status, artifacts }, { headers: NO_STORE });
}

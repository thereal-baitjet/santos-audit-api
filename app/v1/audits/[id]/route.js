// GET /v1/audits/{id} — job status. Requires the job's access token.
import { NextResponse } from "next/server";
import { getStore } from "../../../../lib/deep/store.js";
import { verifyAccessToken } from "../../../../lib/deep/ids.js";
import { deepAuditGate, requireJobToken, NO_STORE } from "../../../../lib/deep/gate.js";
import { jobView } from "../route.js";

export async function GET(req, { params }) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const { id } = await params;
  const denied = requireJobToken(req, id, verifyAccessToken);
  if (denied) return denied;

  const job = await getStore().getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(jobView(job), { headers: NO_STORE });
}

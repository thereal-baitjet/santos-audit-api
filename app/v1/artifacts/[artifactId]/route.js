// GET /v1/artifacts/{artifactId}?exp=&sig= — short-lived signed artifact download.
// Authorization is the HMAC signature minted by the report endpoint; the URL
// expires (default 15 min) and artifacts themselves are retention-limited.
import { NextResponse } from "next/server";
import { getStore } from "../../../../lib/deep/store.js";
import { verifyArtifactSig } from "../../../../lib/deep/ids.js";
import { deepAuditGate, NO_STORE } from "../../../../lib/deep/gate.js";

export async function GET(req, { params }) {
  const gate = deepAuditGate();
  if (gate) return gate;
  const { artifactId } = await params;
  const exp = req.nextUrl.searchParams.get("exp");
  const sig = req.nextUrl.searchParams.get("sig");
  if (!verifyArtifactSig(artifactId, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired artifact link. Re-fetch the report for fresh URLs.", code: "UNAUTHORIZED" }, { status: 401, headers: NO_STORE });
  }
  const artifact = await getStore().getArtifact(artifactId);
  if (!artifact) return NextResponse.json({ error: "Artifact not found or expired", code: "NOT_FOUND" }, { status: 404, headers: NO_STORE });

  return new NextResponse(Buffer.from(artifact.data), {
    headers: {
      "Content-Type": artifact.content_type,
      "Content-Disposition": `attachment; filename="${artifact.id}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

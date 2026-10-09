import { withAgentLog } from "../../../../lib/agent-log.js";
// POST /api/audit/remediate: llms.txt + Organization JSON-LD for failed AI
// Readiness layers, x402-paid or free with a signed private report. The
// handler lives in lib/remediate-http.ts so tests can inject a facilitator.
import { resourceServer } from "../../../../lib/x402-server.js";
import { createRemediateHandler, remediateOptions } from "../../../../lib/remediate-http.ts";

export const dynamic = "force-dynamic";

export const OPTIONS = remediateOptions;
export const POST = withAgentLog(createRemediateHandler(resourceServer), "remediate");

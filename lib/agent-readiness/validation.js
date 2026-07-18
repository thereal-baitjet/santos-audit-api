import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { AGENT_READINESS_RESULT_SCHEMA } from "./contract.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(AGENT_READINESS_RESULT_SCHEMA);

export function assertAgentReadinessResult(result) {
  if (validate(result)) return result;
  const detail = (validate.errors ?? []).slice(0, 8).map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
  const failure = new Error(`AgentReadinessResult contract violation: ${detail}`);
  failure.code = "INVALID_AGENT_READINESS_RESULT";
  throw failure;
}

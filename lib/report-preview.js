// Illustrative values match /reports/sample-agent-readiness. This is never a
// customer result, live scan, testimonial, or certification.
export const REPORT_PREVIEW = {
  score: 82,
  dimensions: [
    { name: "Discoverable", value: 91 },
    { name: "Understandable", value: 78 },
    { name: "Callable", value: 73 },
    { name: "Trustworthy", value: 86 },
  ],
  evidence: [
    {
      status: "passed",
      title: "OpenAPI document discovered",
      detail: "Valid 3.1 document with typed responses.",
    },
    {
      status: "warning",
      title: "MCP registry unconfirmed",
      detail: "Endpoint advertised; registry evidence not confirmed.",
    },
    {
      status: "action",
      title: "Capability manifest incomplete",
      detail: "Add resource pricing, limits, and selection guidance.",
    },
  ],
};

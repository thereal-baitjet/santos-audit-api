export const SITE_URL = "https://www.santosautomation.com";

export const DIMENSIONS = [
  { name: "Discoverable", text: "Find the site, documentation, crawler rules, canonical URLs, sitemaps, llms.txt, and advertised interfaces." },
  { name: "Understandable", text: "Interpret identity, content, services, pricing, relationships, semantic HTML, and structured data." },
  { name: "Callable", text: "Use OpenAPI, MCP, capability manifests, typed schemas, stable errors, job endpoints, and x402 payment." },
  { name: "Trustworthy", text: "Evaluate HTTPS, security headers, accessibility, performance, browser errors, support, and evidence quality." },
];

export const FAQS = [
  { question: "What is AI Website Intelligence?", answer: "AI Website Intelligence measures whether a website can be discovered, understood, trusted, and used by AI systems and autonomous agents." },
  { question: "What is an Agent Readiness audit?", answer: "It checks the public technical signals that help agents find information, interpret structured meaning, and invoke applicable machine-readable capabilities." },
  { question: "Is Agent Readiness the same as SEO?", answer: "No. SEO mainly addresses search discovery and ranking. Agent Readiness also examines structured meaning, callable interfaces, machine-readable documentation, and operational trust." },
  { question: "Does llms.txt guarantee visibility in AI answers?", answer: "No. llms.txt can orient an agent and point to useful documentation, but it cannot guarantee inclusion or ranking in an AI-generated answer." },
  { question: "Does every website need MCP or OpenAPI?", answer: "No. They matter when a site exposes callable services. Santos marks non-applicable checks instead of penalizing an informational website." },
  { question: "What is the difference between Quick and Deep audits?", answer: "Quick audits use bounded fetch-and-parse checks. Deep audits use a real browser for rendered accessibility, lab performance, network, console, screenshot, and passive security evidence." },
];

const commonRelated = [
  ["Run an Agent Readiness audit", "/agent-readiness-audit"],
  ["Read the scoring methodology", "/methodology/agent-readiness"],
  ["Explore the Website Intelligence API", "/website-intelligence-api"],
];

export const PRODUCT_PAGES = {
  "ai-website-intelligence": {
    path: "/ai-website-intelligence",
    title: "AI Website Intelligence Platform and API | Santos",
    description: "Understand AI website intelligence through four measurable layers: discovery, meaning, callable capabilities, and trust—with structured evidence from Santos.",
    eyebrow: "Category guide · Santos Website Intelligence",
    h1: "Website intelligence built for AI agents",
    intro: "Traditional audits stop at search and page quality. Santos combines those foundations with machine discovery, structured meaning, callable interfaces, and trust evidence so one public URL becomes useful intelligence for people and agents.",
    sections: [
      { heading: "A wider lens than traditional SEO", body: "Search visibility remains important, but an agent also needs to identify the provider, understand what a service does, select a suitable operation, and judge whether interaction is safe. The four-layer model separates those questions instead of hiding them in one opaque score." },
      { heading: "Evidence before claims", body: "Santos records discovered URLs, response states, parsed interface signals, and explicit limitations. It does not promise placement in AI answers and does not treat a proposed convention as a universal standard." },
      { heading: "One model, several audit depths", body: "Quick Intelligence Audit is designed for fast triage. Agent Readiness performs bounded passive machine-interface discovery. Deep Website Intelligence Audit adds browser-rendered evidence for teams that need a client-ready technical report." },
    ],
    highlights: DIMENSIONS,
    faq: FAQS.slice(0, 3), related: commonRelated,
  },
  "agent-readiness-audit": {
    path: "/agent-readiness-audit",
    title: "AI Agent Readiness Audit for Websites | Santos",
    description: "Audit whether AI agents can discover, understand, and use a website's public machine interfaces. Applicability-aware results cost 0.075 USDC via x402.",
    eyebrow: "Paid capability · 0.075 USDC per successful audit",
    h1: "See whether AI agents can understand and use your website",
    intro: "The Agent Readiness audit classifies the target, checks only applicable public surfaces, and returns evidence for llms.txt, structured identity, OpenAPI, MCP, operational trust, and machine commerce.",
    sections: [
      { heading: "Applicability is part of the score", body: "An informational website is not automatically deficient because it has no MCP server or OpenAPI document. Santos first determines whether callable and commerce surfaces are relevant, then separates tested, unknown, and not-applicable checks." },
      { heading: "Passive by design", body: "The audit reads bounded public resources. It does not authenticate to the target, submit forms, invoke advertised business tools, execute target-provided code, or send a payment signature to the audited service." },
      { heading: "A report agents can consume", body: "Results include a 0–100 readiness score, level, grade, confidence, tested coverage, category subscores, discovered interfaces, findings, and prioritized recommended actions." },
    ],
    highlights: [
      { name: "Discovery & documentation", text: "llms.txt, public docs, interface links, crawlability, and low-noise machine guidance." },
      { name: "Typed capabilities", text: "OpenAPI operations, MCP transport and tools, schemas, output, auth, errors, and limits." },
      { name: "Trust & commerce", text: "Provider identity, terms, support, claim accuracy, public pricing, x402 challenge quality, and idempotency." },
    ],
    code: "GET https://api.santosautomation.com/api/agent-readiness?url=https%3A%2F%2Fexample.com&depth=quick\n← 402 PAYMENT-REQUIRED · 0.075 USDC · eip155:8453\n→ retry with PAYMENT-SIGNATURE\n← 200 application/json · payment receipt",
    faq: [FAQS[1], FAQS[4], FAQS[5]], related: commonRelated,
  },
  "website-intelligence-api": {
    path: "/website-intelligence-api",
    title: "Website Intelligence API for AI Agents | Santos",
    description: "Turn a public URL into structured website intelligence through synchronous Quick and Agent Readiness endpoints or an asynchronous browser-rendered audit.",
    eyebrow: "Developer integration · JSON over HTTP",
    h1: "Turn any public URL into structured website intelligence",
    intro: "Santos exposes versioned, machine-payable HTTP interfaces for fast triage, Agent Readiness, and browser-rendered evidence. No account or traditional API key is required; paid requests use x402 on Base.",
    sections: [
      { heading: "Choose the smallest honest scope", body: "Use GET /api/audit for lightweight single-page signals, GET /api/agent-readiness for bounded agent-interface discovery, and POST /v1/audits when rendered browser evidence and downloadable artifacts justify an asynchronous job." },
      { heading: "Stable integration surfaces", body: "The OpenAPI 3.1 document describes typed inputs, responses, errors, and payment behavior. The capability manifest helps an agent select a tier, while the MCP endpoint provides discovery and a canonical paid handoff." },
      { heading: "Designed for safe automation", body: "Public targets are restricted to HTTP and HTTPS with private networks blocked. Quick audits settle only after a successful response. Deep jobs support idempotency and use per-job access tokens for report retrieval." },
    ],
    highlights: [
      { name: "Safe Fetch", text: "GET /v1/fetch · synchronous · 0.002 USDC per successful SSRF-guarded raw fetch." },
      { name: "Content Extraction", text: "POST /v1/extract · synchronous · 0.005 USDC per successful page-to-Markdown extraction." },
      { name: "Quick Intelligence", text: "GET /api/audit · synchronous · 0.015 USDC per successful audit." },
      { name: "Agent Readiness", text: "GET /api/agent-readiness · synchronous · 0.075 USDC per successful audit." },
      { name: "Deep Intelligence", text: "POST /v1/audits · asynchronous · 0.225 USDC per bounded compute reservation." },
    ],
    code: "curl 'https://api.santosautomation.com/api/audit?url=https%3A%2F%2Fexample.com'\n# Decode PAYMENT-REQUIRED, sign the quoted x402 terms, then retry.\n# See /openapi.json for schemas and examples.",
    faq: [FAQS[5], FAQS[2]], related: commonRelated,
  },
  "mcp-readiness-checker": {
    path: "/mcp-readiness-checker",
    title: "MCP Readiness Checker and Audit | Santos",
    description: "Check MCP discovery, transport, tools, schemas, structured output, authorization guidance, safety metadata, and public evidence.",
    eyebrow: "Technical checker · Model Context Protocol",
    h1: "Audit a website's MCP readiness",
    intro: "An MCP URL alone is not enough. Santos looks for a discoverable, interoperable interface whose tools are described precisely enough for an agent to select and use safely.",
    sections: [
      { heading: "Discovery and transport", body: "The audit looks for MCP links in public documentation, machine-readable assets, registry evidence, and explicit endpoints, then assesses compatible transport and protocol negotiation without calling target business tools." },
      { heading: "Tools, resources, and schemas", body: "Useful servers provide deterministic tool descriptions, strict input schemas, declared outputs, structured content, and clear error behavior. Resource and prompt exposure is recorded when public evidence supports it." },
      { heading: "Safety and authorization", body: "Read-only, destructive, idempotent, and open-world behavior should be documented accurately. Protected servers should explain authorization discovery without leaking credentials into public metadata." },
    ],
    highlights: [
      { name: "Advertised", text: "Can an agent find the canonical MCP surface?" },
      { name: "Interoperable", text: "Does transport negotiation expose usable tools and typed schemas?" },
      { name: "Safe to select", text: "Are side effects, authorization, outputs, and limitations explicit?" },
    ],
    faq: [FAQS[4], FAQS[1]], related: commonRelated,
  },
  "llms-txt-checker": {
    path: "/llms-txt-checker",
    title: "llms.txt Checker and Validator | Santos",
    description: "Validate whether llms.txt is reachable, well structured, consistent, linked to useful documentation, and honest about its role.",
    eyebrow: "Technical checker · agent orientation",
    h1: "Check whether your llms.txt file is useful to AI agents",
    intro: "Santos treats llms.txt as a proposed orientation file—not a ranking switch. The checker asks whether it gives an agent concise, current paths to the documentation and interfaces that actually matter.",
    sections: [
      { heading: "Availability and structure", body: "The audit checks the conventional location, response state, readable text, useful headings, concise summary, and grouped links. A successful HTTP response alone does not establish quality." },
      { heading: "Link and claim quality", body: "Referenced documentation should resolve to canonical public resources. Product names, prices, endpoints, access requirements, and limitations should agree with the website and interface descriptions." },
      { heading: "Useful, not duplicated", body: "A good file reduces navigation work. It should point to canonical sources rather than reproduce an entire marketing site or make unsupported claims about AI crawler behavior." },
    ],
    highlights: [
      { name: "Reachable", text: "Public, readable, and served from a predictable URL." },
      { name: "Structured", text: "Concise summary and clearly grouped canonical links." },
      { name: "Consistent", text: "Claims match visible docs, pricing, interfaces, and limitations." },
    ],
    code: "# /llms.txt\n# Product name\nShort, factual orientation.\n\n## Documentation\n- [API contract](https://example.com/openapi.json): Typed operations\n\n## Optional\n- [Methodology](https://example.com/methodology): Limits and scoring",
    faq: [FAQS[3], FAQS[2]], related: commonRelated,
  },
  "openapi-readiness-checker": {
    path: "/openapi-readiness-checker",
    title: "OpenAPI Readiness Audit and Validator | Santos",
    description: "Measure whether agents can discover and understand an API through valid OpenAPI, typed operations, auth, examples, errors, and documentation.",
    eyebrow: "Technical checker · API description quality",
    h1: "Measure whether AI agents can understand your API",
    intro: "A parseable specification is the beginning, not the finish. Santos examines whether an agent can discover the document, select an operation, construct valid input, anticipate output and errors, and understand access or payment requirements.",
    sections: [
      { heading: "Canonical discovery", body: "The document should be advertised from public HTML, Link metadata, or machine guidance and identify the canonical server. Conflicting or stale specifications reduce confidence even when each file parses." },
      { heading: "Operations an agent can select", body: "Stable operationId values, meaningful summaries, tags, request schemas, required fields, response schemas, and examples reduce guesswork during tool construction." },
      { heading: "Access and failure behavior", body: "Authentication, x402 payment, rate limits, idempotency, timeouts, non-2xx responses, and retry guidance should be explicit so an agent can act without unsafe trial and error." },
    ],
    highlights: [
      { name: "Valid", text: "Parseable OpenAPI 3.x or Swagger 2.0 with a canonical server." },
      { name: "Typed", text: "Inputs, outputs, examples, required fields, and stable operation identifiers." },
      { name: "Operational", text: "Auth, payment, errors, limits, settlement, and retry behavior." },
    ],
    faq: [FAQS[4], FAQS[1]], related: commonRelated,
  },
};

export const LEARN_ARTICLES = {
  "what-is-ai-website-intelligence": {
    title: "What Is AI Website Intelligence?", description: "A practical definition of AI Website Intelligence and how discovery, structured meaning, callable interfaces, and trust extend traditional audits.",
    intro: "AI Website Intelligence is the evidence-based measurement of whether automated systems can find a website, interpret what it represents, use any applicable capabilities, and decide whether the interaction is dependable.",
    sections: [
      ["Beyond search visibility", "SEO answers important questions about crawling, indexing, content, and page quality. Agent-facing evaluation keeps those foundations and adds entity clarity, machine interface discovery, typed operations, access rules, and operational evidence."],
      ["Four separate questions", "Discoverable asks where the site and documentation can be found. Understandable asks what the provider, content, and offers mean. Callable asks whether useful operations exist. Trustworthy asks whether evidence supports safe reliance."],
      ["What a useful audit returns", "A useful result exposes observations, URLs, status, applicability, tested coverage, confidence, and prioritized fixes. One score may summarize completed checks, but it should not conceal skipped or irrelevant tests."],
    ],
  },
  "what-is-agent-readiness": {
    title: "What Makes a Website Ready for AI Agents?", description: "Learn how public documentation, structured identity, typed capabilities, applicability, and trust make a website ready for AI agents.",
    intro: "An agent-ready website gives automated systems enough public, consistent evidence to understand the provider and complete an appropriate task without guesswork.",
    sections: [
      ["Readable is not yet usable", "Clear pages and metadata help an agent understand a business. Callable readiness requires an explicit interface such as OpenAPI or MCP only when the business actually offers an operation an agent should invoke."],
      ["Applicability prevents false failures", "A publisher may need strong crawlability and structured identity but no API. A paid API provider needs much more: typed operations, access rules, error models, idempotency, and pricing scoped to the resource."],
      ["Trust closes the loop", "HTTPS, support, limitations, stable errors, terms, performance, and accessible content make machine-readable claims more dependable. Readiness is not a certification; it is a traceable assessment of observed public evidence."],
    ],
  },
  "mcp-vs-openapi": {
    title: "MCP vs OpenAPI: What AI-Ready Websites Need", description: "Compare MCP and OpenAPI for agent-ready services, including discovery, tool selection, schemas, transports, authorization, and when each applies.",
    intro: "OpenAPI describes HTTP APIs. MCP provides a protocol for exposing tools, resources, and prompts to model clients. They overlap around typed operations but solve different integration problems.",
    sections: [
      ["OpenAPI describes an HTTP contract", "An OpenAPI document maps paths, methods, inputs, outputs, servers, security schemes, and errors. It is ideal when a service already exposes a stable HTTP API or needs broad tooling compatibility."],
      ["MCP presents model-facing capabilities", "MCP clients discover tools and schemas through a live protocol. Good descriptions explain selection, side effects, structured output, authorization, and operational limits."],
      ["Many services benefit from both", "OpenAPI can remain the canonical web contract while MCP offers agent-native discovery and invocation. Consistent names, schemas, pricing, and limitations across both surfaces matter more than adding either label alone."],
    ],
  },
  "llms-txt-vs-robots-txt": {
    title: "llms.txt vs robots.txt", description: "Understand the different roles of llms.txt and robots.txt: orientation and documentation links versus crawler access directives.",
    intro: "robots.txt communicates crawler access preferences. llms.txt is a proposal for concise orientation and documentation links. They are complementary files, not substitutes.",
    sections: [
      ["robots.txt controls crawling instructions", "A robots file uses user-agent groups and allow or disallow rules. It can reference sitemaps, but it does not explain a product, document an API, or provide typed capability schemas."],
      ["llms.txt provides orientation", "A concise llms file can name a service, summarize it, and link to authoritative documentation. Support varies, so publishing one does not guarantee crawling, citation, or answer visibility."],
      ["Keep both consistent", "Do not point agents toward documentation that crawler rules block unintentionally. Keep canonical URLs, product names, and machine interface links aligned with visible content and structured data."],
    ],
  },
  "how-ai-agents-discover-capabilities": {
    title: "How AI Agents Discover Website Capabilities", description: "A practical discovery path from HTML and Link headers to llms.txt, capability manifests, OpenAPI, MCP, and payment challenges.",
    intro: "Capability discovery works best as a chain of progressively more precise evidence rather than a single magic file.",
    sections: [
      ["Start from the public page", "Canonical links, descriptive navigation, JSON-LD, and HTTP Link headers can identify the provider and advertise documentation or service descriptions."],
      ["Move to machine descriptions", "llms.txt can orient a reader, a capability manifest can help choose a product, and OpenAPI can describe typed HTTP operations. Each should point back to a canonical source."],
      ["Negotiate live interfaces carefully", "MCP can enumerate tools through a live transport. x402 can return unsigned payment terms before a paid request. Discovery should remain passive: do not invoke business tools or transfer funds just to learn what exists."],
    ],
  },
  "structured-data-for-ai-agents": {
    title: "Structured Data for AI Agents", description: "Use Schema.org and JSON-LD to clarify provider identity, websites, services, APIs, offers, and canonical relationships for automated systems.",
    intro: "Structured data turns visible facts into explicit entities and relationships, but it is dependable only when it matches the page people can see.",
    sections: [
      ["Model identity first", "Organization and WebSite entities establish who operates the site and which URL is canonical. Stable @id values let Service or WebAPI descriptions reference the same provider."],
      ["Describe real capabilities", "WebAPI or Service markup can name the interface, documentation, provider, terms, and visible offers. Do not add ratings, customers, integrations, or guarantees that the product cannot substantiate."],
      ["Validate syntax and consistency", "Parseable JSON-LD is necessary but insufficient. Compare names, endpoints, prices, currencies, and access requirements with HTML, OpenAPI, capability manifests, and payment challenges."],
    ],
  },
  "from-discoverable-to-callable": {
    title: "From Discoverable to Callable: The Next Layer After SEO", description: "See how technical SEO foundations connect to structured meaning, tool interfaces, and trust for the agentic web.",
    intro: "Discovery earns a website the chance to be read. Callability gives an agent a documented way to do something useful after it understands what the website offers.",
    sections: [
      ["Discovery remains foundational", "Fast pages, canonical URLs, crawl rules, sitemaps, titles, headings, and accessible content help search systems and agents reach reliable information."],
      ["Meaning makes selection possible", "Consistent entities, structured data, service descriptions, pricing, and contact information help an agent distinguish one provider and offer from another."],
      ["Interfaces turn intent into action", "Typed API operations or MCP tools can convert a request into a bounded action. Trust requires explicit side effects, authentication, payment, errors, idempotency, and evidence—not merely an endpoint URL."],
    ],
  },
  "agent-ready-website-checklist": {
    title: "The Agent-Ready Website Checklist", description: "A practical checklist for crawler access, machine documentation, structured identity, OpenAPI, MCP, trust, and applicability.",
    intro: "Use this checklist to improve the public evidence an agent needs. Implement only the interfaces that match the site's real purpose.",
    sections: [
      ["Discovery and meaning", "Confirm HTTPS, canonical URLs, indexability, a current sitemap, deliberate crawler rules, one clear H1, descriptive metadata, semantic HTML, structured identity, support, and canonical documentation links."],
      ["Callable services", "If the site exposes operations, publish a valid OpenAPI document or an MCP interface with strict schemas. Document inputs, outputs, auth, errors, limits, side effects, and idempotency."],
      ["Verification", "Test every advertised asset at its exact URL. Compare claims and prices across visible pages and machine files. Record skipped and not-applicable checks, then prioritize high-confidence fixes before adding new surface area."],
    ],
  },
};

export function pageMetadata(page) {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: { title: page.title, description: page.description, type: "website", url: page.path },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

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
      { name: "Structured Extraction", text: "POST /v1/extract/structured · synchronous · 0.08 USDC per successful schema-conforming extraction." },
      { name: "Feed Parser", text: "GET /v1/feed · synchronous · 0.003 USDC per successful RSS, Atom, or JSON Feed parse." },
      { name: "Link Map", text: "GET /v1/links · synchronous · 0.003 USDC per successful tagged link map." },
      { name: "Summarizer", text: "POST /v1/summarize · synchronous · 0.033 USDC per successful Claude page brief." },
      { name: "Quick Intelligence", text: "GET /api/audit · synchronous · 0.015 USDC per successful audit." },
      { name: "Batch Audit", text: "POST /api/audit/batch · synchronous · 0.50 USDC flat for up to 50 URLs." },
      { name: "Agent Readiness", text: "GET /api/agent-readiness · synchronous · 0.075 USDC per successful audit." },
      { name: "Screenshot & PDF", text: "GET /v1/screenshot · synchronous · 0.01 USDC per successful browser render." },
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
      ["Callable, made concrete", "Santos is itself an example of the callable dimension it measures: eleven x402-payable capabilities on Base mainnet, each documented in OpenAPI, discoverable through llms.txt and MCP, and priced explicitly rather than hidden behind a subscription. A Quick Intelligence Audit ($0.015 USDC) and Agent Readiness assessment ($0.075 USDC) triage a page; Safe Fetch ($0.002 USDC), Page-to-Markdown Extraction ($0.005 USDC), and Structured Extraction ($0.08 USDC) turn a page into raw text, clean Markdown, or schema-conforming JSON; Feed Parser ($0.003 USDC) and Link Map ($0.003 USDC) normalize any feed and map every link on a page; Summarizer ($0.033 USDC) condenses a page into a Claude brief; Screenshot & PDF Render ($0.01 USDC) captures what a real browser sees; a flat-rate Batch Audit ($0.50 USDC) covers up to 50 URLs; a Deep Website Intelligence Audit ($0.225 USDC) adds Lighthouse, axe-core, and network evidence. Every one settles USDC only after a successful response — a payable interface an agent can select, invoke, and trust without a support ticket."],
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
  "x402-explained": {
    title: "x402 Explained: Pay-Per-Call APIs for AI Agents", description: "How the x402 protocol resurrects HTTP 402 for machine payments: the exact scheme, EIP-3009 authorization on Base, the facilitator, and a worked request flow.",
    intro: "x402 turns the long-reserved HTTP 402 status code into a working payment protocol: a server quotes a price, the client signs a stablecoin authorization, and settlement happens only when the request succeeds.",
    sections: [
      ["The status code that waited three decades", "HTTP 402 Payment Required was reserved in the early HTTP specifications and left undefined because no viable digital payment mechanism existed at the time. x402 finally gives the status concrete semantics: instead of an error page, an unpaid request receives a machine-readable quote describing exactly what payment would unlock the resource."],
      ["The exact scheme on Base", "A payment requirement names a scheme, a network, an asset, an amount, a recipient, and a validity window. In the common exact scheme on Base mainnet (eip155:8453), the asset is USDC and payment moves through EIP-3009 transferWithAuthorization: the buyer signs an off-chain authorization, and the payee or a facilitator submits it on-chain. The buyer therefore never needs ETH for gas, and the signed payload is valid only for the quoted amount, recipient, and time window."],
      ["The full request flow, step by step", "First, the client sends an ordinary request, such as GET /v1/fetch. Second, the server answers 402 with a PAYMENT-REQUIRED header carrying base64-encoded JSON terms. Third, the client decodes the terms, selects an accepted payment option, and signs an EIP-3009 authorization with its wallet. Fourth, the client retries the identical request with a PAYMENT-SIGNATURE header. Fifth, the server verifies the signature and, on success, returns the resource together with a PAYMENT-RESPONSE header containing the settlement receipt. In x402 v2 the whole exchange is header-based, so any HTTP client can participate."],
      ["The facilitator: verify and settle", "A server does not need to run its own node or wallet infrastructure. A facilitator exposes two operations: verify, which checks that the signature matches the quoted terms and the buyer holds sufficient funds, and settle, which submits the authorization on-chain. Santos settles only after producing a successful response (a status below 400): if the underlying request fails, the payment is never settled and no USDC moves."],
      ["Why this model suits agents", "There are no accounts, no API keys, no subscriptions, and no invoices. An agent pays 0.002 USDC for one fetch instead of committing to a monthly plan it will never exhaust, and budgets become exact because spend can be capped per call. Identity is a wallet address, access control is a signature, and settle-on-success removes the refund negotiation that makes conventional prepaid credits awkward for autonomous software."],
      ["Discovery through Bazaar", "A payment protocol only helps if agents can find services that speak it. Bazaar, the discovery layer of the x402 ecosystem, indexes payable endpoints so a client can enumerate available services, their prices, and their networks without prior bilateral knowledge. The eleven Santos tools are published there alongside the capability manifest, OpenAPI document, and llms.txt, so an agent can go from discovery to paid invocation without human setup."],
      ["Try it in five minutes", "Run curl against https://api.santosautomation.com/v1/fetch?url=https%3A%2F%2Fexample.com and read the 402 response: the PAYMENT-REQUIRED header quotes 0.002 USDC on eip155:8453 with a recipient and expiry. Decode the header, sign the quoted terms with any x402 client library (the reference SDK wraps fetch and axios to handle challenge, signing, and retry automatically), and repeat the request. The response returns the fetched content plus a PAYMENT-RESPONSE receipt. The identical flow works for every Santos capability, from Feed Parser at 0.003 USDC to Batch Audit at 0.50 USDC flat."],
    ],
  },
  "four-dimensions-of-agent-readiness": {
    title: "The Four Dimensions of Agent Readiness, Scored", description: "What Discoverable, Understandable, Callable, and Trustworthy each measure, how applicability-aware scoring keeps informational sites fair, and the highest-impact fixes per dimension.",
    intro: "A single readiness score hides more than it reveals. Santos reports four dimensions — Discoverable, Understandable, Callable, and Trustworthy — so a team can see which layer actually fails and fix that one first.",
    sections: [
      ["Why four scores instead of one", "Every agent task decomposes into the same sequence: find the site, interpret what it offers, invoke an applicable operation, and decide whether the result can be relied on. A site can excel at discovery and still be unusable because nothing is callable. One blended number cannot express that difference, so Santos scores each layer separately from 0 to 100 and reports the composite alongside the parts."],
      ["Discoverable: can an agent find you", "This dimension measures machine-facing entry points: whether llms.txt exists and orients usefully, whether robots.txt is deliberate rather than accidental, whether sitemaps are current, whether canonical URLs resolve consistently, and whether documentation and interface descriptions are linked from public pages and headers. A common failure is documentation that exists but is unreachable by machine: no sitemap reference, no llms.txt, and a robots rule that quietly blocks it."],
      ["Understandable: can an agent interpret you", "This dimension measures meaning: semantic HTML, JSON-LD identity for the organization, website, and services, consistent product naming, visible pricing, and descriptions that agree across pages. An agent that cannot tell the provider from the product will misquote both, and a pricing page that contradicts the structured data produces exactly the kind of inconsistency an autonomous system should refuse to act on."],
      ["Callable: can an agent act", "This dimension measures invocable surfaces: OpenAPI documents, MCP servers, capability manifests, typed input and output schemas, stable error models, and x402 payment terms with explicit prices. It applies only where the business genuinely offers operations an agent should invoke; a documentation site with nothing to call is not deficient for lacking an API."],
      ["Trustworthy: can an agent rely on you", "This dimension measures operational evidence: HTTPS configuration, security headers, accessibility, performance, browser errors, reachable support channels, and whether published claims match observed behavior. Trust is what makes the other three dimensions safe to use unattended, because a callable interface on an unverifiable site is a liability rather than a capability."],
      ["Applicability-aware scoring", "Santos classifies the target before scoring it. Categories a site does not need are marked not applicable and removed from the denominator instead of being scored as failures, so an informational publisher is not penalized for lacking MCP or payment surfaces while an API provider is held to the full bar. All numbers come from deterministic published rules; AI-generated summaries, when requested, annotate the report but never change a score."],
      ["The highest-impact fixes per dimension", "Discoverable: publish a concise llms.txt, align robots.txt with intent, and ship a current sitemap. Understandable: add JSON-LD Organization and WebSite markup and make pricing visible and consistent. Callable: publish a valid OpenAPI document or a capability manifest with typed schemas, stable errors, and explicit prices. Trustworthy: fix missing security headers, remove console errors, and expose a reachable support path. In audit after audit these basics move the score more than any exotic addition."],
    ],
  },
  "capability-manifests": {
    title: "Capability Manifests: Telling Agents What Your Site Can Do", description: "Why scraping cannot discover invocable interfaces, what an agent-capabilities.json manifest contains, how it relates to OpenAPI, MCP, and llms.txt, and how to publish one.",
    intro: "An agent that has to scrape your site to guess what it can call will guess wrong. A capability manifest states, in one machine-readable document, which operations exist, what they cost, and how to invoke them.",
    sections: [
      ["The discovery problem", "HTML is written for humans: navigation labels, marketing copy, and screenshots. Nothing in a typical homepage reliably tells an automated client that a JSON API exists, which operations it offers, what each one costs, or how access and payment work. Scraping navigation text to reconstruct that picture is brittle, lossy, and indistinguishable from guesswork at exactly the moment an agent needs certainty."],
      ["What a capability manifest is", "A capability manifest is a JSON document at a well-known location that enumerates invocable operations with stable identifiers, prices, typed input and output schemas, worked examples, and stated limitations. Santos publishes one at /.well-known/agent-capabilities.json: it lists eleven capabilities, from Safe Fetch at 0.002 USDC to Batch Audit at 0.50 USDC flat, each with its endpoint, schemas, examples, and the payment protocol it accepts."],
      ["Structure in practice", "A useful entry carries a stable capability id, a plain description, the invocation endpoint, a price with amount and asset, request and response schemas an agent can validate against before calling, at least one worked example, and explicit limitations such as rate limits, blocked network ranges, or unsupported inputs. Service-level metadata covers the provider identity, supported payment protocols such as x402-v2, and settlement behavior so the agent knows payment finalizes only on success."],
      ["An index, not a replacement", "The manifest does not compete with the documents it points to. OpenAPI remains the canonical contract for HTTP operations, MCP remains the agent-native invocation protocol, and llms.txt remains the orientation file for readers both human and machine. The manifest is the routing layer above them: it helps an agent decide that Structured Extraction, not raw fetch, is the right tool, then hands off to the contract that governs the actual call."],
      ["Publishing one", "Start by inventorying the operations an agent may legitimately invoke, and assign each a stable id. Describe inputs and outputs with the same schemas your OpenAPI document or MCP server already uses rather than inventing a parallel description. State prices and limitations honestly, serve the file at /.well-known/agent-capabilities.json with a content type of application/json and a predictable cache policy, and link it from llms.txt and your documentation so discovery does not depend on one convention alone."],
      ["Keeping it honest", "A manifest is a claim, and claims are audited. Prices must match what the 402 challenge actually quotes, endpoints must resolve, and stated limitations must match observed behavior. Santos compares manifest claims against live evidence during an audit, and discrepancies surface as findings that lower the Callable and Trustworthy dimensions. The manifest that helps your score is the one your service can keep."],
    ],
  },
  "what-200-audits-reveal": {
    title: "What 200+ Audits of the World's Biggest Sites Reveal", description: "Methodology and findings from auditing more than 200 well-known websites with one deterministic engine: average 59, median 57, and the patterns behind the scores.",
    intro: "Santos ran the same deterministic audit across more than 200 well-known websites. The result is a public index of how ready the web's most visited properties actually are for AI agents, and the picture is mixed.",
    sections: [
      ["Methodology", "Every site in the index was processed by the same engine under the same constraints: passive public evidence only, one page per site, no authentication, no privileged access, and no interaction with advertised business tools. Scoring is applicability-aware, so a media site is not punished for lacking an API, and deterministic, so rerunning the same evidence produces the same numbers. The reports are HMAC-signed and publicly verifiable at /verify."],
      ["Headline numbers", "Across the index the average score is 59 out of 100 and the median is 57. The top score belongs to planetscale.com at 91. At the other end sit some of the most visited properties on the web: google.com at 37, oracle.com at 39, and binance.com at 24. A median in the high fifties means the typical major site is discoverable and readable, but offers an agent almost nothing it can reliably call or verify."],
      ["The pattern: infrastructure scores high", "Developer-tool and infrastructure companies dominate the top of the table because their product is an interface. They publish OpenAPI documents, typed SDKs, machine-readable pricing, status pages, and precise documentation as a matter of course, since their customers are machines and the engineers who operate them. PlanetScale's 91 is what that discipline looks like when measured."],
      ["The other pattern: consumer and finance score low", "Large consumer platforms and finance sites cluster at the bottom. Their real interfaces sit behind accounts, session auth, and app stores; their robots directives are restrictive; and their machine-facing documentation is sparse or marketing-led. Google's 37 is a useful reminder that size and engineering talent do not automatically produce agent-readiness — the surfaces an agent needs are simply not the surfaces these businesses expose."],
      ["The most common failures", "Three gaps recur across the index. First, llms.txt is missing on the large majority of audited sites. Second, almost none publish a machine-readable description of their capabilities, leaving agents to scrape and guess. Third, security headers are weak or absent far more often than their cost would justify. All three are inexpensive fixes relative to their effect on the score."],
      ["What the top scorers do differently", "The leaders share habits rather than secrets: a concise llms.txt that points to canonical documentation, a valid public OpenAPI document, explicit and consistent pricing, strong security headers, fast pages, and claims that survive comparison with observed behavior. Nothing in the top tier requires novel technology. It requires treating machine consumers as first-class users and keeping every surface consistent with the others."],
      ["Honest limitations", "This is single-page lab data, not a certification. Each score reflects what one deterministic engine could observe passively on one day, from one entry point, and a site can change its evidence at any time. The index is published as a public leaderboard at /reports with the full per-site reports behind it, so readers can inspect the findings and the exact evidence rather than taking the ranking on faith."],
    ],
  },
  "santos-vs-lighthouse-vs-seo-tools": {
    title: "Santos vs Lighthouse vs Traditional SEO Tools", description: "A fair comparison of measurement scope: Lighthouse audits rendered page quality, SEO tools measure search discovery, and Santos scores agent readiness across four dimensions.",
    intro: "Lighthouse, traditional SEO platforms, and Santos all produce scores for websites, but they answer different questions. Knowing which question you need answered matters more than which number is higher.",
    sections: [
      ["What Lighthouse measures", "Lighthouse produces lab evidence about one rendered page: performance metrics, accessibility violations, best-practice checks, and basic SEO signals, all from a controlled browser run against a single load. It answers a narrow question well: is this page fast, accessible, and built according to web platform guidance. It is the reference tool for that question, and Santos uses it rather than reinventing it."],
      ["What traditional SEO tools measure", "Platforms such as Ahrefs and Semrush, and generic site crawlers, measure search discovery and ranking: crawl coverage, indexation, keyword positions, backlink profiles, SERP features, and competitive gaps. They answer whether search engines can find and rank your content, and they do it at a scale of historical data that a point-in-time audit cannot match."],
      ["What Santos measures", "Santos measures agent readiness across four dimensions: whether an autonomous system can discover the site, understand what it offers, invoke applicable capabilities, and rely on the interaction. That includes surfaces the other tools do not model at all — OpenAPI documents, MCP servers, capability manifests, typed error behavior, and x402 payment challenges — scored deterministically and adjusted for applicability."],
      ["Where they overlap", "Performance and accessibility appear in both Lighthouse output and the Santos Trustworthy dimension. Crawlability, canonical URLs, sitemaps, and metadata quality matter to both SEO tools and the Discoverable dimension. This overlap is an asset: fixing the foundational layer improves all three families of scores at once, which is why the cheapest readiness work is usually the oldest work."],
      ["Where they do not overlap", "A perfect Lighthouse score says nothing about how an agent would call your API, because invocation surfaces are outside its model. A top-tier SEO audit will not check whether you publish MCP tools, a capability manifest, typed schemas, or a well-formed 402 challenge, because those signals do not influence search ranking. The gap is not a flaw in either tool; it is simply a different question."],
      ["When to use which, and how they compose", "Use Lighthouse when the question is page quality, SEO platforms when the question is search growth, and Santos when the question is whether machines can act on your site without a human in the loop. The tools compose rather than compete: Santos Deep audits run Lighthouse and axe-core as one evidence layer among others, then add interface discovery, commerce, and consistency evidence on top. A mature team runs all three and reads each score for the question it actually answers."],
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

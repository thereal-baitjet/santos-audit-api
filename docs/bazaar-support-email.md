# Draft: Agentic Market / CDP Bazaar support enquiry

Send to the CDP x402 / Agentic Market support channel. Everything below is
reproducible with `npm run verify:bazaar` and `npm run bazaar:read`.

Update the dates and figures if you send it later than 2026-07-28.

---

**Subject:** x402 Bazaar — 10 of 11 paid resources never indexed; existing entry stale 9 days despite settlements

Hello,

We operate Santos Website Intelligence (`com.santosautomation/site-audit`), an
x402 v2 seller on Base mainnet settling through the CDP facilitator. We have
eleven paid endpoints, and only one appears in the Bazaar discovery catalog.
That one entry has not refreshed in nine days despite settled payments against
it. We would like to understand what actually triggers catalog ingestion.

**Seller details**

- Seller wallet: `0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B`
- Network: `eip155:8453` (Base mainnet), USDC
- Facilitator: `https://api.cdp.coinbase.com/platform/v2/x402`
- Canonical API host: `https://api.santosautomation.com`

**What we observe**

The only catalog entry for our domain is:

```
resource:    https://api.santosautomation.com/api/audit
serviceName: Santos Quick Intelligence Audit
lastUpdated: 2026-07-19T02:38:06.677Z
iconUrl:     (absent)
```

That `serviceName` and tag set were replaced in our deployment on 2026-07-27,
and `iconUrl` has been served since then, so the record predates our current
metadata by more than a week.

On **2026-07-28T03:23Z** we settled **ten real payments**, one against each of
our other paid endpoints, totalling 0.948 USDC. All ten returned HTTP 200 with a
`PAYMENT-RESPONSE` receipt, and the on-chain transfers are visible from the
seller wallet above. A full catalog scan **9.4 hours later** — 9,000 resources,
every page — showed no new entries and no change to the existing record's
`lastUpdated`.

**What we have verified on our side**

- All eleven endpoints return a valid 402 with a base64 `PAYMENT-REQUIRED`
  header carrying `x402Version: 2`, a complete `accepts[0]`, and an
  `extensions.bazaar` discovery block with input and output JSON Schemas.
- Each endpoint emits its own canonical, **query-free** `resource.url` — these
  are pinned via `routeConfig.resource` rather than derived from the request
  URL, so identity is stable across callers. (Before 2026-07-28 they were
  derived, so every caller minted a different `resource.url`; we believe that
  explains why nothing indexed historically, but it does not explain the
  silence since the fix.)
- `resource.description` is under 500 characters on every route.
- Tags are within the 5-tag limit, and `serviceName` and `iconUrl` are set.

**The specific question**

`PaymentRequirementsV2` carries neither `resource` nor `extensions`, so at
settle time the payment payload is the only channel that can carry Bazaar
metadata to the facilitator.

We strip the client-echoed `extensions` envelope **before calling verify**,
because CDP's verify rejects payloads that include it with
`400 "'paymentPayload' is invalid"`. We currently strip it on settle as well.

1. Does settlement attribution or catalog ingestion require the `extensions`
   block to be present in the payload sent to **settle**?
2. If so, what is the expected shape — the full echoed envelope, or a
   restricted subset — given verify rejects the echoed form?
3. What else triggers a catalog entry to be created or refreshed, if not a
   settled payment?
4. Why would an existing entry remain frozen for nine days across multiple
   settlements against that exact resource URL?

**Reproducing**

Our verification is scripted and public:

- `verify-bazaar-discovery.js` sends an unpaid but valid request to all eleven
  endpoints, decodes each 402, and asserts the eleven `resource.url` values are
  distinct and canonical. It passes 11/11.
- `read-bazaar.js` pages the discovery API and diffs the catalog against those
  eleven expected resources.

We are happy to run any additional diagnostic, settle another payment against a
specific endpoint on request, or share full request and response captures.

Thank you,

Juan Santos
Santos Automation — info@santosautomation.com
https://www.santosautomation.com

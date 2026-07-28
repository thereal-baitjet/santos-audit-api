// Shared x402 v2 resource server: Coinbase CDP facilitator (settles real USDC
// on Base mainnet, authenticated via CDP_API_KEY_ID/CDP_API_KEY_SECRET) with
// the exact-EVM scheme and Bazaar discovery extension registered.
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { createFacilitatorConfig } from "@coinbase/x402";

// Receiving wallet (public address, not a secret) — hard-coded for mainnet.
// (No env fallback: stale project env vars must not silently flip us back to testnet.)
export const SELLER = "0x3F8173bbb64ffAcA8793C9c46518Ba2369277E8B";
export const NETWORK = "eip155:8453"; // Base mainnet

const facilitatorConfig = createFacilitatorConfig(
  process.env.CDP_API_KEY_ID,
  process.env.CDP_API_KEY_SECRET,
);

// CDP's *verify* rejects payment payloads carrying the echoed `extensions`
// envelope standard x402 v2 clients send back (400 "'paymentPayload' is
// invalid"), so it is stripped there and only there.
//
// It must survive into *settle*. PaymentRequirementsV2 carries neither
// `resource` nor `extensions` (see @x402/core PaymentRequirementsV2Schema),
// so the payment payload is the only channel by which Bazaar discovery
// metadata reaches CDP at settlement — and settlement is what populates the
// catalog. Stripping it from settle silently stopped all new Bazaar indexing:
// the last catalog write for this service was 2026-07-19T02:38Z, hours before
// b42984a introduced the strip, and ten settled payments on 2026-07-28
// produced no new entries. `resource` had the same problem and was restored in
// 9e2770a for attribution; this is the other half of that fix.
//
// Note CDP rejects resource.description > ~500 chars, so route descriptions
// stay short.
class CDPFacilitatorClient extends HTTPFacilitatorClient {
  verify(paymentPayload, paymentRequirements) {
    const { extensions, ...withoutExtensions } = paymentPayload;
    return super.verify(withoutExtensions, paymentRequirements);
  }
  settle(paymentPayload, paymentRequirements) {
    return super.settle(paymentPayload, paymentRequirements);
  }
}
const facilitatorClient = new CDPFacilitatorClient(facilitatorConfig);

export const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

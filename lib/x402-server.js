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

// CDP's verify/settle schema rejects payment payloads that carry the echoed
// `resource`/`extensions` envelope standard x402 v2 clients send back
// (400 "'paymentPayload' is invalid"), which 402'd every real payment. The
// facilitator only needs x402Version + the signed payload + accepted terms.
class CDPFacilitatorClient extends HTTPFacilitatorClient {
  #sanitize({ resource, extensions, ...payload }) {
    return payload;
  }
  verify(paymentPayload, paymentRequirements) {
    return super.verify(this.#sanitize(paymentPayload), paymentRequirements);
  }
  settle(paymentPayload, paymentRequirements) {
    return super.settle(this.#sanitize(paymentPayload), paymentRequirements);
  }
}
const facilitatorClient = new CDPFacilitatorClient(facilitatorConfig);

export const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

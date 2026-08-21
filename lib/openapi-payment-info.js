// agent-payment-integrity-compatible seller audit declaration for GET /api/audit.
//
// This is the price/protocols `x-payment-info` shape the Action already
// accepts. It is not the current MPP Payment Discovery `offers[]` shape.
// Built from the existing catalog, x402 rail, and Bazaar catalog identity so
// the paid-operation declaration cannot drift from what the route charges.
import { apiProduct } from "./products.js";
import { SELLER, NETWORK, USDC_ASSET } from "./x402-server.js";
import { bazaarRoute, resourceUrl } from "./bazaar-catalog.js";

export const QUICK_AUDIT_ROUTE = "/api/audit";
export const QUICK_AUDIT_METHOD = "GET";
export const QUICK_AUDIT_BAZAAR_ID = "quick-audit";
export const QUICK_AUDIT_SCHEME = "exact";

export function quickAuditPaymentInfo() {
  const product = apiProduct(QUICK_AUDIT_ROUTE);
  if (!product) {
    throw new Error("catalog is missing the Quick Intelligence product");
  }
  if (product.method !== QUICK_AUDIT_METHOD || product.route !== QUICK_AUDIT_ROUTE) {
    throw new Error(`catalog Quick Intelligence method/route drifted: ${product.method} ${product.route}`);
  }
  const bazaar = bazaarRoute(QUICK_AUDIT_BAZAAR_ID);
  if (bazaar.path !== QUICK_AUDIT_ROUTE || !bazaar.methods.includes(QUICK_AUDIT_METHOD)) {
    throw new Error("Bazaar quick-audit identity drifted from GET /api/audit");
  }
  return {
    price: {
      amount: product.priceUsdc,
      currency: "USDC",
      mode: "fixed",
    },
    protocols: [
      {
        x402: {
          scheme: QUICK_AUDIT_SCHEME,
          network: NETWORK,
          asset: USDC_ASSET,
          payTo: SELLER,
          resource: resourceUrl(QUICK_AUDIT_BAZAAR_ID),
        },
      },
    ],
  };
}

// Opt-in public listing flag shared by the paid audit routes.
//
// The routes used to accept only ?public=1, so ?public=true — what most
// callers try — was silently ignored and the paid report never reached
// /reports/<domain>. Accept the usual truthy spellings, and always say what
// happened in a response header: the report body is HMAC-signed, so the
// outcome cannot be added to it without breaking signature verification.
import { domainFromUrl } from "./public-reports.js";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const PUBLIC_LISTING_HEADER = "X-Santos-Public-Listing";

export function wantsPublicListing(searchParams) {
  const value = searchParams.get("public");
  return value != null && TRUTHY.has(value.trim().toLowerCase());
}

/**
 * Header value for the listing outcome:
 *   "not-requested" | "listed; url=<report page>" | "failed"
 */
export function publicListingHeader(outcome, listedUrl) {
  if (outcome !== "listed") return outcome;
  const domain = domainFromUrl(listedUrl);
  const site = process.env.PUBLIC_SITE_URL || "https://www.santosautomation.com";
  return domain ? `listed; url=${site.replace(/\/+$/, "")}/reports/${domain}` : "listed";
}

/** Set the outcome header and expose it to browser callers. */
export function applyPublicListingHeader(response, value) {
  response.headers.set(PUBLIC_LISTING_HEADER, value);
  const exposed = response.headers.get("Access-Control-Expose-Headers");
  const names = new Set((exposed ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  names.add(PUBLIC_LISTING_HEADER);
  response.headers.set("Access-Control-Expose-Headers", [...names].join(", "));
  return response;
}

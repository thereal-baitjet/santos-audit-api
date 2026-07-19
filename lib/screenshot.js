// Screenshot request validation/normalization — pure, testable.
import { AuditError } from "./safe-fetch.js";

export const SCREENSHOT_FORMATS = ["png", "jpeg", "pdf"];
export const SCREENSHOT_DEVICES = ["desktop", "mobile"];

export function normalizeScreenshotRequest(params) {
  const format = (params.format ?? "png").toLowerCase();
  if (!SCREENSHOT_FORMATS.includes(format)) {
    throw new AuditError("INVALID_REQUEST", `format must be one of: ${SCREENSHOT_FORMATS.join(", ")}`);
  }
  const device = (params.device ?? "desktop").toLowerCase();
  if (!SCREENSHOT_DEVICES.includes(device)) {
    throw new AuditError("INVALID_REQUEST", `device must be one of: ${SCREENSHOT_DEVICES.join(", ")}`);
  }
  const fullPageRaw = params.full_page;
  const full_page = fullPageRaw === true || fullPageRaw === "true" || fullPageRaw === "1";
  return { profile: "screenshot", url: params.url, format, device, full_page };
}

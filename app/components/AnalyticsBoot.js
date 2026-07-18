"use client";

import { useEffect } from "react";
import { bindAnalyticsAttributes } from "../../lib/analytics-client.js";

// Mounted once via the footer on every page. Binds delegated click tracking for
// any element carrying data-analytics-event. Privacy-safe and fails silently.
export function AnalyticsBoot() {
  useEffect(() => {
    bindAnalyticsAttributes();
  }, []);
  return null;
}

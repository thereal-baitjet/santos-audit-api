// Audit result cache with TTL.
// Stores audit results by URL to avoid re-parsing on repeat requests.

class AuditCache {
  constructor(ttlMs = 3600000) { // 1 hour default
    this.cache = new Map();
    this.timers = new Map();
    this.ttlMs = ttlMs;
    this.hits = 0;
    this.misses = 0;
  }

  get(url) {
    const normalized = this.normalizeUrl(url);
    const entry = this.cache.get(normalized);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalized);
      this.timers.delete(normalized);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.report;
  }

  set(url, report, ttlMs = this.ttlMs) {
    const normalized = this.normalizeUrl(url);

    // Clear existing timer
    if (this.timers.has(normalized)) {
      clearTimeout(this.timers.get(normalized));
    }

    const expiresAt = Date.now() + ttlMs;
    this.cache.set(normalized, { report, expiresAt });

    // Auto-expire
    const timer = setTimeout(() => {
      this.cache.delete(normalized);
      this.timers.delete(normalized);
    }, ttlMs);

    this.timers.set(normalized, timer);
  }

  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    } catch {
      return url;
    }
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }
}

const globalCache = new AuditCache();

export { AuditCache, globalCache as auditCache };

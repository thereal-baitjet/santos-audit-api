// x402 key caching for faster verification.
// Caches public keys with TTL to avoid refetching on every request.

const CACHE_TTL_MS = 3600000; // 1 hour

class X402KeyCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Update hit metric (silent-fail)
    if (typeof process !== 'undefined' && process.env.DEBUG_CACHE) {
      console.log(`[x402-cache] HIT: ${key}`);
    }
    return entry.value;
  }

  set(key, value, ttl = CACHE_TTL_MS) {
    // Clear existing timer if present
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });

    // Auto-expire after TTL
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
      if (typeof process !== 'undefined' && process.env.DEBUG_CACHE) {
        console.log(`[x402-cache] EXPIRE: ${key}`);
      }
    }, ttl);

    this.timers.set(key, timer);

    if (typeof process !== 'undefined' && process.env.DEBUG_CACHE) {
      console.log(`[x402-cache] SET: ${key} (ttl: ${ttl}ms)`);
    }
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Global singleton instance
const globalCache = new X402KeyCache();

export { X402KeyCache, globalCache as x402KeyCache };

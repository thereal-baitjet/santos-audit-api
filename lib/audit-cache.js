// Audit result cache with TTL.
// Supports both in-memory (local dev) and Redis (production via Vercel KV).

class AuditCache {
  constructor(ttlMs = 3600000) {
    this.ttlMs = ttlMs;
    this.hits = 0;
    this.misses = 0;

    // In-memory fallback
    this.cache = new Map();
    this.timers = new Map();

    // Redis client (lazy-loaded when available)
    this.redis = null;
    this.redisUrl = process.env.REDIS_URL;
  }

  async ensureRedis() {
    if (this.redis || !this.redisUrl) return;

    try {
      const { createClient } = await import('redis');
      this.redis = createClient({ url: this.redisUrl });
      await this.redis.connect();
      console.log('[audit-cache] Connected to Redis');
    } catch (e) {
      console.warn('[audit-cache] Redis unavailable:', e.message);
    }
  }

  normalizeUrl(url) {
    // A new namespace avoids reusing persisted reports whose old keys dropped
    // the query, including queryless keys polluted by a query-bearing request.
    const prefix = 'audit:v2:';
    try {
      const parsed = new URL(url);
      // Fragments never reach the HTTP server. Preserve the serialized URL's
      // path and query verbatim: order, repeated parameters, encoding, and even
      // an empty '?' can affect the response, so do not sort or re-encode them.
      parsed.hash = '';
      return `${prefix}${parsed.href}`;
    } catch {
      return `${prefix}${url}`;
    }
  }

  async get(url) {
    const key = this.normalizeUrl(url);

    try {
      // Try Redis first
      if (this.redisUrl) {
        await this.ensureRedis();
        if (this.redis) {
          const cached = await this.redis.get(key);
          if (cached) {
            this.hits++;
            return JSON.parse(cached);
          }
        }
      }

      // Fall back to in-memory
      const entry = this.cache.get(key);
      if (!entry) {
        this.misses++;
        return null;
      }

      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        this.timers.delete(key);
        this.misses++;
        return null;
      }

      this.hits++;
      return entry.report;
    } catch (e) {
      console.warn('[audit-cache] Get error:', e.message);
      this.misses++;
      return null;
    }
  }

  async set(url, report, ttlMs = this.ttlMs) {
    const key = this.normalizeUrl(url);
    const ttlSecs = Math.ceil(ttlMs / 1000);

    try {
      // Store in Redis (with fallback to memory)
      if (this.redisUrl) {
        await this.ensureRedis();
        if (this.redis) {
          await this.redis.setEx(key, ttlSecs, JSON.stringify(report));
          return;
        }
      }

      // Fall back to in-memory
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }

      const expiresAt = Date.now() + ttlMs;
      this.cache.set(key, { report, expiresAt });

      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttlMs);

      this.timers.set(key, timer);
    } catch (e) {
      console.warn('[audit-cache] Set error:', e.message);
    }
  }

  async clear() {
    try {
      if (this.redisUrl && this.redis) {
        await this.redis.flushDb();
      }
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.cache.clear();
      this.timers.clear();
      this.hits = 0;
      this.misses = 0;
    } catch (e) {
      console.warn('[audit-cache] Clear error:', e.message);
    }
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      backend: this.redisUrl ? 'redis' : 'memory',
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }
}

const globalCache = new AuditCache();

export { AuditCache, globalCache as auditCache };

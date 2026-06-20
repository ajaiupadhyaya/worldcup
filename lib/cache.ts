// Simple in-memory TTL cache for Phase 1.
// Swap for Redis (Upstash) in Phase 5 — the interface here is intentionally
// minimal so that migration is a drop-in.

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // epoch ms
}

// TTLs (in seconds) per the handoff caching strategy.
export const TTL = {
  LIVE: 60, // live match data
  STANDINGS: 5 * 60, // group standings
  FINISHED: 60 * 60, // finished match data
  SCHEDULED: 5 * 60, // upcoming fixtures
} as const;

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Fetch-through helper: returns cached value if present, otherwise runs the
   * loader, caches the result, and returns it. Tracks cache hits via the
   * returned `cached` flag.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<{ value: T; cached: boolean }> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return { value: hit, cached: true };
    const value = await loader();
    this.set(key, value, ttlSeconds);
    return { value, cached: false };
  }
}

// Module-level singleton. In Next.js dev with HMR the module may reload, but a
// global guard keeps a single instance across reloads.
const globalForCache = globalThis as unknown as { __wcCache?: MemoryCache };
export const cache = globalForCache.__wcCache ?? new MemoryCache();
if (!globalForCache.__wcCache) globalForCache.__wcCache = cache;

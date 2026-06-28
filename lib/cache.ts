// TTL cache with an optional Upstash Redis REST backend. Memory is always used
// as an L1 and remains the fallback when Redis credentials are absent or a
// remote command fails.

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

export function cacheBackendFromEnv(env: NodeJS.ProcessEnv): "redis" | "memory" {
  return env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? "redis" : "memory";
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisConfigured = cacheBackendFromEnv(process.env) === "redis";

async function redisCommand<T>(command: unknown[]): Promise<T | undefined> {
  if (!redisConfigured) return undefined;
  try {
    const res = await fetch(redisUrl!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { result?: T; error?: string };
    if (body.error) return undefined;
    return body.result;
  } catch {
    return undefined;
  }
}

class HybridCache {
  constructor(private readonly memory: MemoryCache) {}

  backend(): "redis" | "memory" {
    return redisConfigured ? "redis" : "memory";
  }

  async get<T>(key: string): Promise<T | undefined> {
    const hit = this.memory.get<T>(key);
    if (hit !== undefined) return hit;

    const raw = await redisCommand<string | null>(["GET", key]);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as { value: T; expiresAt?: number };
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) return undefined;
      return parsed.value;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.memory.set(key, value, ttlSeconds);
    const payload = JSON.stringify({
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    await redisCommand(["SET", key, payload, "EX", ttlSeconds]);
  }

  async delete(key: string): Promise<void> {
    this.memory.delete(key);
    await redisCommand(["DEL", key]);
  }

  async clear(): Promise<void> {
    this.memory.clear();
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async wrap<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<{ value: T; cached: boolean }> {
    const hit = await this.get<T>(key);
    if (hit !== undefined) return { value: hit, cached: true };
    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return { value, cached: false };
  }
}

// Module-level singleton. In Next.js dev with HMR the module may reload, but a
// global guard keeps a single instance across reloads.
const globalForCache = globalThis as unknown as {
  __wcMemoryCache?: MemoryCache;
  __wcCache?: HybridCache;
};

const memory = globalForCache.__wcMemoryCache ?? new MemoryCache();
if (!globalForCache.__wcMemoryCache) globalForCache.__wcMemoryCache = memory;

export const cache = globalForCache.__wcCache ?? new HybridCache(memory);
if (!globalForCache.__wcCache) globalForCache.__wcCache = cache;

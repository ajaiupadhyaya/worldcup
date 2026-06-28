import { describe, expect, it } from "vitest";
import { cache, cacheBackendFromEnv } from "./cache";

describe("cache", () => {
  it("selects memory when Upstash credentials are absent", () => {
    expect(cacheBackendFromEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe("memory");
    expect(cacheBackendFromEnv({ NODE_ENV: "test", UPSTASH_REDIS_REST_URL: "https://example.com" } as NodeJS.ProcessEnv)).toBe("memory");
    expect(cacheBackendFromEnv({ NODE_ENV: "test", UPSTASH_REDIS_REST_TOKEN: "token" } as NodeJS.ProcessEnv)).toBe("memory");
  });

  it("selects redis only when both Upstash credentials are present", () => {
    expect(cacheBackendFromEnv({
      NODE_ENV: "test",
      UPSTASH_REDIS_REST_URL: "https://example.com",
      UPSTASH_REDIS_REST_TOKEN: "token",
    } as NodeJS.ProcessEnv)).toBe("redis");
  });

  it("stores values through the memory fallback", async () => {
    const key = `test:cache:${Date.now()}`;
    await cache.set(key, { ok: true }, 2);
    await expect(cache.get<{ ok: boolean }>(key)).resolves.toEqual({ ok: true });
    await cache.delete(key);
    await expect(cache.get(key)).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { checkRateLimit, rateLimitResponse } from "./rateLimit";

describe("rate limiting", () => {
  it("blocks after the configured limit", async () => {
    const identity = `test-${Date.now()}-${Math.random()}`;
    await expect(checkRateLimit("unit", identity, 2, 60)).resolves.toEqual({ ok: true });
    await expect(checkRateLimit("unit", identity, 2, 60)).resolves.toEqual({ ok: true });
    const limited = await checkRateLimit("unit", identity, 2, 60);
    expect(limited.ok).toBe(false);
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("returns the public 429 payload shape", async () => {
    const res = rateLimitResponse(17);
    await expect(res.json()).resolves.toEqual({
      error: "Rate limit exceeded",
      retryAfterSeconds: 17,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("17");
  });
});

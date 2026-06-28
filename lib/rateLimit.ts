import { cache } from "./cache";

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "anonymous";
}

export async function checkRateLimit(
  name: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = `ratelimit:${name}:${identity}`;
  const existing = await cache.get<Bucket>(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + windowSeconds * 1000 };

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  await cache.set(key, bucket, Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
  return { ok: true };
}

export function rateLimitResponse(retryAfterSeconds = 60): Response {
  return Response.json(
    { error: "Rate limit exceeded", retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

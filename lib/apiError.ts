import { NextResponse } from "next/server";

// Log the real error (which can include upstream provider URLs / payloads)
// server-side, and return a generic message to the client so internal
// infrastructure and provider details never leak.
export function apiError(context: string, err: unknown, status = 502) {
  console.error(`[api] ${context}:`, err);
  return NextResponse.json(
    { error: "Upstream data temporarily unavailable" },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

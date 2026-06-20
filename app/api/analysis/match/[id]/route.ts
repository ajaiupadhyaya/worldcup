import { NextResponse } from "next/server";
import { getBreakdown } from "@/lib/analysis";
import { hasAnthropicKey } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST generates (or returns cached) post-match tactical breakdown.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }
  // `?force=1` bypasses the cache and forces a fresh (paid) Claude generation,
  // so it's gated behind a server-side admin token — public callers are
  // always cache-first, preventing unbounded generation abuse.
  const force =
    new URL(req.url).searchParams.get("force") === "1" &&
    Boolean(process.env.ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
  try {
    const analysis = await getBreakdown(id, force);
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

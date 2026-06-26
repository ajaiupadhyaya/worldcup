import { NextResponse } from "next/server";
import { getBreakdown } from "@/lib/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST generates (or returns cached) post-match tactical breakdown.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // `?force=1` bypasses the cache. Keep it admin-gated so public callers stay
  // cache-first even though the analysis engine is free.
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

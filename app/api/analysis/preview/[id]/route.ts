import { NextResponse } from "next/server";
import { getPreview } from "@/lib/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST generates (or returns cached) pre-match preview + prediction.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Admin-gated cache bypass (see analysis/match route) — public callers stay
  // cache-first.
  const force =
    new URL(req.url).searchParams.get("force") === "1" &&
    Boolean(process.env.ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
  try {
    const analysis = await getPreview(id, force);
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

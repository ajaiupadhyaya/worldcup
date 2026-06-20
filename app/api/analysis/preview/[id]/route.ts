import { NextResponse } from "next/server";
import { getPreview } from "@/lib/analysis";
import { hasAnthropicKey } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST generates (or returns cached) pre-match preview + prediction.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!hasAnthropicKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const analysis = await getPreview(id, force);
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

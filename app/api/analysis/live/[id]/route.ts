import { NextResponse } from "next/server";
import { getLive } from "@/lib/analysis";
import { checkRateLimit, clientKey, rateLimitResponse } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET returns the latest live tactical observation (regenerated every 15 min).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const limited = await checkRateLimit("analysis-live", clientKey(req), 30, 60);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSeconds);

  try {
    const analysis = await getLive(id);
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

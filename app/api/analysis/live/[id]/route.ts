import { NextResponse } from "next/server";
import { getLive } from "@/lib/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET returns the latest live tactical observation (regenerated every 15 min).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const analysis = await getLive(id);
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

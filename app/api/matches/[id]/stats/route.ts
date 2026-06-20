import { NextResponse } from "next/server";
import { getMatch } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const env = await getMatch(id);
    return NextResponse.json(
      { ...env, data: { stats: env.data.stats ?? null, score: env.data.score, status: env.data.status } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

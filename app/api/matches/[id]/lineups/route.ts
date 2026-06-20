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
      { ...env, data: { lineups: env.data.lineups ?? null } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

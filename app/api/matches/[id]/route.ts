import { NextResponse } from "next/server";
import { getMatch } from "@/lib/data";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// Next 15+: route params are async.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const env = await getMatch(id);
    return NextResponse.json(env, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError(`GET /api/matches/${id}`, err);
  }
}

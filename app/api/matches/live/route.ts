import { NextResponse } from "next/server";
import { getLiveMatches } from "@/lib/data";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = await getLiveMatches();
    return NextResponse.json(env, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError("GET /api/matches/live", err);
  }
}

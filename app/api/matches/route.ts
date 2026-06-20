import { NextResponse } from "next/server";
import { getMatches } from "@/lib/data";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = await getMatches();
    return NextResponse.json(env, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError("GET /api/matches", err);
  }
}

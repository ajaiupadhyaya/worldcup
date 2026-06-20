import { NextResponse } from "next/server";
import { getStandings } from "@/lib/data";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = await getStandings();
    return NextResponse.json(env, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError("GET /api/standings", err);
  }
}

import { NextResponse } from "next/server";
import { getMatches } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const env = await getMatches();
    return NextResponse.json(env, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // ?probe=1 actively pings API-Football (consumes quota); default is a cheap
  // probe that reports config + ESPN liveness only.
  const probe = new URL(req.url).searchParams.get("probe") === "1";
  const health = await checkHealth(probe);
  return NextResponse.json(
    { sources: health, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

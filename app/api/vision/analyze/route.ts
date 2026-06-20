import { NextResponse } from "next/server";
import { getMatch } from "@/lib/data";
import { matchContext } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CV_SERVICE_URL = process.env.CV_SERVICE_URL ?? "http://localhost:8000";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/**
 * POST multipart/form-data with an `image` file (and optional `matchId` for
 * context). Forwards the frame to the FastAPI CV service and returns its
 * structured tactical read.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data with an 'image' field" }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Missing 'image' file field" }, { status: 400 });
  }
  if (image.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image exceeds 8MB limit" }, { status: 413 });
  }
  if (!image.type || !ALLOWED_TYPES.has(image.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${image.type || "unknown"}` },
      { status: 415 },
    );
  }

  // Optionally enrich with match context so the CV read is grounded.
  let context: string | undefined;
  const matchId = form.get("matchId");
  if (typeof matchId === "string" && matchId) {
    try {
      const { data } = await getMatch(matchId);
      context = matchContext(data);
    } catch {
      // Context is best-effort; proceed without it.
    }
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  let cvRes: Response;
  try {
    cvRes = await fetch(`${CV_SERVICE_URL}/analyze-frame`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the shared secret when configured (CV service enforces it).
        ...(process.env.CV_SHARED_SECRET ? { "X-CV-Token": process.env.CV_SHARED_SECRET } : {}),
      },
      body: JSON.stringify({
        image_base64: imageBase64,
        media_type: image.type || undefined,
        match_context: context,
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    // Log internals server-side; don't leak the internal URL/error to clients.
    console.error("CV service unreachable", CV_SERVICE_URL, err);
    return NextResponse.json({ error: "Vision service unavailable" }, { status: 502 });
  }

  const payload = await cvRes.json().catch(() => ({ error: "CV service returned non-JSON" }));
  if (!cvRes.ok) {
    return NextResponse.json(
      { error: payload?.detail ?? payload?.error ?? "CV analysis failed" },
      { status: cvRes.status },
    );
  }
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

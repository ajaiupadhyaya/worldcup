import { NextResponse } from "next/server";
import { getMatch } from "@/lib/data";
import { matchContext } from "@/lib/claude";
import { analyzeFrame, hasAnthropicKey } from "@/lib/vision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

// Optional external FastAPI CV service. When CV_SERVICE_URL is set, the frame
// is forwarded there; otherwise it's analyzed in-process via Claude vision
// (the default production path on Vercel).
const CV_SERVICE_URL = process.env.CV_SERVICE_URL;

/**
 * POST multipart/form-data with an `image` file (and optional `matchId` for
 * context). Returns a structured tactical read of the frame.
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
  if (!CV_SERVICE_URL && !hasAnthropicKey()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  // Optionally enrich with match context so the read is grounded.
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

  // External service path (only when explicitly configured).
  if (CV_SERVICE_URL) {
    try {
      const cvRes = await fetch(`${CV_SERVICE_URL}/analyze-frame`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CV_SHARED_SECRET ? { "X-CV-Token": process.env.CV_SHARED_SECRET } : {}),
        },
        body: JSON.stringify({ image_base64: imageBase64, media_type: image.type, match_context: context }),
        signal: AbortSignal.timeout(55_000),
      });
      const payload = await cvRes.json().catch(() => ({ error: "CV service returned non-JSON" }));
      if (!cvRes.ok) {
        return NextResponse.json(
          { error: payload?.detail ?? payload?.error ?? "CV analysis failed" },
          { status: cvRes.status },
        );
      }
      return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      console.error("CV service unreachable", err);
      return NextResponse.json({ error: "Vision service unavailable" }, { status: 502 });
    }
  }

  // In-process path: call Claude vision directly.
  try {
    const result = await analyzeFrame(imageBase64, image.type as MediaType, context);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("vision analyze failed", err);
    const message = (err as Error).message;
    const status = message.includes("declined") ? 422 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

import { askStream, hasAnthropicKey } from "@/lib/claude";
import { matchForQA } from "@/lib/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { matchId, question } → streams Claude's answer as text/plain chunks.
export async function POST(req: Request) {
  if (!hasAnthropicKey()) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { matchId?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }
  const { matchId, question } = body;
  if (!matchId || !question) {
    return new Response(JSON.stringify({ error: "matchId and question are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let match;
  try {
    match = await matchForQA(matchId);
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 400 });
  }

  // Stream Claude's text deltas straight to the client.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = askStream(match, question);
        claudeStream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        await claudeStream.finalMessage();
      } catch (err) {
        controller.enqueue(encoder.encode(`\n[error: ${(err as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

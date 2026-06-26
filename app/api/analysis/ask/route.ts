import { matchForQA } from "@/lib/analysis";
import { answerMatchQuestion } from "@/lib/free-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST { matchId, question } -> streams a free deterministic analyst answer.
export async function POST(req: Request) {
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

  const answer = answerMatchQuestion(match, question);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(answer));
      controller.close();
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

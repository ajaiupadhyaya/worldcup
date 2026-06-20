"use client";

import { useRef, useState } from "react";

// Ask Claude anything about this match. Streams the answer token-by-token from
// /api/analysis/ask.
export function MatchQA({ matchId }: { matchId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = ["What's the key tactical battle?", "Why is one side on top?", "What should the trailing side change?"];

  async function ask(q: string) {
    if (!q.trim() || streaming) return;
    setStreaming(true);
    setAnswer("");
    setError(null);
    try {
      const res = await fetch("/api/analysis/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, question: q }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setError(
          res.status === 503
            ? "Q&A needs an ANTHROPIC_API_KEY in .env.local."
            : j.error || "Could not reach Claude.",
        );
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-lg text-text">Ask the analyst</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this match…"
          className="flex-1 rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-home focus:outline-none"
        />
        <button
          type="submit"
          disabled={streaming || !question.trim()}
          className="rounded-[var(--radius-card)] border border-home px-4 py-2 font-mono text-xs uppercase tracking-widest text-home transition-colors hover:bg-home hover:text-bg disabled:opacity-40"
        >
          {streaming ? "…" : "Ask"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((sug) => (
          <button
            key={sug}
            onClick={() => {
              setQuestion(sug);
              ask(sug);
            }}
            disabled={streaming}
            className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted hover:border-home hover:text-text disabled:opacity-40"
          >
            {sug}
          </button>
        ))}
      </div>

      {(answer || error) && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
          {error ? (
            <p className="font-mono text-xs text-danger/90">{error}</p>
          ) : (
            <p className="max-w-[64ch] whitespace-pre-wrap text-[15px] leading-relaxed text-text/90">
              {answer}
              {streaming && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-home align-middle" />}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

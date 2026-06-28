"use client";

import { useRef, useState } from "react";

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
            ? "The free analyst engine is unavailable."
            : j.error || "Could not answer the question.",
        );
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          full += decoder.decode();
          break;
        }
        full += decoder.decode(value, { stream: true });
        setAnswer(full);
      }
      const sentinel = full.match(/\n?\[error: ([^\]]*)\]\s*$/);
      if (sentinel) {
        setAnswer(full.slice(0, sentinel.index).trim());
        setError(sentinel[1] || "The analyst engine could not finish the answer.");
      } else {
        setAnswer(full);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="border border-[var(--border)] p-5">
      <h2 className="mb-4 font-heading text-2xl font-semibold text-[var(--foreground)]">Ask the analyst</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="grid gap-2 sm:grid-cols-[1fr_auto]"
      >
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about this match…"
          className="min-w-0 border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:border-[var(--border-strong)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={streaming || !question.trim()}
          className="border border-[var(--border-strong)] bg-[var(--foreground)] px-4 py-2 text-[10px] tracking-[2px] text-[var(--foreground-inverse)] disabled:opacity-40"
        >
          {streaming ? "…" : "ASK"}
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
            className="border border-[var(--border)] px-2.5 py-1 text-[10px] text-[var(--foreground-secondary)] hover:border-[var(--border-strong)] disabled:opacity-40"
          >
            {sug}
          </button>
        ))}
      </div>

      {(answer || error) && (
        <div className="mt-4 border border-[var(--border)] bg-[var(--row-alt)] p-4">
          {error ? (
            <p className="text-xs text-[var(--foreground-accent)]">{error}</p>
          ) : (
            <p className="max-w-[64ch] whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--foreground)]">
              {answer}
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-[var(--foreground-accent)] align-middle" />
              )}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

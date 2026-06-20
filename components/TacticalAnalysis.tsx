"use client";

import { useState } from "react";
import type { Match } from "@/lib/types";

interface AnalysisResult {
  text: string;
  model: string;
  generatedAt: string;
}

// Claude tactical breakdown. Picks the right endpoint for the match state:
// finished -> post-match breakdown, live -> live read, scheduled -> preview.
export function TacticalAnalysis({ match }: { match: Match }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cta =
    match.status === "finished"
      ? "Generate post-match breakdown"
      : match.status === "live"
        ? "Read the live tactical picture"
        : "Generate match preview";

  async function run() {
    setLoading(true);
    setError(null);
    const route =
      match.status === "finished"
        ? { url: `/api/analysis/match/${match.id}`, method: "POST" }
        : match.status === "live"
          ? { url: `/api/analysis/live/${match.id}`, method: "GET" }
          : { url: `/api/analysis/preview/${match.id}`, method: "POST" };
    try {
      const res = await fetch(route.url, { method: route.method });
      const json = await res.json();
      if (!res.ok) {
        const staleState = res.status === 400 && /only available for/i.test(json.error ?? "");
        setError(
          res.status === 503
            ? "Claude analysis needs an ANTHROPIC_API_KEY. Add one to .env.local to enable tactical breakdowns."
            : staleState
              ? "The match state just changed — refresh and try again."
              : json.error || "Analysis failed.",
        );
      } else {
        setResult(json);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <ChalkBadge />
        <h2 className="font-display text-lg text-text">Tactical read</h2>
        {result && (
          <span className="ml-auto font-mono text-[10px] text-muted">{result.model}</span>
        )}
      </div>

      {result ? (
        <article className="max-w-[64ch] whitespace-pre-wrap font-[family-name:var(--font-body)] text-[15px] leading-relaxed text-text/90">
          {result.text}
        </article>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border p-5">
          <p className="mb-3 max-w-prose text-sm text-muted">
            A UEFA-Pro-License read of this match — the key tactical battle, why the
            result is unfolding the way it is, and the decisive calls — written by Claude
            from the live data.
          </p>
          <button
            onClick={run}
            disabled={loading}
            className="rounded-[var(--radius-card)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "drawing…" : cta}
          </button>
          {error && <p className="mt-3 font-mono text-xs text-danger/90">{error}</p>}
        </div>
      )}
    </section>
  );
}

function ChalkBadge() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="7" fill="none" stroke="var(--home)" strokeWidth="1.4" />
      <path d="M6 10 L14 10 M11 7 L14 10 L11 13" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

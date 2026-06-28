"use client";

import { useState } from "react";
import type { Match } from "@/lib/types";

interface AnalysisResult {
  text: string;
  model: string;
  generatedAt: string;
}

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

  const pullQuote =
    match.status === "live"
      ? `${match.homeTeam.shortName.toUpperCase()}\nDICTATES\nTHE TEMPO.`
      : "THE TACTICAL\nREAD AWAITS.";

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
            ? "The free analysis service is unavailable. Refresh and try again."
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
    <section className="mx-auto grid max-w-[1440px] gap-8 px-6 py-10 sm:grid-cols-2 sm:px-12">
      <h2 className="whitespace-pre-line font-heading text-[clamp(40px,6vw,72px)] font-bold leading-[0.92] tracking-[-0.02em] text-[var(--foreground)]">
        {pullQuote}
      </h2>
      <div>
        {result ? (
          <>
            <article className="whitespace-pre-wrap text-[13px] leading-[1.9] text-[var(--foreground-secondary)]">
              {result.text}
            </article>
            <p className="mt-4 text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">{result.model}</p>
          </>
        ) : (
          <>
            <p className="mb-4 text-[13px] leading-[1.9] text-[var(--foreground-secondary)]">
              A UEFA-Pro-License read of this match — the key tactical battle, why the result is
              unfolding the way it is, and the decisive calls — generated from free/open match data.
            </p>
            <button
              onClick={run}
              disabled={loading}
              className="border border-[var(--border-strong)] bg-[var(--foreground)] px-4 py-2 text-[10px] tracking-[2px] text-[var(--foreground-inverse)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "GENERATING…" : cta.toUpperCase()}
            </button>
            {error && <p className="mt-3 text-xs text-[var(--foreground-accent)]">{error}</p>}
          </>
        )}
      </div>
    </section>
  );
}

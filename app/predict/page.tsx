import type { ReactNode } from "react";
import Link from "next/link";
import { predictions, ratings, calibration } from "@/lib/predictions";
import { WinCupLeaderboard } from "@/components/predict/WinCupLeaderboard";
import { SurvivalFunnel } from "@/components/predict/SurvivalFunnel";
import { RatingsTable } from "@/components/predict/RatingsTable";
import { CalibrationPanel } from "@/components/predict/CalibrationPanel";
import { formatProb } from "@/lib/probability";

export const metadata = { title: "Predict — World Cup MMXXVI" };

function Section({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="mx-auto mb-12 max-w-[1440px] px-6 sm:px-12">
      <div className="section-rule mb-6 pt-6">
        <div className="flex flex-wrap items-baseline gap-4">
          <h2 className="font-heading text-3xl font-bold italic text-[var(--foreground)]">{title}</h2>
          <span className="text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">{kicker.toUpperCase()}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function PredictPage() {
  const p = predictions;
  const wcIds = new Set(p.teams.map((t) => t.id));
  const wcRatings = ratings.teams.filter((t) => wcIds.has(t.id));

  return (
    <div className="pb-12">
      <section className="overflow-hidden px-6 pt-8 sm:px-12">
        <h1 className="headline-bleed text-[clamp(80px,14vw,180px)] text-[var(--foreground)]">PREDICT</h1>
        <p className="mt-4 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
          DIXON-COLES · ELO · MONTE-CARLO
        </p>
      </section>

      <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
        <ModelTrustPanel
          generatedAt={p.generatedAt}
          simCount={p.simCount}
          thirdsTableComplete={p.thirdsTableComplete !== false}
          brier={calibration.brier}
          logloss={calibration.logloss}
        />
      </div>

      <Section kicker="who lifts the trophy" title="Win the Cup">
        <WinCupLeaderboard teams={p.teams} />
      </Section>

      <Section kicker="probability of reaching each round" title="The Bracket">
        <SurvivalFunnel teams={p.teams} />
        <Link
          href="/bracket"
          className="mt-6 inline-flex items-center gap-2 text-[11px] tracking-[3px] text-[var(--foreground-accent)] transition-opacity hover:opacity-70"
        >
          VIEW THE FULL DRAW
          <span aria-hidden>→</span>
        </Link>
      </Section>

      <Section kicker="elo + attack / defense strength" title="Ratings">
        <RatingsTable teams={wcRatings} />
      </Section>

      <Section kicker="how well-calibrated is the model" title="The Model">
        <CalibrationPanel
          cal={calibration}
          meta={{ generatedAt: p.generatedAt, simCount: p.simCount, seed: p.seed, modelVersion: p.modelVersion }}
        />
      </Section>
    </div>
  );
}

function ModelTrustPanel({
  generatedAt,
  simCount,
  thirdsTableComplete,
  brier,
  logloss,
}: {
  generatedAt: string;
  simCount: number;
  thirdsTableComplete: boolean;
  brier: number;
  logloss: number;
}) {
  const generated = new Date(generatedAt);
  const generatedLabel = Number.isFinite(generated.getTime()) ? generated.toUTCString() : "unknown";
  return (
    <section className="mb-10 grid gap-3 border border-[var(--border)] p-4 sm:grid-cols-4">
      <TrustStat label="Snapshot" value={generatedLabel} />
      <TrustStat label="Simulations" value={simCount.toLocaleString()} />
      <TrustStat label="Brier / Log loss" value={`${brier.toFixed(3)} / ${logloss.toFixed(3)}`} />
      <div
        className={`border px-3 py-2 text-[10px] tracking-[2px] ${
          thirdsTableComplete
            ? "border-[var(--foreground)] text-[var(--foreground)]"
            : "border-[var(--foreground-accent)] text-[var(--foreground-accent)]"
        }`}
      >
        <div className="text-[9px] text-[var(--foreground-secondary)]">BRACKET INTEGRITY</div>
        <div className="mt-1">{thirdsTableComplete ? "Annex C covered" : "Annex C fallback active"}</div>
      </div>
      <p className="text-[13px] leading-[1.9] text-[var(--foreground-secondary)] sm:col-span-4">
        Team percentages include Monte Carlo uncertainty; the current leader is still only{" "}
        {formatProb(Math.max(...predictions.teams.map((t) => t.winCup)))} to win.
      </p>
    </section>
  );
}

function TrustStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] px-3 py-2">
      <div className="text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">{label.toUpperCase()}</div>
      <div className="mt-1 text-sm tabular-nums text-[var(--foreground)]">{value}</div>
    </div>
  );
}

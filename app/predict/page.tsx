import type { ReactNode } from "react";
import { predictions, ratings, calibration } from "@/lib/predictions";
import { WinCupLeaderboard } from "@/components/predict/WinCupLeaderboard";
import { SurvivalFunnel } from "@/components/predict/SurvivalFunnel";
import { RatingsTable } from "@/components/predict/RatingsTable";
import { CalibrationPanel } from "@/components/predict/CalibrationPanel";
import { formatProb } from "@/lib/probability";

export const metadata = { title: "Predict — Floodlit" };

function Section({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10 border-l border-border pl-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-3xl leading-none text-text">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

export default function PredictPage() {
  const p = predictions;
  // The ratings snapshot carries every historically-fitted nation (~330);
  // on a World Cup page only the 48 participants are meaningful.
  const wcIds = new Set(p.teams.map((t) => t.id));
  const wcRatings = ratings.teams.filter((t) => wcIds.has(t.id));
  return (
    <div className="mx-auto max-w-7xl px-4 py-7">
      <div className="mb-7 flex flex-wrap items-baseline gap-3 border-l border-border pl-4">
        <h1 className="font-display text-5xl leading-none text-text">Predict</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          dixon-coles · elo · monte-carlo
        </span>
      </div>

      <ModelTrustPanel
        generatedAt={p.generatedAt}
        simCount={p.simCount}
        thirdsTableComplete={p.thirdsTableComplete !== false}
        brier={calibration.brier}
        logloss={calibration.logloss}
      />

      <Section kicker="who lifts the trophy" title="Win the Cup">
        <WinCupLeaderboard teams={p.teams} />
      </Section>

      <Section kicker="probability of reaching each round" title="The Bracket">
        <SurvivalFunnel teams={p.teams} />
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
    <section className="art-panel mb-8 grid gap-3 p-4 sm:grid-cols-4">
      <TrustStat label="Snapshot" value={generatedLabel} />
      <TrustStat label="Simulations" value={simCount.toLocaleString()} />
      <TrustStat label="Brier / Log loss" value={`${brier.toFixed(3)} / ${logloss.toFixed(3)}`} />
      <div className={`border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] ${
        thirdsTableComplete ? "border-home/50 text-home" : "border-danger/60 text-danger"
      }`}>
        <div className="text-[9px] text-muted">Bracket integrity</div>
        <div className="mt-1">{thirdsTableComplete ? "Annex C covered" : "Annex C fallback active"}</div>
      </div>
      <p className="sm:col-span-4 text-[12px] leading-relaxed text-muted">
        Team percentages include Monte Carlo uncertainty; the current leader is still
        only {formatProb(Math.max(...predictions.teams.map((t) => t.winCup)))} to win.
      </p>
    </section>
  );
}

function TrustStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums text-text">{value}</div>
    </div>
  );
}

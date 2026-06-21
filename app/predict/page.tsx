import type { ReactNode } from "react";
import { predictions, ratings, calibration } from "@/lib/predictions";
import { WinCupLeaderboard } from "@/components/predict/WinCupLeaderboard";
import { SurvivalFunnel } from "@/components/predict/SurvivalFunnel";
import { RatingsTable } from "@/components/predict/RatingsTable";
import { CalibrationPanel } from "@/components/predict/CalibrationPanel";

export const metadata = { title: "Predict — Floodlit" };

function Section({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-2xl text-text">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

export default function PredictPage() {
  const p = predictions;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="font-display text-3xl text-text">Predict</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          dixon-coles · elo · monte-carlo
        </span>
      </div>

      <Section kicker="who lifts the trophy" title="Win the Cup">
        <WinCupLeaderboard teams={p.teams} />
      </Section>

      <Section kicker="probability of reaching each round" title="The Bracket">
        <SurvivalFunnel teams={p.teams} />
      </Section>

      <Section kicker="elo + attack / defense strength" title="Ratings">
        <RatingsTable teams={ratings.teams} />
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

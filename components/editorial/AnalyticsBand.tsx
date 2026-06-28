import type { Match } from "@/lib/types";
import { computeTournamentStats } from "@/lib/tournamentStats";
import { predictions } from "@/lib/predictions";
import { formatProb } from "@/lib/probability";
import { calibration } from "@/lib/predictions";

export function AnalyticsBand({ matches }: { matches: Match[] }) {
  const stats = computeTournamentStats(matches);
  const topQualify = Math.max(...predictions.teams.map((t) => t.qualify));

  const cells = [
    { value: stats.avgXg, label: "AVG xG", accent: false },
    { value: String(stats.goals), label: "TOTAL GOALS", accent: false },
    { value: formatProb(topQualify), label: "TOP QUALIFY", accent: true },
    { value: calibration.brier.toFixed(2), label: "BRIER SCORE", accent: false },
  ];

  return (
    <section className="bg-[var(--surface-dark)]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 sm:grid-cols-4">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`flex flex-col items-start justify-center px-6 py-10 sm:px-12 ${
              i > 0 ? "border-l border-[var(--border-dark)]" : ""
            }`}
          >
            <span
              className={`stat-large text-[clamp(40px,6vw,72px)] leading-none ${
                cell.accent ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-inverse)]"
              }`}
            >
              {cell.value}
            </span>
            <span className="mt-3 text-[9px] tracking-[3px] text-[var(--foreground-secondary)]">{cell.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

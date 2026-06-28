import type { Match } from "@/lib/types";
import { computeTournamentStats } from "@/lib/tournamentStats";

export function StatTrio({ matches }: { matches: Match[] }) {
  const stats = computeTournamentStats(matches);

  const cells = [
    { value: String(stats.goals), label: "GOALS SCORED" },
    { value: String(stats.matchesPlayed), label: "MATCHES PLAYED" },
    { value: stats.avgXg, label: "AVG xG PER MATCH" },
  ];

  return (
    <section className="border-y border-[var(--border-strong)]">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 sm:grid-cols-3">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`flex flex-col items-center justify-center py-10 ${
              i > 0 ? "border-t border-[var(--border-strong)] sm:border-l sm:border-t-0" : ""
            }`}
          >
            <span className="stat-large text-[clamp(48px,8vw,80px)] leading-none text-[var(--foreground)]">
              {cell.value}
            </span>
            <span className="mt-3 text-[9px] tracking-[3px] text-[var(--foreground-secondary)]">
              {cell.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

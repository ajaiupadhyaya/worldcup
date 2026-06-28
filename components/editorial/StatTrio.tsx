"use client";

import type { Match } from "@/lib/types";
import { computeTournamentStats } from "@/lib/tournamentStats";
import { CountUp } from "./CountUp";

export function StatTrio({ matches }: { matches: Match[] }) {
  const stats = computeTournamentStats(matches);

  const cells = [
    { fig: "I", value: stats.goals, label: "Goals scored", numeric: true, decimals: 0 },
    { fig: "II", value: stats.matchesPlayed, label: "Matches played", numeric: true, decimals: 0 },
    {
      fig: "III",
      value: stats.avgXg,
      label: "Avg xG / match",
      numeric: stats.avgXg !== "—",
      decimals: 2,
    },
  ];

  return (
    <section className="border-y border-[var(--border-strong)] bg-[var(--paper-pure)]">
      <div className="mx-auto grid max-w-[1480px] grid-cols-1 sm:grid-cols-3">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`group relative flex flex-col items-center justify-center px-6 py-12 ${
              i > 0 ? "border-t border-[var(--border)] sm:border-l sm:border-t-0" : ""
            }`}
          >
            <span className="absolute left-4 top-4 text-[9px] tracking-[0.3em] text-[var(--foreground-faint)]">
              {cell.fig}
            </span>
            <span className="stat-large misreg text-[clamp(56px,9vw,104px)] leading-none text-[var(--foreground)]">
              {cell.numeric && typeof cell.value === "number" ? (
                <CountUp value={cell.value} decimals={cell.decimals} />
              ) : (
                String(cell.value)
              )}
            </span>
            <span className="mt-4 text-[9px] tracking-[0.3em] text-[var(--foreground-secondary)]">
              {cell.label.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

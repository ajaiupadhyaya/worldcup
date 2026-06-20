"use client";

import { useStandings, groupStandings } from "@/lib/hooks";
import { StandingsTable } from "@/components/StandingsTable";

export default function StandingsPage() {
  const { data, isLoading, error } = useStandings();
  const groups = data ? groupStandings(data.data) : {};

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-baseline gap-3">
        <h1 className="font-display text-3xl text-text">Groups</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          top two advance
        </span>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger/90">Couldn&apos;t load standings: {(error as Error).message}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([group, rows]) => (
          <StandingsTable key={group} group={group} rows={rows} />
        ))}
      </div>
    </div>
  );
}

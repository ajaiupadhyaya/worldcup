"use client";

import { groupStandings, useStandings } from "@/lib/hooks";
import { StandingsTable } from "@/components/StandingsTable";

export function StandingsGrid({ projected }: { projected: Record<string, number> }) {
  const { data, isLoading, error } = useStandings();
  const groups = data ? groupStandings(data.data) : {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-7">
      <div className="mb-6 flex flex-wrap items-baseline gap-3 border-l border-border pl-4">
        <h1 className="font-display text-5xl leading-none text-text">Groups</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          top two advance · Q% = model qualify odds
        </span>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="art-panel h-44 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger/90">Couldn&apos;t load standings: {(error as Error).message}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([group, rows]) => (
          <StandingsTable key={group} group={group} rows={rows} projected={projected} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { groupStandings, useMatches, useStandings } from "@/lib/hooks";
import { hydrateStandingTeams } from "@/lib/tournament";
import { StandingsTable } from "@/components/StandingsTable";
import { FormGuide } from "@/components/editorial/FormGuide";
import { AnalyticsBand } from "@/components/editorial/AnalyticsBand";
import { EditorialPull } from "@/components/editorial/EditorialPull";

export function StandingsGrid({ projected }: { projected: Record<string, number> }) {
  const { data, isLoading, error } = useStandings();
  const { data: matchesEnv } = useMatches();
  const matches = matchesEnv?.data ?? [];
  const standings = data ? hydrateStandingTeams(data.data, matches) : [];
  const groups = groupStandings(standings);
  const groupEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <section className="overflow-hidden px-6 pt-8 sm:px-12">
        <h1 className="headline-bleed text-[clamp(100px,18vw,240px)] text-[var(--foreground)]">GROUPES</h1>
      </section>

      <div className="mx-auto max-w-[1440px] px-6 sm:px-12">
        <div className="border-t border-[var(--border-strong)] pt-6">
          <p className="section-label">GROUP STAGE — JUNE 2026</p>
        </div>
      </div>

      {isLoading && (
        <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-8 sm:grid-cols-2 sm:px-12">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse bg-[var(--row-alt)]" />
          ))}
        </div>
      )}

      {error && (
        <p className="mx-auto max-w-[1440px] px-6 py-8 text-sm text-[var(--foreground-accent)] sm:px-12">
          Couldn&apos;t load standings: {(error as Error).message}
        </p>
      )}

      <div className="mx-auto grid max-w-[1440px] gap-x-12 gap-y-10 px-6 py-8 sm:grid-cols-2 sm:px-12">
        {groupEntries.map(([group, rows]) => (
          <StandingsTable key={group} group={group} rows={rows} projected={projected} />
        ))}
      </div>

      <EditorialPull
        dark
        quote={"THE MODEL SPEAKS\nIN PROBABILITIES,\nNOT PROMISES."}
        note="Monte Carlo simulations run daily across all group-stage permutations. Qualification percentages reflect current standings, remaining fixtures, and Elo-adjusted xG projections."
      />

      <FormGuide standings={standings} />
      <AnalyticsBand matches={matches} />
    </div>
  );
}

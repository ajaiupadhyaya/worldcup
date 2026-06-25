"use client";

import { useMatches, useStandings, groupStandings } from "@/lib/hooks";
import { byInterest, groupByDay } from "@/lib/format";
import { qualificationByTeam, qualificationGeneratedAt } from "@/lib/qualification";
import { hydrateStandingTeams } from "@/lib/tournament";
import { FeaturedMatch } from "@/components/FeaturedMatch";
import { MatchRow } from "@/components/MatchRow";
import { StandingsTable } from "@/components/StandingsTable";
import { PitchDivider } from "@/components/PitchDivider";
import { TournamentPulse } from "@/components/TournamentPulse";

export default function Home() {
  const { data: matchesEnv, isLoading: loadingMatches, error: matchesError } = useMatches();
  const { data: standingsEnv, error: standingsError } = useStandings();

  const matches = (matchesEnv?.data ?? []).slice().sort(byInterest);
  const featured =
    matches.find((m) => m.status === "live") ??
    matches.find((m) => m.status === "scheduled") ??
    matches[0];
  const rest = matches.filter((m) => m.id !== featured?.id);
  const days = groupByDay(rest);
  const standings = standingsEnv ? hydrateStandingTeams(standingsEnv.data, matches) : [];
  const groups = groupStandings(standings);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <TournamentPulse
        matches={matches}
        standings={standings}
        projected={qualificationByTeam}
        modelGeneratedAt={qualificationGeneratedAt}
      />

      {/* HERO — the featured match as a broadcast frame */}
      {loadingMatches && !featured ? (
        <div className="h-48 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />
      ) : matchesError ? (
        <div className="rounded-[var(--radius-card)] border border-danger/40 bg-surface p-5 text-sm text-danger/90">
          Couldn&apos;t load fixtures: {(matchesError as Error).message}
        </div>
      ) : featured ? (
        <FeaturedMatch summary={featured} />
      ) : (
        <p className="text-muted">No fixtures on the board right now.</p>
      )}

      {/* FIXTURES */}
      {days.length > 0 && (
        <>
          <PitchDivider label="On the board" />
          <div className="space-y-6">
            {days.map((d) => (
              <section key={d.iso}>
                <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">{d.day}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {d.matches.map((m) => (
                    <MatchRow key={m.id} match={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {/* GROUPS */}
      {(Object.keys(groups).length > 0 || standingsError) && (
        <>
          <PitchDivider label="Groups" />
          {standingsError ? (
            <p className="text-sm text-muted">Standings are unavailable right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(groups).map(([group, rows]) => (
                <StandingsTable key={group} group={group} rows={rows} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

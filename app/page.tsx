"use client";

import { useMatches, useStandings, groupStandings } from "@/lib/hooks";
import { byInterest, groupByDay } from "@/lib/format";
import { qualificationByTeam, qualificationGeneratedAt } from "@/lib/qualification";
import { hydrateStandingTeams } from "@/lib/tournament";
import { predictions } from "@/lib/predictions";
import { FeaturedMatch } from "@/components/FeaturedMatch";
import { MatchRow } from "@/components/MatchRow";
import { TickerBar } from "@/components/TickerBar";
import { TournamentPulse } from "@/components/TournamentPulse";
import { HomeMasthead } from "@/components/editorial/HomeMasthead";
import { StatTrio } from "@/components/editorial/StatTrio";
import { QualificationBars } from "@/components/editorial/QualificationBars";
import { EditorialPull } from "@/components/editorial/EditorialPull";

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

  const topTeams = [...predictions.teams]
    .sort((a, b) => b.qualify - a.qualify)
    .slice(0, 6)
    .map((t, i) => ({ name: t.name, rank: i + 1 }));

  return (
    <div>
      <HomeMasthead />

      {loadingMatches && !featured ? (
        <div className="h-80 animate-pulse bg-[var(--surface-featured)]" />
      ) : matchesError ? (
        <div className="mx-auto max-w-[1440px] px-6 py-8 text-sm text-[var(--foreground-accent)] sm:px-12">
          Couldn&apos;t load fixtures: {(matchesError as Error).message}
        </div>
      ) : featured ? (
        <FeaturedMatch summary={featured} />
      ) : (
        <p className="px-6 py-8 text-[var(--foreground-secondary)] sm:px-12">No fixtures on the board right now.</p>
      )}

      <TickerBar />
      <StatTrio matches={matches} />

      {days.length > 0 && (
        <section id="fixtures" className="mx-auto max-w-[1440px] px-0 py-8">
          <div className="section-rule mx-6 mb-6 pt-6 sm:mx-12">
            <div className="flex items-baseline justify-between">
              <h2 className="section-label">ON THE BOARD</h2>
              {days[0] && (
                <span className="text-[11px] tracking-[2px] text-[var(--foreground-secondary)]">
                  {days[0].day.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div>
            {days.flatMap((d) =>
              d.matches.map((m, i) => <MatchRow key={m.id} match={m} index={i} />),
            )}
          </div>
        </section>
      )}

      <QualificationBars teams={topTeams} projected={qualificationByTeam} />

      {standings.length > 0 && (
        <TournamentPulse
          matches={matches}
          standings={standings}
          projected={qualificationByTeam}
          modelGeneratedAt={qualificationGeneratedAt}
        />
      )}

      {standingsError && (
        <p className="mx-auto max-w-[1440px] px-6 py-4 text-sm text-[var(--foreground-secondary)] sm:px-12">
          Standings are unavailable right now.
        </p>
      )}

      <EditorialPull
        quote={"DATA IS THE\nNEW UNIFORM."}
        note="Probabilities computed from Expected Goals (xG), recent form, head-to-head history, and Elo ratings. Model updated after every match."
      />
    </div>
  );
}

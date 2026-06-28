"use client";

import { useMatches, useStandings } from "@/lib/hooks";
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
import { Reveal } from "@/components/editorial/Reveal";

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
        <section id="fixtures" className="mx-auto max-w-[1480px] scroll-mt-20 px-0 py-12">
          <div className="section-rule mx-6 mb-2 flex items-baseline justify-between pt-5 sm:mx-12 lg:mx-20">
            <h2 className="section-label">The Fixtures — On the Board</h2>
            {days[0] && (
              <span className="text-[10px] tracking-[0.2em] text-[var(--foreground-secondary)]">
                {days[0].day.toUpperCase()}
              </span>
            )}
          </div>
          <Reveal>
            {days.flatMap((d) =>
              d.matches.map((m, i) => <MatchRow key={m.id} match={m} index={i} />),
            )}
          </Reveal>
        </section>
      )}

      <Reveal>
        <QualificationBars teams={topTeams} projected={qualificationByTeam} />
      </Reveal>

      {standings.length > 0 && (
        <Reveal>
          <TournamentPulse
            matches={matches}
            standings={standings}
            projected={qualificationByTeam}
            modelGeneratedAt={qualificationGeneratedAt}
          />
        </Reveal>
      )}

      {standingsError && (
        <p className="mx-auto max-w-[1480px] px-6 py-4 text-sm text-[var(--foreground-secondary)] sm:px-12">
          Standings are unavailable right now.
        </p>
      )}

      <EditorialPull
        dark
        quote={"DATA IS THE\nNEW UNIFORM."}
        note="Probabilities computed from Expected Goals (xG), recent form, head-to-head history, and Elo ratings. The model is updated after every match."
      />
    </div>
  );
}

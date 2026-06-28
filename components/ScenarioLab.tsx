"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Match, Standing } from "@/lib/types";
import { useMatches, useStandings } from "@/lib/hooks";
import {
  buildThirdPlaceTable,
  groupNameForMatch,
  groupRows,
  hydrateStandingTeams,
  projectGroupTableForResults,
  qualificationOutlook,
  type ScenarioOutcome,
  type ThirdPlaceEntry,
} from "@/lib/tournament";
import { qualificationByTeam, qualificationForTeam, qualificationGeneratedAt } from "@/lib/qualification";
import { formatProb } from "@/lib/probability";
import { byInterest, kickoffDay, kickoffTime } from "@/lib/format";
import { Flag } from "./Flag";

const OUTCOMES: { key: ScenarioOutcome; label: string }[] = [
  { key: "home", label: "Home win" },
  { key: "draw", label: "Draw" },
  { key: "away", label: "Away win" },
];

export function ScenarioLab() {
  const { data: matchesEnv, isLoading: loadingMatches, error: matchesError } = useMatches();
  const { data: standingsEnv, isLoading: loadingStandings, error: standingsError } = useStandings();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, ScenarioOutcome>>({});

  const matches = useMemo(() => (matchesEnv?.data ?? []).slice().sort(byInterest), [matchesEnv]);
  const standings = useMemo(
    () => hydrateStandingTeams(standingsEnv?.data ?? [], matches),
    [standingsEnv, matches],
  );
  const rowsByGroup = useMemo(() => groupRows(standings), [standings]);

  const openByGroup = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    for (const match of matches.filter((m) => m.status !== "finished")) {
      const group = groupNameForMatch(match, rowsByGroup);
      if (!group) continue;
      (grouped[group] ??= []).push(match);
    }
    for (const groupMatches of Object.values(grouped)) {
      groupMatches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    }
    return grouped;
  }, [matches, rowsByGroup]);

  const groupOptions = useMemo(
    () =>
      Object.entries(openByGroup)
        .map(([group, groupMatches]) => ({
          group,
          matches: groupMatches,
          nextKickoff: groupMatches[0]?.kickoff ?? "",
        }))
        .sort((a, b) => a.nextKickoff.localeCompare(b.nextKickoff) || a.group.localeCompare(b.group)),
    [openByGroup],
  );

  const activeGroup = selectedGroup && openByGroup[selectedGroup] ? selectedGroup : groupOptions[0]?.group;
  const groupMatches = activeGroup ? openByGroup[activeGroup] ?? [] : [];
  const currentGroup = activeGroup ? rowsByGroup[activeGroup] ?? [] : [];
  const outcomeFor = (match: Match): ScenarioOutcome => outcomes[match.id] ?? "draw";
  const projectedGroup = groupMatches.length
    ? projectGroupTableForResults(
        currentGroup,
        groupMatches.map((match) => ({ match, outcome: outcomeFor(match) })),
      )
    : currentGroup;
  const scenarioStandings = activeGroup
    ? standings.map((row) => projectedGroup.find((projected) => projected.team.id === row.team.id) ?? row)
    : standings;
  const thirdPlace = buildThirdPlaceTable(scenarioStandings, qualificationByTeam).slice(0, 10);
  const modelDate = new Date(qualificationGeneratedAt);

  if (loadingMatches || loadingStandings) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-12">
        <div className="h-64 animate-pulse bg-[var(--row-alt)]" />
      </div>
    );
  }

  if (matchesError || standingsError) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 sm:px-12">
        <p className="text-sm text-[var(--foreground-accent)]">
          Couldn&apos;t load scenario data: {((matchesError || standingsError) as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <section className="overflow-hidden px-6 pt-8 sm:px-12">
        <h1 className="headline-bleed text-[clamp(64px,12vw,160px)] text-[var(--foreground)]">SCENARIOS</h1>
        <p className="mt-4 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
          GROUP TABLES · THIRD-PLACE LINE · MODEL{" "}
          {Number.isNaN(modelDate.getTime()) ? "SNAPSHOT" : modelDate.toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()}
        </p>
      </section>

      {!activeGroup ? (
        <div className="mx-auto max-w-[1440px] border border-[var(--border)] p-6 text-sm text-[var(--foreground-secondary)] sm:px-12">
          No upcoming group fixtures are available in the feed.
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1440px] gap-6 px-6 sm:px-12 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <Panel title="Group" kicker={`${groupOptions.length} open`}>
              <div className="space-y-2">
                {groupOptions.map(({ group, matches: groupMatchesForButton }) => (
                  <button
                    key={group}
                    onClick={() => setSelectedGroup(group)}
                    className={`w-full border px-3 py-3 text-left transition-colors ${
                      activeGroup === group
                        ? "border-[var(--foreground-accent)] bg-[var(--row-alt)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">
                      <span>{group.toUpperCase()}</span>
                      <span>
                        {groupMatchesForButton.length} FIXTURE{groupMatchesForButton.length === 1 ? "" : "S"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--foreground-secondary)]">
                      {kickoffDay(groupMatchesForButton[0].kickoff)} · {kickoffTime(groupMatchesForButton[0].kickoff)}
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Results" kicker="defaults draw">
              <div className="space-y-3">
                {groupMatches.map((match) => (
                  <div key={match.id} className="border border-[var(--border)] p-2">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">
                      <span>{kickoffDay(match.kickoff)}</span>
                      <span>{kickoffTime(match.kickoff)}</span>
                    </div>
                    <FixtureTeam team={match.homeTeam} />
                    <FixtureTeam team={match.awayTeam} />
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {OUTCOMES.map((item) => (
                        <button
                          key={item.key}
                          onClick={() =>
                            setOutcomes((current) => ({
                              ...current,
                              [match.id]: item.key,
                            }))
                          }
                          className={`border px-2 py-2 text-[10px] tracking-[1px] transition-colors ${
                            outcomeFor(match) === item.key
                              ? "border-[var(--foreground-accent)] bg-[var(--foreground-accent)] text-[var(--foreground-inverse)]"
                              : "border-[var(--border)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {item.key === "home"
                            ? match.homeTeam.shortName
                            : item.key === "away"
                              ? match.awayTeam.shortName
                              : item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>

          <main className="space-y-4">
            <Panel title={activeGroup} kicker={`${groupMatches.length} result scenario`}>
              <div className="grid gap-4 md:grid-cols-2">
                <ScenarioTable title="Current" rows={currentGroup} thirdPlace={buildThirdPlaceTable(standings, qualificationByTeam)} />
                <ScenarioTable title="Projected" rows={projectedGroup} changedFrom={currentGroup} thirdPlace={thirdPlace} showOutlook />
              </div>
            </Panel>

            <Panel title="Third-Place Line" kicker="after scenario">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {thirdPlace.map((entry) => (
                  <div
                    key={`${entry.row.group}-${entry.row.team.id}`}
                    className={`flex items-center gap-2 border px-2 py-1.5 ${
                      entry.insideCut ? "border-[var(--foreground-accent)] bg-[var(--row-alt)]" : "border-[var(--border)]"
                    }`}
                  >
                    <span
                      className={`w-4 text-[10px] tabular-nums ${
                        entry.insideCut ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-secondary)]"
                      }`}
                    >
                      {entry.tableRank}
                    </span>
                    <Flag team={entry.row.team} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--foreground)]">
                      {entry.row.team.shortName || entry.row.team.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-[var(--foreground-secondary)]">
                      {entry.row.points}pt {entry.row.gd > 0 ? "+" : ""}
                      {entry.row.gd}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </main>
        </div>
      )}
    </div>
  );
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <section className="border border-[var(--border)] p-4">
      <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-3">
        <h2 className="font-heading text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        <span className="text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">{kicker.toUpperCase()}</span>
      </div>
      {children}
    </section>
  );
}

function FixtureTeam({ team }: { team: Match["homeTeam"] }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Flag team={team} size={18} />
      <span className="truncate text-sm text-[var(--foreground)]">{team.name}</span>
    </div>
  );
}

function ScenarioTable({
  title,
  rows,
  changedFrom,
  thirdPlace,
  showOutlook = false,
}: {
  title: string;
  rows: Standing[];
  changedFrom?: Standing[];
  thirdPlace: ThirdPlaceEntry[];
  showOutlook?: boolean;
}) {
  return (
    <div className="overflow-hidden border border-[var(--border)]">
      <div className="border-b border-[var(--border)] px-2 py-1.5 text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">
        {title.toUpperCase()}
      </div>
      <div>
        {rows.map((row) => {
          const before = changedFrom?.find((r) => r.team.id === row.team.id);
          const rankDelta = before ? before.rank - row.rank : 0;
          const qualify = qualificationForTeam(row.team.name);
          const outlook = qualificationOutlook(row, thirdPlace);
          return (
            <div
              key={row.team.id}
              className="flex items-center gap-2 border-b border-[var(--border)] px-2 py-2 last:border-b-0 hover:bg-[var(--row-alt)]"
            >
              <span className="w-4 text-xs tabular-nums text-[var(--foreground-secondary)]">{row.rank}</span>
              <Flag team={row.team} size={18} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--foreground)]">{row.team.name}</span>
              {rankDelta !== 0 && (
                <span className={`text-[10px] ${rankDelta > 0 ? "text-[var(--foreground)]" : "text-[var(--foreground-accent)]"}`}>
                  {rankDelta > 0 ? `+${rankDelta}` : rankDelta}
                </span>
              )}
              <span className="text-[11px] tabular-nums text-[var(--foreground-secondary)]">
                {row.played}P · {row.points}pt · {row.gd > 0 ? "+" : ""}
                {row.gd}
              </span>
              <span className="w-12 text-right text-[10px] tabular-nums text-[var(--foreground-accent)]">
                {qualify === undefined ? "Q --" : `Q ${formatProb(qualify)}`}
              </span>
              {showOutlook && <OutlookBadge outlook={outlook} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutlookBadge({ outlook }: { outlook: ReturnType<typeof qualificationOutlook> }) {
  const toneClass =
    outlook.tone === "safe"
      ? "border-[var(--foreground)] text-[var(--foreground)]"
      : outlook.tone === "watch"
        ? "border-[var(--foreground-secondary)] text-[var(--foreground-secondary)]"
        : outlook.tone === "out"
          ? "border-[var(--border)] text-[var(--foreground-secondary)]"
          : "border-[var(--foreground-accent)] text-[var(--foreground-accent)]";
  return (
    <span className={`hidden shrink-0 border px-1.5 py-0.5 text-[9px] tracking-[1px] sm:inline ${toneClass}`}>
      {outlook.label}
    </span>
  );
}

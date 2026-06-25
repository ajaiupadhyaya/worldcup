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
import { kitColor } from "@/lib/teamColors";
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
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="h-64 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />
      </div>
    );
  }

  if (matchesError || standingsError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="font-mono text-sm text-danger/90">
          Couldn&apos;t load scenario data: {((matchesError || standingsError) as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-none text-text">Scenario Lab</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            group tables · third-place line · model {Number.isNaN(modelDate.getTime()) ? "snapshot" : modelDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>

      {!activeGroup ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 font-mono text-sm text-muted">
          No upcoming group fixtures are available in the feed.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-3">
            <Panel title="Group" kicker={`${groupOptions.length} open`}>
              <div className="space-y-2">
                {groupOptions.map(({ group, matches: groupMatchesForButton }) => (
                  <button
                    key={group}
                    onClick={() => {
                      setSelectedGroup(group);
                    }}
                    className={`w-full border px-3 py-2 text-left transition-colors ${
                      activeGroup === group
                        ? "border-home bg-home/5"
                        : "border-border bg-bg/20 hover:border-home/50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                      <span>{group}</span>
                      <span>{groupMatchesForButton.length} fixture{groupMatchesForButton.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted">
                      {kickoffDay(groupMatchesForButton[0].kickoff)} · {kickoffTime(groupMatchesForButton[0].kickoff)}
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Results" kicker="defaults draw">
              <div className="space-y-3">
                {groupMatches.map((match) => (
                  <div key={match.id} className="border border-border bg-bg/20 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
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
                          className={`border px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                            outcomeFor(match) === item.key
                              ? "border-accent bg-accent text-bg"
                              : "border-border text-muted hover:text-text"
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
              <div className="grid gap-3 md:grid-cols-2">
                <ScenarioTable title="Current" rows={currentGroup} thirdPlace={buildThirdPlaceTable(standings, qualificationByTeam)} />
                <ScenarioTable title="Projected" rows={projectedGroup} changedFrom={currentGroup} thirdPlace={thirdPlace} showOutlook />
              </div>
            </Panel>

            <Panel title="Third-Place Line" kicker="after scenario">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                {thirdPlace.map((entry) => (
                  <div
                    key={`${entry.row.group}-${entry.row.team.id}`}
                    className={`flex items-center gap-2 border px-2 py-1.5 ${
                      entry.insideCut ? "border-home/30 bg-home/5" : "border-border bg-bg/20"
                    }`}
                  >
                    <span className={`w-4 font-mono text-[10px] tabular-nums ${entry.insideCut ? "text-home" : "text-muted"}`}>
                      {entry.tableRank}
                    </span>
                    <Flag team={entry.row.team} size={16} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-text">{entry.row.team.shortName || entry.row.team.name}</span>
                    <span className="font-mono text-[10px] tabular-nums text-muted">
                      {entry.row.points}pt {entry.row.gd > 0 ? "+" : ""}{entry.row.gd}
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
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-3">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base leading-none text-text">{title}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

function FixtureTeam({ team }: { team: Match["homeTeam"] }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: kitColor(team) }} />
      <Flag team={team} size={18} />
      <span className="truncate text-sm text-text">{team.name}</span>
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
    <div className="overflow-hidden border border-border bg-bg/20">
      <div className="border-b border-border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {title}
      </div>
      <div>
        {rows.map((row) => {
          const before = changedFrom?.find((r) => r.team.id === row.team.id);
          const rankDelta = before ? before.rank - row.rank : 0;
          const qualify = qualificationForTeam(row.team.name);
          const outlook = qualificationOutlook(row, thirdPlace);
          return (
            <div key={row.team.id} className="flex items-center gap-2 border-b border-border px-2 py-2 last:border-b-0">
              <span className="w-4 font-mono text-xs text-muted tabular-nums">{row.rank}</span>
              <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: kitColor(row.team) }} />
              <Flag team={row.team} size={18} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-text">{row.team.name}</span>
              {rankDelta !== 0 && (
                <span className={`font-mono text-[10px] ${rankDelta > 0 ? "text-home" : "text-danger/90"}`}>
                  {rankDelta > 0 ? `+${rankDelta}` : rankDelta}
                </span>
              )}
              <span className="font-mono text-[11px] tabular-nums text-muted">
                {row.played}P · {row.points}pt · {row.gd > 0 ? "+" : ""}{row.gd}
              </span>
              <span className="w-12 text-right font-mono text-[10px] tabular-nums text-home">
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
      ? "border-home/40 text-home"
      : outlook.tone === "watch"
        ? "border-accent/50 text-accent"
        : outlook.tone === "out"
          ? "border-muted/40 text-muted"
          : "border-danger/50 text-danger/90";
  return (
    <span className={`hidden shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] sm:inline ${toneClass}`}>
      {outlook.label}
    </span>
  );
}

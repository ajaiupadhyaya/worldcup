"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Match, Standing, Team } from "@/lib/types";
import { buildTournamentPulse } from "@/lib/tournament";
import { formatProb } from "@/lib/probability";
import { kitColor } from "@/lib/teamColors";
import { kickoffTime } from "@/lib/format";
import { Flag } from "./Flag";
import { LiveDot } from "./LiveDot";

export function TournamentPulse({
  matches,
  standings,
  projected,
  modelGeneratedAt,
}: {
  matches: Match[];
  standings: Standing[];
  projected: Record<string, number>;
  modelGeneratedAt: string;
}) {
  if (!standings.length) return null;

  const pulse = buildTournamentPulse(standings, matches, projected);
  const thirdPlace = pulse.thirdPlace.slice(0, 10);
  const modelDate = new Date(modelGeneratedAt);
  const modelLabel = Number.isNaN(modelDate.getTime())
    ? "model snapshot"
    : `model ${modelDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <section className="mb-8 border-l border-border pl-3 sm:pl-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-text sm:text-5xl">Tournament Pulse</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted sm:text-xs">
            group-stage command center · {modelLabel}
          </p>
        </div>
        <Link href="/predict" className="border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-home transition-colors hover:border-home hover:bg-home hover:text-bg">
          open model room -&gt;
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <PulseStat label="Groups complete" value={`${pulse.completedGroups}/12`} />
          <PulseStat label="Top-two spots locked" value={String(pulse.topTwoLocked)} />
          <PulseStat label="Groups still live" value={String(pulse.activeGroups)} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Panel title="Highest Leverage Fixtures" kicker="next whistle">
            {pulse.stakes.length ? (
              <div className="space-y-2">
                {pulse.stakes.map((stake) => (
                  <StakeRow key={stake.match.id} stake={stake} />
                ))}
              </div>
            ) : (
              <p className="font-mono text-xs text-muted">No live or upcoming fixtures in the feed.</p>
            )}
          </Panel>

          <Panel title="Pressure Board" kicker="closest calls">
            <div className="space-y-1.5">
              {pulse.pressure.map((entry) => (
                <TeamPressure key={`${entry.row.group}-${entry.row.team.id}`} entry={entry} />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {thirdPlace.length > 0 && (
        <div className="mt-3">
          <Panel title="Third-Place Cut Line" kicker="best eight advance">
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
              {thirdPlace.map((entry) => (
                <ThirdPlaceChip key={`${entry.row.group}-${entry.row.team.id}`} entry={entry} />
              ))}
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div className="art-panel p-3">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h2 className="font-display text-lg leading-none text-text">{title}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{kicker}</span>
      </div>
      {children}
    </div>
  );
}

function PulseStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="art-panel slash-field min-h-[108px] px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-3 font-display text-5xl leading-none text-text">{value}</div>
    </div>
  );
}

function Qualify({ value }: { value?: number }) {
  return (
    <span className="font-mono text-[10px] tabular-nums text-home">
      {value === undefined ? "Q --" : `Q ${formatProb(value)}`}
    </span>
  );
}

function TeamMini({ team, rank, points, prob }: { team: Team; rank?: number; points?: number; prob?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: kitColor(team) }} />
      <Flag team={team} size={18} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{team.shortName || team.name}</span>
      {rank !== undefined && points !== undefined && (
        <span className="font-mono text-[10px] text-muted tabular-nums">
          {rank} · {points}pt
        </span>
      )}
      <Qualify value={prob} />
    </div>
  );
}

function StakeRow({
  stake,
}: {
  stake: ReturnType<typeof buildTournamentPulse>["stakes"][number];
}) {
  const match = stake.match;
  return (
    <Link
      href={`/match/${match.id}`}
      className="block border-t border-border pt-3 first:border-t-0 first:pt-0 hover:text-text"
    >
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="truncate text-muted">{stake.group ?? match.round ?? "World Cup"}</span>
        <span className="flex shrink-0 items-center gap-1 text-accent">
          {match.status === "live" && <LiveDot size={6} />}
          {match.status === "live" ? "live" : kickoffTime(match.kickoff)}
        </span>
      </div>
      <div className="space-y-1">
        <TeamMini team={match.homeTeam} rank={stake.home?.rank} points={stake.home?.points} prob={stake.homeQualifyProb} />
        <TeamMini team={match.awayTeam} rank={stake.away?.rank} points={stake.away?.points} prob={stake.awayQualifyProb} />
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{stake.label}</div>
      {stake.impacts.length > 0 && (
        <div className="mt-2 grid gap-1">
          {stake.impacts.map((impact) => (
            <div
              key={impact.outcome}
              className="flex items-center gap-2 border border-border bg-bg/40 px-2 py-1 font-mono text-[10px]"
            >
              <span className="w-12 shrink-0 uppercase tracking-[0.1em] text-home">{impact.label}</span>
              <span className="min-w-0 truncate text-muted">{impact.summary}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function TeamPressure({
  entry,
}: {
  entry: ReturnType<typeof buildTournamentPulse>["pressure"][number];
}) {
  const toneClass =
    entry.tone === "safe" ? "text-home" : entry.tone === "danger" ? "text-danger/90" : "text-accent";
  return (
    <div className="flex items-center gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
      <Flag team={entry.row.team} size={18} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-text">{entry.row.team.name}</span>
          <span className="font-mono text-[10px] text-muted">{entry.row.group.replace("Group ", "")}</span>
        </div>
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{entry.label}</div>
      </div>
      <span className={`font-mono text-[11px] tabular-nums ${toneClass}`}>
        {entry.qualifyProb === undefined ? `${entry.row.points}pt` : formatProb(entry.qualifyProb)}
      </span>
    </div>
  );
}

function ThirdPlaceChip({
  entry,
}: {
  entry: ReturnType<typeof buildTournamentPulse>["thirdPlace"][number];
}) {
  return (
    <div
      className={`flex items-center gap-2 border px-2 py-1.5 ${
        entry.insideCut ? "border-home/40 bg-home/8" : "border-border bg-bg/35"
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
  );
}

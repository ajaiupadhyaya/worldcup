"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Match, Standing, Team } from "@/lib/types";
import { buildTournamentPulse } from "@/lib/tournament";
import { formatProb } from "@/lib/probability";
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
    <section className="mx-auto max-w-[1440px] border-t-2 border-[var(--border-strong)] px-6 py-10 sm:px-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl font-bold italic text-[var(--foreground)]">Tournament Pulse</h2>
          <p className="mt-2 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
            GROUP-STAGE COMMAND CENTER · {modelLabel.toUpperCase()}
          </p>
        </div>
        <Link
          href="/predict"
          className="border border-[var(--border-strong)] px-4 py-2 text-[10px] tracking-[2px] text-[var(--foreground)] transition-colors hover:bg-[var(--row-alt)]"
        >
          OPEN MODEL ROOM →
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="grid gap-0 border border-[var(--border)] sm:grid-cols-3 lg:grid-cols-1">
          <PulseStat label="Groups complete" value={`${pulse.completedGroups}/12`} />
          <PulseStat label="Top-two spots locked" value={String(pulse.topTwoLocked)} border />
          <PulseStat label="Groups still live" value={String(pulse.activeGroups)} border />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Highest Leverage Fixtures" kicker="next whistle">
            {pulse.stakes.length ? (
              <div className="divide-y divide-[var(--border)]">
                {pulse.stakes.map((stake) => (
                  <StakeRow key={stake.match.id} stake={stake} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--foreground-secondary)]">No live or upcoming fixtures in the feed.</p>
            )}
          </Panel>

          <Panel title="Pressure Board" kicker="closest calls">
            <div className="divide-y divide-[var(--border)]">
              {pulse.pressure.map((entry) => (
                <TeamPressure key={`${entry.row.group}-${entry.row.team.id}`} entry={entry} />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {thirdPlace.length > 0 && (
        <div className="mt-8 border border-[var(--border)] p-4">
          <div className="mb-4 flex items-baseline justify-between border-b border-[var(--border)] pb-3">
            <h3 className="font-heading text-lg font-semibold text-[var(--foreground)]">Third-Place Cut Line</h3>
            <span className="text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">BEST EIGHT ADVANCE</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {thirdPlace.map((entry) => (
              <ThirdPlaceChip key={`${entry.row.group}-${entry.row.team.id}`} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <div className="border border-[var(--border)] p-4">
      <div className="mb-4 flex items-baseline justify-between border-b border-[var(--border)] pb-3">
        <h3 className="font-heading text-lg font-semibold text-[var(--foreground)]">{title}</h3>
        <span className="text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">{kicker.toUpperCase()}</span>
      </div>
      {children}
    </div>
  );
}

function PulseStat({ label, value, border = false }: { label: string; value: string; border?: boolean }) {
  return (
    <div
      className={`flex min-h-[108px] flex-col justify-center px-6 py-5 ${
        border ? "border-t border-[var(--border)] sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t" : ""
      }`}
    >
      <div className="text-[9px] tracking-[3px] text-[var(--foreground-secondary)]">{label.toUpperCase()}</div>
      <div className="stat-large mt-3 text-5xl leading-none text-[var(--foreground)]">{value}</div>
    </div>
  );
}

function Qualify({ value }: { value?: number }) {
  return (
    <span className="text-[10px] tabular-nums text-[var(--foreground-accent)]">
      {value === undefined ? "Q --" : `Q ${formatProb(value)}`}
    </span>
  );
}

function TeamMini({ team, rank, points, prob }: { team: Team; rank?: number; points?: number; prob?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Flag team={team} size={18} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--foreground)]">
        {team.shortName || team.name}
      </span>
      {rank !== undefined && points !== undefined && (
        <span className="text-[10px] tabular-nums text-[var(--foreground-secondary)]">
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
    <Link href={`/match/${match.id}`} className="block py-3 first:pt-0 hover:opacity-80">
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] tracking-[2px]">
        <span className="truncate text-[var(--foreground-secondary)]">
          {stake.group ?? match.round ?? "World Cup"}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[var(--foreground-accent)]">
          {match.status === "live" && <LiveDot size={6} />}
          {match.status === "live" ? "LIVE" : kickoffTime(match.kickoff)}
        </span>
      </div>
      <div className="space-y-1">
        <TeamMini team={match.homeTeam} rank={stake.home?.rank} points={stake.home?.points} prob={stake.homeQualifyProb} />
        <TeamMini team={match.awayTeam} rank={stake.away?.rank} points={stake.away?.points} prob={stake.awayQualifyProb} />
      </div>
      <div className="mt-1 text-[10px] tracking-[1px] text-[var(--foreground-secondary)]">{stake.label}</div>
      {stake.impacts.length > 0 && (
        <div className="mt-2 grid gap-1">
          {stake.impacts.map((impact) => (
            <div
              key={impact.outcome}
              className="flex items-center gap-2 border border-[var(--border)] px-2 py-1 text-[10px]"
            >
              <span className="w-12 shrink-0 tracking-[1px] text-[var(--foreground-accent)]">{impact.label}</span>
              <span className="min-w-0 truncate text-[var(--foreground-secondary)]">{impact.summary}</span>
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
    entry.tone === "safe"
      ? "text-[var(--foreground)]"
      : entry.tone === "danger"
        ? "text-[var(--foreground-accent)]"
        : "text-[var(--foreground-secondary)]";
  return (
    <div className="flex items-center gap-2 py-2 first:pt-0">
      <Flag team={entry.row.team} size={18} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] text-[var(--foreground)]">{entry.row.team.name}</span>
          <span className="text-[10px] text-[var(--foreground-secondary)]">
            {entry.row.group.replace("Group ", "")}
          </span>
        </div>
        <div className="truncate text-[10px] tracking-[1px] text-[var(--foreground-secondary)]">{entry.label}</div>
      </div>
      <span className={`text-[11px] tabular-nums ${toneClass}`}>
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
  );
}

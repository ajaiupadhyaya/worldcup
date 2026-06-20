"use client";

import Link from "next/link";
import type { Match, MatchEvent, Player, Team } from "@/lib/types";
import { useMatch } from "@/lib/hooks";
import { statusLabel, kickoffDay, kickoffTime } from "@/lib/format";
import { Flag } from "./Flag";
import { LiveDot } from "./LiveDot";
import { FormationPitch } from "./FormationPitch";
import { StatComparison } from "./StatComparison";
import { TacticalAnalysis } from "./TacticalAnalysis";
import { MatchQA } from "./MatchQA";
import { CVUpload } from "./CVUpload";
import { ShareButton } from "./ShareButton";
import { PitchDivider } from "./PitchDivider";

export function MatchDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useMatch(id);
  const match = data?.data;

  if (isLoading && !match) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="h-40 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />
      </div>
    );
  }
  if (error || !match) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-center">
        <p className="text-danger/90">{error ? (error as Error).message : "Match not found."}</p>
        <Link href="/" className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-home">
          ← back to the board
        </Link>
      </div>
    );
  }

  const live = match.status === "live";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link href="/" className="mb-4 inline-block font-mono text-[11px] uppercase tracking-widest text-muted hover:text-text">
        ← board
      </Link>

      {/* Scoreboard */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em]">
          {live && <LiveDot size={7} />}
          <span className={live ? "text-accent" : "text-muted"}>
            {live ? `LIVE · ${statusLabel(match)}` : match.status === "finished" ? "FULL TIME" : `${kickoffDay(match.kickoff)} · ${kickoffTime(match.kickoff)}`}
          </span>
          <span className="text-muted">· {match.round || match.homeTeam.group || "World Cup"}</span>
          {match.venue && <span className="text-muted">· {match.venue}</span>}
        </div>

        <div className="flex items-center justify-between gap-4">
          <TeamHead team={match.homeTeam} color="var(--home)" />
          <div className="flex items-center gap-3 font-display text-5xl tabular-nums sm:text-6xl">
            <span>{match.status === "scheduled" ? "" : match.score.home}</span>
            <span className="text-muted">{match.status === "scheduled" ? "vs" : "–"}</span>
            <span>{match.status === "scheduled" ? "" : match.score.away}</span>
          </div>
          <TeamHead team={match.awayTeam} color="var(--accent)" align="right" />
        </div>

        <div className="mt-5">
          <ShareButton matchId={match.id} />
        </div>
      </div>

      {/* Tactics board + stats/events */}
      <div className="mt-6 grid gap-6 md:grid-cols-[300px_1fr] md:items-start">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <FormationPitch homeFormation={match.lineups?.home.formation} awayFormation={match.lineups?.away.formation} />
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 font-display text-lg text-text">By the numbers</h2>
            <StatComparison match={match} />
          </div>
          {match.events && match.events.length > 0 && (
            <div>
              <h2 className="mb-2 font-display text-lg text-text">Timeline</h2>
              <EventTimeline events={match.events} match={match} />
            </div>
          )}
        </div>
      </div>

      <PitchDivider />

      {/* Claude tactical read */}
      <TacticalAnalysis match={match} />

      <PitchDivider />

      {/* Q&A + CV */}
      <div className="grid gap-8 md:grid-cols-2">
        <MatchQA matchId={match.id} />
        <CVUpload matchId={match.id} />
      </div>

      {/* Lineups */}
      {match.lineups && (match.lineups.home.startingXI.length > 0 || match.lineups.away.startingXI.length > 0) && (
        <>
          <PitchDivider label="Teamsheets" />
          <div className="grid gap-6 sm:grid-cols-2">
            <Lineup title={match.homeTeam.name} color="var(--home)" xi={match.lineups.home.startingXI} subs={match.lineups.home.substitutes} formation={match.lineups.home.formation} />
            <Lineup title={match.awayTeam.name} color="var(--accent)" xi={match.lineups.away.startingXI} subs={match.lineups.away.substitutes} formation={match.lineups.away.formation} />
          </div>
        </>
      )}
    </div>
  );
}

function TeamHead({ team, color, align = "left" }: { team: Team; color: string; align?: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${align === "right" ? "items-end text-right" : "items-start"}`}>
      <Flag team={team} size={44} />
      <span className="truncate font-display text-xl leading-tight text-text sm:text-2xl">{team.name}</span>
      <span className="h-1 w-10 rounded-full" style={{ background: color }} />
    </div>
  );
}

function EventTimeline({ events, match }: { events: MatchEvent[]; match: Match }) {
  const color = (e: MatchEvent) =>
    e.type === "goal" ? "var(--danger)" : e.type === "card" ? "var(--accent)" : "var(--muted)";
  const icon = (e: MatchEvent) => (e.type === "goal" ? "⚽" : e.type === "card" ? "▮" : e.type === "substitution" ? "⇄" : "▷");
  return (
    <ol className="space-y-1.5">
      {events.map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="w-9 shrink-0 font-mono text-xs text-muted tabular-nums">{e.minute}&apos;</span>
          <span className="shrink-0" style={{ color: color(e) }}>{icon(e)}</span>
          <span className="text-text/90">
            {e.player || e.detail}
            {e.assist && <span className="text-muted"> · assist {e.assist}</span>}
            {e.team && (
              <span className="ml-1 font-mono text-[10px] text-muted">
                {e.team === match.homeTeam.id ? match.homeTeam.shortName : e.team === match.awayTeam.id ? match.awayTeam.shortName : ""}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Lineup({ title, color, xi, subs, formation }: { title: string; color: string; xi: Player[]; subs: Player[]; formation: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="h-4 w-1 rounded-full" style={{ background: color }} />
        <span className="font-display text-sm text-text">{title}</span>
        {formation && <span className="font-mono text-[11px] text-muted">{formation}</span>}
      </div>
      <ol className="space-y-0.5">
        {xi.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-[13px]">
            <span className="w-6 text-right font-mono text-xs text-muted tabular-nums">{p.number || "·"}</span>
            <span className="text-text/90">{p.name}</span>
            <span className="ml-auto font-mono text-[10px] text-muted">{p.position}</span>
          </li>
        ))}
      </ol>
      {subs.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted">
            bench ({subs.length})
          </summary>
          <ol className="mt-1 space-y-0.5">
            {subs.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[12px] text-muted">
                <span className="w-6 text-right font-mono tabular-nums">{p.number || "·"}</span>
                <span>{p.name}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

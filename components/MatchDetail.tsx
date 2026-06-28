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
      <div className="mx-auto max-w-7xl px-4 py-7">
        <div className="art-panel h-48 animate-pulse" />
      </div>
    );
  }
  if (error || !match) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-center">
        <p className="text-danger/90">{error ? (error as Error).message : "Match not found."}</p>
        <Link href="/" className="mt-4 inline-block border border-home px-3 py-2 font-mono text-xs uppercase tracking-widest text-home hover:bg-home hover:text-bg">
          ← back to the board
        </Link>
      </div>
    );
  }

  const live = match.status === "live";

  return (
    <div className="mx-auto max-w-7xl px-4 py-7">
      <Link href="/" className="mb-5 inline-block border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted hover:border-home hover:text-text">
        ← board
      </Link>

      {/* Scoreboard */}
      <div className="art-panel p-5 md:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em]">
          {live && <LiveDot size={7} />}
          <span className={live ? "text-accent" : "text-muted"}>
            {live ? `LIVE · ${statusLabel(match)}` : match.status === "finished" ? "FULL TIME" : `${kickoffDay(match.kickoff)} · ${kickoffTime(match.kickoff)}`}
          </span>
          <span className="text-muted">· {match.round || match.homeTeam.group || "World Cup"}</span>
          {match.venue && <span className="text-muted">· {match.venue}</span>}
        </div>

        <div className="grid items-center gap-5 sm:grid-cols-[1fr_auto_1fr]">
          <TeamHead team={match.homeTeam} color="var(--home)" />
          <div className="slash-field flex min-h-24 min-w-0 items-center justify-center gap-3 border border-border px-4 py-4 font-display text-5xl tabular-nums text-text sm:min-h-28 sm:gap-4 sm:px-6 sm:text-7xl">
            <span>{match.status === "scheduled" ? "" : match.score.home}</span>
            <span className="text-muted">{match.status === "scheduled" ? "vs" : "–"}</span>
            <span>{match.status === "scheduled" ? "" : match.score.away}</span>
          </div>
          <TeamHead team={match.awayTeam} color="var(--accent)" align="right" />
        </div>

        <div className="mt-5">
          <ShareButton matchId={match.id} />
        </div>

        {data && <SourceBadges source={data.source} cached={data.cached} fetchedAt={data.fetchedAt} match={match} />}
      </div>

      {/* Tactics board + stats/events */}
      <div className="mt-7 grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
        <div className="art-panel p-4">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            <span>Shape Room</span>
            <span>{match.lineups?.home.formation || "--"} / {match.lineups?.away.formation || "--"}</span>
          </div>
          <FormationPitch homeFormation={match.lineups?.home.formation} awayFormation={match.lineups?.away.formation} />
        </div>
        <div className="space-y-6">
          <div className="art-panel p-5">
            <h2 className="mb-4 border-l-2 border-home pl-3 font-display text-xl text-text">By the numbers</h2>
            <StatComparison match={match} />
          </div>
          {match.events && match.events.length > 0 && (
            <div className="art-panel p-5">
              <h2 className="mb-4 border-l-2 border-accent pl-3 font-display text-xl text-text">Timeline</h2>
              <EventTimeline events={match.events} match={match} />
            </div>
          )}
        </div>
      </div>

      <PitchDivider />

      {/* Free tactical read */}
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

function SourceBadges({
  source,
  cached,
  fetchedAt,
  match,
}: {
  source: string;
  cached: boolean;
  fetchedAt: string;
  match: Match;
}) {
  const fetched = new Date(fetchedAt);
  const fetchedLabel = Number.isFinite(fetched.getTime()) ? fetched.toUTCString() : "unknown";
  const hasXg = Boolean(match.stats && (match.stats.xG.home > 0 || match.stats.xG.away > 0));
  return (
    <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
      <span className="border border-border px-2 py-1 text-muted">source: {source}</span>
      <span className="border border-border px-2 py-1 text-muted">{cached ? "cached" : "fresh"} · {fetchedLabel}</span>
      <span className={`border px-2 py-1 ${hasXg ? "border-home/50 text-home" : "border-accent/50 text-accent"}`}>
        {hasXg ? "xG live" : "xG unavailable"}
      </span>
    </div>
  );
}

function TeamHead({ team, color, align = "left" }: { team: Team; color: string; align?: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-2 ${align === "right" ? "items-start text-left sm:items-end sm:text-right" : "items-start"}`}>
      <Flag team={team} size={44} />
      <span className="max-w-full truncate font-display text-2xl leading-tight text-text sm:text-3xl">{team.name}</span>
      <span className="h-1 w-14" style={{ background: color }} />
    </div>
  );
}

function EventTimeline({ events, match }: { events: MatchEvent[]; match: Match }) {
  const color = (e: MatchEvent) =>
    e.type === "goal" ? "var(--danger)" : e.type === "card" ? "var(--accent)" : "var(--muted)";
  const icon = (e: MatchEvent) => (e.type === "goal" ? "⚽" : e.type === "card" ? "▮" : e.type === "substitution" ? "⇄" : "▷");
  const fallbackLabel = (e: MatchEvent) =>
    e.type === "substitution" ? "Substitution" : e.type === "var" ? "VAR review" : e.type === "card" ? "Card" : "Goal";
  return (
    <ol className="divide-y divide-border/70 border border-border">
      {events.map((e, i) => (
        <li key={`${e.minute}-${e.type}-${e.player}-${i}`} className="flex items-start gap-3 px-3 py-2 text-sm">
          <span className="w-9 shrink-0 font-mono text-xs text-muted tabular-nums">{e.minute}&apos;</span>
          <span className="shrink-0" style={{ color: color(e) }}>{icon(e)}</span>
          <span className="text-text/90">
            {e.player || e.detail || fallbackLabel(e)}
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
    <div className="art-panel p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <span className="h-5 w-1" style={{ background: color }} />
        <span className="font-display text-lg text-text">{title}</span>
        {formation && <span className="font-mono text-[11px] text-muted">{formation}</span>}
      </div>
      <ol className="divide-y divide-border/60 border border-border/80">
        {xi.map((p) => (
          <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-[13px]">
            <span className="w-6 text-right font-mono text-xs text-muted tabular-nums">{p.number || "·"}</span>
            <span className="text-text/90">{p.name}</span>
            <span className="ml-auto font-mono text-[10px] text-muted">{p.position}</span>
          </li>
        ))}
      </ol>
      {subs.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer border border-border px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted hover:border-home hover:text-text">
            bench ({subs.length})
          </summary>
          <ol className="mt-1 divide-y divide-border/60 border border-border/80">
            {subs.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-muted">
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

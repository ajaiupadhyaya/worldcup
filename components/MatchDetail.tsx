"use client";

import Link from "next/link";
import type { Match, MatchEvent, Player, Team } from "@/lib/types";
import { useMatch } from "@/lib/hooks";
import { statusLabel, kickoffDay, kickoffTime } from "@/lib/format";
import { LiveDot } from "./LiveDot";
import { FormationPitch } from "./FormationPitch";
import { StatComparison } from "./StatComparison";
import { TacticalAnalysis } from "./TacticalAnalysis";
import { MatchQA } from "./MatchQA";
import { CVUpload } from "./CVUpload";
import { ShareButton } from "./ShareButton";

export function MatchDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useMatch(id);
  const match = data?.data;

  if (isLoading && !match) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-12">
        <div className="h-64 animate-pulse bg-[var(--row-alt)]" />
      </div>
    );
  }
  if (error || !match) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16 text-center sm:px-12">
        <p className="text-[var(--foreground-accent)]">{error ? (error as Error).message : "Match not found."}</p>
        <Link
          href="/"
          className="mt-6 inline-block border border-[var(--border-strong)] px-4 py-2 text-[10px] tracking-[2px] hover:bg-[var(--row-alt)]"
        >
          ← BACK TO BOARD
        </Link>
      </div>
    );
  }

  const live = match.status === "live";
  const decided = match.status !== "scheduled";
  const breadcrumb = ["MATCHES", match.round?.toUpperCase() || "WORLD CUP", `MATCH ${match.id.slice(-2)}`]
    .filter(Boolean)
    .join("  /  ");

  const metaCols = [
    { label: "VENUE", value: match.venue?.toUpperCase() || "TBC" },
    { label: "DATE", value: kickoffDay(match.kickoff).toUpperCase() },
    { label: "KICK-OFF", value: kickoffTime(match.kickoff).toUpperCase() },
    { label: "ROUND", value: (match.round || "GROUP STAGE").toUpperCase() },
    { label: "ATTENDANCE", value: "—" },
  ];

  return (
    <div>
      <section className="mx-auto max-w-[1440px] px-6 pt-6 sm:px-12">
        <p className="text-[9px] tracking-[2.5px] text-[var(--foreground-secondary)]">{breadcrumb}</p>
        <div className="mt-4 h-px bg-[var(--border)]" />

        <div className="overflow-hidden py-6">
          <h1 className="font-heading text-[clamp(64px,14vw,200px)] font-bold leading-[0.82] tracking-[-0.04em] text-[var(--foreground)]">
            {match.homeTeam.name.toUpperCase()}
          </h1>
          <div className="my-4 flex items-center gap-4">
            <span className="text-[11px] tracking-[4px] text-[var(--foreground-secondary)]">VS</span>
            <span className="h-1 w-[120px] bg-[var(--foreground-accent)]" />
          </div>
          <h1 className="font-heading text-[clamp(64px,14vw,200px)] font-bold leading-[0.82] tracking-[-0.04em] text-[var(--foreground)]">
            {match.awayTeam.name.toUpperCase()}
          </h1>
        </div>
      </section>

      <div className="section-rule" />
      <div className="flex flex-wrap bg-[var(--surface-dark)]">
        {metaCols.map((col, i) => (
          <div
            key={col.label}
            className={`min-w-[140px] flex-1 px-6 py-3 sm:px-12 ${
              i < metaCols.length - 1 ? "border-r border-[var(--foreground-secondary)]" : ""
            }`}
          >
            <p className="text-[8px] tracking-[2px] text-[var(--foreground-secondary)]">{col.label}</p>
            <p className="mt-1 text-[13px] text-[var(--foreground-inverse)]">{col.value}</p>
          </div>
        ))}
      </div>

      <section className="py-12 text-center">
        {live && (
          <div className="mb-4 flex items-center justify-center gap-2">
            <LiveDot size={8} />
            <span className="text-[9px] tracking-[2px] text-[var(--foreground-accent)]">LIVE · {statusLabel(match)}</span>
          </div>
        )}
        <p className="font-heading text-[clamp(72px,12vw,120px)] font-bold italic leading-none tabular-nums text-[var(--foreground)]">
          {decided ? (
            <>
              {match.score.home}
              <span className="mx-4 text-[clamp(48px,8vw,80px)] not-italic text-[var(--foreground-secondary)]">—</span>
              {match.score.away}
            </>
          ) : (
            "—"
          )}
        </p>
        <div className="mt-6 flex justify-center">
          <ShareButton matchId={match.id} />
        </div>
        {data && <SourceBadges source={data.source} cached={data.cached} fetchedAt={data.fetchedAt} match={match} />}
      </section>

      <div className="section-rule mx-auto max-w-[1440px]" />

      <section className="mx-auto max-w-[1440px] px-6 py-10 sm:px-12">
        <h2 className="mb-6 section-label">MATCH STATISTICS</h2>
        <StatComparison match={match} />
      </section>

      {match.events && match.events.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-6 py-10 sm:px-12">
          <div className="section-rule mb-6 pt-6">
            <h2 className="section-label">KEY EVENTS</h2>
          </div>
          <EventTimeline events={match.events} match={match} />
        </section>
      )}

      <TacticalAnalysis match={match} />

      <section className="mx-auto max-w-[1440px] px-6 py-10 sm:px-12">
        <div className="section-rule mb-6 pt-6">
          <h2 className="section-label">SHAPE ROOM</h2>
        </div>
        <div className="border border-[var(--border)] p-4">
          <p className="mb-4 text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">
            {match.lineups?.home.formation || "—"} / {match.lineups?.away.formation || "—"}
          </p>
          <FormationPitch
            homeFormation={match.lineups?.home.formation}
            awayFormation={match.lineups?.away.formation}
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-6 py-10 sm:grid-cols-2 sm:px-12">
        <MatchQA matchId={match.id} />
        <CVUpload matchId={match.id} />
      </section>

      {match.lineups && (match.lineups.home.startingXI.length > 0 || match.lineups.away.startingXI.length > 0) && (
        <section className="mx-auto max-w-[1440px] px-6 pb-12 sm:px-12">
          <div className="section-rule mb-6 pt-6">
            <h2 className="section-label">TEAMSHEETS</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Lineup
              title={match.homeTeam.name}
              xi={match.lineups.home.startingXI}
              subs={match.lineups.home.substitutes}
              formation={match.lineups.home.formation}
            />
            <Lineup
              title={match.awayTeam.name}
              xi={match.lineups.away.startingXI}
              subs={match.lineups.away.substitutes}
              formation={match.lineups.away.formation}
            />
          </div>
        </section>
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
    <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] tracking-[1.5px] text-[var(--foreground-secondary)]">
      <span>SOURCE: {source.toUpperCase()}</span>
      <span>·</span>
      <span>{cached ? "CACHED" : "FRESH"} · {fetchedLabel}</span>
      <span>·</span>
      <span className={hasXg ? "text-[var(--foreground)]" : "text-[var(--foreground-accent)]"}>
        {hasXg ? "xG LIVE" : "xG UNAVAILABLE"}
      </span>
    </div>
  );
}

function EventTimeline({ events, match }: { events: MatchEvent[]; match: Match }) {
  const homeId = match.homeTeam.id;
  return (
    <ol className="space-y-0">
      {events.map((e, i) => {
        const isHome = e.team === homeId;
        const teamLabel = isHome ? match.homeTeam.shortName.toUpperCase() : match.awayTeam.shortName.toUpperCase();
        const eventLabel =
          e.type === "goal"
            ? `GOAL — ${(e.player || e.detail || "Unknown").toUpperCase()}${e.detail?.includes("pen") ? " (pen.)" : ""}`
            : (e.detail || e.type).toUpperCase();
        return (
          <li key={`${e.minute}-${e.type}-${e.player}-${i}`}>
            <div className="flex items-baseline gap-4 py-3">
              <span className="w-10 text-[11px] tabular-nums text-[var(--foreground-secondary)]">{e.minute}&apos;</span>
              <span
                className={`w-12 text-[11px] tracking-[2px] ${
                  isHome ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-secondary)]"
                }`}
              >
                {teamLabel}
              </span>
              <span className="font-heading text-[15px] text-[var(--foreground)]">{eventLabel}</span>
            </div>
            <div className="h-px bg-[var(--border)]" />
          </li>
        );
      })}
    </ol>
  );
}

function Lineup({
  title,
  xi,
  subs,
  formation,
}: {
  title: string;
  xi: Player[];
  subs: Player[];
  formation: string;
}) {
  return (
    <div className="border border-[var(--border)] p-4">
      <div className="mb-3 flex items-baseline gap-3 border-b border-[var(--border)] pb-2">
        <span className="font-heading text-lg font-semibold text-[var(--foreground)]">{title.toUpperCase()}</span>
        {formation && <span className="text-[11px] text-[var(--foreground-secondary)]">{formation}</span>}
      </div>
      <ol>
        {xi.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 border-b border-[var(--border)] py-2 text-[13px] last:border-b-0"
          >
            <span className="w-6 text-right text-xs tabular-nums text-[var(--foreground-secondary)]">
              {p.number || "·"}
            </span>
            <span className="text-[var(--foreground)]">{p.name}</span>
            <span className="ml-auto text-[10px] text-[var(--foreground-secondary)]">{p.position}</span>
          </li>
        ))}
      </ol>
      {subs.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[10px] tracking-[2px] text-[var(--foreground-secondary)] hover:text-[var(--foreground)]">
            BENCH ({subs.length})
          </summary>
          <ol className="mt-2">
            {subs.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1.5 text-[12px] text-[var(--foreground-secondary)]">
                <span className="w-6 text-right tabular-nums">{p.number || "·"}</span>
                <span>{p.name}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

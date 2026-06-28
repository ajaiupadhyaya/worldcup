"use client";

import Link from "next/link";
import type { Match } from "@/lib/types";
import { useMatch } from "@/lib/hooks";
import { statusLabel } from "@/lib/format";
import { Flag } from "./Flag";
import { LiveDot } from "./LiveDot";
import { FormationPitch } from "./FormationPitch";

// The hero: the featured match presented as a broadcast frame — scoreboard
// supers on the left, the live tactics board on the right.
export function FeaturedMatch({ summary }: { summary: Match }) {
  // Pull detail for formations; fall back to the summary while it loads.
  const { data } = useMatch(summary.id);
  const match = data?.data ?? summary;
  const live = match.status === "live";
  const hasXg = Boolean(match.stats && (match.stats.xG.home > 0 || match.stats.xG.away > 0));

  return (
    <Link
      href={`/match/${match.id}`}
      className="group art-panel block overflow-hidden"
    >
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_320px] md:items-center md:p-6">
        {/* scoreboard */}
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-3 font-mono text-[11px] uppercase tracking-[0.2em]">
            {live && <LiveDot size={7} />}
            <span className={live ? "text-accent" : "text-muted"}>
              {live ? `LIVE · ${statusLabel(match)}` : match.status === "finished" ? "FULL TIME" : statusLabel(match)}
            </span>
            <span className="text-muted">· {match.round || match.homeTeam.group || "World Cup"}</span>
          </div>

          <TeamLine team={match.homeTeam} goals={match.score.home} color="var(--home)" show={match.status !== "scheduled"} />
          <TeamLine team={match.awayTeam} goals={match.score.away} color="var(--accent)" show={match.status !== "scheduled"} />

          <span className="mt-5 inline-block border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted transition-colors group-hover:border-home group-hover:bg-home group-hover:text-bg">
            Open tactics-cam →
          </span>
          <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em]">
            <span className="border border-border px-2 py-1 text-muted">
              source: {data?.source ?? match.source}
            </span>
            {data && (
              <span className="border border-border px-2 py-1 text-muted">
                {data.cached ? "cached" : "fresh"}
              </span>
            )}
            <span className={`border px-2 py-1 ${hasXg ? "border-home/50 text-home" : "border-accent/50 text-accent"}`}>
              {hasXg ? "xG live" : "xG pending"}
            </span>
          </div>
        </div>

        {/* tactics board */}
        <div className="slash-field mx-auto w-full max-w-[280px] border border-border p-3">
          <FormationPitch homeFormation={match.lineups?.home.formation} awayFormation={match.lineups?.away.formation} />
        </div>
      </div>
    </Link>
  );
}

function TeamLine({ team, goals, color, show }: { team: Match["homeTeam"]; goals: number; color: string; show: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="h-10 w-[4px] shrink-0" style={{ background: color }} />
      <Flag team={team} size={34} />
      <span className="flex-1 truncate font-display text-2xl leading-none text-text sm:text-3xl">
        {team.name}
      </span>
      {show && <span className="font-display text-4xl leading-none tabular-nums text-text">{goals}</span>}
    </div>
  );
}

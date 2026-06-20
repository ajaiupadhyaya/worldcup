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

  return (
    <Link
      href={`/match/${match.id}`}
      className="group block overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface"
    >
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_300px] md:items-center md:p-6">
        {/* scoreboard */}
        <div>
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]">
            {live && <LiveDot size={7} />}
            <span className={live ? "text-accent" : "text-muted"}>
              {live ? `LIVE · ${statusLabel(match)}` : match.status === "finished" ? "FULL TIME" : statusLabel(match)}
            </span>
            <span className="text-muted">· {match.round || match.homeTeam.group || "World Cup"}</span>
          </div>

          <TeamLine team={match.homeTeam} goals={match.score.home} color="var(--home)" show={match.status !== "scheduled"} />
          <TeamLine team={match.awayTeam} goals={match.score.away} color="var(--accent)" show={match.status !== "scheduled"} />

          <span className="mt-4 inline-block font-mono text-[11px] uppercase tracking-widest text-muted transition-colors group-hover:text-home">
            Open tactics-cam →
          </span>
        </div>

        {/* tactics board */}
        <div className="mx-auto w-full max-w-[260px]">
          <FormationPitch homeFormation={match.lineups?.home.formation} awayFormation={match.lineups?.away.formation} />
        </div>
      </div>
    </Link>
  );
}

function TeamLine({ team, goals, color, show }: { team: Match["homeTeam"]; goals: number; color: string; show: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-9 w-1 rounded-full" style={{ background: color }} />
      <Flag team={team} size={34} />
      <span className="flex-1 truncate font-display text-2xl leading-none text-text sm:text-3xl">
        {team.name}
      </span>
      {show && <span className="font-display text-4xl leading-none tabular-nums text-text">{goals}</span>}
    </div>
  );
}

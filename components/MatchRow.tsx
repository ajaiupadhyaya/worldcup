import Link from "next/link";
import type { Match } from "@/lib/types";
import { kitColor } from "@/lib/teamColors";
import { statusLabel, kickoffTime } from "@/lib/format";
import { Flag } from "./Flag";
import { LiveDot } from "./LiveDot";

// A fixture as two stacked team lines, each wearing its kit-colour programme
// spine on the left edge. Winner's score is full-strength; loser's is muted.
export function MatchRow({ match }: { match: Match }) {
  const { homeTeam, awayTeam, score, status } = match;
  const decided = status !== "scheduled"; // show scores for live + finished
  // Dim only a team that LOST a finished match — a side merely trailing in a
  // live match stays bright (draws always stay bright).
  const final = status === "finished";
  const homeLost = final && score.home < score.away;
  const awayLost = final && score.away < score.home;

  const line = (team: typeof homeTeam, goals: number, dim: boolean) => (
    <div className="flex items-center gap-3 py-1.5">
      <span className="h-7 w-[3px] shrink-0" style={{ background: kitColor(team) }} />
      <Flag team={team} size={22} />
      <span className={`flex-1 truncate text-[15px] ${dim ? "text-muted" : "text-text"}`}>
        {team.name}
      </span>
      {decided ? (
        <span className={`font-mono text-lg tabular-nums ${dim ? "text-muted" : "text-text"}`}>
          {goals}
        </span>
      ) : null}
    </div>
  );

  return (
    <Link
      href={`/match/${match.id}`}
      className="art-panel-quiet block px-3 py-2 transition-colors hover:border-home hover:bg-surface"
    >
      <div className="mb-1 flex items-center justify-between border-b border-border/70 pb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {match.round || match.homeTeam.group || "Match"}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          {status === "live" && <LiveDot size={6} />}
          <span className={status === "live" ? "text-accent" : "text-muted"}>
            {status === "scheduled" ? kickoffTime(match.kickoff) : statusLabel(match)}
          </span>
        </span>
      </div>
      {line(homeTeam, score.home, homeLost)}
      {line(awayTeam, score.away, awayLost)}
    </Link>
  );
}

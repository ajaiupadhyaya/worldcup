import Link from "next/link";
import type { Match } from "@/lib/types";
import { kickoffTime, statusLabel } from "@/lib/format";
import { LiveDot } from "./LiveDot";

export function MatchRow({ match, index = 0 }: { match: Match; index?: number }) {
  const { homeTeam, awayTeam, score, status } = match;
  const decided = status !== "scheduled";
  const live = status === "live";
  const hasXg = Boolean(match.stats && (match.stats.xG.home > 0 || match.stats.xG.away > 0));
  const alt = index % 2 === 0;

  return (
    <Link
      href={`/match/${match.id}`}
      className={`group relative flex h-[55px] items-center px-6 transition-colors hover:bg-[var(--row-alt)] sm:px-12 ${
        alt ? "bg-[var(--row-alt)]" : "bg-[var(--background)]"
      }`}
    >
      <span className="w-10 shrink-0 text-[11px] text-[var(--foreground-secondary)]">
        {match.homeTeam.group?.replace("Group ", "") || "—"}
      </span>
      <span className="w-16 shrink-0 text-[11px] tabular-nums text-[var(--foreground-secondary)]">
        {status === "scheduled" ? kickoffTime(match.kickoff) : statusLabel(match)}
      </span>
      <span className="min-w-0 flex-1 truncate font-heading text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {homeTeam.name.toUpperCase()}
      </span>
      <span
        className={`w-24 shrink-0 text-center font-heading text-[22px] font-semibold tabular-nums ${
          live ? "text-[var(--foreground-accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {decided ? `${score.home} — ${score.away}` : "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-right font-heading text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {awayTeam.name.toUpperCase()}
      </span>
      <span className="ml-4 hidden w-16 shrink-0 text-right text-[9px] tracking-[1px] text-[var(--foreground-secondary)] sm:inline">
        {hasXg ? `xG ${match.stats!.xG.home.toFixed(2)}–${match.stats!.xG.away.toFixed(2)}` : "xG —"}
      </span>
      {live && (
        <span className="absolute right-4 sm:hidden">
          <LiveDot size={6} />
        </span>
      )}
    </Link>
  );
}

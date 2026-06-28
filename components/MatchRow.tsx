import Link from "next/link";
import type { Match } from "@/lib/types";
import { kickoffTime, statusLabel } from "@/lib/format";
import { LiveDot } from "./LiveDot";

export function MatchRow({ match, index = 0 }: { match: Match; index?: number }) {
  const { homeTeam, awayTeam, score, status } = match;
  const decided = status !== "scheduled";
  const live = status === "live";
  const hasXg = Boolean(match.stats && (match.stats.xG.home > 0 || match.stats.xG.away > 0));

  return (
    <Link
      href={`/match/${match.id}`}
      className="group relative flex h-[58px] items-center gap-3 border-b border-[var(--border)] bg-transparent px-6 transition-colors duration-200 hover:bg-[var(--surface-dark)] sm:px-12 lg:px-20"
    >
      <span className="w-6 shrink-0 text-[11px] tabular-nums text-[var(--foreground-faint)] transition-colors group-hover:text-[var(--foreground-accent)]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="w-9 shrink-0 text-[10px] tracking-[0.12em] text-[var(--foreground-secondary)] transition-colors group-hover:text-[var(--foreground-inverse-dim)]">
        {match.homeTeam.group?.replace("Group ", "") || "—"}
      </span>
      <span className="w-16 shrink-0 text-[10px] tabular-nums tracking-[0.08em] text-[var(--foreground-secondary)] transition-colors group-hover:text-[var(--foreground-inverse-dim)]">
        {status === "scheduled" ? kickoffTime(match.kickoff) : statusLabel(match)}
      </span>
      <span className="min-w-0 flex-1 truncate font-heading text-[clamp(15px,2.1vw,22px)] font-semibold tracking-[-0.02em] text-[var(--foreground)] transition-colors group-hover:text-[var(--foreground-inverse)]">
        {homeTeam.name.toUpperCase()}
      </span>
      <span
        className={`w-24 shrink-0 text-center font-heading text-[22px] font-semibold tabular-nums transition-colors ${
          live
            ? "text-[var(--foreground-accent)]"
            : "text-[var(--foreground)] group-hover:text-[var(--foreground-inverse)]"
        }`}
      >
        {decided ? `${score.home}–${score.away}` : "·"}
      </span>
      <span className="min-w-0 flex-1 truncate text-right font-heading text-[clamp(15px,2.1vw,22px)] font-semibold tracking-[-0.02em] text-[var(--foreground)] transition-colors group-hover:text-[var(--foreground-inverse)]">
        {awayTeam.name.toUpperCase()}
      </span>
      <span className="ml-4 hidden w-16 shrink-0 text-right text-[9px] tracking-[0.1em] text-[var(--foreground-faint)] transition-colors group-hover:text-[var(--foreground-inverse-dim)] sm:inline">
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

"use client";

import Link from "next/link";
import { useMatches } from "@/lib/hooks";
import { byInterest, statusLabel } from "@/lib/format";
import { LiveDot } from "./LiveDot";

// The persistent broadcast lower-third. Mono ticker of live (or next) matches,
// pinned to the top of every page.
export function TickerBar() {
  const { data } = useMatches();
  const matches = (data?.data ?? []).slice().sort(byInterest);
  const live = matches.filter((m) => m.status === "live");
  const scheduled = matches.filter((m) => m.status === "scheduled");
  const finished = matches.filter((m) => m.status === "finished");
  // Prefer live, then upcoming, then recent results so the bar is never empty
  // when only finished matches remain on the board.
  const ticker = (live.length ? live : scheduled.length ? scheduled : finished).slice(0, 6);
  const labelKind = live.length ? "live" : scheduled.length ? "upcoming" : "results";

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/88">
      <div className="mx-auto flex max-w-7xl items-center gap-0 px-4 font-mono text-xs">
        <span className="flex shrink-0 items-center gap-1.5 border-l border-r border-border px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted">
          {live.length ? <LiveDot size={7} /> : null}
          {labelKind === "live" ? "LIVE" : labelKind === "upcoming" ? "NEXT UP" : "RESULTS"}
        </span>
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {ticker.length === 0 ? (
            <span className="px-3 py-2 text-muted">No fixtures on the board</span>
          ) : (
            ticker.map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="flex shrink-0 items-center gap-2 border-r border-border px-3 py-2 text-text/90 transition-colors hover:bg-surface hover:text-text"
              >
                <span className="text-muted">{m.homeTeam.shortName}</span>
                <span className="tabular-nums">
                  {labelKind === "live" || m.status === "finished"
                    ? `${m.score.home}–${m.score.away}`
                    : "v"}
                </span>
                <span className="text-muted">{m.awayTeam.shortName}</span>
                <span className="text-[10px] text-accent">{statusLabel(m)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useMatches } from "@/lib/hooks";
import { byInterest, statusLabel } from "@/lib/format";

export function TickerBar() {
  const pathname = usePathname();
  const { data } = useMatches();
  const matches = (data?.data ?? []).slice().sort(byInterest);
  const live = matches.filter((m) => m.status === "live");
  const scheduled = matches.filter((m) => m.status === "scheduled");
  const finished = matches.filter((m) => m.status === "finished");
  const ticker = (live.length ? live : scheduled.length ? scheduled : finished).slice(0, 8);

  if (pathname !== "/" || ticker.length === 0) return null;

  const items = ticker.map((m) => {
    const score =
      m.status === "live" || m.status === "finished"
        ? `${m.homeTeam.shortName} ${m.score.home}–${m.score.away} ${m.awayTeam.shortName}`
        : `${m.homeTeam.shortName} v ${m.awayTeam.shortName} ${statusLabel(m)}`;
    return score;
  });

  return (
    <div className="overflow-hidden bg-[var(--foreground-accent)]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 py-3 sm:px-12">
        <span className="shrink-0 text-[9px] font-bold tracking-[3px] text-[var(--foreground-inverse)]">
          LIVE
        </span>
        <span className="text-[var(--foreground-inverse)] opacity-60">|</span>
        <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[10px] tracking-[1.5px] text-[var(--foreground-inverse)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {items.join("   ·   ")}
        </div>
      </div>
    </div>
  );
}

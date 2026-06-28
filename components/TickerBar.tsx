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
  const source = live.length ? live : scheduled.length ? scheduled : finished;
  const ticker = source.slice(0, 10);

  if (pathname !== "/" || ticker.length === 0) return null;

  const label = live.length ? "LIVE" : scheduled.length ? "NEXT" : "RESULTS";

  const items = ticker.map((m) =>
    m.status === "live" || m.status === "finished"
      ? `${m.homeTeam.shortName} ${m.score.home}–${m.score.away} ${m.awayTeam.shortName}`
      : `${m.homeTeam.shortName} v ${m.awayTeam.shortName} · ${statusLabel(m)}`,
  );

  // Duplicate the run so the marquee loops seamlessly across the -50% shift.
  const run = [...items, ...items];

  return (
    <div className="marquee flex items-stretch overflow-hidden border-y border-[var(--surface-deep)] bg-[var(--foreground-accent)] text-[var(--foreground-inverse)]">
      <div className="flex shrink-0 items-center gap-2 border-r border-[var(--foreground-inverse)]/25 px-5">
        {live.length > 0 && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground-inverse)] live-dot" aria-hidden />
        )}
        <span className="text-[9px] font-bold tracking-[0.3em]">{label}</span>
      </div>
      <div className="relative flex min-w-0 flex-1 items-center overflow-hidden py-2.5">
        <div className="marquee-track">
          {run.map((item, i) => (
            <span key={i} className="px-5 text-[10px] tracking-[0.18em]">
              {item}
              <span className="ml-5 text-[var(--foreground-inverse)]/45">/</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

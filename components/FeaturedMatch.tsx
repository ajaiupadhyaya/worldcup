"use client";

import Link from "next/link";
import type { Match } from "@/lib/types";
import { useMatch } from "@/lib/hooks";
import { kickoffTime, statusLabel } from "@/lib/format";
import { LiveDot } from "./LiveDot";

export function FeaturedMatch({ summary }: { summary: Match }) {
  const { data } = useMatch(summary.id);
  const match = data?.data ?? summary;
  const live = match.status === "live";
  const decided = match.status !== "scheduled";
  const hasXg = Boolean(match.stats && (match.stats.xG.home > 0 || match.stats.xG.away > 0));

  const metaItems = [
    match.venue?.toUpperCase(),
    match.round?.toUpperCase(),
    match.status === "scheduled" ? kickoffTime(match.kickoff) : statusLabel(match),
    hasXg ? `xG  ${match.stats!.xG.home.toFixed(2)} — ${match.stats!.xG.away.toFixed(2)}` : null,
  ].filter(Boolean);

  return (
    <Link href={`/match/${match.id}`} className="group block bg-[var(--surface-featured)]">
      <div className="relative mx-auto max-w-[1440px] px-6 py-10 sm:px-12">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="text-left">
            <p className="font-heading text-[clamp(40px,8vw,86px)] font-bold italic leading-[0.9] tracking-[-0.02em] text-[var(--foreground-inverse)]">
              {match.homeTeam.name.toUpperCase()}
            </p>
            <p className="mt-1 text-[11px] tracking-[2px] text-[var(--foreground-secondary)]">
              {match.homeTeam.shortName}
            </p>
          </div>

          <div className="text-center">
            {live && (
              <div className="mb-2 flex items-center justify-center gap-2">
                <LiveDot size={8} />
                <span className="text-[10px] tracking-[2px] text-[var(--foreground-accent)]">
                  {statusLabel(match)}
                </span>
              </div>
            )}
            <p className="font-heading text-[clamp(64px,10vw,110px)] font-bold leading-none text-[var(--foreground-inverse)]">
              {decided ? `${match.score.home} — ${match.score.away}` : "—"}
            </p>
          </div>

          <div className="text-right">
            <p className="font-heading text-[clamp(40px,8vw,86px)] font-bold italic leading-[0.9] tracking-[-0.02em] text-[var(--foreground-inverse)]">
              {match.awayTeam.name.toUpperCase()}
            </p>
            <p className="mt-1 text-[11px] tracking-[2px] text-[var(--foreground-secondary)]">
              {match.awayTeam.shortName}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--surface-deep)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3 text-[10px] tracking-[1.5px] text-[var(--foreground-secondary)] sm:px-12">
          {metaItems.map((item, i) => (
            <span key={`${item}-${i}`} className="flex items-center gap-3">
              {i > 0 && <span className="text-[var(--foreground-secondary)]">·</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

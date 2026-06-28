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
      <div className="relative mx-auto max-w-[1480px] px-6 py-9 sm:px-12 lg:px-20">
        {/* eyebrow */}
        <div className="mb-7 flex items-center justify-between">
          <span className="kicker text-[var(--foreground-inverse-dim)]">
            {live ? "Live now — featured tie" : "Featured tie"}
          </span>
          <span className="flex items-center gap-2 text-[9px] tracking-[0.26em] text-[var(--foreground-inverse-dim)] transition-colors group-hover:text-[var(--foreground-accent)]">
            ENTER THE DOSSIER
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
          </span>
        </div>

        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="text-left">
            <p className="misreg font-heading text-[clamp(38px,8vw,92px)] font-extrabold italic leading-[0.86] tracking-[-0.03em] text-[var(--foreground-inverse)]">
              {match.homeTeam.name.toUpperCase()}
            </p>
            <p className="mt-2 text-[10px] tracking-[0.26em] text-[var(--foreground-inverse-dim)]">
              {match.homeTeam.shortName} · HOME
            </p>
          </div>

          <div className="flex flex-col items-center">
            {live ? (
              <div className="mb-2 flex items-center gap-2">
                <LiveDot size={8} />
                <span className="text-[10px] tracking-[0.22em] text-[var(--foreground-accent)]">
                  {statusLabel(match)}
                </span>
              </div>
            ) : (
              <span className="mb-2 font-heading text-[14px] font-light italic text-[var(--foreground-inverse-dim)]">
                versus
              </span>
            )}
            <p className="font-heading text-[clamp(56px,10vw,116px)] font-extrabold leading-none text-[var(--foreground-inverse)]">
              {decided ? (
                <>
                  {match.score.home}
                  <span className="px-2 text-[var(--foreground-accent)]">–</span>
                  {match.score.away}
                </>
              ) : (
                <span className="text-[var(--foreground-inverse-dim)]">vs</span>
              )}
            </p>
          </div>

          <div className="text-right">
            <p className="misreg font-heading text-[clamp(38px,8vw,92px)] font-extrabold italic leading-[0.86] tracking-[-0.03em] text-[var(--foreground-inverse)]">
              {match.awayTeam.name.toUpperCase()}
            </p>
            <p className="mt-2 text-[10px] tracking-[0.26em] text-[var(--foreground-inverse-dim)]">
              {match.awayTeam.shortName} · AWAY
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-dark)] bg-[var(--surface-deep)]">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[10px] tracking-[0.18em] text-[var(--foreground-inverse-dim)] sm:px-12 lg:px-20">
          {metaItems.map((item, i) => (
            <span key={`${item}-${i}`} className="flex items-center gap-4">
              {i > 0 && <span className="text-[var(--foreground-accent)]">·</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

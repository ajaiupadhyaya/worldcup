"use client";

import type { BracketSlotProb } from "@/lib/predictions";
import { formatProb } from "@/lib/probability";
import { ProbBar } from "@/components/predict/ProbBar";
import { championLadder, mostLikely } from "@/lib/bracketView";
import { useTeamPath } from "@/components/bracket/TeamPathProvider";

/**
 * ChampionPanel — single source of truth is the M104 winner distribution
 * (tree.champion), which equals teams.winCup. Enlarged projected champion +
 * compact title-odds leaderboard (top 6).
 */
export function ChampionPanel({
  champion,
  name,
}: {
  champion: BracketSlotProb[];
  name: (id: string) => string;
}) {
  const { selectedTeamId, selectTeam } = useTeamPath();
  const top = mostLikely(champion);
  const ladder = championLadder(champion, 6);

  return (
    <section
      aria-label="Projected champion and title odds"
      className="mx-auto mt-8 grid max-w-[1480px] gap-6 px-6 sm:px-12 lg:grid-cols-[1fr_1.1fr]"
    >
      {/* Hero: projected champion */}
      <div className="border border-[var(--border-strong)] bg-[var(--paper-pure)] p-6">
        <p className="section-label">Projected champion</p>
        <p className="misreg mt-2 font-heading text-[clamp(40px,7vw,92px)] font-black italic leading-[0.85] text-[var(--foreground)]">
          {top ? name(top.id).toUpperCase() : "—"}
        </p>
        <p className="mt-3 text-[13px] tracking-[0.04em] text-[var(--foreground-secondary)]">
          {top
            ? `${formatProb(top.prob)} to lift the trophy`
            : "Awaiting the draw"}
        </p>
        {top && (
          <button
            type="button"
            aria-pressed={top.id === selectedTeamId}
            onClick={() => selectTeam(top.id)}
            className="mt-4 border border-[var(--border)] px-3 py-1 text-[11px] tracking-[0.12em] text-[var(--foreground-secondary)] hover:border-[var(--foreground-accent)] hover:text-[var(--foreground-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--foreground-accent)]"
          >
            {top.id === selectedTeamId
              ? `VIEWING ${name(top.id).toUpperCase()}'S ROAD — CLEAR`
              : `TRACE ${name(top.id).toUpperCase()}'S ROAD`}
          </button>
        )}
      </div>

      {/* Title-odds ladder */}
      <div className="border border-[var(--border)]">
        <div className="border-b border-[var(--border)] px-4 py-2 text-[10px] tracking-[0.2em] text-[var(--foreground-secondary)]">
          TITLE ODDS
        </div>
        {ladder.map((e, i) => {
          const selected = e.id === selectedTeamId;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={selected}
              onClick={() => selectTeam(e.id)}
              className={`flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-2 text-left last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--foreground-accent)] ${
                selected
                  ? "bg-[var(--row-alt)]"
                  : "hover:bg-[var(--row-alt)]"
              }`}
            >
              <span className="w-5 text-right text-xs text-[var(--foreground-secondary)]">
                {i + 1}
              </span>
              <span className="w-32 truncate font-heading text-[13px] font-semibold sm:w-40">
                {name(e.id).toUpperCase()}
              </span>
              <span className="flex-1">
                <ProbBar
                  value={e.prob / (ladder[0]?.prob || 1)}
                  color={
                    selected
                      ? "var(--foreground-accent)"
                      : "var(--foreground)"
                  }
                  label={`${name(e.id)}: ${formatProb(e.prob)} to win`}
                />
              </span>
              <span className="w-12 text-right text-[13px] tabular-nums text-[var(--foreground)]">
                {formatProb(e.prob)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

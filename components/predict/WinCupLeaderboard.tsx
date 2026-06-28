import type { PredTeam } from "@/lib/predictions";
import { formatProb } from "@/lib/predictions";
import { ProbBar } from "./ProbBar";

export function WinCupLeaderboard({ teams }: { teams: PredTeam[] }) {
  const ranked = [...teams].sort((a, b) => b.winCup - a.winCup);
  const top = ranked[0]?.winCup ?? 1;
  return (
    <div className="border border-[var(--border)]">
      {ranked.map((t, i) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 border-b border-[var(--border)] px-4 py-2 last:border-b-0 hover:bg-[var(--row-alt)] ${
            i % 2 === 0 ? "bg-[var(--row-alt)]" : "bg-[var(--background)]"
          }`}
        >
          <span className="w-5 text-right text-xs text-[var(--foreground-secondary)]">{i + 1}</span>
          <span className="w-36 truncate font-heading text-[13px] font-semibold sm:w-44">{t.name.toUpperCase()}</span>
          <span className="flex-1">
            <ProbBar value={t.winCup / top} label={`${t.name}: ${formatProb(t.winCup)} to win the cup`} />
          </span>
          <span className="w-12 text-right text-[13px] tabular-nums text-[var(--foreground)]">
            {formatProb(t.winCup)}
          </span>
          <span className="hidden w-12 text-right text-[10px] tabular-nums text-[var(--foreground-secondary)] sm:inline">
            ±{(t.mcStdErr.winCup * 100).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

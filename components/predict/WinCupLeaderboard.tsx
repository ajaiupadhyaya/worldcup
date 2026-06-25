import type { PredTeam } from "@/lib/predictions";
import { formatProb } from "@/lib/predictions";
import { kitColor } from "@/lib/teamColors";
import { ProbBar } from "./ProbBar";

// All 48 teams ranked by P(win cup). Sort here so the ranking is self-contained
// (not reliant on the snapshot's order). Bars are normalised to the leader so the
// field stays readable; the printed % and ± are the true values.
export function WinCupLeaderboard({ teams }: { teams: PredTeam[] }) {
  const ranked = [...teams].sort((a, b) => b.winCup - a.winCup);
  const top = ranked[0]?.winCup ?? 1;
  return (
    <div className="art-panel overflow-hidden">
      {ranked.map((t, i) => (
        <div
          key={t.id}
          className="flex items-center gap-3 border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-2/70"
        >
          <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
          <span
            className="h-5 w-[3px] shrink-0"
            style={{ background: kitColor({ name: t.name, shortName: t.name }) }}
          />
          <span className="w-36 truncate text-[13px] text-text sm:w-44">{t.name}</span>
          <span className="flex-1">
            <ProbBar value={t.winCup / top} label={`${t.name}: ${formatProb(t.winCup)} to win the cup`} />
          </span>
          <span className="w-12 text-right font-mono text-[13px] tabular-nums text-text">
            {formatProb(t.winCup)}
          </span>
          <span className="hidden w-12 text-right font-mono text-[10px] tabular-nums text-muted sm:inline">
            ±{(t.mcStdErr.winCup * 100).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

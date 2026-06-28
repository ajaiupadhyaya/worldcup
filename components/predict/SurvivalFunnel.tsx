import type { PredTeam } from "@/lib/predictions";
import { formatProb, funnelRows } from "@/lib/predictions";
import { ProbBar } from "./ProbBar";

export function SurvivalFunnel({ teams }: { teams: PredTeam[] }) {
  const cols = funnelRows(teams, 8);
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto sm:grid-flow-row sm:grid-cols-5">
      {cols.map((col) => (
        <div key={col.key} className="border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-2 py-1.5 text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">
            {col.label.toUpperCase()}
          </div>
          <div className="divide-y divide-[var(--border)]">
            {col.entries.map((e) => (
              <div key={e.id} className="px-2 py-1.5 hover:bg-[var(--row-alt)]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] text-[var(--foreground)]">{e.name}</span>
                  <span className="text-[11px] tabular-nums text-[var(--foreground-secondary)]">{formatProb(e.prob)}</span>
                </div>
                <div className="mt-1">
                  <ProbBar
                    value={e.prob}
                    label={`${e.name}: ${formatProb(e.prob)} ${
                      col.key === "winCup" ? "to win the cup" : `to reach the ${col.label}`
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

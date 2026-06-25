import type { PredTeam } from "@/lib/predictions";
import { formatProb, funnelRows } from "@/lib/predictions";
import { ProbBar } from "./ProbBar";

// Five stage columns R16 -> Champion; each lists the top teams by probability
// of reaching that stage. Honest survival view of the Monte-Carlo.
export function SurvivalFunnel({ teams }: { teams: PredTeam[] }) {
  const cols = funnelRows(teams, 8);
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto sm:grid-flow-row sm:grid-cols-5">
      {cols.map((col) => (
        <div key={col.key} className="art-panel">
          <div className="border-b border-border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            {col.label}
          </div>
          <div className="divide-y divide-border">
            {col.entries.map((e) => (
              <div key={e.id} className="px-2 py-1.5 transition-colors hover:bg-surface-2/70">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] text-text">{e.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted">{formatProb(e.prob)}</span>
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

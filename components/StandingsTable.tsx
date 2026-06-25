import type { Standing } from "@/lib/types";
import { formatProb, slugifyTeam } from "@/lib/predictions";
import { kitColor } from "@/lib/teamColors";
import { Flag } from "./Flag";

// A group table as a rack of programme spines: mono columns, each row wearing
// its kit-colour edge bar. The top-2 qualification line is drawn in chalk.
// When `projected` is supplied, a model qualify-probability column is appended.
export function StandingsTable({
  group,
  rows,
  projected,
}: {
  group: string;
  rows: Standing[];
  projected?: Record<string, number>;
}) {
  return (
    <div className="art-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-display text-base text-text">{group}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          P W D L GD Pts{projected ? " · Q%" : ""}
        </span>
      </div>
      <div>
        {rows.map((r, i) => {
          const q = projected?.[slugifyTeam(r.team.name)];
          return (
            <div key={r.team.id}>
              <div className="flex items-center gap-2 px-3 py-2 font-mono text-[13px] transition-colors hover:bg-surface-2/70">
                <span className="w-3 text-center text-muted">{r.rank || i + 1}</span>
                <span className="h-5 w-[3px] shrink-0" style={{ background: kitColor(r.team) }} />
                <Flag team={r.team} size={18} />
                <span className="flex-1 truncate font-[family-name:var(--font-body)] text-text">
                  {r.team.name}
                </span>
                <span className="grid grid-cols-6 gap-2 tabular-nums text-right text-muted">
                  <span>{r.played}</span>
                  <span>{r.won}</span>
                  <span>{r.drawn}</span>
                  <span>{r.lost}</span>
                  <span className={r.gd > 0 ? "text-text" : ""}>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
                  <span className="font-semibold text-text">{r.points}</span>
                </span>
                {projected && (
                  <span className="w-10 text-right tabular-nums text-home">
                    {q === undefined ? "—" : formatProb(q)}
                  </span>
                )}
              </div>
              {i === 1 && rows.length > 2 && (
                <div className="mx-3 border-b border-dashed" style={{ borderColor: "var(--chalk-faint)" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

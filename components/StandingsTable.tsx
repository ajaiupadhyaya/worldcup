import type { Standing } from "@/lib/types";
import { formatProb, slugifyTeam } from "@/lib/predictions";

export function StandingsTable({
  group,
  rows,
  projected,
}: {
  group: string;
  rows: Standing[];
  projected?: Record<string, number>;
}) {
  const letter = group.replace("Group ", "");

  return (
    <div className="min-w-0">
      <p className="font-heading text-[clamp(48px,10vw,80px)] font-bold italic leading-[0.9] text-[var(--foreground)]">
        {letter}
      </p>
      <div className="mt-2 border-t border-[var(--foreground-secondary)]">
        <div className="grid grid-cols-[1fr_repeat(7,minmax(0,2rem))] gap-2 py-2 text-[9px] tracking-[2px] text-[var(--foreground-secondary)]">
          <span>TEAM</span>
          <span className="text-center">MP</span>
          <span className="text-center">W</span>
          <span className="text-center">D</span>
          <span className="text-center">L</span>
          <span className="text-center">GF</span>
          <span className="text-center">GA</span>
          <span className="text-center">PTS</span>
        </div>
        {rows.map((r, i) => {
          const q = projected?.[slugifyTeam(r.team.name)];
          const qualified = r.rank <= 2;
          const alt = i % 2 === 0;
          return (
            <div key={r.team.id}>
              <div
                className={`grid grid-cols-[1fr_repeat(7,minmax(0,2rem))] items-center gap-2 py-2.5 text-[13px] ${
                  alt ? "bg-[var(--row-alt)]" : "bg-[var(--background)]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="w-4 text-[10px] text-[var(--foreground-secondary)]">{r.rank || i + 1}</span>
                  {qualified && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--foreground-accent)]" aria-hidden />
                  )}
                  <span
                    className={`truncate font-heading text-lg font-semibold ${
                      qualified ? "text-[var(--foreground-accent)]" : "text-[var(--foreground)]"
                    }`}
                  >
                    {r.team.name.toUpperCase()}
                  </span>
                  {projected && q !== undefined && (
                    <span className="ml-auto hidden text-[10px] tabular-nums text-[var(--foreground-secondary)] sm:inline">
                      Q {formatProb(q)}
                    </span>
                  )}
                </div>
                <span className="text-center tabular-nums text-[var(--foreground-secondary)]">{r.played}</span>
                <span className="text-center tabular-nums text-[var(--foreground-secondary)]">{r.won}</span>
                <span className="text-center tabular-nums text-[var(--foreground-secondary)]">{r.drawn}</span>
                <span className="text-center tabular-nums text-[var(--foreground-secondary)]">{r.lost}</span>
                <span className="text-center tabular-nums text-[var(--foreground-secondary)]">{r.gf}</span>
                <span className="text-center tabular-nums text-[var(--foreground-secondary)]">{r.ga}</span>
                <span className="text-center font-semibold tabular-nums text-[var(--foreground)]">{r.points}</span>
              </div>
              <div className="h-px bg-[var(--border)]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

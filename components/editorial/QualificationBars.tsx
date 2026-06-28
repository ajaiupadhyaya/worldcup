import { formatProb } from "@/lib/probability";
import { slugifyTeam } from "@/lib/predictions";

export function QualificationBars({
  teams,
  projected,
}: {
  teams: { name: string; rank: number }[];
  projected: Record<string, number>;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-6 py-8 sm:px-12">
      <div className="section-rule mb-6 pt-6">
        <h2 className="section-label">ROUND OF 32 — QUALIFICATION PROBABILITY</h2>
      </div>
      <div className="space-y-0">
        {teams.map((team, i) => {
          const prob = projected[slugifyTeam(team.name)] ?? 0;
          const topTwo = team.rank <= 2;
          const fillColor = topTwo ? "var(--foreground-accent)" : "var(--foreground)";
          const textColor = topTwo ? "text-[var(--foreground-accent)]" : "text-[var(--foreground)]";

          return (
            <div key={team.name}>
              <div className="flex items-center gap-4 py-3">
                <span className="w-36 shrink-0 font-heading text-base font-semibold text-[var(--foreground)] sm:w-44">
                  {team.name.toUpperCase()}
                </span>
                <div className="hidden h-1.5 flex-1 bg-[#ebebeb] sm:block">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.min(prob * 100, 100)}%`, background: fillColor }}
                  />
                </div>
                <span className={`w-14 text-right font-heading text-lg font-bold tabular-nums ${textColor}`}>
                  {formatProb(prob)}
                </span>
              </div>
              {i < teams.length - 1 && <div className="h-px max-w-[1100px] bg-[var(--border)]" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

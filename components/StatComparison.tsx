import type { Match } from "@/lib/types";

function StatRow({
  label,
  home,
  away,
  suffix = "",
}: {
  label: string;
  home: number | string;
  away: number | string;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-[var(--border)] py-4 last:border-b-0">
      <span className="font-heading text-[26px] font-bold tabular-nums text-[var(--foreground)]">
        {home}
        {suffix}
      </span>
      <span className="text-center text-[10px] tracking-[2px] text-[var(--foreground-secondary)]">{label}</span>
      <span className="text-right font-heading text-[26px] font-bold tabular-nums text-[var(--foreground-secondary)]">
        {away}
        {suffix}
      </span>
    </div>
  );
}

export function StatComparison({ match }: { match: Match }) {
  const s = match.stats;
  if (!s) {
    return (
      <p className="text-xs text-[var(--foreground-secondary)]">
        Match stats appear once the match is underway.
      </p>
    );
  }

  const hasXg = s.xG.home > 0 || s.xG.away > 0;
  const passAccHome = s.passes?.home ? Math.round((s.passes.home / (s.passes.home + (s.passes.away || 1))) * 100) : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between text-[11px] tracking-[2px]">
        <span className="font-semibold text-[var(--foreground)]">{match.homeTeam.shortName}</span>
        <span className="text-[var(--foreground-secondary)]">STATISTICS</span>
        <span className="text-[var(--foreground-secondary)]">{match.awayTeam.shortName}</span>
      </div>
      {hasXg && (
        <StatRow label="xG" home={s.xG.home.toFixed(2)} away={s.xG.away.toFixed(2)} />
      )}
      <StatRow label="POSSESSION" home={s.possession.home} away={s.possession.away} suffix="%" />
      <StatRow label="TOTAL SHOTS" home={s.shots.home} away={s.shots.away} />
      <StatRow label="SHOTS ON TARGET" home={s.shotsOnTarget.home} away={s.shotsOnTarget.away} />
      {s.corners && <StatRow label="CORNERS" home={s.corners.home} away={s.corners.away} />}
      {passAccHome !== null && s.passes && (
        <StatRow label="PASS ACCURACY" home={`${passAccHome}%`} away={`${100 - passAccHome}%`} />
      )}
      {!hasXg && (
        <p className="mt-2 text-[10px] text-[var(--foreground-secondary)]">
          xG unavailable from this source — add an API-Football key for expected goals.
        </p>
      )}
    </div>
  );
}

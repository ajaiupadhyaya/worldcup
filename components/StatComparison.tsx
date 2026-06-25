import type { Match } from "@/lib/types";

// Head-to-head stat bars: home grows from the left in telestrator cyan, away
// from the right in sodium amber, meeting in the middle. xG gets pride of place.
function Bar({ label, home, away, suffix = "" }: { label: string; home: number; away: number; suffix?: string }) {
  // Both-zero means the source omitted this stat — render nothing rather than a
  // misleading "0 vs 0" with an empty bar.
  if (home + away === 0) return null;
  const total = home + away;
  const homePct = (home / total) * 100;
  return (
    <div className="border-b border-border/60 py-3 last:border-b-0">
      <div className="mb-1 flex items-center justify-between font-mono text-[13px] tabular-nums">
        <span className="text-home">{home}{suffix}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</span>
        <span className="text-accent">{away}{suffix}</span>
      </div>
      <div className="flex h-2 overflow-hidden border border-border bg-bg">
        <span style={{ width: `${homePct}%`, background: "var(--home)" }} />
        <span style={{ width: `${100 - homePct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

export function StatComparison({ match }: { match: Match }) {
  const s = match.stats;
  if (!s) {
    return (
      <p className="border border-border p-3 font-mono text-xs text-muted">Match stats appear once the match is underway.</p>
    );
  }
  const hasXg = s.xG.home > 0 || s.xG.away > 0;
  return (
    <div>
      {hasXg && <Bar label="Expected goals" home={s.xG.home} away={s.xG.away} />}
      <Bar label="Possession" home={s.possession.home} away={s.possession.away} suffix="%" />
      <Bar label="Shots" home={s.shots.home} away={s.shots.away} />
      <Bar label="On target" home={s.shotsOnTarget.home} away={s.shotsOnTarget.away} />
      {s.corners && <Bar label="Corners" home={s.corners.home} away={s.corners.away} />}
      {s.passes && (s.passes.home > 0 || s.passes.away > 0) && (
        <Bar label="Passes" home={s.passes.home} away={s.passes.away} />
      )}
      {!hasXg && (
        <p className="mt-2 font-mono text-[10px] text-muted">
          xG unavailable from this source — add an API-Football key for expected goals.
        </p>
      )}
    </div>
  );
}

import type { Match } from "@/lib/types";

export function computeTournamentStats(matches: Match[]) {
  const finished = matches.filter((m) => m.status === "finished");
  const totalGoals = finished.reduce((sum, m) => sum + m.score.home + m.score.away, 0);
  const withXg = finished.filter((m) => m.stats && (m.stats.xG.home > 0 || m.stats.xG.away > 0));
  const avgXg =
    withXg.length > 0
      ? withXg.reduce((sum, m) => sum + (m.stats!.xG.home + m.stats!.xG.away), 0) / withXg.length
      : 0;

  return {
    goals: totalGoals,
    matchesPlayed: finished.length,
    avgXg: avgXg > 0 ? avgXg.toFixed(2) : "—",
  };
}

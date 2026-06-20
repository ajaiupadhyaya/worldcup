import type { Match } from "./types";

// Shared, presentation-agnostic formatting helpers.

/** Kickoff time as a short local time, e.g. "1:00 PM". */
export function kickoffTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Kickoff day label, e.g. "Sat, Jun 21". */
export function kickoffDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** A short, human status string for a match. */
export function statusLabel(match: Match): string {
  if (match.status === "live") return match.minute ? `${match.minute}'` : "LIVE";
  if (match.status === "finished") return "FT";
  return kickoffTime(match.kickoff);
}

/** Group fixtures by kickoff day (ISO date key) for sectioned lists. */
export function groupByDay(matches: Match[]): { day: string; iso: string; matches: Match[] }[] {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.kickoff.slice(0, 10); // YYYY-MM-DD
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(m);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, ms]) => ({
      iso,
      day: kickoffDay(ms[0].kickoff),
      matches: ms.sort((x, y) => x.kickoff.localeCompare(y.kickoff)),
    }));
}

/** Order matches by interest: live first, then upcoming soonest, then finished. */
export function byInterest(a: Match, b: Match): number {
  const rank = (m: Match) => (m.status === "live" ? 0 : m.status === "scheduled" ? 1 : 2);
  return rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff);
}

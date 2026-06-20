// ESPN hidden-endpoint client — the fallback data source.
// No auth, no SLA. Every call is wrapped in try/catch by callers; this module
// throws on hard failures and returns normalized domain types on success.
//
// Endpoints used:
//   scoreboard: site.api.espn.com/.../fifa.world/scoreboard
//   summary:    site.api.espn.com/.../fifa.world/summary?event={id}
//   standings:  site.api.espn.com/apis/v2/.../fifa.world/standings?season=2026

import type {
  Lineup,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStats,
  Player,
  Standing,
  Team,
} from "./types";

const SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
const CORE_BASE = "https://site.api.espn.com/apis/v2/sports/soccer/fifa.world";
const SEASON = 2026;

async function espnFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Always go to the network; our own cache layer governs freshness.
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`ESPN request failed (${res.status}) for ${url}`);
  }
  return (await res.json()) as T;
}

// ---- mapping helpers --------------------------------------------------------

function mapStatusState(state: string | undefined, completed: boolean | undefined): Match["status"] {
  if (completed || state === "post") return "finished";
  if (state === "in") return "live";
  return "scheduled";
}

function num(v: unknown): number {
  // Strip thousands separators / percent signs so "1,234" and "57%" parse.
  const n = typeof v === "string" ? parseFloat(v.replace(/[,%]/g, "")) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

// Parse an ESPN clock ("62'", "45'+2", "90:00", "HT") to a minute number.
function clockToMinute(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/(\d+)(?:\s*\+\s*(\d+))?/);
  if (!m) return undefined;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

function mapTeam(raw: any, group?: string): Team {
  return {
    id: String(raw?.id ?? ""),
    name: raw?.displayName ?? raw?.name ?? "Unknown",
    shortName: raw?.abbreviation ?? raw?.shortDisplayName ?? raw?.name ?? "",
    flag: raw?.logo ?? raw?.flag ?? "",
    group,
  };
}

function statValue(stats: any[], name: string): number {
  const s = stats?.find((x) => x?.name === name);
  // Prefer the numeric `value` (displayValue can be "1,234" or "+3").
  return s ? num(s.value ?? s.displayValue) : 0;
}

// ---- public API -------------------------------------------------------------

/** All fixtures on the World Cup scoreboard, normalized. */
export async function getMatches(): Promise<Match[]> {
  const data = await espnFetch<any>(`${SITE_BASE}/scoreboard`);
  const events: any[] = data?.events ?? [];
  return events.map(mapEvent).filter(Boolean) as Match[];
}

function mapEvent(event: any): Match | null {
  const comp = event?.competitions?.[0];
  if (!comp) return null;
  const competitors: any[] = comp.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const statusType = event?.status?.type ?? comp?.status?.type ?? {};
  const status = mapStatusState(statusType.state, statusType.completed);
  const minute = status === "live" ? clockToMinute(event?.status?.displayClock) : undefined;

  return {
    id: String(event.id),
    homeTeam: mapTeam(home.team),
    awayTeam: mapTeam(away.team),
    status,
    minute: minute && minute > 0 ? minute : undefined,
    kickoff: event.date,
    score: { home: num(home.score), away: num(away.score) },
    venue: comp?.venue?.fullName,
    round: event?.season?.slug ?? comp?.notes?.[0]?.headline,
    source: "espn",
  };
}

/** Full single-match detail: stats, lineups, events. */
export async function getMatch(id: string): Promise<Match> {
  const [scoreboard, summary] = await Promise.all([
    espnFetch<any>(`${SITE_BASE}/scoreboard`).catch(() => null),
    espnFetch<any>(`${SITE_BASE}/summary?event=${encodeURIComponent(id)}`),
  ]);

  // Base match comes from the header in the summary (always present), with the
  // scoreboard event as a richer fallback for status/score if available.
  const header = summary?.header;
  const sbEvent = scoreboard?.events?.find((e: any) => String(e.id) === String(id));
  const base = sbEvent ? mapEvent(sbEvent) : mapHeader(header);
  if (!base) throw new Error(`ESPN: match ${id} not found`);

  base.stats = mapStats(summary);
  base.lineups = mapLineups(summary);
  base.events = mapEvents(summary, base.homeTeam.id);
  return base;
}

function mapHeader(header: any): Match | null {
  const comp = header?.competitions?.[0];
  if (!comp) return null;
  const competitors: any[] = comp.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;
  const statusType = comp?.status?.type ?? {};
  return {
    id: String(header.id),
    homeTeam: mapTeam(home.team),
    awayTeam: mapTeam(away.team),
    status: mapStatusState(statusType.state, statusType.completed),
    kickoff: comp.date,
    score: { home: num(home.score), away: num(away.score) },
    source: "espn",
  };
}

function mapStats(summary: any): MatchStats | undefined {
  const teams: any[] = summary?.boxscore?.teams ?? [];
  if (teams.length < 2) return undefined;
  // boxscore teams are ordered [home? , away?] — disambiguate by homeAway when present.
  const homeTeam = teams.find((t) => t?.homeAway === "home") ?? teams[0];
  const awayTeam = teams.find((t) => t?.homeAway === "away") ?? teams[1];
  const h = homeTeam?.statistics ?? [];
  const a = awayTeam?.statistics ?? [];

  // ESPN does not expose xG on this endpoint; left at 0 and filled by
  // API-Football when that source is active.
  return {
    xG: { home: 0, away: 0 },
    possession: { home: statValue(h, "possessionPct"), away: statValue(a, "possessionPct") },
    shots: { home: statValue(h, "totalShots"), away: statValue(a, "totalShots") },
    shotsOnTarget: { home: statValue(h, "shotsOnTarget"), away: statValue(a, "shotsOnTarget") },
    passes: { home: statValue(h, "totalPasses"), away: statValue(a, "totalPasses") },
    corners: { home: statValue(h, "wonCorners"), away: statValue(a, "wonCorners") },
    fouls: { home: statValue(h, "foulsCommitted"), away: statValue(a, "foulsCommitted") },
    yellowCards: { home: statValue(h, "yellowCards"), away: statValue(a, "yellowCards") },
    redCards: { home: statValue(h, "redCards"), away: statValue(a, "redCards") },
  };
}

function mapPlayer(entry: any): Player {
  const ath = entry?.athlete ?? {};
  const pos = ath?.position?.abbreviation ?? entry?.position?.abbreviation ?? "";
  return {
    id: String(ath?.id ?? ""),
    name: ath?.displayName ?? ath?.fullName ?? "Unknown",
    number: num(entry?.jersey ?? ath?.jersey),
    position: pos || entry?.formationPlace || "",
    rating: entry?.rating ? num(entry.rating) : undefined,
  };
}

function mapLineups(summary: any): { home: Lineup; away: Lineup } | undefined {
  const rosters: any[] = summary?.rosters ?? [];
  if (rosters.length < 2) return undefined;
  const homeRoster = rosters.find((r) => r?.homeAway === "home") ?? rosters[0];
  const awayRoster = rosters.find((r) => r?.homeAway === "away") ?? rosters[1];

  const toLineup = (r: any): Lineup => {
    const players: any[] = r?.roster ?? [];
    return {
      formation: r?.formation ?? "",
      startingXI: players.filter((p) => p?.starter).map(mapPlayer),
      substitutes: players.filter((p) => !p?.starter).map(mapPlayer),
    };
  };
  return { home: toLineup(homeRoster), away: toLineup(awayRoster) };
}

function mapEventType(raw: string | undefined): MatchEventType | null {
  switch (raw) {
    case "goal":
    case "penalty-goal":
    case "own-goal":
      return "goal";
    case "yellow-card":
    case "red-card":
    case "yellow-red-card":
      return "card";
    case "substitution":
      return "substitution";
    case "var":
    case "video-review":
      return "var";
    default:
      return null;
  }
}

function mapEvents(summary: any, homeTeamId: string): MatchEvent[] {
  const key: any[] = summary?.keyEvents ?? [];
  const out: MatchEvent[] = [];
  for (const e of key) {
    const type = mapEventType(e?.type?.type);
    if (!type) continue;
    const athletes: any[] = e?.athletesInvolved ?? e?.participants ?? [];
    out.push({
      minute: clockToMinute(e?.clock?.displayValue) ?? 0,
      type,
      team: String(e?.team?.id ?? ""),
      player: athletes[0]?.displayName ?? e?.text ?? "",
      detail: e?.type?.text ?? e?.text,
      assist: athletes[1]?.displayName,
    });
  }
  return out.sort((x, y) => x.minute - y.minute);
}

/** All group standings, normalized. */
export async function getStandings(): Promise<Standing[]> {
  const data = await espnFetch<any>(`${CORE_BASE}/standings?season=${SEASON}`);
  const groups: any[] = data?.children ?? [];
  const out: Standing[] = [];
  for (const g of groups) {
    const groupName: string = g?.name ?? "Group";
    const entries: any[] = g?.standings?.entries ?? [];
    for (const en of entries) {
      const team = mapTeam(en.team, groupName);
      out.push({
        group: groupName,
        team,
        rank: statValue(en.stats, "rank"),
        played: statValue(en.stats, "gamesPlayed"),
        won: statValue(en.stats, "wins"),
        drawn: statValue(en.stats, "ties"),
        lost: statValue(en.stats, "losses"),
        gf: statValue(en.stats, "pointsFor"),
        ga: statValue(en.stats, "pointsAgainst"),
        gd: statValue(en.stats, "pointDifferential"),
        points: statValue(en.stats, "points"),
        form: en.stats?.find((s: any) => s?.name === "overall")?.displayValue,
      });
    }
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);
}

/** Head-to-head: ESPN bundles this inside the match summary. Best-effort. */
export async function getHeadToHead(matchId: string): Promise<any[]> {
  const summary = await espnFetch<any>(`${SITE_BASE}/summary?event=${encodeURIComponent(matchId)}`);
  return summary?.headToHeadGames ?? [];
}

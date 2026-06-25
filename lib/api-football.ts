/* eslint-disable @typescript-eslint/no-explicit-any */
// API-Football v3 client — the primary data source.
// Activates only when API_FOOTBALL_KEY is set; otherwise callers fall back to
// ESPN. Free tier is 100 req/day, so the cache layer in front of this is load
// bearing. Every response is normalized into the domain types in ./types.
//
// Docs: https://www.api-football.com/documentation-v3
// World Cup league id = 1, season = 2026.

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

const BASE = "https://v3.football.api-sports.io";
export const WORLD_CUP_LEAGUE = 1;
export const WORLD_CUP_SEASON = 2026;

export function hasApiFootballKey(): boolean {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

class ApiFootballError extends Error {}

async function af<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new ApiFootballError("API_FOOTBALL_KEY not configured");

  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new ApiFootballError(`API-Football ${path} failed (${res.status})`);
  }
  const body = (await res.json()) as { response: T[]; errors?: unknown };
  // API-Football returns 200 with an `errors` object on quota/auth problems.
  if (body.errors && (Array.isArray(body.errors) ? body.errors.length : Object.keys(body.errors).length)) {
    throw new ApiFootballError(`API-Football ${path} errors: ${JSON.stringify(body.errors)}`);
  }
  return body.response ?? [];
}

// ---- mapping helpers --------------------------------------------------------

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "string") {
    // Strip thousands separators and percent signs ("1,234" / "57%").
    const n = parseFloat(v.replace(/[,%]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return Number.isFinite(v as number) ? (v as number) : 0;
}

function mapTeam(raw: any, group?: string): Team {
  return {
    id: String(raw?.id ?? ""),
    name: raw?.name ?? "Unknown",
    shortName: raw?.code ?? raw?.name?.slice(0, 3)?.toUpperCase() ?? "",
    flag: raw?.logo ?? raw?.flag ?? "",
    group,
  };
}

function mapStatus(short: string | undefined): Match["status"] {
  // API-Football short status codes.
  const live = ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"];
  // ABD (abandoned) is terminal — treat as finished, not upcoming.
  // PST/CANC/SUSP/TBD/NS intentionally fall through to "scheduled".
  const finished = ["FT", "AET", "PEN", "AWD", "WO", "ABD"];
  if (finished.includes(short ?? "")) return "finished";
  if (live.includes(short ?? "")) return "live";
  return "scheduled";
}

function mapFixture(fx: any): Match {
  const f = fx.fixture ?? {};
  const teams = fx.teams ?? {};
  const goals = fx.goals ?? {};
  return {
    id: String(f.id),
    homeTeam: mapTeam(teams.home),
    awayTeam: mapTeam(teams.away),
    status: mapStatus(f.status?.short),
    minute: f.status?.elapsed ?? undefined,
    kickoff: f.date,
    score: { home: num(goals.home), away: num(goals.away) },
    venue: f.venue?.name,
    round: fx.league?.round,
    source: "api-football",
  };
}

// ---- public API -------------------------------------------------------------

export async function getMatches(): Promise<Match[]> {
  const fixtures = await af<any>("/fixtures", {
    league: WORLD_CUP_LEAGUE,
    season: WORLD_CUP_SEASON,
  });
  return fixtures.map(mapFixture);
}

export async function getMatch(id: string): Promise<Match> {
  const [fixtures, stats, lineups, events] = await Promise.all([
    af<any>("/fixtures", { id }),
    af<any>("/fixtures/statistics", { fixture: id }).catch(() => []),
    af<any>("/fixtures/lineups", { fixture: id }).catch(() => []),
    af<any>("/fixtures/events", { fixture: id }).catch(() => []),
  ]);
  if (!fixtures.length) throw new ApiFootballError(`fixture ${id} not found`);
  const match = mapFixture(fixtures[0]);
  match.stats = mapStats(stats, match.homeTeam.id);
  match.lineups = mapLineups(lineups, match.homeTeam.id);
  match.events = mapEvents(events);
  return match;
}

export async function getStats(id: string, homeTeamId?: string): Promise<MatchStats | undefined> {
  const stats = await af<any>("/fixtures/statistics", { fixture: id });
  return mapStats(stats, homeTeamId);
}

function pickStat(arr: any[], type: string): number {
  const s = arr?.find((x) => x?.type === type);
  return s ? num(s.value) : 0;
}

function mapStats(raw: any[], homeTeamId?: string): MatchStats | undefined {
  if (!raw?.length) return undefined;
  const homeBlock =
    raw.find((b) => String(b?.team?.id) === String(homeTeamId)) ?? raw[0];
  // The genuinely-other block, or undefined when only one team's stats exist
  // (early live minutes) — never fall back to homeBlock, which would mirror
  // home stats onto away.
  const awayBlock = raw.find((b) => b !== homeBlock);
  const h = homeBlock?.statistics ?? [];
  const a = awayBlock?.statistics ?? [];
  return {
    xG: { home: pickStat(h, "expected_goals"), away: pickStat(a, "expected_goals") },
    possession: { home: pickStat(h, "Ball Possession"), away: pickStat(a, "Ball Possession") },
    shots: { home: pickStat(h, "Total Shots"), away: pickStat(a, "Total Shots") },
    shotsOnTarget: { home: pickStat(h, "Shots on Goal"), away: pickStat(a, "Shots on Goal") },
    passes: { home: pickStat(h, "Total passes"), away: pickStat(a, "Total passes") },
    corners: { home: pickStat(h, "Corner Kicks"), away: pickStat(a, "Corner Kicks") },
    fouls: { home: pickStat(h, "Fouls"), away: pickStat(a, "Fouls") },
    yellowCards: { home: pickStat(h, "Yellow Cards"), away: pickStat(a, "Yellow Cards") },
    redCards: { home: pickStat(h, "Red Cards"), away: pickStat(a, "Red Cards") },
  };
}

function mapPlayer(p: any): Player {
  const pl = p?.player ?? p;
  return {
    id: String(pl?.id ?? ""),
    name: pl?.name ?? "Unknown",
    number: num(pl?.number),
    position: pl?.pos ?? "",
    rating: pl?.rating ? num(pl.rating) : undefined,
  };
}

function mapLineups(raw: any[], homeTeamId?: string): { home: Lineup; away: Lineup } | undefined {
  if (!raw || raw.length < 2) return undefined;
  const homeBlock = raw.find((b) => String(b?.team?.id) === String(homeTeamId)) ?? raw[0];
  const awayBlock = raw.find((b) => b !== homeBlock) ?? raw[1];
  const toLineup = (b: any): Lineup => ({
    formation: b?.formation ?? "",
    startingXI: (b?.startXI ?? []).map(mapPlayer),
    substitutes: (b?.substitutes ?? []).map(mapPlayer),
    coach: b?.coach?.name,
  });
  return { home: toLineup(homeBlock), away: toLineup(awayBlock) };
}

function mapEventType(type: string | undefined, detail: string | undefined): MatchEventType | null {
  switch (type) {
    case "Goal":
      return "goal";
    case "Card":
      return "card";
    case "subst":
      return "substitution";
    case "Var":
      return "var";
    default:
      return detail?.toLowerCase().includes("card") ? "card" : null;
  }
}

function mapEvents(raw: any[]): MatchEvent[] {
  if (!raw?.length) return [];
  const out: MatchEvent[] = [];
  for (const e of raw) {
    const type = mapEventType(e?.type, e?.detail);
    if (!type) continue;
    out.push({
      minute: num(e?.time?.elapsed) + num(e?.time?.extra),
      type,
      team: String(e?.team?.id ?? ""),
      player: e?.player?.name ?? "",
      detail: e?.detail,
      assist: e?.assist?.name ?? undefined,
    });
  }
  return out.sort((x, y) => x.minute - y.minute);
}

export async function getStandings(): Promise<Standing[]> {
  const raw = await af<any>("/standings", {
    league: WORLD_CUP_LEAGUE,
    season: WORLD_CUP_SEASON,
  });
  // response: [{ league: { standings: [ [groupRows...], [groupRows...] ] } }]
  const groups: any[][] = raw?.[0]?.league?.standings ?? [];
  const out: Standing[] = [];
  for (const group of groups) {
    for (const row of group) {
      const groupName = row?.group ?? "Group";
      out.push({
        group: groupName,
        team: mapTeam(row.team, groupName),
        rank: num(row.rank),
        played: num(row.all?.played),
        won: num(row.all?.win),
        drawn: num(row.all?.draw),
        lost: num(row.all?.lose),
        gf: num(row.all?.goals?.for),
        ga: num(row.all?.goals?.against),
        gd: num(row.goalsDiff),
        points: num(row.points),
        form: row.form,
      });
    }
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.rank - b.rank);
}

export async function getHeadToHead(homeTeamId: string, awayTeamId: string): Promise<Match[]> {
  const fixtures = await af<any>("/fixtures/headtohead", {
    h2h: `${homeTeamId}-${awayTeamId}`,
  });
  return fixtures.map(mapFixture);
}

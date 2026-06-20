// Core domain types for the World Cup Intelligence System.
// These are the normalized shapes that every data source (API-Football, ESPN)
// is mapped into, so the rest of the app never sees raw provider payloads.

export type MatchStatus = "scheduled" | "live" | "finished";

export interface Team {
  id: string;
  name: string;
  shortName: string;
  flag: string; // URL to flag/crest image
  group?: string;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string; // e.g. "G", "D", "M", "F" or grid position
  rating?: number;
}

export interface Lineup {
  formation: string; // e.g. "4-3-3"
  startingXI: Player[];
  substitutes: Player[];
  coach?: string;
}

export interface MatchStats {
  xG: { home: number; away: number };
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  passes: { home: number; away: number };
  pressures?: { home: number; away: number };
  // Extra fields surfaced when available; never assume presence.
  corners?: { home: number; away: number };
  fouls?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
}

export type MatchEventType = "goal" | "card" | "substitution" | "var";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  team: string; // team id
  player: string;
  detail?: string; // e.g. "Yellow Card", "Penalty", "Substitution 1"
  assist?: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  status: MatchStatus;
  minute?: number;
  kickoff: string; // ISO timestamp
  score: { home: number; away: number };
  venue?: string;
  round?: string; // e.g. "Group A", "Round of 16"
  stats?: MatchStats;
  lineups?: { home: Lineup; away: Lineup };
  events?: MatchEvent[];
  source: DataSource; // which provider produced this record
}

export interface Standing {
  group: string;
  team: Team;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form?: string; // e.g. "WWDLW"
}

export type DataSource = "api-football" | "espn";

// A small wrapper so API routes can report which source served the data and
// whether it came from cache — useful for the /dev data-health panel.
export interface DataEnvelope<T> {
  data: T;
  source: DataSource;
  cached: boolean;
  fetchedAt: string; // ISO
}

import type { Match, Standing } from "./types";

export interface ThirdPlaceEntry {
  row: Standing;
  tableRank: number;
  insideCut: boolean;
  qualifyProb?: number;
}

export interface PressureEntry {
  row: Standing;
  qualifyProb?: number;
  label: string;
  tone: "safe" | "watch" | "danger";
}

export interface MatchStake {
  match: Match;
  group?: string;
  home?: Standing;
  away?: Standing;
  homeQualifyProb?: number;
  awayQualifyProb?: number;
  label: string;
  impacts: ResultImpact[];
}

export interface TournamentPulse {
  completedGroups: number;
  activeGroups: number;
  topTwoLocked: number;
  thirdPlace: ThirdPlaceEntry[];
  pressure: PressureEntry[];
  stakes: MatchStake[];
}

export type ScenarioOutcome = "home" | "draw" | "away";

export type QualificationTone = "safe" | "watch" | "danger" | "out";

export interface QualificationOutlook {
  label: string;
  tone: QualificationTone;
}

export interface ResultImpact {
  outcome: ScenarioOutcome;
  label: string;
  homeRank?: number;
  awayRank?: number;
  homePoints?: number;
  awayPoints?: number;
  summary: string;
}

export interface ScenarioSelection {
  match: Match;
  outcome: ScenarioOutcome;
}

const THIRD_PLACE_ADVANCE_COUNT = 8;

function teamKey(name: string): string {
  const aliases: Record<string, string> = {
    "cote-d-ivoire": "ivory-coast",
    "cote-divoire": "ivory-coast",
    "curacao": "curacao",
    "turkiye": "turkey",
  };
  const key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return aliases[key] ?? key;
}

function projectedQualifyProb(projected: Record<string, number>, teamName: string): number | undefined {
  const key = teamKey(teamName);
  return projected[key] ?? projected[key.replace(/-/g, " ")];
}

export function groupRows(rows: Standing[]): Record<string, Standing[]> {
  return rows.reduce<Record<string, Standing[]>>((acc, row) => {
    (acc[row.group] ??= []).push(row);
    return acc;
  }, {});
}

function standingSort(a: Standing, b: Standing): number {
  return (
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.team.name.localeCompare(b.team.name)
  );
}

export function hydrateStandingTeams(rows: Standing[], matches: Match[]): Standing[] {
  const byId = new Map<string, Match["homeTeam"]>();
  const byName = new Map<string, Match["homeTeam"]>();
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) {
      byId.set(team.id, team);
      byName.set(teamKey(team.name), team);
    }
  }

  return rows.map((row) => {
    if (row.team.flag) return row;
    const matchTeam = byId.get(row.team.id) ?? byName.get(teamKey(row.team.name));
    if (!matchTeam?.flag) return row;
    return {
      ...row,
      team: {
        ...row.team,
        flag: matchTeam.flag,
        shortName: row.team.shortName || matchTeam.shortName,
      },
    };
  });
}

export function buildThirdPlaceTable(
  rows: Standing[],
  projected: Record<string, number> = {},
): ThirdPlaceEntry[] {
  return rows
    .filter((row) => row.rank === 3)
    .sort(standingSort)
    .map((row, i) => ({
      row,
      tableRank: i + 1,
      insideCut: i < THIRD_PLACE_ADVANCE_COUNT,
      qualifyProb: projectedQualifyProb(projected, row.team.name),
    }));
}

export function qualificationOutlook(
  row: Standing,
  thirdPlace: ThirdPlaceEntry[] = [],
): QualificationOutlook {
  if (row.rank <= 2) {
    return {
      label: row.played >= 3 ? "Top two locked" : "Top-two track",
      tone: "safe",
    };
  }

  if (row.rank === 3) {
    const third = thirdPlace.find((entry) => entry.row.team.id === row.team.id);
    if (third?.insideCut) {
      return {
        label: row.played >= 3 ? "Third-place line" : "Third-place track",
        tone: "watch",
      };
    }
    return {
      label: row.played >= 3 ? "Needs help" : "Below cut line",
      tone: "danger",
    };
  }

  return {
    label: row.played >= 3 ? "Eliminated" : "Must win / needs help",
    tone: row.played >= 3 ? "out" : "danger",
  };
}

function pressureLabel(row: Standing, prob?: number): PressureEntry["label"] {
  const played = row.played >= 3 ? "final group position" : `${3 - row.played} match${3 - row.played === 1 ? "" : "es"} left`;
  if (row.rank <= 2) return `Top-two track · ${played}`;
  if (row.rank === 3) return `Third-place bubble · ${played}`;
  if (prob !== undefined && prob <= 0.15) return `Needs help · ${played}`;
  return `Chasing the line · ${played}`;
}

function pressureTone(row: Standing, prob?: number): PressureEntry["tone"] {
  if (prob !== undefined) {
    if (prob >= 0.85) return "safe";
    if (prob <= 0.25) return "danger";
  }
  if (row.rank <= 2) return "safe";
  if (row.rank === 3) return "watch";
  return "danger";
}

export function buildPressureRows(
  rows: Standing[],
  projected: Record<string, number> = {},
  limit = 6,
): PressureEntry[] {
  return rows
    .map((row) => {
      const qualifyProb = projectedQualifyProb(projected, row.team.name);
      return {
        row,
        qualifyProb,
        label: pressureLabel(row, qualifyProb),
        tone: pressureTone(row, qualifyProb),
      };
    })
    .filter((entry) => entry.row.rank >= 2 && entry.row.rank <= 4)
    .sort((a, b) => {
      const ap = a.qualifyProb ?? (a.row.rank <= 2 ? 0.75 : 0.25);
      const bp = b.qualifyProb ?? (b.row.rank <= 2 ? 0.75 : 0.25);
      return Math.abs(ap - 0.5) - Math.abs(bp - 0.5) || standingSort(a.row, b.row);
    })
    .slice(0, limit);
}

export function groupNameForMatch(match: Match, rowsByGroup: Record<string, Standing[]>): string | undefined {
  for (const [group, rows] of Object.entries(rowsByGroup)) {
    const ids = new Set(rows.map((row) => row.team.id));
    const names = new Set(rows.map((row) => teamKey(row.team.name)));
    if (
      (ids.has(match.homeTeam.id) || names.has(teamKey(match.homeTeam.name))) &&
      (ids.has(match.awayTeam.id) || names.has(teamKey(match.awayTeam.name)))
    ) {
      return group;
    }
  }
  return match.homeTeam.group ?? match.awayTeam.group;
}

function rowForTeam(rows: Standing[] | undefined, team: Match["homeTeam"]): Standing | undefined {
  return rows?.find((row) => row.team.id === team.id || teamKey(row.team.name) === teamKey(team.name));
}

function cloneRow(row: Standing): Standing {
  return { ...row, team: { ...row.team } };
}

function outcomeScore(outcome: ScenarioOutcome): { home: number; away: number } {
  switch (outcome) {
    case "home":
      return { home: 1, away: 0 };
    case "away":
      return { home: 0, away: 1 };
    case "draw":
      return { home: 1, away: 1 };
  }
}

function applyResult(rows: Standing[], match: Match, outcome: ScenarioOutcome): Standing[] {
  const score = outcomeScore(outcome);
  const projected = rows.map(cloneRow);
  const home = rowForTeam(projected, match.homeTeam);
  const away = rowForTeam(projected, match.awayTeam);
  if (!home || !away) return projected.sort(standingSort).map((row, i) => ({ ...row, rank: i + 1 }));

  home.played += 1;
  away.played += 1;
  home.gf += score.home;
  home.ga += score.away;
  away.gf += score.away;
  away.ga += score.home;
  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;

  if (score.home > score.away) {
    home.won += 1;
    away.lost += 1;
    home.points += 3;
  } else if (score.away > score.home) {
    away.won += 1;
    home.lost += 1;
    away.points += 3;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }

  return projected.sort(standingSort).map((row, i) => ({ ...row, rank: i + 1 }));
}

export function projectGroupTable(rows: Standing[], match: Match, outcome: ScenarioOutcome): Standing[] {
  return applyResult(rows, match, outcome);
}

export function projectGroupTableForResults(
  rows: Standing[],
  selections: ScenarioSelection[],
): Standing[] {
  return selections.reduce(
    (table, selection) => applyResult(table, selection.match, selection.outcome),
    rows,
  );
}

function outcomeLabel(match: Match, outcome: ScenarioOutcome): string {
  if (outcome === "draw") return "Draw";
  const team = outcome === "home" ? match.homeTeam : match.awayTeam;
  return `${team.shortName || team.name} win`;
}

function resultSummary(home?: Standing, away?: Standing): string {
  if (!home || !away) return "table impact pending";
  const homeZone = home.rank <= 2 ? "top two" : home.rank === 3 ? "third" : "fourth";
  const awayZone = away.rank <= 2 ? "top two" : away.rank === 3 ? "third" : "fourth";
  return `${home.team.shortName || home.team.name} ${home.points}pt/${homeZone} · ${away.team.shortName || away.team.name} ${away.points}pt/${awayZone}`;
}

export function buildResultImpacts(match: Match, groupTable: Standing[] | undefined): ResultImpact[] {
  if (!groupTable?.length) return [];
  return (["home", "draw", "away"] as const).map((outcome) => {
    const projected = applyResult(groupTable, match, outcome);
    const home = rowForTeam(projected, match.homeTeam);
    const away = rowForTeam(projected, match.awayTeam);
    return {
      outcome,
      label: outcomeLabel(match, outcome),
      homeRank: home?.rank,
      awayRank: away?.rank,
      homePoints: home?.points,
      awayPoints: away?.points,
      summary: resultSummary(home, away),
    };
  });
}

function matchStakeLabel(home?: Standing, away?: Standing): string {
  if (!home || !away) return "Fixture impact pending";
  const bubble = [home, away].filter((row) => row.rank >= 2 && row.rank <= 4);
  if (bubble.length === 2) return "Direct qualification swing";
  if (bubble.some((row) => row.rank === 3)) return "Third-place line pressure";
  if (bubble.length === 1) return `${bubble[0].team.shortName || bubble[0].team.name} qualification pressure`;
  return "Group position impact";
}

export function buildMatchStakes(
  matches: Match[],
  rows: Standing[],
  projected: Record<string, number> = {},
  limit = 4,
): MatchStake[] {
  const rowsByGroup = groupRows(rows);
  return matches
    .filter((match) => match.status !== "finished")
    .map((match) => {
      const group = groupNameForMatch(match, rowsByGroup);
      const groupTable = group ? rowsByGroup[group] : undefined;
      const home = rowForTeam(groupTable, match.homeTeam);
      const away = rowForTeam(groupTable, match.awayTeam);
      return {
        match,
        group,
        home,
        away,
        homeQualifyProb: projectedQualifyProb(projected, match.homeTeam.name),
        awayQualifyProb: projectedQualifyProb(projected, match.awayTeam.name),
        label: matchStakeLabel(home, away),
        impacts: buildResultImpacts(match, groupTable),
      };
    })
    .sort((a, b) => {
      const ar = Math.min(a.home?.rank ?? 9, a.away?.rank ?? 9);
      const br = Math.min(b.home?.rank ?? 9, b.away?.rank ?? 9);
      return ar - br || a.match.kickoff.localeCompare(b.match.kickoff);
    })
    .slice(0, limit);
}

export function buildTournamentPulse(
  standings: Standing[],
  matches: Match[],
  projected: Record<string, number> = {},
): TournamentPulse {
  const hydrated = hydrateStandingTeams(standings, matches);
  const groups = groupRows(hydrated);
  const groupList = Object.values(groups);
  return {
    completedGroups: groupList.filter((rows) => rows.length > 0 && rows.every((row) => row.played >= 3)).length,
    activeGroups: groupList.filter((rows) => rows.some((row) => row.played < 3)).length,
    topTwoLocked: hydrated.filter((row) => row.played >= 3 && row.rank <= 2).length,
    thirdPlace: buildThirdPlaceTable(hydrated, projected),
    pressure: buildPressureRows(hydrated, projected),
    stakes: buildMatchStakes(matches, hydrated, projected),
  };
}

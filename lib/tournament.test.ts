import { describe, expect, it } from "vitest";
import {
  buildMatchStakes,
  buildResultImpacts,
  buildPressureRows,
  buildThirdPlaceTable,
  buildTournamentPulse,
  hydrateStandingTeams,
  projectGroupTable,
  projectGroupTableForResults,
  qualificationOutlook,
} from "@/lib/tournament";
import type { Match, Standing, Team } from "@/lib/types";

function team(id: string, name: string, shortName = name.slice(0, 3).toUpperCase(), flag = ""): Team {
  return { id, name, shortName, flag };
}

function standing(group: string, rank: number, name: string, partial: Partial<Standing> = {}): Standing {
  return {
    group,
    team: team(name.toLowerCase().replace(/ /g, "-"), name),
    rank,
    played: 2,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    ...partial,
  };
}

function match(home: Team, away: Team, partial: Partial<Match> = {}): Match {
  return {
    id: `${home.id}-${away.id}`,
    homeTeam: home,
    awayTeam: away,
    status: "scheduled",
    kickoff: "2026-06-25T19:00:00Z",
    score: { home: 0, away: 0 },
    source: "espn",
    ...partial,
  };
}

describe("hydrateStandingTeams", () => {
  it("fills missing standings flags from matching fixtures", () => {
    const mexico = team("203", "Mexico", "MEX", "https://flags/mex.png");
    const rows = [standing("Group A", 1, "Mexico", { team: team("203", "Mexico", "MEX", "") })];

    const hydrated = hydrateStandingTeams(rows, [match(mexico, team("450", "Czechia"))]);

    expect(hydrated[0].team.flag).toBe("https://flags/mex.png");
  });
});

describe("buildThirdPlaceTable", () => {
  it("sorts third-placed teams by points, goal difference, then goals for", () => {
    const rows = [
      standing("Group A", 3, "Alpha", { points: 3, gd: 0, gf: 2 }),
      standing("Group B", 3, "Beta", { points: 4, gd: -2, gf: 1 }),
      standing("Group C", 3, "Gamma", { points: 3, gd: 1, gf: 1 }),
    ];

    const table = buildThirdPlaceTable(rows);

    expect(table.map((entry) => entry.row.team.name)).toEqual(["Beta", "Gamma", "Alpha"]);
    expect(table[0].insideCut).toBe(true);
  });

  it("joins model probabilities through common provider aliases", () => {
    const table = buildThirdPlaceTable(
      [standing("Group E", 3, "Côte d'Ivoire"), standing("Group D", 3, "Türkiye")],
      { "ivory-coast": 0.61, turkey: 0.42 },
    );

    expect(table.map((entry) => entry.qualifyProb)).toEqual([0.61, 0.42]);
  });
});

describe("qualificationOutlook", () => {
  it("labels top-two, third-place, and eliminated rows from projected ranks", () => {
    const rows = [
      standing("Group A", 1, "Leader", { played: 3 }),
      standing("Group A", 3, "Bubble", { played: 3, points: 4 }),
      standing("Group A", 4, "Out", { played: 3 }),
    ];
    const thirdPlace = buildThirdPlaceTable([rows[1]]);

    expect(qualificationOutlook(rows[0], thirdPlace)).toEqual({ label: "Top two locked", tone: "safe" });
    expect(qualificationOutlook(rows[1], thirdPlace)).toEqual({ label: "Third-place line", tone: "watch" });
    expect(qualificationOutlook(rows[2], thirdPlace)).toEqual({ label: "Eliminated", tone: "out" });
  });
});

describe("buildPressureRows", () => {
  it("prioritizes teams closest to a 50/50 qualification state", () => {
    const rows = [
      standing("Group A", 2, "Safe", { points: 6 }),
      standing("Group A", 3, "Knife Edge", { points: 3 }),
      standing("Group A", 4, "Long Shot", { points: 1 }),
    ];

    const pressure = buildPressureRows(rows, { safe: 0.95, "knife-edge": 0.52, "long-shot": 0.08 }, 2);

    expect(pressure.map((entry) => entry.row.team.name)).toEqual(["Knife Edge", "Long Shot"]);
    expect(pressure[0].label).toContain("Third-place bubble");
  });
});

describe("buildMatchStakes", () => {
  it("labels a fixture between bubble teams as a direct qualification swing", () => {
    const usa = team("660", "United States", "USA");
    const paraguay = team("210", "Paraguay", "PAR");
    const rows = [
      standing("Group D", 2, "United States", { team: usa, points: 3 }),
      standing("Group D", 3, "Paraguay", { team: paraguay, points: 3 }),
    ];

    const stakes = buildMatchStakes([match(usa, paraguay)], rows);

    expect(stakes[0].group).toBe("Group D");
    expect(stakes[0].label).toBe("Direct qualification swing");
  });

  it("includes result impacts for home win, draw, and away win", () => {
    const usa = team("660", "United States", "USA");
    const turkey = team("turkey", "Turkey", "TUR");
    const australia = team("628", "Australia", "AUS");
    const paraguay = team("210", "Paraguay", "PAR");
    const rows = [
      standing("Group D", 1, "United States", { team: usa, points: 6, gf: 6, ga: 1, gd: 5 }),
      standing("Group D", 2, "Australia", { team: australia, points: 3, gf: 2, ga: 2, gd: 0 }),
      standing("Group D", 3, "Paraguay", { team: paraguay, points: 3, gf: 2, ga: 4, gd: -2 }),
      standing("Group D", 4, "Turkey", { team: turkey, points: 0, gf: 1, ga: 4, gd: -3 }),
    ];

    const impacts = buildResultImpacts(match(turkey, usa), rows);

    expect(impacts.map((impact) => impact.outcome)).toEqual(["home", "draw", "away"]);
    expect(impacts[0]).toMatchObject({ label: "TUR win", homePoints: 3, awayPoints: 6 });
    expect(impacts[2]).toMatchObject({ label: "USA win", homePoints: 0, awayPoints: 9, awayRank: 1 });
  });
});

describe("projectGroupTable", () => {
  it("returns the group table after applying a selected result", () => {
    const leader = team("leader", "Leader", "LED");
    const chaser = team("chaser", "Chaser", "CHA");
    const rows = [
      standing("Group X", 1, "Leader", { team: leader, points: 4, gf: 2, ga: 1, gd: 1 }),
      standing("Group X", 2, "Chaser", { team: chaser, points: 3, gf: 2, ga: 2, gd: 0 }),
    ];

    const table = projectGroupTable(rows, match(chaser, leader), "home");

    expect(table.map((row) => [row.team.name, row.points, row.rank])).toEqual([
      ["Chaser", 6, 1],
      ["Leader", 4, 2],
    ]);
    expect(table[0].gf).toBe(3);
    expect(table[1].ga).toBe(2);
  });
});

describe("projectGroupTableForResults", () => {
  it("applies multiple group fixtures into one projected table", () => {
    const alpha = team("alpha", "Alpha", "ALP");
    const beta = team("beta", "Beta", "BET");
    const gamma = team("gamma", "Gamma", "GAM");
    const delta = team("delta", "Delta", "DEL");
    const rows = [
      standing("Group X", 1, "Alpha", { team: alpha, points: 4, gf: 3, ga: 1, gd: 2 }),
      standing("Group X", 2, "Beta", { team: beta, points: 4, gf: 2, ga: 1, gd: 1 }),
      standing("Group X", 3, "Gamma", { team: gamma, points: 1, gf: 1, ga: 2, gd: -1 }),
      standing("Group X", 4, "Delta", { team: delta, points: 1, gf: 0, ga: 2, gd: -2 }),
    ];

    const table = projectGroupTableForResults(rows, [
      { match: match(gamma, alpha), outcome: "home" },
      { match: match(delta, beta), outcome: "draw" },
    ]);

    expect(table.map((row) => [row.team.name, row.points, row.rank])).toEqual([
      ["Beta", 5, 1],
      ["Alpha", 4, 2],
      ["Gamma", 4, 3],
      ["Delta", 2, 4],
    ]);
  });
});

describe("buildTournamentPulse", () => {
  it("summarizes completed and active groups", () => {
    const rows = [
      standing("Group A", 1, "One", { played: 3 }),
      standing("Group A", 2, "Two", { played: 3 }),
      standing("Group B", 1, "Three", { played: 2 }),
    ];

    const pulse = buildTournamentPulse(rows, []);

    expect(pulse.completedGroups).toBe(1);
    expect(pulse.activeGroups).toBe(1);
    expect(pulse.topTwoLocked).toBe(2);
  });
});

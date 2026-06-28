import { describe, it, expect } from "vitest";
import { bracketOgData } from "./og";
import type { PredTeam } from "./predictions";

function team(id: string, winCup: number): PredTeam {
  return {
    id,
    name: id.toUpperCase(),
    qualify: 0,
    reachR32: 0,
    reachR16: 0,
    reachQF: 0,
    reachSF: 0,
    reachFinal: 0,
    winCup,
    mcStdErr: {
      qualify: 0,
      reachR32: 0,
      reachR16: 0,
      reachQF: 0,
      reachSF: 0,
      reachFinal: 0,
      winCup: 0,
    },
  };
}

describe("bracketOgData", () => {
  it("ranks the champion + top-4 ladder by winCup desc", () => {
    const teams = [
      team("a", 0.05),
      team("b", 0.22),
      team("c", 0.18),
      team("d", 0.01),
      team("e", 0.3),
    ];
    const { champion, ladder } = bracketOgData(teams);
    expect(champion?.id).toBe("e");
    expect(ladder.map((r) => r.id)).toEqual(["e", "b", "c", "a"]);
    expect(ladder).toHaveLength(4);
    expect(champion).toEqual(ladder[0]);
  });

  it("returns a null champion for an empty field", () => {
    const { champion, ladder } = bracketOgData([]);
    expect(champion).toBeNull();
    expect(ladder).toEqual([]);
  });

  it("respects an explicit ladder length", () => {
    const teams = [team("a", 0.1), team("b", 0.2), team("c", 0.3)];
    expect(bracketOgData(teams, 2).ladder.map((r) => r.id)).toEqual(["c", "b"]);
  });
});

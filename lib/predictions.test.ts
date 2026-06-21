import { describe, expect, it } from "vitest";
import { formatProb, funnelRows } from "@/lib/predictions";
import type { PredTeam } from "@/lib/predictions";

describe("formatProb", () => {
  it("rounds large probabilities to integer percent", () => {
    expect(formatProb(0.248)).toBe("25%");
    expect(formatProb(0.5)).toBe("50%");
  });
  it("shows one decimal between 1% and 10%", () => {
    expect(formatProb(0.096)).toBe("9.6%");
    expect(formatProb(0.004)).toBe("0.4%");
  });
  it("floors tiny and clamps edge values", () => {
    expect(formatProb(0.0001)).toBe("<0.1%");
    expect(formatProb(0)).toBe("0%");
    expect(formatProb(-1)).toBe("0%");
  });
});

function mkTeam(id: string, vals: Partial<PredTeam>): PredTeam {
  return {
    id, name: id,
    qualify: 0, reachR32: 0, reachR16: 0, reachQF: 0,
    reachSF: 0, reachFinal: 0, winCup: 0,
    mcStdErr: { qualify: 0, reachR32: 0, reachR16: 0, reachQF: 0, reachSF: 0, reachFinal: 0, winCup: 0 },
    ...vals,
  };
}

describe("funnelRows", () => {
  const teams = [
    mkTeam("a", { reachR16: 0.9, winCup: 0.3, mcStdErr: { qualify: 0, reachR32: 0, reachR16: 0.01, reachQF: 0, reachSF: 0, reachFinal: 0, winCup: 0.02 } }),
    mkTeam("b", { reachR16: 0.5, winCup: 0.1 }),
    mkTeam("c", { reachR16: 0.7, winCup: 0.2 }),
  ];

  it("returns the five stages in funnel order", () => {
    const cols = funnelRows(teams);
    expect(cols.map((c) => c.key)).toEqual(["reachR16", "reachQF", "reachSF", "reachFinal", "winCup"]);
    expect(cols[0].label).toBe("Round of 16");
  });

  it("ranks teams by the column's stage probability, descending", () => {
    const r16 = funnelRows(teams).find((c) => c.key === "reachR16")!;
    expect(r16.entries.map((e) => e.id)).toEqual(["a", "c", "b"]);
    expect(r16.entries[0].prob).toBe(0.9);
    expect(r16.entries[0].stdErr).toBe(0.01);
  });

  it("limits each column to topN", () => {
    const cols = funnelRows(teams, 2);
    expect(cols[0].entries).toHaveLength(2);
  });
});

import { qualifyByTeam, slugifyTeam } from "@/lib/predictions";

describe("slugifyTeam", () => {
  it("mirrors the model _slug: lowercase, strip apostrophes, spaces to hyphens", () => {
    expect(slugifyTeam("South Korea")).toBe("south-korea");
    expect(slugifyTeam("Cote d'Ivoire")).toBe("cote-divoire");
    expect(slugifyTeam("Brazil")).toBe("brazil");
  });
});

describe("qualifyByTeam", () => {
  it("maps slug -> qualify probability", () => {
    const m = qualifyByTeam([mkTeam("argentina", { qualify: 0.99 }), mkTeam("mexico", { qualify: 1 })]);
    expect(m.get("argentina")).toBe(0.99);
    expect(m.get("mexico")).toBe(1);
    expect(m.get("nope")).toBeUndefined();
  });
});

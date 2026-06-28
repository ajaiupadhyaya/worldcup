import { describe, expect, it } from "vitest";
import { ROUND_ORDER, ROUND_LABELS, mostLikely, prettifyId, STAGE_BY_ROUND } from "@/lib/bracketView";
import type { BracketSlotProb } from "@/lib/predictions";

describe("ROUND_ORDER / ROUND_LABELS", () => {
  it("lists the five knockout rounds in R32→Final order", () => {
    expect(ROUND_ORDER).toEqual(["R32", "R16", "QF", "SF", "F"]);
  });
  it("labels every round", () => {
    expect(ROUND_ORDER.map((r) => ROUND_LABELS[r])).toEqual([
      "Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final",
    ]);
  });
});

describe("mostLikely", () => {
  const dist: BracketSlotProb[] = [
    { id: "argentina", prob: 0.41 },
    { id: "brazil", prob: 0.32 },
  ];
  it("returns the highest-probability entry", () => {
    expect(mostLikely(dist)?.id).toBe("argentina");
  });
  it("does not assume the list is pre-sorted", () => {
    expect(mostLikely([{ id: "a", prob: 0.1 }, { id: "b", prob: 0.9 }])?.id).toBe("b");
  });
  it("returns null for an empty or missing distribution", () => {
    expect(mostLikely([])).toBeNull();
    expect(mostLikely(undefined as unknown as BracketSlotProb[])).toBeNull();
  });
});

describe("prettifyId", () => {
  it("turns a slug id into a display name", () => {
    expect(prettifyId("south-korea")).toBe("South Korea");
    expect(prettifyId("brazil")).toBe("Brazil");
    expect(prettifyId("")).toBe("");
  });
});

describe("STAGE_BY_ROUND", () => {
  it("maps each board round to the snapshot stage whose mcStdErr it shows", () => {
    expect(STAGE_BY_ROUND).toEqual({
      R32: "reachR32",
      R16: "reachR16",
      QF: "reachQF",
      SF: "reachSF",
      F: "winCup",
    });
  });
});

// ---------------------------------------------------------------------------
// UV3 additions
// ---------------------------------------------------------------------------
import { computeLayout, slotState, championLadder } from "@/lib/bracketView";
import type { BracketTree, BracketMatch } from "@/lib/bracket";

function mkMatch(p: Partial<BracketMatch> & Pick<BracketMatch, "slot" | "round">): BracketMatch {
  return { sides: [[], []], winner: [], feeders: null, ...p };
}
function mkTree(rounds: Partial<BracketTree["rounds"]>): BracketTree {
  const full = { R32: [], R16: [], QF: [], SF: [], F: [], ...rounds } as BracketTree["rounds"];
  const bySlot: BracketTree["bySlot"] = {};
  for (const r of Object.values(full)) for (const m of r) bySlot[m.slot] = m;
  return { rounds: full, bySlot, columns: [], champion: [], generatedAt: "2026-06-28T00:00:00Z" };
}

describe("computeLayout", () => {
  it("places R32 on base rows and each parent at the mean row of its feeders", () => {
    const tree = mkTree({
      R32: [
        mkMatch({ slot: "M73", round: "R32" }),
        mkMatch({ slot: "M74", round: "R32" }),
        mkMatch({ slot: "M75", round: "R32" }),
        mkMatch({ slot: "M76", round: "R32" }),
      ],
      R16: [
        mkMatch({ slot: "M89", round: "R16", feeders: ["M73", "M75"] }),
        mkMatch({ slot: "M90", round: "R16", feeders: ["M74", "M76"] }),
      ],
    });
    const layout = computeLayout(tree);
    const byId = new Map(layout.map((n) => [n.slot, n]));
    expect(byId.get("M73")).toMatchObject({ col: 0, row: 0 });
    expect(byId.get("M75")).toMatchObject({ col: 0, row: 2 });
    // M89 feeds from rows 0 and 2 -> row 1; M90 from 1 and 3 -> row 2
    expect(byId.get("M89")).toMatchObject({ col: 1, row: 1 });
    expect(byId.get("M90")).toMatchObject({ col: 1, row: 2 });
  });
});

describe("slotState", () => {
  it("is idle when nothing is traced", () => {
    expect(slotState("M73", null)).toBe("idle");
    expect(slotState("M73", new Set())).toBe("idle");
  });
  it("is active on the traced path and dim elsewhere", () => {
    const traced = new Set(["M73", "M89"]);
    expect(slotState("M73", traced)).toBe("active");
    expect(slotState("M74", traced)).toBe("dim");
  });
});

describe("championLadder", () => {
  it("returns the top-N title odds, descending", () => {
    const champ = [
      { id: "brazil", prob: 0.12 },
      { id: "argentina", prob: 0.2 },
      { id: "france", prob: 0.15 },
    ];
    expect(championLadder(champ, 2).map((e) => e.id)).toEqual(["argentina", "france"]);
  });
});

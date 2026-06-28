import { describe, expect, it } from "vitest";
import { ROUND_ORDER, ROUND_LABELS, mostLikely, prettifyId, STAGE_BY_ROUND, collapsedFace } from "@/lib/bracketView";
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

describe("collapsedFace", () => {
  // R32: each side is a single certain occupant (prob 1.0). The face must show
  // each side's *match-win* probability, never the 1.0 occupancy prob.
  it("shows match-win probabilities (not occupancy) for a settled R32 match", () => {
    const face = collapsedFace({
      sides: [
        [{ id: "south-africa", prob: 1.0 }],
        [{ id: "canada", prob: 1.0 }],
      ],
      winner: [
        { id: "canada", prob: 0.7955 },
        { id: "south-africa", prob: 0.2045 },
      ],
    });
    expect(face.top.entry?.id).toBe("south-africa");
    expect(face.top.winProb).toBeCloseTo(0.2045);
    expect(face.top.advancing).toBe(false);
    expect(face.bottom.entry?.id).toBe("canada");
    expect(face.bottom.winProb).toBeCloseTo(0.7955);
    expect(face.bottom.advancing).toBe(true);
  });

  // Later rounds: both sides must be measured the same way so the advancing
  // side is ALWAYS the one with the higher displayed number.
  it("makes the advancing side the higher number in an uncertain QF match", () => {
    const face = collapsedFace({
      sides: [
        [{ id: "france", prob: 0.457 }, { id: "germany", prob: 0.3495 }],
        [{ id: "morocco", prob: 0.4821 }, { id: "canada", prob: 0.2852 }],
      ],
      winner: [
        { id: "morocco", prob: 0.3197 },
        { id: "france", prob: 0.2164 },
        { id: "germany", prob: 0.1622 },
        { id: "canada", prob: 0.1254 },
      ],
    });
    expect(face.top.entry?.id).toBe("france");
    expect(face.top.winProb).toBeCloseTo(0.2164);
    expect(face.bottom.entry?.id).toBe("morocco");
    expect(face.bottom.winProb).toBeCloseTo(0.3197);
    // Morocco (0.32) advances over France (0.22): higher number wins.
    expect(face.bottom.advancing).toBe(true);
    expect(face.top.advancing).toBe(false);
    expect(face.bottom.winProb).toBeGreaterThan(face.top.winProb);
  });

  it("never marks both sides advancing; degrades safely on empty sides", () => {
    const empty = collapsedFace({ sides: [[], []], winner: [] });
    expect(empty.top.entry).toBeNull();
    expect(empty.bottom.entry).toBeNull();
    expect(empty.top.advancing).toBe(false);
    expect(empty.bottom.advancing).toBe(false);

    const oneSide = collapsedFace({
      sides: [[{ id: "spain", prob: 1 }], []],
      winner: [{ id: "spain", prob: 1 }],
    });
    expect(oneSide.top.advancing).toBe(true);
    expect(oneSide.bottom.advancing).toBe(false);
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
  return { sides: [[], []], winner: [], feeders: [null, null], ...p };
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

// ---------------------------------------------------------------------------
// UV4 additions
// ---------------------------------------------------------------------------
import { clampRoundIndex } from "@/lib/bracketView";

describe("clampRoundIndex", () => {
  it("keeps a valid index unchanged", () => {
    expect(clampRoundIndex(0)).toBe(0);
    expect(clampRoundIndex(4)).toBe(4);
  });
  it("clamps out-of-range and non-finite indices", () => {
    expect(clampRoundIndex(-1)).toBe(0);
    expect(clampRoundIndex(99)).toBe(4);
    expect(clampRoundIndex(NaN)).toBe(0);
  });
});

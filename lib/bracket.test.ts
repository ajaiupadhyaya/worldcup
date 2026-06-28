import { describe, expect, it } from "vitest";
import { buildBracketTree, tracePath } from "@/lib/bracket";
import type { BracketSlot, Topology } from "@/lib/predictions";

// Mini subtree: M73 & M75 (R32) feed M90 (R16). r32 unused by the builder.
const topo: Topology = {
  r32: [],
  progression: { M90: ["M73", "M75"] },
};
const bracket: BracketSlot[] = [
  {
    slot: "M73",
    round: "R32",
    sides: [[{ id: "a", prob: 0.6 }, { id: "b", prob: 0.4 }], [{ id: "c", prob: 0.7 }, { id: "d", prob: 0.3 }]],
    winner: [{ id: "a", prob: 0.5 }, { id: "c", prob: 0.3 }],
  },
  {
    slot: "M75",
    round: "R32",
    sides: [[{ id: "e", prob: 1 }], [{ id: "f", prob: 1 }]],
    winner: [{ id: "e", prob: 0.6 }, { id: "f", prob: 0.4 }],
  },
  {
    slot: "M90",
    round: "R16",
    sides: [[{ id: "a", prob: 0.5 }, { id: "b", prob: 0.2 }], [{ id: "e", prob: 0.6 }]],
    winner: [{ id: "a", prob: 0.4 }, { id: "e", prob: 0.35 }],
  },
];

describe("buildBracketTree", () => {
  it("groups matches into round columns ordered R32 -> F, dropping empty rounds", () => {
    const tree = buildBracketTree(bracket, topo);
    expect(tree.columns.map((c) => c.round)).toEqual(["R32", "R16"]);
    expect(tree.columns[0].label).toBe("Round of 32");
    expect(tree.columns[1].label).toBe("Round of 16");
    expect(tree.columns[0].matches.map((m) => m.slot)).toEqual(["M73", "M75"]);
    expect(tree.columns[1].matches.map((m) => m.slot)).toEqual(["M90"]);
  });

  it("resolves feeder slot ids from progression (null,null for R32)", () => {
    const tree = buildBracketTree(bracket, topo);
    expect(tree.bySlot.M90.feeders).toEqual(["M73", "M75"]);
    expect(tree.bySlot.M73.feeders).toEqual([null, null]);
  });

  it("carries side and winner distributions through unchanged", () => {
    const tree = buildBracketTree(bracket, topo);
    expect(tree.bySlot.M73.sides[0]).toEqual([{ id: "a", prob: 0.6 }, { id: "b", prob: 0.4 }]);
    expect(tree.bySlot.M73.winner[0]).toEqual({ id: "a", prob: 0.5 });
  });

  it("returns an empty tree for an absent bracket", () => {
    const tree = buildBracketTree(undefined, topo);
    expect(tree.columns).toEqual([]);
    expect(tree.bySlot).toEqual({});
  });

  it("null-coalesces a single-element progression entry so feeders is never [string, undefined]", () => {
    // topology with only one feeder listed for M90 (under-specified); cast via unknown
    // to simulate a malformed/partial payload that bypasses static typing at runtime.
    const singleFeederTopo = {
      r32: [],
      progression: { M90: ["M73"] },
    } as unknown as Topology;
    const tree = buildBracketTree(bracket, singleFeederTopo);
    expect(tree.bySlot.M90.feeders).toEqual(["M73", null]);
  });
});

describe("tracePath", () => {
  const tree = buildBracketTree(bracket, topo);

  it("collects every slot a team appears in (side or winner)", () => {
    expect(tracePath(tree, "a")).toEqual(new Set(["M73", "M90"]));
    expect(tracePath(tree, "e")).toEqual(new Set(["M75", "M90"]));
  });

  it("includes a slot when the team is only a losing participant", () => {
    // b reaches M73 (side) and M90 (side) but never wins either.
    expect(tracePath(tree, "b")).toEqual(new Set(["M73", "M90"]));
    // c only appears in M73.
    expect(tracePath(tree, "c")).toEqual(new Set(["M73"]));
  });

  it("returns an empty set for an unknown team", () => {
    expect(tracePath(tree, "zzz")).toEqual(new Set());
  });
});

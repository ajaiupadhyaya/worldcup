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

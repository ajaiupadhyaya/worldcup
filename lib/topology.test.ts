import { describe, expect, it } from "vitest";
import {
  BRACKET_ROUNDS,
  BRACKET_SLOTS,
  roundForSlot,
  topology,
  validateBracketSlots,
  predictions,
} from "@/lib/predictions";
import type { BracketSlot } from "@/lib/predictions";

describe("BRACKET_SLOTS / roundForSlot", () => {
  it("is exactly the 31 knockout slots M73..M104 with M103 omitted", () => {
    expect(BRACKET_SLOTS.length).toBe(31);
    expect(BRACKET_SLOTS[0]).toBe("M73");
    expect(BRACKET_SLOTS[BRACKET_SLOTS.length - 1]).toBe("M104");
    expect(BRACKET_SLOTS).not.toContain("M103");
    expect(new Set(BRACKET_SLOTS).size).toBe(31);
  });

  it("maps each slot to the verified round band", () => {
    const counts = { R32: 0, R16: 0, QF: 0, SF: 0, F: 0 } as Record<string, number>;
    for (const slot of BRACKET_SLOTS) counts[roundForSlot(slot)]++;
    expect(counts).toEqual({ R32: 16, R16: 8, QF: 4, SF: 2, F: 1 });
    expect(roundForSlot("M73")).toBe("R32");
    expect(roundForSlot("M88")).toBe("R32");
    expect(roundForSlot("M89")).toBe("R16");
    expect(roundForSlot("M97")).toBe("QF");
    expect(roundForSlot("M101")).toBe("SF");
    expect(roundForSlot("M104")).toBe("F");
    expect(() => roundForSlot("M103")).toThrow();
  });

  it("orders the rounds R32 -> F", () => {
    expect(BRACKET_ROUNDS).toEqual(["R32", "R16", "QF", "SF", "F"]);
  });
});

describe("data/topology.json", () => {
  it("has 16 R32 ties with valid refs and 3X best-third placeholders", () => {
    expect(topology.r32.length).toBe(16);
    const ref = /^([12][A-L]|3X)$/;
    for (const tie of topology.r32) {
      expect(tie.slot).toMatch(/^M(7[3-9]|8[0-8])$/);
      expect(tie.homeRef).toMatch(ref);
      expect(tie.awayRef).toMatch(ref);
    }
    // Exactly the 8 best-third fixtures carry a 3X away-ref (FIFA Annex-C set).
    const thirdSlots = topology.r32.filter((t) => t.awayRef === "3X").map((t) => t.slot).sort();
    expect(thirdSlots).toEqual(["M74", "M77", "M79", "M80", "M81", "M82", "M85", "M87"]);
  });

  it("progression feeders union with R32 slots covers exactly BRACKET_SLOTS", () => {
    const progKeys = Object.keys(topology.progression);
    expect(progKeys.length).toBe(15); // M89..M104 minus M103
    for (const feeders of Object.values(topology.progression)) {
      expect(feeders).toHaveLength(2);
      for (const f of feeders) expect(BRACKET_SLOTS).toContain(f);
    }
    const all = new Set([...topology.r32.map((t) => t.slot), ...progKeys]);
    expect([...all].sort()).toEqual([...BRACKET_SLOTS].sort());
  });

  it("has no thirds_table field", () => {
    expect((topology as unknown as Record<string, unknown>).thirds_table).toBeUndefined();
  });
});

describe("validateBracketSlots", () => {
  const complete: BracketSlot[] = BRACKET_SLOTS.map((slot) => ({
    slot,
    round: roundForSlot(slot),
    sides: [[{ id: "x", prob: 1 }], [{ id: "y", prob: 1 }]],
    winner: [{ id: "x", prob: 0.6 }, { id: "y", prob: 0.4 }],
  }));

  it("accepts a well-formed 31-slot bracket", () => {
    expect(validateBracketSlots(complete)).toBe(true);
  });

  it("rejects absent, short, mis-rounded, or malformed brackets", () => {
    expect(validateBracketSlots(undefined)).toBe(false);
    expect(validateBracketSlots(complete.slice(0, 30))).toBe(false);
    const wrongRound = complete.map((s, i) =>
      i === 0 ? { ...s, round: "F" as const } : s,
    );
    expect(validateBracketSlots(wrongRound)).toBe(false);
    const oneSide = complete.map((s, i) =>
      i === 0 ? { ...s, sides: [[{ id: "x", prob: 1 }]] as unknown as BracketSlot["sides"] } : s,
    );
    expect(validateBracketSlots(oneSide)).toBe(false);
  });
});

describe("predictions.bracket (real committed latest.json)", () => {
  it("has exactly 31 slots", () => {
    expect(predictions.bracket).toBeDefined();
    expect(predictions.bracket!.length).toBe(31);
  });

  it("includes M73 and M104 slot ids", () => {
    const slots = predictions.bracket!.map((s) => s.slot);
    expect(slots).toContain("M73");
    expect(slots).toContain("M104");
  });

  it("every slot round is one of the 5 valid labels", () => {
    const validRounds = new Set(["R32", "R16", "QF", "SF", "F"]);
    for (const s of predictions.bracket!) {
      expect(validRounds.has(s.round)).toBe(true);
    }
  });

  it("each slot has sides length 2 and a winner array", () => {
    for (const s of predictions.bracket!) {
      expect(Array.isArray(s.sides)).toBe(true);
      expect(s.sides.length).toBe(2);
      expect(Array.isArray(s.winner)).toBe(true);
      expect(s.winner.length).toBeGreaterThan(0);
    }
  });
});

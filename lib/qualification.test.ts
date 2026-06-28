import { describe, expect, it } from "vitest";
import { qualificationByTeam, reachR32ByTeam } from "@/lib/qualification";

describe("reachR32ByTeam", () => {
  it("maps every team id to a probability in [0,1]", () => {
    const ids = Object.keys(reachR32ByTeam);
    expect(ids.length).toBe(48);
    for (const id of ids) {
      const p = reachR32ByTeam[id];
      expect(typeof p).toBe("number");
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("dominates qualify for every team (reachR32 ⊇ top-2)", () => {
    // reachR32 = P(top-2 OR best-third) >= P(top-2) = qualify, per-sim, always.
    for (const id of Object.keys(reachR32ByTeam)) {
      expect(reachR32ByTeam[id]).toBeGreaterThanOrEqual(qualificationByTeam[id] - 1e-9);
    }
  });

  it("differs from qualify for at least one already-advanced team", () => {
    // The whole point of Fix A: best-third teams read 0% under `qualify`.
    const differ = Object.keys(reachR32ByTeam).filter(
      (id) => reachR32ByTeam[id] > qualificationByTeam[id] + 1e-6,
    );
    expect(differ.length).toBeGreaterThan(0);
  });
});

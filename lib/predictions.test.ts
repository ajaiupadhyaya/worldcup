import { describe, expect, it } from "vitest";
import { formatProb } from "@/lib/predictions";

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

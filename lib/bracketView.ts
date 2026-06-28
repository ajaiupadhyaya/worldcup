import type { BracketSlotProb, BracketRound, Stage } from "@/lib/predictions";

/** Column order, left→right, for the knockout board. */
export const ROUND_ORDER: BracketRound[] = ["R32", "R16", "QF", "SF", "F"];

/** Human round labels (Bodoni headings render these). */
export const ROUND_LABELS: Record<BracketRound, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Final",
};

/**
 * Highest-probability entry of a per-slot distribution. Defends against an
 * unsorted/empty/missing list (the snapshot caps + sorts, but UI must not
 * assume it). Returns null when there is nothing to show.
 */
export function mostLikely(dist: BracketSlotProb[]): BracketSlotProb | null {
  if (!dist || dist.length === 0) return null;
  let best = dist[0];
  for (const d of dist) if (d.prob > best.prob) best = d;
  return best;
}

/**
 * The snapshot stage whose Monte-Carlo standard error best represents a slot
 * in each round — i.e. the uncertainty of a team *reaching* (or, for the
 * Final, *winning*) that match. Drives the BracketSlot whisker.
 */
export const STAGE_BY_ROUND: Record<BracketRound, Stage> = {
  R32: "reachR32",
  R16: "reachR16",
  QF: "reachQF",
  SF: "reachSF",
  F: "winCup",
};

/** Fallback display name from a snapshot slug id (used when no name lookup hit). */
export function prettifyId(id: string): string {
  if (!id) return "";
  return id
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

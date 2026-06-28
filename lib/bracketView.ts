import type { BracketSlotProb, BracketRound, Stage } from "@/lib/predictions";
import type { BracketTree } from "@/lib/bracket";

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

// ---------------------------------------------------------------------------
// UV3: Layout geometry + path-state helpers
// ---------------------------------------------------------------------------

/** One positioned node in the deterministic bracket canvas. */
export interface LayoutNode {
  slot: string;
  round: BracketRound;
  col: number;
  row: number;
  /**
   * Both feeder slot ids as strings (never null here) or null when the match
   * has no feeders (R32 or synthetic test fixtures).
   */
  feeders: [string, string] | null;
}

/**
 * Deterministic bracket geometry without DOM measurement: R32 matches take
 * their array index as base row; every later match sits at the mean row of
 * its two feeders. col = ROUND_ORDER index. Used for absolute positioning and
 * SVG connector elbows.
 */
export function computeLayout(tree: BracketTree): LayoutNode[] {
  const rowBySlot = new Map<string, number>();
  const nodes: LayoutNode[] = [];
  ROUND_ORDER.forEach((round, col) => {
    const matches = tree.rounds[round] ?? [];
    matches.forEach((m, i) => {
      let row: number;
      const [f0, f1] = m.feeders ?? [null, null];
      if (f0 && f1) {
        const ra = rowBySlot.get(f0);
        const rb = rowBySlot.get(f1);
        row = ra != null && rb != null ? (ra + rb) / 2 : i;
      } else {
        row = i;
      }
      rowBySlot.set(m.slot, row);
      const feeders: [string, string] | null = f0 && f1 ? [f0, f1] : null;
      nodes.push({ slot: m.slot, round, col, row, feeders });
    });
  });
  return nodes;
}

export type SlotVisual = "active" | "dim" | "idle";

/** Visual state of a slot given the active path trace (null/empty => idle). */
export function slotState(slot: string, traced: Set<string> | null): SlotVisual {
  if (!traced || traced.size === 0) return "idle";
  return traced.has(slot) ? "active" : "dim";
}

/** Top-N title odds (the M104 winner distribution), descending. */
export function championLadder(champion: BracketSlotProb[], topN = 6): BracketSlotProb[] {
  return [...champion].sort((a, b) => b.prob - a.prob).slice(0, topN);
}

/** Bound a round index (e.g. from a mobile selector) into ROUND_ORDER range. */
export function clampRoundIndex(i: number): number {
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(ROUND_ORDER.length - 1, Math.round(i)));
}

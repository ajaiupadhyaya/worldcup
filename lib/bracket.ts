import { BRACKET_ROUNDS } from "./predictions";
import type { BracketRound, BracketSlot, BracketSlotProb, Topology } from "./predictions";

export interface BracketMatch {
  slot: string;
  round: BracketRound;
  sides: [BracketSlotProb[], BracketSlotProb[]];
  winner: BracketSlotProb[];
  /** Feeder slot ids for connector lines (R16+); [null, null] for R32. */
  feeders: [string | null, string | null];
}

export interface BracketColumn {
  round: BracketRound;
  label: string;
  matches: BracketMatch[];
}

export interface BracketTree {
  columns: BracketColumn[];
  /** Round-keyed map for absolute-canvas layout and mobile stacking. */
  rounds: Record<BracketRound, BracketMatch[]>;
  bySlot: Record<string, BracketMatch>;
  /** M104 winner distribution — single source of truth for the ChampionPanel. */
  champion: BracketSlotProb[];
  /** ISO timestamp of the predictions snapshot that built this tree. */
  generatedAt: string;
}

const ROUND_LABELS: Record<BracketRound, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Final",
};

const slotNum = (slot: string): number => {
  const n = Number.parseInt(slot.slice(1), 10);
  return Number.isNaN(n) ? 0 : n;
};

/** Shape predictions.bracket + topology into round-column tree + slot index.
 *  Honors each slot's emitted `round`; feeders come from topology.progression.
 *  An absent/empty bracket yields an empty (renderable) tree. */
export function buildBracketTree(
  bracket: BracketSlot[] | undefined,
  topology: Topology,
  generatedAt = "",
): BracketTree {
  const bySlot: Record<string, BracketMatch> = {};
  for (const s of bracket ?? []) {
    const feeders = topology.progression[s.slot];
    bySlot[s.slot] = {
      slot: s.slot,
      round: s.round,
      sides: [s.sides[0] ?? [], s.sides[1] ?? []],
      winner: s.winner ?? [],
      feeders: feeders ? [feeders[0] ?? null, feeders[1] ?? null] : [null, null],
    };
  }
  const columns: BracketColumn[] = BRACKET_ROUNDS.map((round) => ({
    round,
    label: ROUND_LABELS[round],
    matches: Object.values(bySlot)
      .filter((m) => m.round === round)
      .sort((a, b) => slotNum(a.slot) - slotNum(b.slot)),
  })).filter((col) => col.matches.length > 0);

  // Build the round-keyed index (sorted, same order as columns)
  const rounds = Object.fromEntries(
    BRACKET_ROUNDS.map((r) => [r, Object.values(bySlot).filter((m) => m.round === r).sort((a, b) => slotNum(a.slot) - slotNum(b.slot))]),
  ) as Record<BracketRound, BracketMatch[]>;

  const champion: BracketSlotProb[] = bySlot["M104"]?.winner ?? [];
  return { columns, rounds, bySlot, champion, generatedAt };
}

/** Every slot id where `teamId` appears on a side OR in the winner list —
 *  the highlight interaction's "road to the final". */
export function tracePath(tree: BracketTree, teamId: string): Set<string> {
  const path = new Set<string>();
  for (const m of Object.values(tree.bySlot)) {
    const present =
      m.sides[0].some((p) => p.id === teamId) ||
      m.sides[1].some((p) => p.id === teamId) ||
      m.winner.some((p) => p.id === teamId);
    if (present) path.add(m.slot);
  }
  return path;
}

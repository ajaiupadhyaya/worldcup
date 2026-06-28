import calibrationJson from "@/data/predictions/calibration.json";
import predictionsJson from "@/data/predictions/latest.json";
import ratingsJson from "@/data/ratings/latest.json";
import topologyJson from "@/data/topology.json";
export { formatProb } from "./probability";

export type Stage =
  | "qualify" | "reachR32" | "reachR16" | "reachQF"
  | "reachSF" | "reachFinal" | "winCup";

export interface PredTeam {
  id: string;
  name: string;
  qualify: number;
  reachR32: number;
  reachR16: number;
  reachQF: number;
  reachSF: number;
  reachFinal: number;
  winCup: number;
  mcStdErr: Record<Stage, number>;
}

export interface GroupProb {
  group: string;
  teams: { id: string; finishProbs: { p1: number; p2: number; p3: number; p4: number } }[];
}

// --- THE DRAW: locked bracket contract (camelCase to match the snapshot) ---
export type BracketRound = "R32" | "R16" | "QF" | "SF" | "F";

export interface BracketSlotProb {
  id: string;
  prob: number;
}

/** One knockout match slot M73..M104. `sides` = each participant side's
 *  distribution (who reaches that side); `winner` = who advances/wins. Each
 *  list is prob >= 0.005, sorted desc, capped at 12 — UI must NOT assume it
 *  sums to 1 (tail dropped). */
export interface BracketSlot {
  slot: string;
  round: BracketRound;
  sides: [BracketSlotProb[], BracketSlotProb[]];
  winner: BracketSlotProb[];
}

/** Slim topology (data/topology.json). Refs: "1A" (winner), "2B" (runner-up),
 *  "3X" (a best-third placeholder). The web imports THIS, never
 *  model/data/bracket_2026.json (which carries the 5000-line thirds_table). */
export interface R32Tie {
  slot: string;
  homeRef: string;
  awayRef: string;
}
export type Progression = Record<string, [string, string]>;
export interface Topology {
  r32: R32Tie[];
  progression: Progression;
}

export interface PredictionsSnapshot {
  generatedAt: string;
  modelVersion: string;
  seed: number;
  simCount: number;
  inputsHash: string;
  thirdsTableComplete?: boolean;
  teams: PredTeam[];
  groups: GroupProb[];
  /** Exactly 31 slots M73..M104 (M103 third-place OMITTED). Optional until
   *  the model emit (Track P) lands; validate with validateBracketSlots. */
  bracket?: BracketSlot[];
}

export interface RatingTeam {
  id: string;
  name: string;
  attack: number;
  defense: number;
  elo: number;
  overall: number;
  style: Record<string, unknown>;
}
export interface RatingsSnapshot {
  generatedAt: string;
  teams: RatingTeam[];
}

export interface ReliabilityBin {
  binMid: number;
  n: number;
  observed: number;
  predicted: number;
}
export interface CalibrationSnapshot {
  generatedAt: string;
  brier: number;
  logloss: number;
  reliability: ReliabilityBin[];
}

// Build-time static import: the cron commits new snapshots -> Vercel redeploys
// -> these imports are re-bundled. `as unknown as` avoids strict structural
// cast errors on the inferred JSON literal type.
export const predictions = predictionsJson as unknown as PredictionsSnapshot;
export const ratings = ratingsJson as unknown as RatingsSnapshot;
export const calibration = calibrationJson as unknown as CalibrationSnapshot;
export const topology = topologyJson as unknown as Topology;

export const FUNNEL_STAGES: { key: Stage; label: string }[] = [
  { key: "reachR16", label: "Round of 16" },
  { key: "reachQF", label: "Quarterfinal" },
  { key: "reachSF", label: "Semifinal" },
  { key: "reachFinal", label: "Final" },
  { key: "winCup", label: "Champion" },
];

export interface FunnelEntry {
  id: string;
  name: string;
  prob: number;
  stdErr: number;
}
export interface FunnelColumn {
  key: Stage;
  label: string;
  entries: FunnelEntry[];
}

/** For each knockout stage, the topN teams by probability of reaching it. */
export function funnelRows(teams: PredTeam[], topN = 8): FunnelColumn[] {
  return FUNNEL_STAGES.map(({ key, label }) => ({
    key,
    label,
    entries: teams
      .map((t) => ({ id: t.id, name: t.name, prob: t[key], stdErr: t.mcStdErr?.[key] ?? 0 }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, topN),
  }));
}

/** Mirror of the model's _slug so live ESPN team names join to snapshot ids. */
export function slugifyTeam(name: string): string {
  return name.toLowerCase().replace(/'/g, "").replace(/ /g, "-");
}

/** slug -> P(qualify from group), for the /standings projected column. */
export function qualifyByTeam(teams: PredTeam[]): Map<string, number> {
  return new Map(teams.map((t) => [t.id, t.qualify]));
}

/** Round columns, R32 -> Final. */
export const BRACKET_ROUNDS: BracketRound[] = ["R32", "R16", "QF", "SF", "F"];

/** The 31 knockout slots in tree order. M103 (third-place playoff) is omitted
 *  by design — the engine does not model it. */
export const BRACKET_SLOTS: string[] = [
  "M73", "M74", "M75", "M76", "M77", "M78", "M79", "M80",
  "M81", "M82", "M83", "M84", "M85", "M86", "M87", "M88", // R32 (16)
  "M89", "M90", "M91", "M92", "M93", "M94", "M95", "M96", // R16 (8)
  "M97", "M98", "M99", "M100",                            // QF (4)
  "M101", "M102",                                         // SF (2)
  "M104",                                                 // F (1)
];

/** Verified round boundaries from the progression feeders. Throws on a
 *  non-knockout slot (e.g. M103), which must never appear in the bracket. */
export function roundForSlot(slot: string): BracketRound {
  const n = Number.parseInt(slot.slice(1), 10);
  if (n >= 73 && n <= 88) return "R32";
  if (n >= 89 && n <= 96) return "R16";
  if (n >= 97 && n <= 100) return "QF";
  if (n === 101 || n === 102) return "SF";
  if (n === 104) return "F";
  throw new Error(`slot ${slot} is not a knockout bracket slot`);
}

/** Structural guard for graceful UI degradation: exactly the 31 BRACKET_SLOTS,
 *  each with the correct round and a two-element sides tuple + winner array. */
export function validateBracketSlots(bracket: BracketSlot[] | undefined): boolean {
  if (!bracket || bracket.length !== BRACKET_SLOTS.length) return false;
  const expected = new Set(BRACKET_SLOTS);
  const seen = new Set<string>();
  for (const s of bracket) {
    if (!expected.has(s.slot) || seen.has(s.slot)) return false;
    seen.add(s.slot);
    if (s.round !== roundForSlot(s.slot)) return false;
    if (!Array.isArray(s.sides) || s.sides.length !== 2) return false;
    if (!Array.isArray(s.winner)) return false;
  }
  return seen.size === BRACKET_SLOTS.length;
}

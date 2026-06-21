import calibrationJson from "@/data/predictions/calibration.json";
import predictionsJson from "@/data/predictions/latest.json";
import ratingsJson from "@/data/ratings/latest.json";

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

export interface PredictionsSnapshot {
  generatedAt: string;
  modelVersion: string;
  seed: number;
  simCount: number;
  inputsHash: string;
  thirdsTableComplete?: boolean;
  teams: PredTeam[];
  groups: GroupProb[];
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

/** Format a probability in [0,1] as a chalk-friendly percentage string. */
export function formatProb(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.001) return "<0.1%";
  if (p < 0.1) return `${(p * 100).toFixed(1)}%`;
  return `${Math.round(p * 100)}%`;
}

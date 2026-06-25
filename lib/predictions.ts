import calibrationJson from "@/data/predictions/calibration.json";
import predictionsJson from "@/data/predictions/latest.json";
import ratingsJson from "@/data/ratings/latest.json";
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

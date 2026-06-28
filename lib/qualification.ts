import predictionsJson from "@/data/predictions/latest.json";
import type { PredictionsSnapshot } from "./predictions";

const snapshot = predictionsJson as unknown as Pick<PredictionsSnapshot, "generatedAt" | "teams">;

export const qualificationGeneratedAt = snapshot.generatedAt;

export const qualificationByTeam = Object.fromEntries(
  snapshot.teams.map((team) => [team.id, team.qualify]),
);

// Fix A: the home "Round of 32" bars use reachR32 (P advance to R32 = group
// top-2 OR best-third) so already-advanced best-third teams stop reading 0%.
// qualify (group top-2) is intentionally left untouched for every OTHER
// consumer: /standings "Q %", AnalyticsBand, ScenarioLab, TournamentPulse.
export const reachR32ByTeam = Object.fromEntries(
  snapshot.teams.map((team) => [team.id, team.reachR32]),
);

function qualificationKey(name: string): string {
  const aliases: Record<string, string> = {
    "cote-d-ivoire": "ivory-coast",
    "cote-divoire": "ivory-coast",
    "curacao": "curacao",
    "turkiye": "turkey",
  };
  const key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return aliases[key] ?? key;
}

export function qualificationForTeam(name: string): number | undefined {
  return qualificationByTeam[qualificationKey(name)];
}

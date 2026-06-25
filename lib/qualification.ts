import predictionsJson from "@/data/predictions/latest.json";
import type { PredictionsSnapshot } from "./predictions";

const snapshot = predictionsJson as unknown as Pick<PredictionsSnapshot, "generatedAt" | "teams">;

export const qualificationGeneratedAt = snapshot.generatedAt;

export const qualificationByTeam = Object.fromEntries(
  snapshot.teams.map((team) => [team.id, team.qualify]),
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

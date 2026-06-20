// Kit colours for the programme-spine edge bars. Keyed by team short code
// (ESPN abbreviation) with a deterministic fallback so every team — including
// ones not in the table — gets a stable, legible colour.

import type { Team } from "./types";

// Primary kit colour per nation (3-letter codes as ESPN/API-Football emit them).
const KIT: Record<string, string> = {
  ARG: "#6CA0DC", BRA: "#FFDF00", FRA: "#1E3A8A", ENG: "#FFFFFF", ESP: "#C60B1E",
  GER: "#111111", NED: "#EC6A1E", POR: "#C8102E", BEL: "#E30613", ITA: "#0066B3",
  CRO: "#FF0000", URU: "#5CB8E6", MEX: "#006847", USA: "#0A3161", CAN: "#D80621",
  JPN: "#0A1F5E", KOR: "#C8102E", AUS: "#FFCD00", SUI: "#D52B1E", SWE: "#005B99",
  DEN: "#C8102E", POL: "#DC143C", SEN: "#00853F", MAR: "#C1272D", GHA: "#006B3F",
  NGA: "#008751", CIV: "#FF8200", CMR: "#007A5E", EGY: "#C8102E", TUN: "#E70013",
  SRB: "#C6363C", SCO: "#0065BF", WAL: "#C8102E", AUT: "#ED2939", TUR: "#E30A17",
  UKR: "#FFD500", ECU: "#FFD100", COL: "#FCD116", PER: "#D91023", CHI: "#0039A6",
  PAR: "#DA121A", CRC: "#002B7F", QAT: "#8A1538", IRN: "#239F40", KSA: "#006C35",
  CZE: "#11457E", HAI: "#00209F", CUW: "#00247D", BIH: "#001489", ZAF: "#007749",
  RSA: "#007749", NZL: "#000000", PAN: "#005293", HON: "#0073CF", JAM: "#009B3A",
};

// Some sources use full names; map a few common ones to their code colour.
const NAME_ALIAS: Record<string, string> = {
  "South Korea": "KOR", "South Africa": "RSA", "Ivory Coast": "CIV",
  "United States": "USA", "Czechia": "CZE", "Curacao": "CUW", "Curaçao": "CUW",
  "Bosnia-Herzegovina": "BIH", "Türkiye": "TUR", "Turkey": "TUR",
};

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** Stable kit colour for a team's programme-spine edge bar. */
export function kitColor(team: Pick<Team, "shortName" | "name">): string {
  const code = (team.shortName || "").toUpperCase();
  if (KIT[code]) return KIT[code];
  const alias = NAME_ALIAS[team.name];
  if (alias && KIT[alias]) return KIT[alias];
  // Deterministic, reasonably saturated fallback.
  const hue = hashHue(team.name || code || "team");
  return `hsl(${hue} 62% 55%)`;
}

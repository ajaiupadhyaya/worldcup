import type { PredTeam } from "./predictions";

export interface OgLadderRow {
  id: string;
  name: string;
  prob: number;
}

export interface BracketOgData {
  champion: OgLadderRow | null;
  ladder: OgLadderRow[];
}

/**
 * Champion + title-odds ladder for the /bracket OG card. The champion is the
 * single source of truth winCup distribution (== the M104 winner), so the
 * ladder is simply the highest-winCup teams in descending order.
 */
export function bracketOgData(teams: PredTeam[], n = 4): BracketOgData {
  const ladder: OgLadderRow[] = [...teams]
    .sort((a, b) => b.winCup - a.winCup)
    .slice(0, n)
    .map((t) => ({ id: t.id, name: t.name, prob: t.winCup }));
  return { champion: ladder[0] ?? null, ladder };
}

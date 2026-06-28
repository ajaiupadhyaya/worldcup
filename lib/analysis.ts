// Analysis orchestration.
// Bridges the data layer and the free deterministic analysis engine, with a
// caching policy tuned per analysis type:
//   - post-match breakdown: generate ONCE, cache for a day (immutable result)
//   - pre-match preview: cache 30 min, regenerate when lineups change
//   - live commentary: regenerate every 15 minutes

import { cache } from "./cache";
import { getMatch } from "./data";
import { FREE_ANALYSIS_MODEL, buildAnalysisText } from "./free-analysis";
import type { Match } from "./types";

export interface AnalysisResult {
  matchId: string;
  type: "breakdown" | "preview" | "live";
  text: string;
  model: string;
  generatedAt: string;
}

const DAY = 24 * 60 * 60;
const PREVIEW_TTL = 30 * 60;
const LIVE_TTL = 15 * 60;

function result(matchId: string, type: AnalysisResult["type"], text: string): AnalysisResult {
  return {
    matchId,
    type,
    text,
    model: FREE_ANALYSIS_MODEL,
    generatedAt: new Date().toISOString(),
  };
}

/** A short signature of lineup state so previews regenerate when XIs change. */
function lineupSignature(match: Match): string {
  if (!match.lineups) return "none";
  const ids = (xi: { id: string }[]) => xi.map((p) => p.id).sort().join(",");
  return `${ids(match.lineups.home.startingXI)}|${ids(match.lineups.away.startingXI)}`;
}

export async function getBreakdown(matchId: string, force = false): Promise<AnalysisResult> {
  const key = `analysis:breakdown:${matchId}`;
  if (!force) {
    const hit = await cache.get<AnalysisResult>(key);
    if (hit) return hit;
  }
  const { data: match } = await getMatch(matchId);
  if (match.status !== "finished") {
    throw new Error("Breakdown is only available for finished matches");
  }
  const text = buildAnalysisText(match, "breakdown");
  const res = result(matchId, "breakdown", text);
  await cache.set(key, res, DAY);
  return res;
}

export async function getPreview(matchId: string, force = false): Promise<AnalysisResult> {
  const { data: match } = await getMatch(matchId);
  const sig = lineupSignature(match);
  const key = `analysis:preview:${matchId}:${sig}`;
  if (!force) {
    const hit = await cache.get<AnalysisResult>(key);
    if (hit) return hit;
  }
  const text = buildAnalysisText(match, "preview");
  const res = result(matchId, "preview", text);
  await cache.set(key, res, PREVIEW_TTL);
  return res;
}

export async function getLive(matchId: string, force = false): Promise<AnalysisResult> {
  const { data: match } = await getMatch(matchId);
  if (match.status !== "live") {
    throw new Error("Live commentary is only available for live matches");
  }
  // Fold a coarse live-state signature into the key so a new goal/event (or a
  // ~5-minute bucket) regenerates the read; LIVE_TTL caps the cost.
  const sig = `${match.score.home}-${match.score.away}:${match.events?.length ?? 0}:${Math.floor((match.minute ?? 0) / 5)}`;
  const key = `analysis:live:${matchId}:${sig}`;
  if (!force) {
    const hit = await cache.get<AnalysisResult>(key);
    if (hit) return hit;
  }
  const text = buildAnalysisText(match, "live");
  const res = result(matchId, "live", text);
  await cache.set(key, res, LIVE_TTL);
  return res;
}

/** Returns the match (for Q&A context) — throws if not found. */
export async function matchForQA(matchId: string): Promise<Match> {
  const { data } = await getMatch(matchId);
  return data;
}

/**
 * Returns a one-sentence tactical verdict for a match IF a breakdown is already
 * cached — never triggers a generation. Used by the OG card so rendering an
 * image is always cheap and never blocks on external services.
 */
export async function peekVerdict(matchId: string): Promise<string | null> {
  const hit = await cache.get<AnalysisResult>(`analysis:breakdown:${matchId}`);
  if (!hit) return null;
  // First sentence of the breakdown, trimmed to a card-friendly length.
  const sentence = hit.text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return sentence.length > 160 ? sentence.slice(0, 157).trimEnd() + "…" : sentence;
}

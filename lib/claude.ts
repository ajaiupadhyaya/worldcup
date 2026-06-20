// Anthropic Claude client + tactical-analysis prompt templates (Phase 2).
// All analysis runs through claude-sonnet-4-6 per the project spec. Activates
// only when ANTHROPIC_API_KEY is set; routes degrade gracefully otherwise.

import Anthropic from "@anthropic-ai/sdk";
import type { Match, MatchStats } from "./types";

export const ANALYSIS_MODEL = "claude-sonnet-4-6";

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Lazy singleton — constructing the client reads ANTHROPIC_API_KEY from env.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  _client ??= new Anthropic();
  return _client;
}

// The tactical-analyst persona (verbatim from the project spec).
export const ANALYST_SYSTEM = `You are a world-class football tactical analyst with deep expertise in pressing systems, positional play, set pieces, and manager tendencies. You write with the authority and specificity of a UEFA Pro License coach, not a journalist. Be precise, opinionated, and reference specific tactical patterns, not generic observations. Always ground analysis in the actual stats provided.`;

// ---- context formatting -----------------------------------------------------

function fmtStats(s: MatchStats | undefined): string {
  if (!s) return "No detailed stats available.";
  const row = (label: string, h: number, a: number, suffix = "") =>
    `  ${label}: ${h}${suffix} vs ${a}${suffix}`;
  const lines = [
    s.xG.home || s.xG.away ? row("xG", s.xG.home, s.xG.away) : null,
    row("Possession", s.possession.home, s.possession.away, "%"),
    row("Shots", s.shots.home, s.shots.away),
    row("Shots on target", s.shotsOnTarget.home, s.shotsOnTarget.away),
    s.passes.home || s.passes.away ? row("Passes", s.passes.home, s.passes.away) : null,
    s.corners ? row("Corners", s.corners.home, s.corners.away) : null,
    s.fouls ? row("Fouls", s.fouls.home, s.fouls.away) : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function fmtLineups(match: Match): string {
  if (!match.lineups) return "Lineups not confirmed.";
  const { home, away } = match.lineups;
  const xi = (names: { name: string }[]) => names.map((p) => p.name).join(", ");
  return [
    `${match.homeTeam.name} (${home.formation || "?"}): ${xi(home.startingXI)}`,
    `${match.awayTeam.name} (${away.formation || "?"}): ${xi(away.startingXI)}`,
  ].join("\n");
}

function fmtEvents(match: Match): string {
  if (!match.events?.length) return "No key events recorded.";
  return match.events
    .map((e) => `  ${e.minute}' [${e.type}] ${e.detail ?? e.player}`)
    .join("\n");
}

/** Render a full match into a compact text context block for prompting. */
export function matchContext(match: Match): string {
  return [
    `Match: ${match.homeTeam.name} ${match.score.home}-${match.score.away} ${match.awayTeam.name}`,
    `Status: ${match.status}${match.minute ? ` (${match.minute}')` : ""}`,
    match.round ? `Round: ${match.round}` : null,
    match.venue ? `Venue: ${match.venue}` : null,
    "",
    "Stats:",
    fmtStats(match.stats),
    "",
    "Lineups:",
    fmtLineups(match),
    "",
    "Key events:",
    fmtEvents(match),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// ---- core call helper -------------------------------------------------------

async function complete(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  // Stream so large / slow analysis calls don't hit request timeouts, then
  // collapse to the final text.
  const stream = client().messages.stream({
    model: ANALYSIS_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") {
    throw new Error("Claude declined to analyze this match.");
  }
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  // Never let an empty result be cached as a successful analysis.
  if (!text) throw new Error("Claude returned an empty analysis; please retry.");
  return text;
}

// ---- analysis types ---------------------------------------------------------

/** Post-match tactical breakdown (400-600 words). */
export async function postMatchBreakdown(match: Match): Promise<string> {
  const user = `Write a 400-600 word post-match tactical breakdown of this finished match. Cover: the key tactical battle, why the result happened, standout performers, and decisive manager decisions. Ground every claim in the stats below.\n\n${matchContext(match)}`;
  // Headroom so a 600-word breakdown isn't truncated mid-sentence.
  return complete(ANALYST_SYSTEM, user, 3000);
}

/** Pre-match preview + prediction. */
export async function preMatchPreview(
  match: Match,
  extra?: { homeForm?: string; awayForm?: string; h2h?: string },
): Promise<string> {
  const context = [
    matchContext(match),
    extra?.homeForm ? `\n${match.homeTeam.name} recent form: ${extra.homeForm}` : "",
    extra?.awayForm ? `${match.awayTeam.name} recent form: ${extra.awayForm}` : "",
    extra?.h2h ? `Head-to-head: ${extra.h2h}` : "",
  ].join("\n");
  const user = `Write a pre-match preview for this upcoming fixture. Cover: predicted formations for both sides, the key tactical matchups to watch, and a predicted scoreline with reasoning. Keep it tight and opinionated (250-400 words).\n\n${context}`;
  return complete(ANALYST_SYSTEM, user, 1500);
}

/** Short live tactical observation (2-3 sentences). */
export async function liveCommentary(match: Match): Promise<string> {
  const user = `This match is live at ${match.minute ?? "?"}'. In 2-3 sentences, give a sharp tactical observation about what is happening right now, grounded in the live stats and events.\n\n${matchContext(match)}`;
  return complete(ANALYST_SYSTEM, user, 400);
}

/** Q&A about a match — returns a streaming SSE-friendly text stream. */
export function askStream(match: Match, question: string) {
  const system = `${ANALYST_SYSTEM}\n\nYou are answering questions about this specific match. Use the match context to ground your answers; if the data does not support an answer, say so.\n\nMATCH CONTEXT:\n${matchContext(match)}`;
  return client().messages.stream({
    model: ANALYSIS_MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: question }],
  });
}

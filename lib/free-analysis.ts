import type { Match, MatchStats } from "./types";

export const FREE_ANALYSIS_MODEL = "floodlit-free-intelligence-v1";

type Side = "home" | "away";

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function statDiff(stats: MatchStats | undefined, key: keyof MatchStats): number | null {
  const pair = stats?.[key];
  if (!pair || typeof pair !== "object" || !("home" in pair) || !("away" in pair)) return null;
  return Number(pair.home) - Number(pair.away);
}

function team(match: Match, side: Side): string {
  return side === "home" ? match.homeTeam.name : match.awayTeam.name;
}

function leader(match: Match): Side | "level" {
  if (match.score.home > match.score.away) return "home";
  if (match.score.away > match.score.home) return "away";
  return "level";
}

function formation(match: Match, side: Side): string {
  return match.lineups?.[side].formation || "unconfirmed";
}

function availableStats(match: Match): string[] {
  const stats = match.stats;
  if (!stats) return ["No live stat feed is available yet, so this read leans on score state, lineups, and event timing."];

  const rows = [
    ["possession", statDiff(stats, "possession"), "%"],
    ["shot volume", statDiff(stats, "shots"), ""],
    ["shots on target", statDiff(stats, "shotsOnTarget"), ""],
    ["xG", statDiff(stats, "xG"), ""],
    ["corners", statDiff(stats, "corners"), ""],
  ] as const;

  return rows
    .filter(([, diff]) => diff !== null && Math.abs(diff) > 0)
    .slice(0, 4)
    .map(([label, diff, suffix]) => {
      const side = (diff ?? 0) > 0 ? "home" : "away";
      return `${team(match, side)} lead the ${label} count by ${Math.abs(diff ?? 0)}${suffix}.`;
    });
}

function eventRead(match: Match): string {
  const events = match.events ?? [];
  if (!events.length) return "The event log is still quiet, so the biggest signal is structural: spacing, territory, and how each midfield line protects transitions.";
  const goals = events.filter((event) => event.type === "goal");
  const cards = events.filter((event) => event.type === "card");
  const latest = events[events.length - 1];
  const parts = [];
  if (goals.length) parts.push(`${goals.length} goal event${goals.length === 1 ? "" : "s"} already changed the game script`);
  if (cards.length) parts.push(`${cards.length} card event${cards.length === 1 ? "" : "s"} add discipline pressure`);
  if (latest) parts.push(`the latest logged action came on ${latest.minute}'`);
  return `${parts.join("; ")}.`;
}

function scoreState(match: Match): string {
  const state = leader(match);
  if (match.status === "scheduled") {
    return `${team(match, "home")} (${formation(match, "home")}) and ${team(match, "away")} (${formation(match, "away")}) enter with the first priority being rest-defense: avoid the early transition that flips the group math.`;
  }
  if (state === "level") {
    return `At ${match.score.home}-${match.score.away}, this is still a leverage game: the next goal changes both tactical risk and qualification pressure.`;
  }
  const ahead = team(match, state);
  const behind = team(match, state === "home" ? "away" : "home");
  return `${ahead} are protecting a ${Math.abs(match.score.home - match.score.away)}-goal edge; ${behind} need to increase penalty-box entries without leaving the counter lane open.`;
}

function tacticalBattle(match: Match): string {
  const home = formation(match, "home");
  const away = formation(match, "away");
  if (home !== "unconfirmed" || away !== "unconfirmed") {
    return `The core shape battle is ${team(match, "home")} ${home} against ${team(match, "away")} ${away}. Watch the half-spaces: that is where the first free runner usually appears when the press is beaten.`;
  }
  return "With formations not confirmed, the best early read is compactness: which side can keep the back line connected to midfield while still arriving with numbers around second balls.";
}

export function buildAnalysisText(match: Match, type: "breakdown" | "preview" | "live"): string {
  const stats = availableStats(match);
  const label = type === "preview" ? "Pre-match model read" : type === "live" ? "Live model read" : "Post-match model read";
  return [
    `${label}: ${scoreState(match)}`,
    tacticalBattle(match),
    stats.length ? stats.join(" ") : "",
    eventRead(match),
    "Actionable watchpoint: track the first pass after regain. If it goes forward cleanly, the defending block is stretched; if it goes sideways, the press has done its job.",
    "This read is generated locally from free/open match data and deterministic rules, so it costs nothing and remains auditable.",
  ].filter(Boolean).join("\n\n");
}

export function answerMatchQuestion(match: Match, rawQuestion: string): string {
  const question = rawQuestion.toLowerCase();
  const stats = match.stats;
  if (question.includes("tactical battle") || question.includes("key")) {
    return `${tacticalBattle(match)} ${scoreState(match)}`;
  }
  if (question.includes("why") || question.includes("on top")) {
    const state = leader(match);
    if (state !== "level") return `${team(match, state)} are on top because the game state now lets them choose moments: protect central lanes first, then attack space after turnovers. ${availableStats(match).join(" ")}`;
    return `No side is truly on top from the scoreline. The separator is territory: possession without box entries is cosmetic, while even a small shots-on-target edge is more meaningful. ${availableStats(match).join(" ")}`;
  }
  if (question.includes("change") || question.includes("trailing")) {
    const state = leader(match);
    const trailing = state === "home" ? "away" : state === "away" ? "home" : null;
    return trailing
      ? `${team(match, trailing)} should first add a runner beyond the last line, then push one fullback higher only when the far-side midfielder is covering the counter. Chasing with both fullbacks at once is the expensive mistake.`
      : "The side that wants to force the game should add pressure through the wide channel first, not by emptying midfield. The risk is losing the second-ball zone after a cleared cross.";
  }
  if (question.includes("xg")) {
    if (!stats?.xG || (stats.xG.home + stats.xG.away === 0)) return "xG is not available from the current free source. The dashboard falls back to shots, shots on target, possession, events, and tournament context.";
    return `${team(match, "home")} xG: ${stats.xG.home}. ${team(match, "away")} xG: ${stats.xG.away}. The useful read is the gap, not the raw number: ${Math.abs(stats.xG.home - stats.xG.away).toFixed(2)} xG separates the chance quality.`;
  }
  if (question.includes("possession")) {
    if (!stats?.possession) return "Possession is not available yet from the active feed.";
    return `${team(match, "home")} have ${pct(stats.possession.home)} possession; ${team(match, "away")} have ${pct(stats.possession.away)}. Treat that as control only if it is paired with shots on target or territory near the box.`;
  }
  return buildAnalysisText(match, match.status === "scheduled" ? "preview" : match.status === "live" ? "live" : "breakdown");
}

export function frameChecklist(match?: Match): {
  formation: string;
  defensive_shape: string;
  press_trigger: string;
  defensive_line: string;
  width: string;
  key_patterns: string[];
  full_analysis: string;
  cached: boolean;
} {
  const home = match ? formation(match, "home") : "unknown";
  const away = match ? formation(match, "away") : "unknown";
  return {
    formation: match ? `${home} / ${away}` : "manual review",
    defensive_shape: "Use the frame to count the first two defensive lines and note whether the far winger is tucked in or left high.",
    press_trigger: "Likely triggers: backward pass, loose first touch, receiver facing own goal, or touchline trap.",
    defensive_line: "Estimate by distance from the box: deep block, mid-block, or high line.",
    width: "Check fullback height and winger touchline width; these reveal whether the team is stretching or compressing the pitch.",
    key_patterns: ["line height", "rest-defense", "half-space access", "far-side cover"],
    full_analysis: match
      ? `Free mode does not perform paid computer vision. Use this uploaded frame as a visual reference against the live match context: ${team(match, "home")} ${home} vs ${team(match, "away")} ${away}. The highest-value manual checks are line height, weak-side cover, and whether the first pass after regain can break pressure.`
      : "Free mode does not perform paid computer vision. The uploaded image can still be used as a reference, but the app returns an auditable tactical checklist rather than pretending to see the frame.",
    cached: false,
  };
}

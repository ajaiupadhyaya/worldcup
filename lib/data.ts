// Data orchestration layer.
// Routes every read through the cache, prefers API-Football when a key is
// configured, and transparently falls back to ESPN on any failure. API routes
// should call ONLY this module, never the provider clients directly.

import * as af from "./api-football";
import * as espn from "./espn";
import { cache, TTL } from "./cache";
import type { DataEnvelope, DataSource, Match, Standing } from "./types";

function envelope<T>(data: T, source: DataSource, cached: boolean): DataEnvelope<T> {
  return { data, source, cached, fetchedAt: new Date().toISOString() };
}

/**
 * Try API-Football first (if keyed), then ESPN. Returns the data plus which
 * source actually served it. Throws only if BOTH sources fail.
 */
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  // For list endpoints, an empty primary result (e.g. wrong league/season or a
  // soft quota failure) is treated as a miss so ESPN still gets a chance.
  emptyIsMiss = false,
): Promise<{ value: T; source: DataSource }> {
  if (af.hasApiFootballKey()) {
    try {
      const value = await primary();
      const empty = emptyIsMiss && Array.isArray(value) && value.length === 0;
      if (!empty) return { value, source: "api-football" };
      console.warn("[data] API-Football returned empty; trying ESPN");
    } catch (err) {
      console.warn("[data] API-Football failed, falling back to ESPN:", (err as Error).message);
    }
  }
  return { value: await fallback(), source: "espn" };
}

// Use the fast (live) TTL when any match is live OR kicks off soon, so a
// scheduled->live transition is picked up within ~60s instead of waiting out
// the 5-minute scheduled cache.
function matchesTtl(matches: Match[]): number {
  const soon = Date.now() + 5 * 60 * 1000;
  const hot = matches.some(
    (m) =>
      m.status === "live" ||
      (m.status === "scheduled" && new Date(m.kickoff).getTime() <= soon),
  );
  return hot ? TTL.LIVE : TTL.SCHEDULED;
}

function singleMatchTtl(match: Match): number {
  if (match.status === "live") return TTL.LIVE;
  if (match.status === "finished") return TTL.FINISHED;
  return TTL.SCHEDULED;
}

// ---- public read API --------------------------------------------------------

export async function getMatches(): Promise<DataEnvelope<Match[]>> {
  const key = "matches:all";
  const hit = cache.get<{ value: Match[]; source: DataSource }>(key);
  if (hit) return envelope(hit.value, hit.source, true);

  const { value, source } = await withFallback(af.getMatches, espn.getMatches, true);
  cache.set(key, { value, source }, matchesTtl(value));
  return envelope(value, source, false);
}

export async function getLiveMatches(): Promise<DataEnvelope<Match[]>> {
  const all = await getMatches();
  return { ...all, data: all.data.filter((m) => m.status === "live") };
}

export async function getMatch(id: string): Promise<DataEnvelope<Match>> {
  const key = `match:${id}`;
  const hit = cache.get<{ value: Match; source: DataSource }>(key);
  if (hit) return envelope(hit.value, hit.source, true);

  // Match IDs are namespaced per provider (an ESPN event id and an API-Football
  // fixture id can collide on the same number for different matches). The detail
  // MUST come from the same source serving the fixture list, or we'd fetch an
  // unrelated match — so there is NO cross-source fallback here. `getMatches()`
  // is cached, so resolving the active source is cheap.
  const listSource = (await getMatches()).source;
  const value = listSource === "api-football" ? await af.getMatch(id) : await espn.getMatch(id);
  cache.set(key, { value, source: listSource }, singleMatchTtl(value));
  return envelope(value, listSource, false);
}

export async function getStandings(): Promise<DataEnvelope<Standing[]>> {
  const key = "standings:all";
  const hit = cache.get<{ value: Standing[]; source: DataSource }>(key);
  if (hit) return envelope(hit.value, hit.source, true);

  const { value, source } = await withFallback(af.getStandings, espn.getStandings, true);
  cache.set(key, { value, source }, TTL.STANDINGS);
  return envelope(value, source, false);
}

// Health probe for the /dev page: reports each source's status plus which
// source is currently being SERVED from cache. ESPN (unmetered) is pinged live;
// API-Football is only pinged when `probe` is set, so a routine health load
// doesn't burn the 100/day free-tier quota.
export interface SourceHealth {
  source: DataSource;
  configured: boolean;
  ok: boolean;
  detail: string;
  count?: number;
  serving?: boolean; // is this the source the cache is currently serving?
}

export async function checkHealth(probe = false): Promise<SourceHealth[]> {
  const results: SourceHealth[] = [];
  const served = cache.get<{ value: Match[]; source: DataSource }>("matches:all")?.source;

  // API-Football — avoid spending quota unless an explicit probe is requested.
  if (af.hasApiFootballKey()) {
    if (probe) {
      try {
        const m = await af.getMatches();
        results.push({ source: "api-football", configured: true, ok: true, detail: "ok", count: m.length, serving: served === "api-football" });
      } catch (err) {
        results.push({ source: "api-football", configured: true, ok: false, detail: (err as Error).message, serving: served === "api-football" });
      }
    } else {
      results.push({ source: "api-football", configured: true, ok: true, detail: "configured (not probed — saves quota)", serving: served === "api-football" });
    }
  } else {
    results.push({ source: "api-football", configured: false, ok: false, detail: "API_FOOTBALL_KEY not set" });
  }

  // ESPN — unmetered, always pinged live.
  try {
    const m = await espn.getMatches();
    results.push({ source: "espn", configured: true, ok: true, detail: "ok", count: m.length, serving: served === "espn" });
  } catch (err) {
    results.push({ source: "espn", configured: true, ok: false, detail: (err as Error).message, serving: served === "espn" });
  }

  return results;
}

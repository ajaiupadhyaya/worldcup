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
): Promise<{ value: T; source: DataSource }> {
  if (af.hasApiFootballKey()) {
    try {
      return { value: await primary(), source: "api-football" };
    } catch (err) {
      console.warn("[data] API-Football failed, falling back to ESPN:", (err as Error).message);
    }
  }
  return { value: await fallback(), source: "espn" };
}

// Pick a TTL based on whether any match in a set is live.
function matchesTtl(matches: Match[]): number {
  return matches.some((m) => m.status === "live") ? TTL.LIVE : TTL.SCHEDULED;
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

  const { value, source } = await withFallback(af.getMatches, espn.getMatches);
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

  const { value, source } = await withFallback(
    () => af.getMatch(id),
    () => espn.getMatch(id),
  );
  cache.set(key, { value, source }, singleMatchTtl(value));
  return envelope(value, source, false);
}

export async function getStandings(): Promise<DataEnvelope<Standing[]>> {
  const key = "standings:all";
  const hit = cache.get<{ value: Standing[]; source: DataSource }>(key);
  if (hit) return envelope(hit.value, hit.source, true);

  const { value, source } = await withFallback(af.getStandings, espn.getStandings);
  cache.set(key, { value, source }, TTL.STANDINGS);
  return envelope(value, source, false);
}

// Health probe for the /dev page: pings each source and reports status.
export interface SourceHealth {
  source: DataSource;
  configured: boolean;
  ok: boolean;
  detail: string;
  count?: number;
}

export async function checkHealth(): Promise<SourceHealth[]> {
  const results: SourceHealth[] = [];

  // API-Football
  if (af.hasApiFootballKey()) {
    try {
      const m = await af.getMatches();
      results.push({ source: "api-football", configured: true, ok: true, detail: "ok", count: m.length });
    } catch (err) {
      results.push({ source: "api-football", configured: true, ok: false, detail: (err as Error).message });
    }
  } else {
    results.push({ source: "api-football", configured: false, ok: false, detail: "API_FOOTBALL_KEY not set" });
  }

  // ESPN
  try {
    const m = await espn.getMatches();
    results.push({ source: "espn", configured: true, ok: true, detail: "ok", count: m.length });
  } catch (err) {
    results.push({ source: "espn", configured: true, ok: false, detail: (err as Error).message });
  }

  return results;
}

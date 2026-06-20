"use client";

import { useQuery } from "@tanstack/react-query";
import type { DataEnvelope, Match, Standing } from "./types";

// Polling cadence per the spec: live data every 60s, slower data every 5m.
const LIVE_POLL = 60_000;
const SLOW_POLL = 5 * 60_000;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: () => fetchJSON<DataEnvelope<Match[]>>("/api/matches"),
    // Poll fast while anything is live, otherwise back off.
    refetchInterval: (query) =>
      query.state.data?.data.some((m) => m.status === "live") ? LIVE_POLL : SLOW_POLL,
  });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ["match", id],
    queryFn: () => fetchJSON<DataEnvelope<Match>>(`/api/matches/${id}`),
    // Live: fast poll. Finished: stop. Scheduled: slow poll so a viewer waiting
    // at the page sees the match flip to live at kickoff.
    refetchInterval: (query) => {
      const status = query.state.data?.data.status;
      return status === "live" ? LIVE_POLL : status === "finished" ? false : SLOW_POLL;
    },
  });
}

export function useStandings() {
  return useQuery({
    queryKey: ["standings"],
    queryFn: () => fetchJSON<DataEnvelope<Standing[]>>("/api/standings"),
    refetchInterval: SLOW_POLL,
  });
}

// Group standings by their group label, preserving rank order.
export function groupStandings(rows: Standing[]): Record<string, Standing[]> {
  return rows.reduce<Record<string, Standing[]>>((acc, row) => {
    (acc[row.group] ??= []).push(row);
    return acc;
  }, {});
}

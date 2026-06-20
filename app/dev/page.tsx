"use client";

import { useEffect, useState } from "react";
import type { DataEnvelope, Match, Standing } from "@/lib/types";
import type { SourceHealth } from "@/lib/data";

// Phase 1 data-confirmation page. NOT the real UI — exists only to verify that
// data flows from the providers through the cache and out of the API routes.

const statusColor: Record<Match["status"], string> = {
  live: "bg-green-500/20 text-green-300 border-green-500/40",
  finished: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
  scheduled: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export default function DevPage() {
  const [matches, setMatches] = useState<DataEnvelope<Match[]> | null>(null);
  const [standings, setStandings] = useState<DataEnvelope<Standing[]> | null>(null);
  const [health, setHealth] = useState<{ sources: SourceHealth[] } | null>(null);
  const [selected, setSelected] = useState<DataEnvelope<Match> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setError(null);
    try {
      const [m, s, h] = await Promise.all([
        getJSON<DataEnvelope<Match[]>>("/api/matches"),
        getJSON<DataEnvelope<Standing[]>>("/api/standings"),
        getJSON<{ sources: SourceHealth[] }>("/api/health"),
      ]);
      setMatches(m);
      setStandings(s);
      setHealth(h);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function inspect(id: string) {
    setSelectedId(id);
    setSelected(null);
    try {
      setSelected(await getJSON<DataEnvelope<Match>>(`/api/matches/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const groups = standings?.data.reduce<Record<string, Standing[]>>((acc, row) => {
    (acc[row.group] ??= []).push(row);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-mono text-sm">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold">⚽ World Cup Intelligence — /dev data check</h1>
          <button
            onClick={loadAll}
            className="rounded border border-zinc-700 px-3 py-1 hover:bg-zinc-800"
          >
            ↻ refresh
          </button>
        </header>

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-red-300">
            {error}
          </div>
        )}

        {/* Data health */}
        <section>
          <h2 className="mb-2 text-zinc-400 uppercase tracking-wide text-xs">Data health</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {health?.sources.map((s) => (
              <div
                key={s.source}
                className={`rounded border p-3 ${
                  s.ok
                    ? "border-green-500/40 bg-green-500/10"
                    : s.configured
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-zinc-700 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{s.source}</span>
                  <span>{s.ok ? "🟢 ok" : s.configured ? "🔴 error" : "⚪ not configured"}</span>
                </div>
                <div className="text-xs text-zinc-400">
                  {s.detail}
                  {s.count !== undefined && ` · ${s.count} fixtures`}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Fixtures */}
          <section>
            <h2 className="mb-2 text-zinc-400 uppercase tracking-wide text-xs">
              Fixtures {matches && `· ${matches.data.length} · src=${matches.source} · cached=${matches.cached}`}
            </h2>
            <div className="space-y-1">
              {matches?.data.map((m) => (
                <button
                  key={m.id}
                  onClick={() => inspect(m.id)}
                  className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left hover:bg-zinc-800 ${
                    selectedId === m.id ? "border-zinc-500 bg-zinc-800" : "border-zinc-800"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${statusColor[m.status]}`}>
                      {m.status}
                      {m.minute ? ` ${m.minute}'` : ""}
                    </span>
                    <span>
                      {m.homeTeam.shortName} {m.score.home}–{m.score.away} {m.awayTeam.shortName}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-500">{m.id}</span>
                </button>
              ))}
              {matches && matches.data.length === 0 && (
                <div className="text-zinc-500">No fixtures returned.</div>
              )}
            </div>
          </section>

          {/* Standings */}
          <section>
            <h2 className="mb-2 text-zinc-400 uppercase tracking-wide text-xs">
              Standings {standings && `· src=${standings.source} · cached=${standings.cached}`}
            </h2>
            <div className="space-y-3">
              {groups &&
                Object.entries(groups).map(([group, rows]) => (
                  <div key={group} className="rounded border border-zinc-800 p-2">
                    <div className="mb-1 font-bold text-zinc-300">{group}</div>
                    {rows.map((r) => (
                      <div key={r.team.id} className="flex justify-between text-xs text-zinc-400">
                        <span>
                          {r.rank}. {r.team.name}
                        </span>
                        <span>
                          {r.played}P · {r.points}pts · {r.gd >= 0 ? "+" : ""}
                          {r.gd}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              {standings && standings.data.length === 0 && (
                <div className="text-zinc-500">No standings returned.</div>
              )}
            </div>
          </section>
        </div>

        {/* Raw JSON of selected match */}
        {selectedId && (
          <section>
            <h2 className="mb-2 text-zinc-400 uppercase tracking-wide text-xs">
              Match {selectedId} — raw{" "}
              {selected && `· src=${selected.source} · cached=${selected.cached}`}
            </h2>
            <pre className="max-h-[480px] overflow-auto rounded border border-zinc-800 bg-black p-3 text-xs">
              {selected ? JSON.stringify(selected.data, null, 2) : "loading…"}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}

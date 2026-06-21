"use client";

import { useState } from "react";
import type { RatingTeam } from "@/lib/predictions";

type Col = "elo" | "attack" | "defense" | "overall";
const COLS: { key: Col; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "elo", label: "Elo" },
];

export function RatingsTable({ teams }: { teams: RatingTeam[] }) {
  const [sort, setSort] = useState<Col>("overall");
  const rows = [...teams].sort((a, b) => b[sort] - a[sort]);
  const fmt = (k: Col, v: number) => (k === "elo" ? Math.round(v).toString() : v.toFixed(2));
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
        <span className="w-5 text-right">#</span>
        <span className="flex-1">Team</span>
        {COLS.map((c) => (
          <button
            key={c.key}
            onClick={() => setSort(c.key)}
            aria-pressed={sort === c.key}
            className={`w-16 text-right tabular-nums ${sort === c.key ? "text-accent" : "hover:text-text"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-[13px] last:border-b-0">
            <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
            <span className="flex-1 truncate text-text">{r.name}</span>
            {COLS.map((c) => (
              <span
                key={c.key}
                className={`w-16 text-right font-mono tabular-nums ${sort === c.key ? "text-text" : "text-muted"}`}
              >
                {fmt(c.key, r[c.key])}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

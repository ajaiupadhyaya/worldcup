# Floodlit Prediction UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the prediction engine's snapshots in the live Floodlit app — a `/predict` hub (win-cup leaderboard, survival funnel, ratings, calibration) plus a projected-qualify column on `/standings`.

**Architecture:** A pure, isomorphic data+transforms module (`lib/predictions.ts`) loads the three committed JSON snapshots via build-time static import and exposes typed accessors + unit-tested transforms. `/predict` is a Server Component composing four presentational sections from those transforms; `/standings` (a client component) imports the qualify map and renders an extra column. No engine, cron, or `data/` changes.

**Tech Stack:** Next.js 16 (App Router, Turbopack, Server Components), TypeScript (strict, `@/*`→`./`, `resolveJsonModule` on, `moduleResolution: bundler`), Tailwind v4 (CSS vars in `app/globals.css`), vitest (new dev dependency).

## Global Constraints

- **Design tokens only** (from `app/globals.css`): bars/links `var(--home)` (telestrator cyan); emphasis `var(--accent)` (sodium amber); secondary `var(--muted)`; surfaces `var(--surface)`/`var(--surface-2)`; hairlines `var(--border)`; track `var(--chalk-faint)`; radius `var(--radius-card)`. Never pure white/black.
- **Fonts via existing utility classes / vars:** `font-display` (Anton caps) for section headings; `font-mono` + `tabular-nums` for ALL numbers; body font default for prose.
- **Honesty-first:** show `mcStdErr` as a ± figure on win-cup; the calibration/methodology section is mandatory (`generatedAt`, `simCount`, `seed`, `modelVersion`).
- **Snapshots are read-only inputs.** Slug = model `_slug`: `name.toLowerCase()`, strip `'`, spaces→`-`. Join by slug; **degrade to "—" on any miss, never throw.**
- **Static import** snapshots through `as unknown as <T>` (avoids strict structural-cast errors on the inferred JSON literal type).
- **Accessibility:** probability bars carry an `aria-label` with the numeric value; honor `prefers-reduced-motion` (no new animation needed).
- **Verification floors:** `npx tsc --noEmit` clean and `npm run build` clean for every task that touches `.ts`/`.tsx`; `npm test` green for transform tasks.

Snapshot shapes (already produced by `model/`, committed in `data/`):
- `data/predictions/latest.json`: `{ generatedAt, modelVersion, seed, simCount, inputsHash, thirdsTableComplete?, teams: [{ id, name, qualify, reachR32, reachR16, reachQF, reachSF, reachFinal, winCup, mcStdErr: {<stage>: number} }] (sorted winCup desc), groups: [{ group, teams: [{ id, finishProbs: {p1,p2,p3,p4} }] }], bracket: [...], fixtures: [...] }`
- `data/ratings/latest.json`: `{ generatedAt, teams: [{ id, name, attack, defense, elo, overall, style }] (sorted overall desc) }`
- `data/predictions/calibration.json`: `{ generatedAt, brier, logloss, reliability: [{ binMid, n, observed, predicted }] (10 bins) }`

---

### Task 1: Data layer foundation + vitest + `formatProb`

**Files:**
- Create: `lib/predictions.ts`
- Create: `lib/predictions.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `"test"` script + `vitest` devDependency via install)

**Interfaces:**
- Produces (consumed by all later tasks):
  - Types: `Stage`, `PredTeam`, `PredictionsSnapshot`, `RatingTeam`, `RatingsSnapshot`, `ReliabilityBin`, `CalibrationSnapshot`, `FunnelEntry`, `FunnelColumn`.
  - Values: `predictions: PredictionsSnapshot`, `ratings: RatingsSnapshot`, `calibration: CalibrationSnapshot`.
  - `formatProb(p: number): string`.

- [ ] **Step 1: Add vitest**

Run: `npm install -D vitest`
Expected: `vitest` appears in `package.json` devDependencies; install succeeds.

- [ ] **Step 2: Add the `test` script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: vitest config (resolve the `@` alias)**

Create `vitest.config.ts`:
```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 4: Write the failing test**

Create `lib/predictions.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatProb } from "@/lib/predictions";

describe("formatProb", () => {
  it("rounds large probabilities to integer percent", () => {
    expect(formatProb(0.248)).toBe("25%");
    expect(formatProb(0.5)).toBe("50%");
  });
  it("shows one decimal between 1% and 10%", () => {
    expect(formatProb(0.096)).toBe("9.6%");
    expect(formatProb(0.004)).toBe("0.4%");
  });
  it("floors tiny and clamps edge values", () => {
    expect(formatProb(0.0001)).toBe("<0.1%");
    expect(formatProb(0)).toBe("0%");
    expect(formatProb(-1)).toBe("0%");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `formatProb` not exported / module has no such member.

- [ ] **Step 6: Implement `lib/predictions.ts`**

Create `lib/predictions.ts`:
```ts
import calibrationJson from "@/data/predictions/calibration.json";
import predictionsJson from "@/data/predictions/latest.json";
import ratingsJson from "@/data/ratings/latest.json";

export type Stage =
  | "qualify" | "reachR32" | "reachR16" | "reachQF"
  | "reachSF" | "reachFinal" | "winCup";

export interface PredTeam {
  id: string;
  name: string;
  qualify: number;
  reachR32: number;
  reachR16: number;
  reachQF: number;
  reachSF: number;
  reachFinal: number;
  winCup: number;
  mcStdErr: Record<Stage, number>;
}

export interface GroupProb {
  group: string;
  teams: { id: string; finishProbs: { p1: number; p2: number; p3: number; p4: number } }[];
}

export interface PredictionsSnapshot {
  generatedAt: string;
  modelVersion: string;
  seed: number;
  simCount: number;
  inputsHash: string;
  thirdsTableComplete?: boolean;
  teams: PredTeam[];
  groups: GroupProb[];
}

export interface RatingTeam {
  id: string;
  name: string;
  attack: number;
  defense: number;
  elo: number;
  overall: number;
  style: Record<string, unknown>;
}
export interface RatingsSnapshot {
  generatedAt: string;
  teams: RatingTeam[];
}

export interface ReliabilityBin {
  binMid: number;
  n: number;
  observed: number;
  predicted: number;
}
export interface CalibrationSnapshot {
  generatedAt: string;
  brier: number;
  logloss: number;
  reliability: ReliabilityBin[];
}

// Build-time static import: the cron commits new snapshots -> Vercel redeploys
// -> these imports are re-bundled. `as unknown as` avoids strict structural
// cast errors on the inferred JSON literal type.
export const predictions = predictionsJson as unknown as PredictionsSnapshot;
export const ratings = ratingsJson as unknown as RatingsSnapshot;
export const calibration = calibrationJson as unknown as CalibrationSnapshot;

/** Format a probability in [0,1] as a chalk-friendly percentage string. */
export function formatProb(p: number): string {
  if (p <= 0) return "0%";
  if (p < 0.001) return "<0.1%";
  if (p < 0.1) return `${(p * 100).toFixed(1)}%`;
  return `${Math.round(p * 100)}%`;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors). If JSON import errors appear, confirm `resolveJsonModule` is set (it is) — do not change unrelated config.

- [ ] **Step 9: Commit**

```bash
git add lib/predictions.ts lib/predictions.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat(predict): data layer + vitest + formatProb"
```

---

### Task 2: `funnelRows` transform

**Files:**
- Modify: `lib/predictions.ts`
- Modify: `lib/predictions.test.ts`

**Interfaces:**
- Consumes: `PredTeam`, `Stage` (Task 1).
- Produces: `FUNNEL_STAGES`, `FunnelEntry { id, name, prob, stdErr }`, `FunnelColumn { key, label, entries }`, `funnelRows(teams: PredTeam[], topN?: number): FunnelColumn[]`.

- [ ] **Step 1: Write the failing test**

Append to `lib/predictions.test.ts`:
```ts
import { funnelRows } from "@/lib/predictions";
import type { PredTeam } from "@/lib/predictions";

function mkTeam(id: string, vals: Partial<PredTeam>): PredTeam {
  return {
    id, name: id,
    qualify: 0, reachR32: 0, reachR16: 0, reachQF: 0,
    reachSF: 0, reachFinal: 0, winCup: 0,
    mcStdErr: { qualify: 0, reachR32: 0, reachR16: 0, reachQF: 0, reachSF: 0, reachFinal: 0, winCup: 0 },
    ...vals,
  };
}

describe("funnelRows", () => {
  const teams = [
    mkTeam("a", { reachR16: 0.9, winCup: 0.3, mcStdErr: { qualify: 0, reachR32: 0, reachR16: 0.01, reachQF: 0, reachSF: 0, reachFinal: 0, winCup: 0.02 } }),
    mkTeam("b", { reachR16: 0.5, winCup: 0.1 }),
    mkTeam("c", { reachR16: 0.7, winCup: 0.2 }),
  ];

  it("returns the five stages in funnel order", () => {
    const cols = funnelRows(teams);
    expect(cols.map((c) => c.key)).toEqual(["reachR16", "reachQF", "reachSF", "reachFinal", "winCup"]);
    expect(cols[0].label).toBe("Round of 16");
  });

  it("ranks teams by the column's stage probability, descending", () => {
    const r16 = funnelRows(teams).find((c) => c.key === "reachR16")!;
    expect(r16.entries.map((e) => e.id)).toEqual(["a", "c", "b"]);
    expect(r16.entries[0].prob).toBe(0.9);
    expect(r16.entries[0].stdErr).toBe(0.01);
  });

  it("limits each column to topN", () => {
    const cols = funnelRows(teams, 2);
    expect(cols[0].entries).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `funnelRows` not exported.

- [ ] **Step 3: Implement**

Append to `lib/predictions.ts`:
```ts
export const FUNNEL_STAGES: { key: Stage; label: string }[] = [
  { key: "reachR16", label: "Round of 16" },
  { key: "reachQF", label: "Quarterfinal" },
  { key: "reachSF", label: "Semifinal" },
  { key: "reachFinal", label: "Final" },
  { key: "winCup", label: "Champion" },
];

export interface FunnelEntry {
  id: string;
  name: string;
  prob: number;
  stdErr: number;
}
export interface FunnelColumn {
  key: Stage;
  label: string;
  entries: FunnelEntry[];
}

/** For each knockout stage, the topN teams by probability of reaching it. */
export function funnelRows(teams: PredTeam[], topN = 8): FunnelColumn[] {
  return FUNNEL_STAGES.map(({ key, label }) => ({
    key,
    label,
    entries: teams
      .map((t) => ({ id: t.id, name: t.name, prob: t[key], stdErr: t.mcStdErr?.[key] ?? 0 }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, topN),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all formatProb + funnelRows tests).

- [ ] **Step 5: Commit**

```bash
git add lib/predictions.ts lib/predictions.test.ts
git commit -m "feat(predict): funnelRows stage-ranking transform"
```

---

### Task 3: `slugifyTeam` + `qualifyByTeam` transforms

**Files:**
- Modify: `lib/predictions.ts`
- Modify: `lib/predictions.test.ts`

**Interfaces:**
- Consumes: `PredTeam` (Task 1).
- Produces: `slugifyTeam(name: string): string`, `qualifyByTeam(teams: PredTeam[]): Map<string, number>`.

- [ ] **Step 1: Write the failing test**

Append to `lib/predictions.test.ts`:
```ts
import { qualifyByTeam, slugifyTeam } from "@/lib/predictions";

describe("slugifyTeam", () => {
  it("mirrors the model _slug: lowercase, strip apostrophes, spaces to hyphens", () => {
    expect(slugifyTeam("South Korea")).toBe("south-korea");
    expect(slugifyTeam("Cote d'Ivoire")).toBe("cote-divoire");
    expect(slugifyTeam("Brazil")).toBe("brazil");
  });
});

describe("qualifyByTeam", () => {
  it("maps slug -> qualify probability", () => {
    const m = qualifyByTeam([mkTeam("argentina", { qualify: 0.99 }), mkTeam("mexico", { qualify: 1 })]);
    expect(m.get("argentina")).toBe(0.99);
    expect(m.get("mexico")).toBe(1);
    expect(m.get("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `slugifyTeam`/`qualifyByTeam` not exported.

- [ ] **Step 3: Implement**

Append to `lib/predictions.ts`:
```ts
/** Mirror of the model's _slug so live ESPN team names join to snapshot ids. */
export function slugifyTeam(name: string): string {
  return name.toLowerCase().replace(/'/g, "").replace(/ /g, "-");
}

/** slug -> P(qualify from group), for the /standings projected column. */
export function qualifyByTeam(teams: PredTeam[]): Map<string, number> {
  return new Map(teams.map((t) => [t.id, t.qualify]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/predictions.ts lib/predictions.test.ts
git commit -m "feat(predict): slugifyTeam + qualifyByTeam join helpers"
```

---

### Task 4: `ProbBar` + `WinCupLeaderboard` + `/predict` page + nav link

**Files:**
- Create: `components/predict/ProbBar.tsx`
- Create: `components/predict/WinCupLeaderboard.tsx`
- Create: `app/predict/page.tsx`
- Modify: `components/SiteNav.tsx`

**Interfaces:**
- Consumes: `predictions`, `PredTeam`, `formatProb` (Task 1); `kitColor` (`@/lib/teamColors`).
- Produces: `<ProbBar value color? label? />`, `<WinCupLeaderboard teams />`, the `/predict` route, a `Section` heading pattern (inline in the page), nav entry.

- [ ] **Step 1: Create `ProbBar`**

Create `components/predict/ProbBar.tsx`:
```tsx
// A flat chalk probability bar: hairline track, telestrator-cyan fill.
export function ProbBar({
  value,
  color = "var(--home)",
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--chalk-faint)" }}
      role="img"
      aria-label={label}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
```

- [ ] **Step 2: Create `WinCupLeaderboard`**

Create `components/predict/WinCupLeaderboard.tsx`:
```tsx
import type { PredTeam } from "@/lib/predictions";
import { formatProb } from "@/lib/predictions";
import { kitColor } from "@/lib/teamColors";
import { ProbBar } from "./ProbBar";

// All 48 teams ranked by P(win cup). Bars are normalised to the leader so the
// field stays readable; the printed % and ± are the true values.
export function WinCupLeaderboard({ teams }: { teams: PredTeam[] }) {
  const top = teams[0]?.winCup || 1;
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      {teams.map((t, i) => (
        <div
          key={t.id}
          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
        >
          <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
          <span
            className="h-5 w-[3px] shrink-0 rounded-full"
            style={{ background: kitColor({ name: t.name, shortName: t.name }) }}
          />
          <span className="w-36 truncate text-[13px] text-text sm:w-44">{t.name}</span>
          <span className="flex-1">
            <ProbBar value={t.winCup / top} label={`${t.name}: ${formatProb(t.winCup)} to win the cup`} />
          </span>
          <span className="w-12 text-right font-mono text-[13px] tabular-nums text-text">
            {formatProb(t.winCup)}
          </span>
          <span className="hidden w-12 text-right font-mono text-[10px] tabular-nums text-muted sm:inline">
            ±{(t.mcStdErr.winCup * 100).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the `/predict` page (leaderboard only for now)**

Create `app/predict/page.tsx`:
```tsx
import type { ReactNode } from "react";
import { predictions } from "@/lib/predictions";
import { WinCupLeaderboard } from "@/components/predict/WinCupLeaderboard";

export const metadata = { title: "Predict — Floodlit" };

function Section({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-2xl text-text">{title}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

export default function PredictPage() {
  const p = predictions;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="font-display text-3xl text-text">Predict</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          dixon-coles · elo · monte-carlo
        </span>
      </div>

      <Section kicker="who lifts the trophy" title="Win the Cup">
        <WinCupLeaderboard teams={p.teams} />
      </Section>
    </div>
  );
}
```

- [ ] **Step 4: Add the nav link**

In `components/SiteNav.tsx`, change `LINKS` to:
```tsx
const LINKS = [
  { href: "/", label: "Live" },
  { href: "/standings", label: "Groups" },
  { href: "/predict", label: "Predict" },
];
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean; `/predict` appears in the build output as a static route.

- [ ] **Step 6: Browser sanity check**

Run: `npm run dev` (background), then navigate (Playwright or browser) to `http://localhost:3000/predict`.
Expected: "Win the Cup" section lists 48 teams; the leader (Argentina) has the longest bar and ~25%; no console errors. Stop the dev server when done.

- [ ] **Step 7: Commit**

```bash
git add components/predict/ProbBar.tsx components/predict/WinCupLeaderboard.tsx app/predict/page.tsx components/SiteNav.tsx
git commit -m "feat(predict): /predict route with win-cup leaderboard + nav"
```

---

### Task 5: `SurvivalFunnel` section

**Files:**
- Create: `components/predict/SurvivalFunnel.tsx`
- Modify: `app/predict/page.tsx`

**Interfaces:**
- Consumes: `funnelRows`, `formatProb`, `PredTeam` (Tasks 1–2); `ProbBar` (Task 4).
- Produces: `<SurvivalFunnel teams />`.

- [ ] **Step 1: Create `SurvivalFunnel`**

Create `components/predict/SurvivalFunnel.tsx`:
```tsx
import type { PredTeam } from "@/lib/predictions";
import { formatProb, funnelRows } from "@/lib/predictions";
import { ProbBar } from "./ProbBar";

// Five stage columns R16 -> Champion; each lists the top teams by probability
// of reaching that stage. Honest survival view of the Monte-Carlo.
export function SurvivalFunnel({ teams }: { teams: PredTeam[] }) {
  const cols = funnelRows(teams, 8);
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto sm:grid-flow-row sm:grid-cols-5">
      {cols.map((col) => (
        <div key={col.key} className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="border-b border-border px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            {col.label}
          </div>
          <div className="divide-y divide-border">
            {col.entries.map((e) => (
              <div key={e.id} className="px-2 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] text-text">{e.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted">{formatProb(e.prob)}</span>
                </div>
                <div className="mt-1">
                  <ProbBar value={e.prob} label={`${e.name}: ${formatProb(e.prob)} to reach the ${col.label}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the section to `/predict`**

In `app/predict/page.tsx`, add the import:
```tsx
import { SurvivalFunnel } from "@/components/predict/SurvivalFunnel";
```
Then add a new `Section` immediately after the "Win the Cup" section:
```tsx
      <Section kicker="probability of reaching each round" title="The Bracket">
        <SurvivalFunnel teams={p.teams} />
      </Section>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Browser sanity check**

Run dev server; load `/predict`. Expected: a 5-column funnel under "The Bracket"; column 1 (Round of 16) shows higher probabilities than column 5 (Champion); horizontally scrollable on a narrow viewport; no console errors.

- [ ] **Step 5: Commit**

```bash
git add components/predict/SurvivalFunnel.tsx app/predict/page.tsx
git commit -m "feat(predict): survival-funnel bracket section"
```

---

### Task 6: `RatingsTable` section

**Files:**
- Create: `components/predict/RatingsTable.tsx`
- Modify: `app/predict/page.tsx`

**Interfaces:**
- Consumes: `ratings`, `RatingTeam` (Task 1).
- Produces: `<RatingsTable teams />` (client component, sortable).

- [ ] **Step 1: Create `RatingsTable`**

Create `components/predict/RatingsTable.tsx`:
```tsx
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
```

- [ ] **Step 2: Add the section to `/predict`**

In `app/predict/page.tsx`, add import:
```tsx
import { RatingsTable } from "@/components/predict/RatingsTable";
import { ratings } from "@/lib/predictions";
```
Add a `Section` after "The Bracket":
```tsx
      <Section kicker="elo + attack / defense strength" title="Ratings">
        <RatingsTable teams={ratings.teams} />
      </Section>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Browser sanity check**

Run dev server; load `/predict`. Expected: a "Ratings" table; clicking the "Elo"/"Attack"/"Defense" headers re-sorts; default sort is Overall; no console errors.

- [ ] **Step 5: Commit**

```bash
git add components/predict/RatingsTable.tsx app/predict/page.tsx
git commit -m "feat(predict): sortable ratings table section"
```

---

### Task 7: `CalibrationPanel` section (the honesty footer)

**Files:**
- Create: `components/predict/CalibrationPanel.tsx`
- Modify: `app/predict/page.tsx`

**Interfaces:**
- Consumes: `calibration`, `CalibrationSnapshot`, `predictions` meta (Task 1).
- Produces: `<CalibrationPanel cal meta />`.

- [ ] **Step 1: Create `CalibrationPanel`**

Create `components/predict/CalibrationPanel.tsx`:
```tsx
import type { CalibrationSnapshot } from "@/lib/predictions";

const SIZE = 200;
const PAD = 18;

function xy(v: number) {
  // v in [0,1] -> pixel within the padded plot box (y flipped).
  return PAD + v * (SIZE - 2 * PAD);
}

export function CalibrationPanel({
  cal,
  meta,
}: {
  cal: CalibrationSnapshot;
  meta: { generatedAt: string; simCount: number; seed: number; modelVersion: string };
}) {
  const maxN = Math.max(1, ...cal.reliability.map((b) => b.n));
  return (
    <div className="grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:grid-cols-[200px_1fr]">
      <svg width={SIZE} height={SIZE} className="shrink-0" role="img" aria-label="Reliability curve">
        {/* perfect-calibration diagonal */}
        <line x1={xy(0)} y1={xy(1)} x2={xy(1)} y2={xy(0)} stroke="var(--chalk-faint)" strokeWidth={1} strokeDasharray="3 3" />
        {/* axes */}
        <line x1={xy(0)} y1={xy(0)} x2={xy(1)} y2={xy(0)} stroke="var(--border)" strokeWidth={1} />
        <line x1={xy(0)} y1={xy(0)} x2={xy(0)} y2={xy(1)} stroke="var(--border)" strokeWidth={1} />
        {cal.reliability.map((b, i) => (
          <circle
            key={i}
            cx={xy(b.predicted)}
            cy={SIZE - xy(b.observed)}
            r={2 + 4 * Math.sqrt(b.n / maxN)}
            fill="var(--home)"
            fillOpacity={0.8}
          />
        ))}
      </svg>

      <div className="font-mono text-[12px] text-muted">
        <div className="mb-3 flex gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em]">Brier</div>
            <div className="text-xl tabular-nums text-text">{cal.brier.toFixed(3)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em]">Log loss</div>
            <div className="text-xl tabular-nums text-text">{cal.logloss.toFixed(3)}</div>
          </div>
        </div>
        <p className="mb-3 max-w-prose font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-muted">
          Out-of-sample calibration on held-out historical matches. Dots near the dashed
          diagonal mean predicted probabilities matched real outcome frequencies. Dot size ∝
          sample count.
        </p>
        <div className="text-[11px] leading-relaxed">
          <div>model {meta.modelVersion} · seed {meta.seed} · {meta.simCount.toLocaleString()} sims</div>
          <div>generated {new Date(meta.generatedAt).toUTCString()}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the section to `/predict`**

In `app/predict/page.tsx`, add import:
```tsx
import { CalibrationPanel } from "@/components/predict/CalibrationPanel";
import { calibration } from "@/lib/predictions";
```
Add the final `Section`:
```tsx
      <Section kicker="how well-calibrated is the model" title="The Model">
        <CalibrationPanel
          cal={calibration}
          meta={{ generatedAt: p.generatedAt, simCount: p.simCount, seed: p.seed, modelVersion: p.modelVersion }}
        />
      </Section>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Browser sanity check**

Run dev server; load `/predict`. Expected: "The Model" section shows Brier ≈ 0.523, log-loss ≈ 0.886, an SVG curve with ~10 cyan dots clustered near the diagonal, and the methodology line (seed 42, 10,000 sims). No console errors.

- [ ] **Step 5: Commit**

```bash
git add components/predict/CalibrationPanel.tsx app/predict/page.tsx
git commit -m "feat(predict): calibration + methodology section"
```

---

### Task 8: `/standings` projected-qualify column

**Architecture note:** `data/predictions/latest.json` is ~133 KB. The current
`app/standings/page.tsx` is a **client** component, so importing the snapshot
there would ship all 133 KB to the browser just to read 48 qualify numbers.
Instead, split: `app/standings/page.tsx` becomes a thin **Server Component** that
imports the snapshot, builds a small `Record<string, number>` (slug → qualify),
and passes it to a new client component `components/StandingsGrid.tsx` that holds
the existing React-Query logic. Only the ~48-entry object crosses to the client.

**Files:**
- Modify: `components/StandingsTable.tsx`
- Create: `components/StandingsGrid.tsx`
- Modify (rewrite): `app/standings/page.tsx`

**Interfaces:**
- Consumes: `predictions`, `qualifyByTeam`, `slugifyTeam`, `formatProb` (Tasks 1, 3); `useStandings`, `groupStandings` (`@/lib/hooks`).
- Produces: `StandingsTable` gains `projected?: Record<string, number>`; `<StandingsGrid projected />` (client).

- [ ] **Step 1: Add the prop + column to `StandingsTable`**

In `components/StandingsTable.tsx`, update imports and signature, and render the column. Replace the file body with:
```tsx
import type { Standing } from "@/lib/types";
import { formatProb, slugifyTeam } from "@/lib/predictions";
import { kitColor } from "@/lib/teamColors";
import { Flag } from "./Flag";

// A group table as a rack of programme spines: mono columns, each row wearing
// its kit-colour edge bar. The top-2 qualification line is drawn in chalk.
// When `projected` is supplied, a model qualify-probability column is appended.
export function StandingsTable({
  group,
  rows,
  projected,
}: {
  group: string;
  rows: Standing[];
  projected?: Record<string, number>;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-display text-sm text-text">{group}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          P W D L GD Pts{projected ? " · Q%" : ""}
        </span>
      </div>
      <div>
        {rows.map((r, i) => {
          const q = projected?.[slugifyTeam(r.team.name)];
          return (
            <div key={r.team.id}>
              <div className="flex items-center gap-2 px-3 py-2 font-mono text-[13px]">
                <span className="w-3 text-center text-muted">{r.rank || i + 1}</span>
                <span className="h-5 w-[3px] shrink-0 rounded-full" style={{ background: kitColor(r.team) }} />
                <Flag team={r.team} size={18} />
                <span className="flex-1 truncate font-[family-name:var(--font-body)] text-text">
                  {r.team.name}
                </span>
                <span className="grid grid-cols-6 gap-2 tabular-nums text-right text-muted">
                  <span>{r.played}</span>
                  <span>{r.won}</span>
                  <span>{r.drawn}</span>
                  <span>{r.lost}</span>
                  <span className={r.gd > 0 ? "text-text" : ""}>{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
                  <span className="font-semibold text-text">{r.points}</span>
                </span>
                {projected && (
                  <span className="w-10 text-right tabular-nums text-home">
                    {q === undefined ? "—" : formatProb(q)}
                  </span>
                )}
              </div>
              {i === 1 && rows.length > 2 && (
                <div className="mx-3 border-b border-dashed" style={{ borderColor: "var(--chalk-faint)" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Move the client logic into `StandingsGrid`**

Create `components/StandingsGrid.tsx` (the existing page body, now a client
component that receives the projected map as a prop):
```tsx
"use client";

import { groupStandings, useStandings } from "@/lib/hooks";
import { StandingsTable } from "@/components/StandingsTable";

export function StandingsGrid({ projected }: { projected: Record<string, number> }) {
  const { data, isLoading, error } = useStandings();
  const groups = data ? groupStandings(data.data) : {};

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-baseline gap-3">
        <h1 className="font-display text-3xl text-text">Groups</h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          top two advance · Q% = model qualify odds
        </span>
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-[var(--radius-card)] border border-border bg-surface" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger/90">Couldn&apos;t load standings: {(error as Error).message}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groups).map(([group, rows]) => (
          <StandingsTable key={group} group={group} rows={rows} projected={projected} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `app/standings/page.tsx` as a Server Component wrapper**

Replace the entire file with (note: NO `"use client"` — this keeps the 133 KB
snapshot server-side; only the small `Record` is serialized to the client):
```tsx
import { StandingsGrid } from "@/components/StandingsGrid";
import { predictions, qualifyByTeam } from "@/lib/predictions";

// Build the slug -> qualify map server-side; only ~48 numbers cross to client.
const projected = Object.fromEntries(qualifyByTeam(predictions.teams));

export default function StandingsPage() {
  return <StandingsGrid projected={projected} />;
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean. In the build's route table, `/standings` First Load JS should
NOT balloon by ~130 KB (confirming the snapshot stayed server-side).

- [ ] **Step 5: Browser sanity check**

Run dev server; load `/standings`. Expected: each group table has a right-aligned cyan Q% column; values are plausible (host/strong teams high); teams whose name doesn't match a snapshot slug show "—" rather than breaking the row. No console errors.

- [ ] **Step 6: Commit**

```bash
git add components/StandingsTable.tsx components/StandingsGrid.tsx app/standings/page.tsx
git commit -m "feat(predict): projected-qualify column on /standings (server-built map)"
```

---

### Task 9: Full verification pass

**Files:** none (verification only; fixes committed if needed).

- [ ] **Step 1: Tests + types + production build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: vitest green; tsc clean; `next build` clean with `/predict` and `/standings` listed.

- [ ] **Step 2: Browser pass — `/predict` (desktop + mobile)**

Start dev server. With Playwright (MCP), navigate to `http://localhost:3000/predict`:
- Assert all four section headings present: "Win the Cup", "The Bracket", "Ratings", "The Model".
- Assert the leaderboard has 48 rows; the funnel has 5 columns; the ratings table sorts on header click; the calibration SVG renders ~10 dots.
- Capture `browser_console_messages`; assert no errors.
- Resize to 390×844 (mobile); assert no horizontal overflow of the page (the funnel may scroll within its own container) and headings remain legible.

- [ ] **Step 3: Browser pass — `/standings`**

Navigate to `http://localhost:3000/standings`:
- Assert the Q% column is present and populated for at least the favourites; "—" appears only on genuine slug mismatches.
- Assert no console errors.
- Note any systematic team-name → slug mismatches in the commit body for a future alias follow-up. Stop the dev server.

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test(predict): full verification pass (build + browser)"
```

If no fixes were needed, skip the commit and record the verification result in the task report instead.

---

## Notes for the implementer

- Do not modify anything under `model/`, `data/`, or `.github/`. The snapshots are inputs.
- The `style` field on ratings is `{}` today (deferred); do not add a style column.
- If `npm run build` complains about importing JSON from outside `app/`, confirm the path is `@/data/...` (alias → repo root) and that `resolveJsonModule` is set — it is. Do not relocate `data/`.
- Keep every number in `font-mono` + `tabular-nums`; keep every fill a CSS var.

# THE DRAW — Interactive Knockout Bracket (design)

**Date:** 2026-06-27
**Status:** Approved (design); pending spec review → implementation plan
**Owner:** ajaiupadhyaya
**Source of grounding:** two verification workflows (`wf_3250d3a0-b77` site audit, `wf_7d994a8c-739` Annex-C + change-map), all correctness claims adversarially verified against `file:line` and external sources.

---

## 1. Summary

Build **THE DRAW** — a full R32→Final interactive knockout bracket at `/bracket`, faithful to the model's probabilistic output, as the site's marquee analytics artifact. The Monte-Carlo engine already simulates every knockout round but the app shows none of it (the `bracket` array isn't even in the TypeScript type; `/predict`'s "The Bracket" renders the survival-funnel list instead of a tree).

Ship it **with** the correctness work it depends on so the marquee never looks broken:
- **Fix A** — honest qualification labels (the home "Round of 32" bars currently show 0% for already-advanced best-third teams).
- **Fix B** — replace the wrong best-thirds lookup table (493/495 rows produce illegal same-group rematches) with the verified FIFA Annex-C table, so R32 opponents are correct.
- **Fix C** — de-concentrate the champion (Argentina 38.8% vs market ~15–22%) by applying the fitted Dixon-Coles `rho` inside the Monte-Carlo and down-weighting friendlies in the strength fit.
- **Plus** a web-app CI gate (none exists today) and a bracket OG share card.

This is the highest-leverage project in the audit: the hard part (the simulation) is done, and it unblocks the downstream roadmap (pick'em game, knockout ScenarioLab, team pages).

## 2. Goals / non-goals

**Goals**
- A correct, beautiful, shareable knockout bracket driven by the daily model snapshot.
- Every probability shown on the site is honest (labels correct, opponents correct, champion not over-concentrated).
- Faithful representation of *uncertainty*, not a single deterministic guess.
- Establish a web-app CI gate.

**Non-goals (explicit fast-follows this unblocks)**
- Pick'em / bracket-builder game.
- Knockout-stage extension of `ScenarioLab`.
- Team pages, live in-match win-probability.
- 3rd-place playoff (match M103) — **not modeled** by the engine; the tree omits it by design.

## 3. Background: the data (verified)

- **Topology** lives in `model/data/bracket_2026.json`:
  - `r32`: 16 matches M73–M88, each `{slot, home_ref, away_ref}` with refs like `1E` (winner E), `2A` (runner-up A), `3X` (a best-third slot). **Verified correct** against FIFA.
  - `progression`: M89–M104 → which two prior slots feed each (e.g. `M89 ← [M74, M77]`). **Verified correct.**
  - `thirds_table`: 495 = C(12,8) rows keyed by the sorted set of 8 group letters supplying qualifying thirds → map of winner-slot→third. **493/495 rows are WRONG** (naive placeholder; 1,702 illegal winner-vs-own-group-third cells; only `EFGHIJKL` and `ABCDEFGH` are correct).
- **Per-slot probabilities** live in the snapshot `data/predictions/latest.json` `bracket` array: today **only M89–M104** (R16→Final; M103 omitted), each `{slot, teamProbs:[{id,prob}]}` where `teamProbs` = P(team **wins** that match). R32 (M73–M88) is **not** emitted.
- **Per-team fields**: `qualify, reachR32, reachR16, reachQF, reachSF, reachFinal, winCup` + `mcStdErr` per stage. `qualify` = P(finish group **top-2**); `reachR32` = P(advance to R32, i.e. top-2 **or** best-third). No per-group-position or per-R32-slot occupancy is emitted yet.
- **Contract gap**: `lib/predictions.ts` `PredictionsSnapshot` **omits `bracket` entirely**, so the frontend silently drops it.

### 3.1 FIFA 2026 Annex-C best-thirds assignment (resolved, high confidence)

The assignment of the 8 best third-placed teams to R32 fixtures is a **fixed, pre-published lookup table** (FIFA World Cup 26 Regulations, Annex C, 495 rows), *not* an algorithm. Only the **set of 8 groups** supplying thirds matters (their individual rank does not). That set selects one row, which maps the 8 winner slots **{1A,1B,1D,1E,1G,1I,1K,1L} = matches {M79,M85,M81,M74,M82,M77,M87,M80}** to specific thirds, guaranteeing **no winner ever faces its own group's third**. The other 8 R32 matches are static and group-independent.

**Sourcing status:** verified against the official FIFA PDF (`digitalhub.fifa.com/.../FWC2026_regulations_EN.pdf`, Annex C) **and** independently against Wikipedia's `Template:2026_FIFA_World_Cup_third-place_table` — 495/495 rows agree, zero mismatches. A FIFA-exact drop-in `thirds_table` (495 rows, 0 same-group cells, keyed identically to the existing JSON) has been generated and is reproducible from the cited sources. **The table must be copied, not derived** — the no-same-group constraint admits many valid permutations; FIFA's specific assignment has no published closed-form.

## 4. Design

Two tracks converge on one snapshot contract.

### Track P — Python model (`model/`)

**Fix B — correct Annex-C opponents.** Replace the `thirds_table` values in `model/data/bracket_2026.json` with the verified FIFA-exact table. Remove the now-stale "two anchor rows" fallback narrative in `simulate.py::_thirds_assignment()`; keep a guarded `raise` on a genuine table miss (with the complete correct table, misses cannot occur for valid 8-group sets, so failing loud is correct). Make the `thirdsTableComplete` honesty flag reflect a real validation, not a key-count. **New test:** assert all 495 rows have 8 distinct thirds, the third-groups equal the key set, and **no winner `1X` is paired with `3X`**; pin a few official rows (e.g. `ABCDEFGI → 1A:3C,1B:3G,1D:3B,1E:3D,1G:3A,1I:3F,1K:3E,1L:3I`). Cache the parsed bracket JSON (it's re-read per sim today — meaningful at 10k sims).

**Fix C — de-concentrate the champion.** Two independent corrections, both verified as real gaps:
1. **Apply `rho` inside the Monte-Carlo.** `simulate.py::_sim_score` (group stage) and `knockout.py::_draw_goals`/`sim_knockout` (90′ + extra time) currently sample **independent Poisson**, while the fitted Dixon-Coles `rho` is used *only* for the displayed fixture probs and the calibration backtest. Sample the scoreline from the DC-corrected joint matrix (reuse `predict.score_matrix(lh,la,rho)` via `rng.choice` over flattened cells). **Cache** corrected matrices per ordered `(λ_home, λ_away, rho)` to control cost (~950k builds/run otherwise).
2. **Down-weight friendlies in the strength MLE.** `dixoncoles.py::fit_strengths` weights all matches by time-decay only; the parsed `tournament` column is unused and ~37% of rows are friendlies. Multiply each match's likelihood weight by an importance factor (`friendly_weight` for `tournament == 'Friendly'`, else 1.0). `friendly_weight` is **tuned by the OOS backtest** (start in 0.3–0.5), not guessed.

**Validation gates (hard, in `validate_predictions` / `run.py`):**
- **Calibration non-regression:** Brier and log-loss must not worsen beyond a small ε vs the recorded baseline (current 0.5226 / 0.8865). The fix should hold or improve them.
- **Conservation (within MC tolerance):** Σ winCup ≈ 1, Σ reachFinal ≈ 2, Σ reachSF ≈ 4, Σ reachQF ≈ 8, Σ reachR16 ≈ 16, Σ reachR32 ≈ 32. Tolerances must accommodate MC noise and degraded partial-tournament states.
- **Reported (human-reviewed, not a hard fail):** champion concentration (top-team `winCup`) — expected to ease materially toward market after the fix.

Note: Fix C changes the seeded RNG stream, so **all recorded snapshots shift** (determinism `r1==r2` still holds; recorded numbers change). Determinism and "stronger team wins majority" tests stay valid; any test asserting exact recorded values is rebaselined.

**Bracket emit — full knockout.** Extend the MC accumulation so **all 31 knockout matches M73→M104** are emitted (today only M89→M104). For each slot, emit the distribution of each **participant side** *and* the **winner** — i.e. who reaches the match (on each side) and who advances — so the UI can render every match's two most-likely teams + the advance %, and reveal full distributions on hover, **uniformly across all rounds** including R32. The MC already simulates every round; this is pure accumulation in the existing R32/progression loops (`simulate.py`). Exact JSON shape is a plan-level decision; the contract is "per-slot participant-side + winner distributions for M73–M104."

### Track W — Next.js / TypeScript

**Fix A — honest "Round of 32" labels.** Only the home `QualificationBars` (titled "Round of 32 — Qualification Probability", `components/editorial/QualificationBars.tsx` + `app/page.tsx`) switches from `qualify` to **`reachR32`**. Add a sibling `reachR32ByTeam(teams)` in `lib/qualification.ts`/`lib/predictions.ts`; **do not** change `qualifyByTeam`/`qualificationByTeam` (consumed by `ScenarioLab` + `TournamentPulse` for genuine top-2 semantics). The `/standings` group "Q %" column, `AnalyticsBand`, and the scenario third-place table **stay on `qualify`** (they correctly mean group top-2) — documented inline.

**Snapshot contract.** Add to `PredictionsSnapshot` (`lib/predictions.ts`): `BracketSlot { slot: string; sides: {id:string;prob:number}[][]; winner: {id:string;prob:number}[] }` (shape per the emit contract) and `bracket: BracketSlot[]`. Provide the **topology** to the web via a **slim committed `data/topology.json`** = `{ r32, progression }` only — **do not** import `model/data/bracket_2026.json` into the web bundle (it carries the 5,000-line thirds_table the UI never needs). The model build writes/refreshes this slim file alongside the snapshot.

**`/bracket` route (the experience).** Server component loads `predictions.bracket` + topology, passes to a client `BracketTree`. Components under `components/bracket/`:
- **`BracketTree`** — rounds as columns (R32 · R16 · QF · SF · FINAL) with connector lines; editorial styling (Bodoni team names, Geist Mono data, ink/paper, vermilion for the active path, folio round labels, misregistration on the champion).
- **`BracketSlot`** — **hybrid**: the most-likely team per side + the advance % shown filled; hover/tap reveals the full distribution (top teams, probability bars, `mcStdErr` whisker).
- **Signature interaction** (`TeamPathProvider`) — tap/click/keyboard-select any team → its road lights up through the entire tree, everything else dims ("ARGENTINA'S ROAD TO THE FINAL").
- **`ChampionPanel`** — the Final slot enlarged + a compact title-odds leaderboard. Single source of truth = the M104 winner distribution (equals `teams.winCup`).
- **States** — skeleton while loading, an "AS OF ⟨model run⟩" dateline, an honest one-line uncertainty note, graceful empty state if `bracket` is absent.
- **Mobile** — round selector / horizontal scroll-snap (one round per screen); path-trace preserved.

**OG share card.** New `app/api/og/bracket/route.tsx` (1200×630 `ImageResponse`), Bodoni/vermilion/ink, rendering the projected champion + top-4 `winCup` ladder (and, as a fast-follow, a specific team's road). satori can't read the CSS `@import` font, so ship a **Bodoni Moda `.ttf` in `/public`** and load it in the route. `/bracket` `generateMetadata` points OG/Twitter at it.

**Connective tissue.** `/predict`'s "The Bracket" `Section` repoints to `/bracket` (keep `SurvivalFunnel` as the inline teaser, append a "View the full draw →" link). Add a `{ href: '/bracket', label: 'THE DRAW' }` entry to `SiteNav` and `/bracket` to `app/sitemap.ts`.

### Track C — CI

New `.github/workflows/web.yml` on push/PR: `actions/checkout` → `setup-node@20` (npm cache) → `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build`. No secrets needed (data is committed JSON; API routes are `force-dynamic`, not exercised at build). Existing `predict.yml` (Python) is unchanged.

## 5. Testing & quality

- **Model:** Annex-C table validity (distinct thirds, key-set match, **no same-group**, pinned official rows); `rho` applied in group + knockout sampling; friendly weighting honored; calibration non-regression; conservation gates; per-slot distributions sum to 1; determinism preserved.
- **UI:** bracket builds from snapshot; path-trace logic (a team's wins thread correctly through feeders); R32 participant resolution; snapshot-missing degradation; `reachR32` relabel; vitest.
- **A11y:** semantic structure, keyboard-operable path-trace, visible focus, reduced-motion honored, contrast under the grain overlay.
- **Verification before "done":** `npm run build` + `vitest` + model `pytest` green; live-verify `/bracket` in a browser (0 console errors, mobile); regenerate a snapshot and confirm the bracket renders end-to-end.

## 6. Risks & mitigations

- **Annex-C correctness (highest).** Mitigated: dual-source verified (FIFA PDF + Wikipedia, 495/495), drop-in generated, validation test forbids same-group pairings.
- **Fix C reshapes every probability site-wide.** Mitigated: calibration non-regression + conservation gates; champion concentration reported for human review; `friendly_weight` tuned on OOS, not guessed.
- **Web↔model coupling.** Mitigated: slim committed `data/topology.json`; web never imports the model dir.
- **Non-standard Next.js fork** (per `AGENTS.md`). Mitigation: read `node_modules/next/dist/docs/` before route/OG work.
- **Snapshot size growth** (15→31 slots, committed every 6h by cron). Accepted; keep slot payloads compact (top-N + tail aggregated).

## 7. Rough shape & sequencing

1. **Fix B** (data + test) — unblocks correct R32.
2. **Bracket emit** (model) — 31-slot distributions + slim topology.
3. **Fix C** (model) + validation gates — rebaseline snapshots.
4. **Fix A** (UI relabel) — independent, small.
5. **`/bracket` UI** (tree, hybrid slot, path-trace, champion, mobile).
6. **OG card + teaser + nav + sitemap.**
7. **CI gate.**

Tracks P and W can largely proceed in parallel against the agreed snapshot contract; the UI can build against a hand-authored sample snapshot until the model emit lands.

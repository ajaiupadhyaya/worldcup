# Floodlit — Predictive Simulation Engine (Design Spec)

**Date:** 2026-06-20
**Status:** Approved design, pre-implementation
**App:** Floodlit (Next.js 16) — <https://worldcup-sable.vercel.app>, repo `github.com/ajaiupadhyaya/worldcup`

## 1. Summary

Add a state-of-the-art **predictive simulation engine** to Floodlit as a new,
additive layer. It produces, for World Cup 2026: live & pre-match win
probabilities, a Monte-Carlo tournament simulation (qualification / bracket /
win-the-cup odds), team power ratings + style fingerprints, and an honest
**backtest/calibration** report card that proves the model against the market.

The heavy math runs **offline in Python on a schedule**; the Next.js app reads
**precomputed, git-versioned JSON snapshots** and renders them in the existing
FLOODLIT CHALK aesthetic. Live in-match win probability is computed on demand in
TypeScript (closed-form, no precompute needed).

Everything is additive — the current app (scores, standings, match pages,
tactical AI, CV, OG cards) is untouched.

## 2. Goals / Non-goals

**Goals (v1):**
- Dixon-Coles bivariate-Poisson strength model, Elo-seeded from history, time-decayed, optionally market-blended.
- Monte-Carlo tournament simulator implementing the real 2026 format + tiebreakers.
- Four surfaces: tournament sim (`/predict`), pre-match prediction cards, live in-match win-probability, power ratings + style fingerprints.
- Out-of-sample backtest: Brier, log-loss, calibration curve, model-vs-market edge.
- Git-versioned prediction snapshots as an auditable track record.
- Reproducible runs (seeded RNG, versioned model + inputs).

**Non-goals (v1, explicitly deferred):**
- Full Bayesian/MCMC inference (PyMC/Stan) — future upgrade to the model internals.
- Player-level models, true tracking data, in-play betting.
- CV-as-data-source (a separate future flagship).
- A live external database — git is the store for v1.

## 3. Data sources

### 3.1 Historical (for priors + backtest)
- Public dataset `martj42/international_results` (`results.csv`: `date, home_team, away_team, home_score, away_score, tournament, city, country, neutral`; ~45k international matches 1872–present; plus `shootouts.csv`). Committed to `model/data/history/`.
- A **team-name normalization map** reconciles dataset names with ESPN names (e.g. "South Korea" ↔ "Korea Republic", "USA" ↔ "United States"). Committed as `model/data/team_aliases.json`. Unmatched names are logged and excluded with a warning.

### 3.2 Live (current tournament)
- ESPN hidden endpoints (no key), fetched directly by the Python model:
  - Date-ranged scoreboard `…/fifa.world/scoreboard?dates=20260611-20260719` → all fixtures, results, round labels (group-stage, round-of-32, round-of-16, quarterfinals, …).
  - Per-match summary → pre-match odds (`pickcenter`/`odds`) for the market blend, where available.
- Verified available: 100+ fixtures spanning 2026-06-11 → 07-12 with round labels; played results carry final scores.

## 4. The model

### 4.1 Strength: Dixon-Coles bivariate Poisson
- Each team `i` has attack `α_i` and defense `β_i`; global home advantage `γ` applied only to non-neutral matches.
- Expected goals: `λ_home = exp(α_home − β_away + γ·1[not neutral])`, `λ_away = exp(α_away − β_home)`.
- Scoreline probability uses independent Poisson with the **Dixon-Coles low-score correction** `τ(x,y; λ,μ,ρ)` for the 0-0/1-0/0-1/1-1 cells.
- Fit by MLE maximizing a **time-decayed** log-likelihood with weights `w_t = exp(−ξ·Δt_days)`; identifiability via `mean(α)=0`, `mean(β)=0`. `ξ` and `ρ` selected by backtest.

### 4.2 Cold-start: Elo seed
- Compute Elo over the full history (margin-of-victory and match-importance weighted) up to tournament start.
- Use each team's Elo as a **Bayesian prior mean** on overall strength `(α_i − β_i)`; the Poisson MLE refines the attack/defense split using recent matches. Teams with sparse recent data lean on the Elo prior. This solves "the 48 teams have barely played each other."

### 4.3 Market blend
- Market-implied probabilities from ESPN odds via overround removal (normalize `1/decimal_odds`).
- `p_final = (1−κ)·p_model + κ·p_market`, `κ` calibrated on backtest.
- The UI shows **three columns — model-only, blended, market** — so the model's edge over the market is explicit. If no odds exist for a fixture, the blend degrades gracefully to model-only.

### 4.4 Live in-match win probability (closed form, TypeScript)
- Inputs: current minute `m`, score `(h,a)`, red cards, and the match's pre-match `λ_home, λ_away` (carried in the snapshot).
- Remaining goals per side `~ Poisson(λ_side · t_remaining)`, `t_remaining` = fraction of normal time left; red cards apply a multiplicative tilt to each side's `λ`.
- Final score = current + remaining; `P(W/D/L)` from the convolution (Skellam / direct Poisson sum). Updates every 60s on the existing live polling. Pure arithmetic — no precompute, no tracking data.

## 5. Tournament simulator

- **Format (2026):** 48 teams, 12 groups of 4 (round-robin, 6 matches/group), top-2 per group + **8 best third-placed teams** → Round of 32 → R16 → QF → SF → Final.
- **Group standings tiebreakers** (FIFA order): points → goal difference → goals for → head-to-head (points, GD, GF among tied) → … → drawing of lots (deterministic pseudo-random with the run seed).
- **Best-thirds ranking** across the 12 groups, take 8; **Round-of-32 slotting** uses the official published mapping of group positions (and which third-place combinations fill which slots).
- **Match simulation:** played matches are fixed; unplayed matches draw a scoreline from the Poisson model. Knockouts are single-elimination; a draw after 90' is resolved by modeled extra-time (additional Poisson over 30') then penalties (strength-tilted ~50/50).
- **Monte-Carlo:** N ≥ 10,000 runs with a **seeded numpy Generator** (seed stored in the snapshot). Aggregate per team: qualify %, reach-R32/R16/QF/SF/Final %, win-cup %, plus most-likely group finish. Report Monte-Carlo standard errors so the percentages carry honest uncertainty.
- Tiebreakers + best-thirds + R32 slotting are the **main correctness risk** → dedicated unit tests against known scenarios.

## 6. Honesty / backtest layer (the differentiator)

- **Out-of-sample backtest** over the historical dataset (walk-forward: fit on past, predict the next match): **Brier score, log-loss, calibration curve (reliability bins)**, and the **model-vs-market** comparison where historical odds exist.
- Every scheduled run **commits a timestamped snapshot** to `data/predictions/history/` — the full prediction history is auditable in git: what the model said before each match and how it resolved. As tournament results land, the realized track record is scored and shown.
- Stance: no overfitting theater — time-decay + genuine OOS validation + a public, version-controlled track record, benchmarked against the market.

## 7. Architecture & data flow

```
GitHub Actions cron (every ~6h + manual dispatch)
  └─ model/  (uv: numpy, scipy)
       1. ingest history CSV + live ESPN (fixtures/results/odds)
       2. fit Elo  →  seed Dixon-Coles MLE (time-decayed)
       3. per-match probabilities + λ (incl. upcoming fixtures)
       4. Monte-Carlo tournament sim (seeded, N≥10k)
       5. backtest + calibration
       6. write JSON → data/predictions/latest.json,
                       data/ratings/latest.json,
                       data/predictions/calibration.json,
                       data/predictions/history/<iso>.json
  └─ commit changed data files  →  Vercel auto-deploy
Next.js
  └─ lib/predictions.ts  reads committed snapshots (typed; static import / ISR)
  └─ /predict hub, prediction cards, ratings views (FLOODLIT CHALK)
  └─ lib/winprob.ts  closed-form live win-prob on match pages (TS, on demand)
```

- Free, no always-on service, no Railway, no external DB. **Git is the store and the audit log.**
- **Reproducibility:** each snapshot records model version, RNG seed, input-data hash, and generation timestamp.

### 7.1 Python package layout (`model/`, uv)
- `model/data/` — history loader, ESPN client, alias map.
- `model/ratings.py` — Elo + Dixon-Coles fit.
- `model/predict.py` — per-match probabilities, expected goals/λ, market blend.
- `model/simulate.py` — group tiebreakers, best-thirds, R32 slotting, Monte-Carlo.
- `model/backtest.py` — walk-forward calibration (Brier, log-loss, reliability).
- `model/style.py` — power-rating table + style fingerprints from the 28 team stats (indices / PCA).
- `model/snapshot.py` — JSON writers + schema validation.
- `model/run.py` — CLI entrypoint (`uv run python -m model.run`).
- `model/tests/` — pytest.

### 7.2 Snapshot contracts (committed JSON; typed in `lib/predictions.ts`)
- `predictions/latest.json`:
  ```
  { generatedAt, modelVersion, seed, simCount,
    teams:   [{ id, name, group, qualify, reachR32, reachR16, reachQF, reachSF, reachFinal, winCup, mcStdErr }],
    groups:  [{ group, teams: [{ id, finishProbs: { p1, p2, p3, p4 } }] }],   // prob of finishing 1st..4th
    fixtures:[{ id, home, away, kickoff, round, played,
                pModel: {h,d,a}, pBlended: {h,d,a}, pMarket: {h,d,a}|null,
                lambdaHome, lambdaAway, topScores: [{ score: "h-a", prob }] }],
    bracket: [{ round, slot, teamProbs: [{ id, prob }] }] }   // advancement odds per bracket slot
  ```
- `ratings/latest.json`: `{ generatedAt, teams: [{ id, name, attack, defense, elo, overall, style: { possession, directness, press, block } }] }`
- `predictions/calibration.json`:
  ```
  { generatedAt, brier, logloss,
    vsMarket: { brier, logloss },                       // market benchmark over the same matches
    reliability: [{ binMid, predicted, observed, n }],  // calibration curve bins
    trackRecord: [{ matchId, kickoff, predicted: {h,d,a}, result: "h"|"d"|"a", brier }] }
  ```

## 8. Surfaces & UX (FLOODLIT CHALK)

- **`/predict` hub:**
  - **Win-the-Cup leaderboard** — all 48 teams, sortable by any advancement stat; kit-colour spines, chalk probability bars.
  - **Interactive bracket** — advancement odds drawn as chalk paths through R32→Final.
  - **Group qualification tables** — each team's qualify % per group.
  - **Model report card** — calibration curve, Brier vs market, live track record. The honesty centerpiece.
- **Match pages:**
  - **Pre-match prediction card** — W/D/L chalk bars, scoreline-probability heatmap / most-likely scores, confidence; model-vs-market toggle.
  - **Live win-probability swing chart** — drawn chalk line updating every 60s during live matches.
- **Power ratings** — attack/defense table + **style fingerprints** (possession-vs-direct, press-vs-block) as a chalk scatter/radar.
- **Home** — a compact "title race" leaderboard strip + today's fixture predictions.
- **Charts:** lightweight **SVG + d3-scale / d3-shape** only (hand-drawn chalk lines), no heavy charting library.

## 9. Sequencing within v1

1. **Spine** — `model/` package: history ingest + ESPN client, Elo + Dixon-Coles fit, Monte-Carlo sim, snapshot writer; GitHub Actions cron; `/predict` leaderboard + bracket reading the snapshot.
2. **Pre-match cards** — fixture probabilities + scoreline heatmap on match pages; home strip.
3. **Live win-prob** — `lib/winprob.ts` + swing chart on live match pages.
4. **Power ratings + style** — ratings views; report card / calibration surfaced.

Each step is a clean increment on the same model + snapshot. The backtest is built with the model (it's how we validate it) and surfaced in the report card.

## 10. Testing strategy

- **Python (pytest):** tiebreakers, best-thirds selection, R32 slotting against known scenarios; Dixon-Coles scoreline probs sum to 1; Elo update + time-decay weighting; seeded-sim determinism; backtest metrics on a fixture set; snapshot schema validation.
- **TypeScript:** `winprob` edge cases (0', 90', leading/trailing, red cards, sums to 1); snapshot type/contract guards; component render + empty/loading/error states for `/predict` and cards.
- The **backtest is a first-class artifact**, not just a test — its output ships in the report card.

## 11. Risks & mitigations

- **Bracket/tiebreaker correctness** (highest risk) → dedicated tests vs official 2026 rules; anchor structure to ESPN round labels.
- **Team-name normalization** (history ↔ ESPN) → committed alias map; unmatched names logged, not silently dropped.
- **Odds availability** → market blend degrades to model-only per fixture when odds are absent.
- **Cron commit churn** → snapshots are small; commit `latest` each run + a timestamped history entry; acceptable deploy cadence (a few times/day). Intra-match dynamics are covered by on-demand live win-prob, so snapshot staleness isn't user-visible.
- **Cold-start credibility** → rests on the historical Elo seed + market blend; we *show calibration* rather than assert accuracy.

## 12. Open items (confirm during planning)
- Exact cron cadence (proposed: every 6h + manual dispatch + a pre/post-matchday trigger).
- Monte-Carlo N (proposed: 10,000; bump if SE too wide / runtime allows).
- Whether the home strip ships in step 1 or step 2 (proposed: step 2).

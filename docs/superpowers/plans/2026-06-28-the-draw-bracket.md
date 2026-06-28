# THE DRAW — Interactive Knockout Bracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a full R32→Final interactive knockout bracket at `/bracket` driven by the daily model snapshot, alongside the three correctness fixes it depends on and a web-app CI gate.

**Architecture:** Two tracks converge on one locked snapshot contract. The Python Monte-Carlo engine is corrected (real FIFA Annex-C R32 opponents; Dixon-Coles `rho` applied *inside* the simulation; friendlies down-weighted in the strength fit) and extended to emit all 31 knockout slots plus a slim topology file. The Next.js app adds typed consumers, a pure render-ready tree builder, the `/bracket` experience (hybrid filled+reveal slots with a "trace a team's road" highlight), an OG share card, glue, and CI.

**Tech Stack:** Python (uv, numpy/scipy) for the model; Next 16 App Router / React 19 / Tailwind v4 / vitest for the web; GitHub Actions for CI.

## Global Constraints

- **Python uses uv only** (`uv run` / `uv add` / `uv sync`) — never bare `pip`/`python`. Model package at `model/`; dependencies stay **numpy + scipy only** (add no heavy deps).
- **Node:** Next **16.2.9** (App Router, Turbopack), React **19**, Tailwind **v4**, vitest. `AGENTS.md` warns this is a **non-standard Next fork** — read `node_modules/next/dist/docs/` before writing any route/OG/metadata code.
- **Editorial design system** (in `app/globals.css`): Bodoni Moda heading `var(--font-heading)`, Geist Mono body `var(--font-body)`, ink `#131318` (`--foreground`), paper `#f4f3f0` (`--background`), vermilion `#ed3419` (`--foreground-accent`), **zero border-radius**, grain overlay, `.misreg`/`.reveal`/`.section-label` utilities. Reuse them; `"use client"` only where interactivity requires.
- **TDD mandatory, bite-sized:** failing test → run (show FAIL) → minimal impl (show complete code) → run (show PASS) → commit. Frequent commits. **No placeholders, ever.**
- **Annex-C table is COPIED from the verified source, never derived.** Validation must assert: 8 distinct thirds per row, third-groups == key set, **no winner `1X` paired with `3X`**, all C(12,8)=495 keys present.
- **Fix C changes the seeded RNG stream** → all recorded snapshots shift. Do **not** assert old recorded values; rebaseline. Determinism (same seed → same output) **must** still hold.
- **The web must NOT import `model/data/bracket_2026.json`** (it carries the 5,000-line thirds table). Use the slim committed `data/topology.json`.
- **`reachR32` relabel applies to ONLY the home `QualificationBars`.** `/standings` "Q %", `AnalyticsBand`, and `ScenarioLab` stay on `qualify` (genuine group top-2). Add `reachR32ByTeam`; do not change `qualifyByTeam`/`qualificationByTeam`.
- **Champion single source of truth** = the M104 winner distribution (equals `teams.winCup`).

## Locked Data Contract

```ts
// lib/predictions.ts (camelCase JSON keys, matching existing teamProbs/reachR32/mcStdErr/winCup)
export interface BracketSlotProb { id: string; prob: number }
export interface BracketSlot {
  slot: string;                 // "M73".."M104"
  round: "R32" | "R16" | "QF" | "SF" | "F";
  sides: [BracketSlotProb[], BracketSlotProb[]];  // each participant side's distribution, desc by prob
  winner: BracketSlotProb[];                       // who advances/wins, desc by prob
}
// PredictionsSnapshot gains:  bracket: BracketSlot[]   // exactly 31 slots M73..M104 (M103 third-place OMITTED)

// data/topology.json — committed by the model build; the web imports THIS, never the model dir:
export interface R32Tie { slot: string; homeRef: string; awayRef: string } // refs "1A","2B","3X"
export type Progression = Record<string, [string, string]>;  // "M89": ["M74","M77"]
export interface Topology { r32: R32Tie[]; progression: Progression }
```

**Round boundaries** (verified from progression feeders): R32 = M73–M88, R16 = M89–M96, QF = M97–M100, SF = M101–M102, F = M104.
**Per-list policy:** each `sides[i]` / `winner` list = entries with `prob >= 0.005`, sorted desc, capped at 12 (tail dropped; the UI must not assume the list sums to 1).
The pre-existing per-slot shape was `{slot, teamProbs}` for M89–M104 only and was **never consumed** — replace it wholesale.

## File Structure

**Model (`model/`)**
- `model/data/bracket_2026.json` — `thirds_table` value replaced with the verified Annex-C table (M1).
- `model/model/bracket.py` — memoized loaders + `validate_thirds_table()` (M1).
- `model/model/simulate.py` — drop stale fallback; `rho`-corrected group sampling; 31-slot bracket emit (M1, M2, M4).
- `model/model/knockout.py` — `rho`-corrected knockout sampling (M2).
- `model/model/dixoncoles.py` — friendly down-weighting in `fit_strengths` (M3).
- `model/model/snapshot.py` / `run.py` — conservation + calibration-non-regression gates; write slim `data/topology.json` (M4, M5).
- `model/tests/*` — Annex-C validity, `rho`, friendly, emit-shape, gate tests.

**Web (root)**
- `data/topology.json` — slim committed topology (M4 writes; UD2 consumes).
- `lib/predictions.ts` — locked types + `bracket` on the snapshot (UD2).
- `lib/qualification.ts` — `reachR32ByTeam` (UD1).
- `lib/bracket.ts` — `buildBracketTree()` + `tracePath()` (UD3).
- `app/bracket/page.tsx` — server route + metadata + states (UV1).
- `components/bracket/BracketBoard.tsx`, `BracketSlot.tsx`, `TeamPathProvider.tsx`, `ChampionPanel.tsx` (UV1–UV4).
- `app/api/og/bracket/route.tsx` + `public/BodoniModa.ttf` (G1).
- `app/predict/page.tsx`, `components/SiteNav.tsx`, `app/sitemap.ts` — glue (G2, G3).
- `.github/workflows/web.yml` — CI gate (G4).

## Execution Order & Dependencies

Sequential by default: **M1 → M2 → M3 → M4 → M5** (model: fix → correct → emit → guard), then **UD1 → UD2 → UD3** (web data), then **UV1 → UV2 → UV3 → UV4** (the view), then **G1 → G2 → G3 → G4** (glue/OG/CI). The web tasks (UD2 onward) may build against the hand-authored sample snapshot fixture introduced in UD2/UD3 and integrate with the real emit (M4) once both land. UD1, G3, G4 are independent and can run any time.

---

I have everything I need. The codebase is at 55 passing tests, the drop-in validates perfectly (495 rows, 0 same-group cells), and I've traced every file:line. Here are the Python-track task blocks.

---

### Task 1 · [M1]: Install the verified FIFA Annex-C thirds table + real validation

**Files**
- Modify `model/data/bracket_2026.json` — replace the `thirds_table` value (495 wrong rows, 493 with same-group cells) with the verified drop-in.
- Modify `model/model/bracket.py` — add `lru_cache` to the three loaders (`load_bracket` L7-8, `load_progression` L11-12, `load_thirds_table` L38-39), add `validate_thirds_table()`.
- Modify `model/model/simulate.py` — delete `_THIRDS_SLOTS` (L13), rewrite `_thirds_assignment` (L54-71) to drop the stale fallback, rewire the call site (L125-134), set `thirds_table_complete` from a real validation.
- Modify `model/tests/test_bracket.py` — add same-group + pinned-row test.

**Interfaces**
- Produces `model.bracket.validate_thirds_table(table: dict | None = None) -> bool`.
- Changes `model.simulate._thirds_assignment(qual_third_groups: set[str], third_team: dict[str, str]) -> dict[str, str]` (no longer returns a completeness flag; raises `KeyError` on a genuine miss).
- Loaders `load_bracket() -> list[dict]`, `load_progression() -> dict`, `load_thirds_table() -> dict` unchanged in signature, now memoized.

- [ ] **Step 1: Failing test — same-group + pinned rows.** Append to `model/tests/test_bracket.py`:
```python


def test_thirds_table_no_same_group_and_distinct():
    table = load_thirds_table()
    winner_group = {"1A": "A", "1B": "B", "1D": "D", "1E": "E",
                    "1G": "G", "1I": "I", "1K": "K", "1L": "L"}
    for key, row in table.items():
        thirds = [code[1] for code in row.values()]
        assert len(set(thirds)) == 8, f"{key}: thirds not distinct"
        assert set(thirds) == set(key), f"{key}: third-groups != key set"
        for slot, code in row.items():
            assert winner_group[slot] != code[1], \
                f"{key}: winner {slot} faces own-group third {code}"


def test_thirds_table_pinned_official_rows():
    table = load_thirds_table()
    assert table["ABCDEFGI"] == {"1A": "3C", "1B": "3G", "1D": "3B", "1E": "3D",
                                 "1G": "3A", "1I": "3F", "1K": "3E", "1L": "3I"}
    assert table["EFGHIJKL"] == {"1A": "3E", "1B": "3J", "1D": "3I", "1E": "3F",
                                 "1G": "3H", "1I": "3G", "1K": "3L", "1L": "3K"}


def test_validate_thirds_table_true_on_shipped():
    from model.bracket import validate_thirds_table
    assert validate_thirds_table() is True
```
Run (from `model/`): `uv run pytest tests/test_bracket.py -q`
Expected: **FAIL** — `test_thirds_table_no_same_group_and_distinct` errors (493 rows have a same-group cell), `test_thirds_table_pinned_official_rows` fails on `ABCDEFGI` (currently `1A:3A`), and `validate_thirds_table` is undefined (ImportError).

- [ ] **Step 2: Copy the verified table into the JSON.** Run this exact command from `model/` (it validates the drop-in before writing, so a corrupt source aborts):
```bash
uv run python - <<'PY'
import json
from itertools import combinations
from pathlib import Path

SRC = Path("../docs/superpowers/specs/annexC_thirds_verified.json")  # verified FIFA Annex-C drop-in (495 rows, 0 same-group), committed
DST = Path("data/bracket_2026.json")

dropin = json.loads(SRC.read_text())
expected = {"".join(c) for c in combinations("ABCDEFGHIJKL", 8)}
winner_group = {"1A": "A", "1B": "B", "1D": "D", "1E": "E",
                "1G": "G", "1I": "I", "1K": "K", "1L": "L"}
assert set(dropin) == expected and len(dropin) == 495, "drop-in keys != C(12,8)"
same_group = 0
for key, row in dropin.items():
    assert set(row) == set(winner_group), f"{key}: bad slot set"
    thirds = [c[1] for c in row.values()]
    assert len(set(thirds)) == 8 and set(thirds) == set(key), f"{key}: bad thirds"
    same_group += sum(winner_group[s] == c[1] for s, c in row.items())
assert same_group == 0, f"drop-in has {same_group} same-group cells"

bracket = json.loads(DST.read_text())
bracket["thirds_table"] = dropin          # replace value, preserve key order
DST.write_text(json.dumps(bracket, indent=2) + "\n")
print(f"thirds_table: {len(dropin)} rows, {same_group} same-group cells written")
PY
```
Expected output: `thirds_table: 495 rows, 0 same-group cells written`

- [ ] **Step 3: Memoize loaders + add `validate_thirds_table`.** Replace `model/model/bracket.py` lines 1-13 and 38-46 by editing the file to this complete content:
```python
import json
from functools import lru_cache
from itertools import combinations
from pathlib import Path

_BRACKET = Path(__file__).resolve().parent.parent / "data" / "bracket_2026.json"

# The eight R32 winner-slots that face a best-third-placed team (Annex C), and
# the group each one wins — used to forbid a winner facing its own group's third.
_THIRDS_WINNER_GROUP = {"1A": "A", "1B": "B", "1D": "D", "1E": "E",
                        "1G": "G", "1I": "I", "1K": "K", "1L": "L"}


@lru_cache(maxsize=1)
def _bracket_json() -> dict:
    return json.loads(_BRACKET.read_text())


@lru_cache(maxsize=1)
def load_bracket() -> list[dict]:
    return _bracket_json()["r32"]


@lru_cache(maxsize=1)
def load_progression() -> dict:
    return _bracket_json()["progression"]
```
Then replace the existing `load_thirds_table`/`assign_thirds` block (current L38-46) with:
```python
@lru_cache(maxsize=1)
def load_thirds_table() -> dict:
    return _bracket_json()["thirds_table"]


def assign_thirds(qualifying_groups: set[str], table: dict | None = None) -> dict[str, str]:
    table = load_thirds_table() if table is None else table
    key = "".join(sorted(qualifying_groups))            # e.g. "EFGHIJKL"
    row = table[key]                                    # {"1A": "3E", ...}
    return {slot: code[1] for slot, code in row.items()}  # "3E" -> "E"


def validate_thirds_table(table: dict | None = None) -> bool:
    """Real structural validation of the Annex-C table (not a key count).

    True iff: every C(12,8)=495 group-set has a row; each row maps exactly the
    eight thirds winner-slots; each row's eight thirds are distinct and equal the
    key's group set; and no winner slot is paired with its own group's third.
    """
    table = load_thirds_table() if table is None else table
    if set(table) != {"".join(c) for c in combinations("ABCDEFGHIJKL", 8)}:
        return False
    for key, row in table.items():
        if set(row) != set(_THIRDS_WINNER_GROUP):
            return False
        thirds = [code[1] for code in row.values()]
        if len(set(thirds)) != 8 or set(thirds) != set(key):
            return False
        if any(_THIRDS_WINNER_GROUP[slot] == code[1] for slot, code in row.items()):
            return False
    return True
```
Keep the existing `_resolve`/`assign_r32` functions (current L15-35) unchanged between the loaders and `load_thirds_table`.
Run: `uv run pytest tests/test_bracket.py -q`
Expected: **PASS** (all bracket tests green, including the three new ones).

- [ ] **Step 4: Drop the stale fallback in `simulate.py`.** Delete `_THIRDS_SLOTS` (L12-13). Replace `_thirds_assignment` (L54-71) with:
```python
def _thirds_assignment(qual_third_groups, third_team):
    """Annex C winner-slot -> qualifying third-placed team.

    Uses the complete FIFA-verified table; for any valid eight-group set a row
    exists, so a miss is a genuine data error and we fail loud (KeyError) rather
    than silently degrading. Callers only invoke this when exactly eight groups
    supply thirds (a structurally complete field).
    """
    from model.bracket import assign_thirds

    slot_group = assign_thirds(qual_third_groups)
    return {slot: third_team[grp] for slot, grp in slot_group.items()}
```
Then rewire the call site. Replace current L89 `thirds_table_complete = True` with a one-time real validation placed just after `prog_order = ...` (L83):
```python
    from model.bracket import validate_thirds_table
    thirds_table_complete = validate_thirds_table()
```
Replace the third-assignment block (current L125-134) with:
```python
        # Best 8 of the 12 third-placed rows -> qualifying GROUPS.
        best8 = best_thirds(third_rows, take=8)        # team names, ranked
        team_to_group = {row.team: g for g, row in third_rows}
        qual_third_groups = {team_to_group[tm] for tm in best8}

        # Only a structurally complete field (exactly 8 third-supplying groups)
        # can be assigned via Annex C; partial sims leave thirds unfilled.
        if len(qual_third_groups) == 8:
            thirds_by_slot = _thirds_assignment(qual_third_groups, third_team)
        else:
            thirds_by_slot = {}
```
Run: `uv run pytest tests/test_simulate.py tests/test_bracket.py tests/test_knockout.py -q`
Expected: **PASS** — `test_real_format_output_shape` still asserts `thirdsTableComplete is True` (now backed by `validate_thirds_table`), and the 2-group tournament tests pass via the `len != 8 -> {}` degraded path.

- [ ] **Step 5: Full suite + commit.** Run: `uv run pytest -q`
Expected: **PASS** (`58 passed` — 55 prior + 3 new bracket tests; determinism unaffected because thirds resolution is independent of the RNG stream).
Commit:
```bash
git add model/data/bracket_2026.json model/model/bracket.py model/model/simulate.py model/tests/test_bracket.py
git commit -m "$(cat <<'EOF'
M1: install verified FIFA Annex-C thirds table + real validation

Replace the 493/495 wrong thirds_table rows (1702 same-group cells) with the
dual-source-verified FIFA Annex-C drop-in (0 same-group cells). Drop the stale
two-anchor-row fallback in simulate; thirdsTableComplete now reflects
validate_thirds_table(). Memoize the bracket JSON loaders (re-read per sim).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 · [M2]: Apply the fitted Dixon-Coles rho inside the Monte-Carlo

**Files**
- Modify `model/model/predict.py` — add a cached corrected-matrix sampler after `score_matrix` (current L14-24).
- Modify `model/model/knockout.py` — replace `_draw_goals` (L6-7) and `sim_knockout` (L10-26) to sample 90′ and ET from the DC-corrected joint matrix.
- Modify `model/model/simulate.py` — `_sim_score` (L33-35) samples the corrected scoreline; add the import.
- Modify `model/tests/test_predict.py` — add sampler determinism/marginal test.

**Interfaces**
- Produces `model.predict.sample_scoreline(lh: float, la: float, rho: float, rng: np.random.Generator) -> tuple[int, int]`, backed by `@lru_cache` keyed on `(lh, la, rho, max_goals)`.
- `model.knockout.sim_knockout(s, home, away, rng) -> str` and `model.simulate._sim_score(s, h, a, rng) -> tuple[int,int]` now consume `s.rho`.

- [ ] **Step 1: Failing test for the sampler.** Append to `model/tests/test_predict.py`:
```python


def test_sample_scoreline_deterministic_and_in_range():
    import numpy as np
    from model.predict import sample_scoreline
    a = sample_scoreline(1.6, 1.1, -0.05, np.random.default_rng(3))
    b = sample_scoreline(1.6, 1.1, -0.05, np.random.default_rng(3))
    assert a == b                       # seeded determinism
    assert 0 <= a[0] <= 10 and 0 <= a[1] <= 10


def test_sample_scoreline_marginals_track_lambda():
    import numpy as np
    from model.predict import sample_scoreline
    rng = np.random.default_rng(0)
    draws = [sample_scoreline(2.4, 0.6, -0.05, rng) for _ in range(4000)]
    mh = sum(h for h, _ in draws) / len(draws)
    ma = sum(a for _, a in draws) / len(draws)
    assert mh > ma                      # home lambda dominates
    assert abs(mh - 2.4) < 0.25         # empirical mean near lambda_home
```
Run: `uv run pytest tests/test_predict.py -q`
Expected: **FAIL** — `sample_scoreline` is undefined (ImportError).

- [ ] **Step 2: Add the cached sampler.** Append to `model/model/predict.py` (after `top_scores`, current L38):
```python


from functools import lru_cache  # noqa: E402  (kept near its use)


@lru_cache(maxsize=None)
def _corrected_flat(lh: float, la: float, rho: float, max_goals: int = 10):
    """Flattened DC-corrected score matrix for an ordered (lh, la, rho).

    Cached because the MC draws ~10^6 scorelines per run but the distinct
    (lambda_home, lambda_away) pairs are bounded by realized fixtures (<~5k).
    Returns (flat_probs, n_cols) for rng.choice over flattened cells.
    """
    m = score_matrix(lh, la, rho, max_goals)
    return m.ravel(), m.shape[1]


def sample_scoreline(lh: float, la: float, rho: float, rng) -> tuple[int, int]:
    """Sample (home_goals, away_goals) from the DC-corrected joint distribution."""
    flat, ncols = _corrected_flat(lh, la, rho)
    idx = int(rng.choice(flat.size, p=flat))
    return idx // ncols, idx % ncols
```
Run: `uv run pytest tests/test_predict.py -q`
Expected: **PASS**.

- [ ] **Step 3: Knockout samples corrected scorelines.** Replace the entire `model/model/knockout.py` with:
```python
import numpy as np

from model.dixoncoles import Strengths, expected_goals
from model.predict import sample_scoreline


def sim_knockout(s: Strengths, home: str, away: str, rng: np.random.Generator) -> str:
    lh, la = expected_goals(s, home, away, neutral=True)
    gh, ga = sample_scoreline(lh, la, s.rho, rng)
    if gh != ga:
        return home if gh > ga else away
    # Extra time: 30 mins ~ 1/3 of normal-time rate, same DC coupling.
    eth, eta = sample_scoreline(lh / 3.0, la / 3.0, s.rho, rng)
    gh += eth
    ga += eta
    if gh != ga:
        return home if gh > ga else away
    # Penalties: strength-tilted coin. A HIGHER defense rating means fewer
    # conceded, so overall strength is attack+defense (both "good" dimensions).
    sh = s.attack.get(home, 0.0) + s.defense.get(home, 0.0)
    sa = s.attack.get(away, 0.0) + s.defense.get(away, 0.0)
    p_home = 1.0 / (1.0 + np.exp(-(sh - sa)))
    return home if rng.random() < p_home else away
```
Run: `uv run pytest tests/test_knockout.py -q`
Expected: **PASS** — `test_stronger_team_wins_majority_and_is_deterministic_by_seed` still holds (A's λ≈3.7 vs B's λ≈0.27; >130/200 wins is robust to the stream change); determinism preserved.

- [ ] **Step 4: Group stage samples corrected scorelines.** In `model/model/simulate.py`, add to the imports (after L6 `from model.dixoncoles import ...`):
```python
from model.predict import sample_scoreline
```
Replace `_sim_score` (L33-35) with:
```python
def _sim_score(s: Strengths, h: str, a: str, rng: np.random.Generator) -> tuple[int, int]:
    lh, la = expected_goals(s, h, a, neutral=True)
    return sample_scoreline(lh, la, s.rho, rng)
```
Run: `uv run pytest tests/test_simulate.py -q`
Expected: **PASS** — `test_probabilities_in_range_and_deterministic` (`r1 == r2`), `test_two_qualify_per_group_on_average`, `test_real_format_exactly_one_champion...`, and the conservation-style assertions all hold (they are structural / statistical, not recorded values).

- [ ] **Step 5: Full suite + commit.** Run: `uv run pytest -q`
Expected: **PASS** (`60 passed` — 58 + 2 new predict tests). The seeded RNG stream has shifted, but no test asserts recorded numeric snapshots, so nothing needs rebaselining here.
Commit:
```bash
git add model/model/predict.py model/model/knockout.py model/model/simulate.py model/tests/test_predict.py
git commit -m "$(cat <<'EOF'
M2: apply fitted Dixon-Coles rho inside the Monte-Carlo

Group (_sim_score) and knockout (90'+ET) now sample scorelines from the
DC-corrected joint matrix via predict.sample_scoreline (rng.choice over
flattened cells), with an lru_cache of corrected matrices per (lh,la,rho).
Previously rho was used only for displayed fixture probs/calibration. RNG
stream shifts; determinism preserved (no recorded values asserted).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3 · [M3]: Down-weight friendlies in the strength MLE (OOS-tuned)

**Files**
- Modify `model/model/dixoncoles.py` — add `friendly_weight` param to `fit_strengths` (signature L27-33), apply the importance factor after `w = _weights(...)` (L43).
- Modify `model/tests/test_dixoncoles.py` — add a friendly-down-weighting test.

**Interfaces**
- `model.dixoncoles.fit_strengths(matches, *, half_life_days=365.0, as_of, elo_prior_weight=0.1, friendly_weight=0.4) -> Strengths`. The default flows through `run.py` (calls `fit_strengths(history, as_of=...)` L132 and `fit_strengths(in_window, as_of=cutoff)` L101) automatically.

- [ ] **Step 1: Failing test — friendlies are down-weighted.** Append to `model/tests/test_dixoncoles.py`:
```python


def test_friendly_weight_down_weights_friendlies():
    # Competitive matches: A beats B. Friendlies: B thrashes A. Down-weighting
    # the friendlies must make A look *relatively* stronger than at full weight.
    comp = [Match(date(2024, 1, 1), "A", "B", 2, 0, True,
                  "FIFA World Cup qualification") for _ in range(12)]
    friend = [Match(date(2024, 1, 1), "B", "A", 5, 0, True, "Friendly")
              for _ in range(12)]
    s_down = fit_strengths(comp + friend, as_of=date(2024, 6, 1), friendly_weight=0.1)
    s_full = fit_strengths(comp + friend, as_of=date(2024, 6, 1), friendly_weight=1.0)
    a_down, b_down = expected_goals(s_down, "A", "B", neutral=True)
    a_full, b_full = expected_goals(s_full, "A", "B", neutral=True)
    assert (a_down - b_down) > (a_full - b_full)
```
Run: `uv run pytest tests/test_dixoncoles.py -q`
Expected: **FAIL** — `fit_strengths` has no `friendly_weight` kwarg (`TypeError`).

- [ ] **Step 2: Add the importance factor.** In `model/model/dixoncoles.py`, change the `fit_strengths` signature (L27-33) to:
```python
def fit_strengths(
    matches: list[Match],
    *,
    half_life_days: float = 365.0,
    as_of: date,
    elo_prior_weight: float = 0.1,
    friendly_weight: float = 0.4,
) -> Strengths:
```
Replace the weights line (current L43 `w = _weights(matches, as_of, half_life_days)`) with:
```python
    w = _weights(matches, as_of, half_life_days)
    # Importance weighting: ~37% of the history is friendlies, which are weaker
    # signal. Multiply each match's likelihood weight by `friendly_weight`
    # (tuned by the OOS backtest, Step 3) for tournament == 'Friendly', else 1.0.
    importance = np.array(
        [friendly_weight if m.tournament == "Friendly" else 1.0 for m in matches]
    )
    w = w * importance
```
Run: `uv run pytest tests/test_dixoncoles.py -q`
Expected: **PASS** (existing tests use `tournament="t"`, importance 1.0, so they are unaffected; the new test passes).

- [ ] **Step 3: Confirm 0.4 is OOS-justified (not guessed).** Run this sweep on the REAL history from `model/` (it reuses the frozen-cutoff backtest logic from `run.py::_calibration_samples`, parameterized by `friendly_weight`):
```bash
uv run python - <<'PY'
from datetime import date, timedelta
from pathlib import Path
from model.history import load_results
from model.dixoncoles import fit_strengths, expected_goals
from model.predict import score_matrix, outcome_probs
from model.backtest import brier, logloss

hist = load_results(Path("data/history/results.csv"))
as_of = date(2026, 6, 20)
in_window = [m for m in hist if m.date <= as_of]
cutoff = min(max(m.date for m in in_window) - timedelta(days=365), as_of)

def label(h, a):  # 'h' / 'd' / 'a'
    return "h" if h > a else "a" if h < a else "d"

print(f"{'fw':>5} {'brier':>9} {'logloss':>9} {'n':>6}")
for fw in (0.3, 0.4, 0.5, 1.0):
    s = fit_strengths(in_window, as_of=cutoff, friendly_weight=fw)
    known = set(s.attack)
    post = sorted((m for m in in_window if m.date > cutoff
                   and m.home in known and m.away in known),
                  key=lambda m: m.date)[-3000:]
    samp = []
    for m in post:
        lh, la = expected_goals(s, m.home, m.away, neutral=m.neutral)
        samp.append((outcome_probs(score_matrix(lh, la, s.rho)),
                     label(m.home_goals, m.away_goals)))
    n = len(samp)
    print(f"{fw:>5} {sum(brier(p,y) for p,y in samp)/n:>9.4f} "
          f"{sum(logloss(p,y) for p,y in samp)/n:>9.4f} {n:>6}")
PY
```
Expected output (informational — exact numbers depend on the committed history; **acceptance criterion**): the argmin over {0.3, 0.4, 0.5} is no worse than the `fw=1.0` row on both Brier and log-loss, confirming friendly down-weighting holds/improves OOS calibration. The committed default is `0.4`; **if** the sweep's argmin within 0.3–0.5 is a different value, set `friendly_weight`'s default in Step 2 to that value and re-run `uv run pytest -q` before committing. (The hard non-regression gate added in M5 enforces this permanently.)

- [ ] **Step 4: Full suite + commit.** Run: `uv run pytest -q`
Expected: **PASS** (`61 passed`). The fit changed, so the seeded snapshot stream shifts again; still no recorded numeric assertions, nothing to rebaseline.
Commit:
```bash
git add model/model/dixoncoles.py model/tests/test_dixoncoles.py
git commit -m "$(cat <<'EOF'
M3: down-weight friendlies in the strength MLE (friendly_weight=0.4)

fit_strengths multiplies each match's likelihood weight by friendly_weight for
tournament=='Friendly' (~37% of rows), else 1.0. Default 0.4 chosen by the
frozen-cutoff OOS backtest (sweep over 0.3-0.5 vs 1.0), not guessed; M5 adds a
hard calibration non-regression gate.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4 · [M4]: Emit all 31 knockout slots (locked shape) + slim topology.json

**Files**
- Modify `model/model/simulate.py` — add `_ROUND_OF` + `_dist` helpers; replace the per-slot accumulation (`slot_team`, current L78 + L165-166) with side0/side1/winner counters in the R32 loop (L139-147) and progression loop (L157-166); rewrite `bracket_out` (L196-205).
- Modify `model/model/bracket.py` — add `build_topology()`.
- Modify `model/model/run.py` — write `data/topology.json` (after the predictions writes, L143-146).
- Modify `model/tests/test_simulate.py` — rebaseline `test_real_format_output_shape` to the new bracket shape.
- Modify `model/tests/test_snapshot.py` — update the bracket fixture in `test_team_keys_include_reachR32_and_groups_bracket` (L38-50) to the new shape.
- Modify `model/tests/test_bracket.py` — add `build_topology` test.
- Modify `model/tests/test_run.py` — assert `topology.json` is written.

**Interfaces**
- Each `bracket` entry: `{"slot": str, "round": "R32"|"R16"|"QF"|"SF"|"F", "sides": [list, list], "winner": list}` where each list holds `{"id": str, "prob": float}` with `prob >= 0.005`, sorted desc by `(prob, id)`, capped at 12.
- Produces `model.bracket.build_topology() -> {"r32": [{"slot","homeRef","awayRef"}], "progression": {...}}`; `3rd@1X` refs map to the generic placeholder `"3X"`.

- [ ] **Step 1: Failing tests — new bracket shape + topology.** Replace `test_real_format_output_shape` in `model/tests/test_simulate.py` (L63-83) with:
```python
def test_real_format_output_shape():
    t = _twelve_group_tournament()
    teams = [tm for v in t.groups.values() for tm in v]
    r = simulate(t, _flat_strengths(teams), sims=200, seed=3)
    stats = r["teams"]["A1"]
    assert set(stats["mcStdErr"]) == set(STAGES)
    assert all(v >= 0.0 for v in stats["mcStdErr"].values())
    assert "reachR32" in stats
    for k in STAGES:
        assert 0.0 <= stats[k] <= 1.0
    assert abs(sum(r["teams"][x]["reachR32"] for x in teams) - 32.0) < 1e-9
    assert abs(sum(r["teams"][x]["reachR16"] for x in teams) - 16.0) < 1e-9
    assert r["thirdsTableComplete"] is True

    # Bracket: exactly 31 slots M73..M104 with M103 (third-place) omitted.
    bracket = r["bracket"]
    slots = [s["slot"] for s in bracket]
    assert len(bracket) == 31
    assert slots == [f"M{n}" for n in range(73, 105) if n != 103]
    rounds = {s["slot"]: s["round"] for s in bracket}
    assert rounds["M73"] == "R32" and rounds["M88"] == "R32"
    assert rounds["M89"] == "R16" and rounds["M96"] == "R16"
    assert rounds["M97"] == "QF" and rounds["M100"] == "QF"
    assert rounds["M101"] == "SF" and rounds["M102"] == "SF"
    assert rounds["M104"] == "F"
    for s in bracket:
        assert len(s["sides"]) == 2
        for lst in (*s["sides"], s["winner"]):
            assert all(0.005 <= e["prob"] <= 1.0 for e in lst)
            assert len(lst) <= 12
            assert sum(e["prob"] for e in lst) <= 1.0 + 1e-9

    # Champion single source of truth: M104 winner distribution == winCup.
    win_by_id = {tt["id"]: r["teams"][nm]["winCup"]
                 for nm, tt in [(nm, {"id": nm.lower()}) for nm in teams]}
    m104 = next(s for s in bracket if s["slot"] == "M104")
    for e in m104["winner"]:
        assert abs(e["prob"] - win_by_id[e["id"]]) < 1e-9
```
Append to `model/tests/test_bracket.py`:
```python


def test_build_topology_shape_and_thirds_placeholder():
    from model.bracket import build_topology
    topo = build_topology()
    assert set(topo) == {"r32", "progression"}
    assert len(topo["r32"]) == 16
    tie = topo["r32"][0]
    assert set(tie) == {"slot", "homeRef", "awayRef"}
    refs = {(t["slot"], t["awayRef"]) for t in topo["r32"]}
    assert ("M79", "3X") in refs               # 1A vs best-third -> placeholder
    assert all(not r.startswith("3rd@")
               for t in topo["r32"] for r in (t["homeRef"], t["awayRef"]))
    assert topo["progression"]["M89"] == ["M74", "M77"]
```
Run: `uv run pytest tests/test_simulate.py tests/test_bracket.py -q`
Expected: **FAIL** — `build_topology` undefined; bracket entries still have `teamProbs`, not `round`/`sides`/`winner`.

- [ ] **Step 2: Accumulate side + winner distributions.** In `model/model/simulate.py`, replace the `_slug` helper region by adding module-level constants/helpers just after `_MATCH_STAGE` (after current L23):
```python
_ROUND_OF = {
    **{f"M{m}": "R32" for m in range(73, 89)},
    **{f"M{m}": "R16" for m in range(89, 97)},
    **{f"M{m}": "QF" for m in range(97, 101)},
    "M101": "SF", "M102": "SF",
    "M104": "F",
}


def _bump(d: dict, slot: str, team: str) -> None:
    s = d.setdefault(slot, {})
    s[team] = s.get(team, 0) + 1


def _dist(counts: dict[str, int], sims: int) -> list[dict]:
    """{team: n} -> [{id, prob>=0.005}], sorted desc, capped at 12."""
    out: list[dict] = []
    for tm, n in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        p = n / sims
        if p < 0.005:
            break
        out.append({"id": _slug(tm), "prob": p})
        if len(out) >= 12:
            break
    return out
```
In `simulate()`, replace the `slot_team` declaration (current L78 `slot_team: dict[str, dict[str, int]] = {}`) with:
```python
    side0: dict[str, dict[str, int]] = {}   # who reaches each slot's home side
    side1: dict[str, dict[str, int]] = {}   # who reaches each slot's away side
    winner_cnt: dict[str, dict[str, int]] = {}  # who advances/wins each slot
```
In the R32 loop, replace the body (current L139-147) with:
```python
        for tie in template:
            h = _resolve_ref(tie["home_ref"], winners, runners, thirds_by_slot)
            a = _resolve_ref(tie["away_ref"], winners, runners, thirds_by_slot)
            if h is None or a is None:
                continue
            slot = tie["slot"]
            r32_entrants.extend((h, a))
            w = sim_knockout(s, h, a, rng)
            results[slot] = w
            _bump(side0, slot, h)
            _bump(side1, slot, a)
            _bump(winner_cnt, slot, w)
```
In the progression loop, replace the body (current L157-166) with:
```python
        for m in prog_order:
            a_src, b_src = progression[m]
            if a_src not in results or b_src not in results:
                continue
            ha, aw = results[a_src], results[b_src]
            w = sim_knockout(s, ha, aw, rng)
            results[m] = w
            stage = _MATCH_STAGE[int(m[1:])]
            counts[w][stage] += 1
            _bump(side0, m, ha)
            _bump(side1, m, aw)
            _bump(winner_cnt, m, w)
```
Replace `bracket_out` (current L196-205) with:
```python
    bracket_out = [
        {
            "slot": slot,
            "round": _ROUND_OF[slot],
            "sides": [_dist(side0.get(slot, {}), sims),
                      _dist(side1.get(slot, {}), sims)],
            "winner": _dist(winner_cnt.get(slot, {}), sims),
        }
        for slot in sorted(winner_cnt, key=lambda k: int(k[1:]))
    ]
```
Run: `uv run pytest tests/test_simulate.py -q`
Expected: **PASS** — `test_real_format_output_shape` green (31 slots, M103 omitted, rounds correct, M104 winner == winCup).

- [ ] **Step 3: Add `build_topology()`.** Append to `model/model/bracket.py`:
```python


def build_topology() -> dict:
    """Slim, web-facing knockout topology (no thirds_table). 3rd@ refs collapse
    to the generic best-third placeholder '3X' (actual occupancy is data-driven
    via the bracket slot distributions)."""
    r32 = []
    for tie in load_bracket():
        def _ref(r: str) -> str:
            return "3X" if r.startswith("3rd@") else r
        r32.append({
            "slot": tie["slot"],
            "homeRef": _ref(tie["home_ref"]),
            "awayRef": _ref(tie["away_ref"]),
        })
    return {"r32": r32, "progression": load_progression()}
```
Run: `uv run pytest tests/test_bracket.py -q`
Expected: **PASS**.

- [ ] **Step 4: Write `topology.json` in the build.** In `model/model/run.py`, add to the imports (after L13 `from model.simulate import ...`):
```python
from model.bracket import build_topology
```
After the two `write_json(pred, ...)` calls (current L145-146), add:
```python
    # Slim topology for the web (never imports model/data/bracket_2026.json).
    write_json(build_topology(), data / "topology.json")
```
Run: `uv run pytest tests/test_run.py -q`
Expected: **PASS** (existing assertions unaffected; topology assertion added next).

- [ ] **Step 5: Rebaseline snapshot fixture + assert topology in run.** In `model/tests/test_snapshot.py`, replace the `bracket` line in `test_team_keys_include_reachR32_and_groups_bracket` (current L44) with:
```python
           "bracket": [{"slot": "M104", "round": "F",
                        "sides": [[{"id": "brazil", "prob": .5}],
                                  [{"id": "france", "prob": .5}]],
                        "winner": [{"id": "brazil", "prob": .12}]}],
```
and replace the assertion (current L48 `assert obj["bracket"][0]["slot"] == "M104"`) with:
```python
    assert obj["bracket"][0]["slot"] == "M104"
    assert obj["bracket"][0]["round"] == "F"
    assert obj["bracket"][0]["winner"][0]["id"] == "brazil"
```
In `model/tests/test_run.py`, add to `test_main_writes_valid_snapshots` (after current L47):
```python
    topo = json.loads((tmp_path / "topology.json").read_text())
    assert set(topo) == {"r32", "progression"}
    assert len(topo["r32"]) == 16
    assert topo["progression"]["M89"] == ["M74", "M77"]
```
Run: `uv run pytest -q`
Expected: **PASS** (`62 passed` — bracket shape rebaselined; determinism in `test_run` still holds).
Commit:
```bash
git add model/model/simulate.py model/model/bracket.py model/model/run.py model/tests/test_simulate.py model/tests/test_snapshot.py model/tests/test_bracket.py model/tests/test_run.py
git commit -m "$(cat <<'EOF'
M4: emit all 31 knockout slots (locked shape) + slim topology.json

simulate now accumulates per-slot home-side, away-side, and winner
distributions for every match M73..M104 (M103 omitted), emitted as
{slot, round, sides, winner} with prob>=0.005, desc, capped at 12. Replaces the
never-consumed {slot, teamProbs} shape. bracket.build_topology() + run.py write
a slim data/topology.json ({r32, progression}) for the web; 3rd@ refs -> '3X'.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5 · [M5]: Hard validation gates — conservation, calibration non-regression, bracket sanity

**Files**
- Create `model/data/calibration_baseline.json` — pinned pre-fix baseline + epsilon.
- Modify `model/model/snapshot.py` — extend `validate_predictions` (L71-87) with stage-nesting + conservation + bracket sanity; add `validate_calibration_nonregression`.
- Modify `model/model/run.py` — load the baseline and gate calibration (around L158-162).
- Modify `model/tests/test_snapshot.py` — tests for each gate.

**Interfaces**
- `model.snapshot.validate_predictions(obj) -> None` now additionally enforces: per-team `reachR32 ≥ qualify` and the `reachR32 ≥ reachR16 ≥ reachQF ≥ reachSF ≥ reachFinal ≥ winCup` chain; team-summed conservation caps (`qualify≤24, reachR32≤32, reachR16≤16, reachQF≤8, reachSF≤4, reachFinal≤2, winCup≤1`) with exact equality (±0.5) when the full 32-team field is present; per-slot `sides`/`winner` lists are valid sub-distributions (each prob in [0,1], sums ≤ 1).
- Produces `model.snapshot.validate_calibration_nonregression(metrics: dict, baseline: dict) -> None` (raises `ValueError` if `brier`/`logloss` exceed `baseline + baseline['eps']`).

- [ ] **Step 1: Failing tests for the gates.** Append to `model/tests/test_snapshot.py`:
```python


def _full_field_teams():
    # 48 teams, exact conservation: 24 qualify, 32 reachR32, 16/8/4/2/1.
    teams = []
    for i in range(48):
        reach32 = 1.0 if i < 32 else 0.0
        qual = 1.0 if i < 24 else 0.0
        r16 = 1.0 if i < 16 else 0.0
        qf = 1.0 if i < 8 else 0.0
        sf = 1.0 if i < 4 else 0.0
        fin = 1.0 if i < 2 else 0.0
        cup = 1.0 if i < 1 else 0.0
        st = {"qualify": qual, "reachR32": reach32, "reachR16": r16,
              "reachQF": qf, "reachSF": sf, "reachFinal": fin, "winCup": cup}
        teams.append({"id": f"t{i}", "name": f"t{i}", **st,
                      "mcStdErr": {k: 0.0 for k in st}})
    return teams


def test_validate_accepts_full_field_conservation():
    validate_predictions({"generatedAt": "x", "modelVersion": "v", "seed": 1,
                          "teams": _full_field_teams()})


def test_validate_rejects_double_champion():
    import pytest
    teams = _full_field_teams()
    teams[1]["winCup"] = 1.0      # two champions -> Sum winCup = 2
    teams[1]["reachFinal"] = 1.0
    with pytest.raises(ValueError):
        validate_predictions({"generatedAt": "x", "modelVersion": "v", "seed": 1,
                              "teams": teams})


def test_validate_rejects_stage_nesting_violation():
    import pytest
    teams = _full_field_teams()
    teams[0]["winCup"] = 1.0
    teams[0]["reachFinal"] = 0.5   # winCup > reachFinal
    with pytest.raises(ValueError):
        validate_predictions({"generatedAt": "x", "modelVersion": "v", "seed": 1,
                              "teams": teams})


def test_validate_rejects_bracket_list_oversum():
    import pytest
    teams = _full_field_teams()
    obj = {"generatedAt": "x", "modelVersion": "v", "seed": 1, "teams": teams,
           "bracket": [{"slot": "M104", "round": "F",
                        "sides": [[{"id": "a", "prob": 0.9}], [{"id": "b", "prob": 0.9}]],
                        "winner": [{"id": "a", "prob": 0.7}, {"id": "b", "prob": 0.6}]}]}
    with pytest.raises(ValueError):     # winner sums to 1.3
        validate_predictions(obj)


def test_calibration_nonregression_gate():
    import pytest
    from model.snapshot import validate_calibration_nonregression
    base = {"brier": 0.5226, "logloss": 0.8865, "eps": 0.01}
    validate_calibration_nonregression({"brier": 0.52, "logloss": 0.88}, base)  # ok
    with pytest.raises(ValueError):
        validate_calibration_nonregression({"brier": 0.55, "logloss": 0.88}, base)
    with pytest.raises(ValueError):
        validate_calibration_nonregression({"brier": 0.52, "logloss": 0.95}, base)
```
Run: `uv run pytest tests/test_snapshot.py -q`
Expected: **FAIL** — gates not implemented (`validate_calibration_nonregression` undefined; oversum/double-champion not rejected).

- [ ] **Step 2: Implement the gates in `snapshot.py`.** In `model/model/snapshot.py`, append to the end of `validate_predictions` (after current L86, inside the function):
```python

    # --- Per-team stage nesting. A team only reaches a later round through the
    # earlier ones; reachR32 dominates qualify because best-thirds also advance.
    eps = 1e-9
    chain = ("reachR32", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")
    for t in obj["teams"]:
        if float(t["qualify"]) > float(t["reachR32"]) + eps:
            raise ValueError(f"{t.get('name')}: qualify > reachR32")
        for earlier, later in zip(chain, chain[1:]):
            if float(t[later]) > float(t[earlier]) + eps:
                raise ValueError(f"{t.get('name')}: {later} > {earlier} (nesting)")

    # --- Conservation. Each sim credits at most a fixed head-count per stage, so
    # team-summed probabilities cannot exceed those caps (catches double-counting)
    # and, when the full 32-team field is present, hit them exactly (+/-0.5 slack).
    caps = {"qualify": 24, "reachR32": 32, "reachR16": 16,
            "reachQF": 8, "reachSF": 4, "reachFinal": 2, "winCup": 1}
    totals = {k: sum(float(t[k]) for t in obj["teams"]) for k in caps}
    for k, cap in caps.items():
        if totals[k] > cap + 1e-6:
            raise ValueError(f"conservation: sum {k}={totals[k]:.4f} exceeds cap {cap}")
    if totals["reachR32"] >= 31.5:          # structurally complete field
        for k, cap in caps.items():
            if abs(totals[k] - cap) > 0.5:
                raise ValueError(
                    f"conservation: sum {k}={totals[k]:.4f} != {cap} (full field)")

    # --- Bracket per-slot sanity: each side / winner list is a sub-distribution.
    for sl in obj.get("bracket", []):
        for lst in (*sl.get("sides", []), sl.get("winner", [])):
            s = 0.0
            for e in lst:
                p = float(e["prob"])
                if not 0.0 <= p <= 1.0:
                    raise ValueError(f"{sl.get('slot')}: prob {p} out of [0,1]")
                s += p
            if s > 1.0 + 1e-6:
                raise ValueError(f"{sl.get('slot')}: list sums to {s:.4f} > 1")
```
Append a new function at module level (after `validate_predictions`):
```python
def validate_calibration_nonregression(metrics: dict, baseline: dict) -> None:
    """Fail if Brier or log-loss worsen beyond eps vs the recorded baseline."""
    eps = float(baseline.get("eps", 0.01))
    for k in ("brier", "logloss"):
        if float(metrics[k]) > float(baseline[k]) + eps:
            raise ValueError(
                f"calibration regression: {k}={float(metrics[k]):.4f} > "
                f"baseline {float(baseline[k]):.4f} + eps {eps}")
```
Run: `uv run pytest tests/test_snapshot.py -q`
Expected: **PASS** (all gate tests green; the existing single-team `test_build_and_validate_roundtrip` passes — `reachR32(0.9) ≥ qualify(0.9)`, chain holds, `reachR32` sum 0.9 < 31.5 so the strong check is skipped).

- [ ] **Step 3: Pin the baseline + wire the calibration gate into `run.py`.** Create `model/data/calibration_baseline.json`:
```json
{
  "brier": 0.5226177402045594,
  "logloss": 0.88646253996757,
  "eps": 0.01,
  "note": "Pre-Fix-C recorded OOS metrics (frozen-cutoff backtest). Fix C (rho-in-MC + friendly down-weighting) must hold or improve these."
}
```
In `model/model/run.py`, add to the `model.snapshot` import block (current L15-21):
```python
from model.snapshot import (
    build_calibration,
    build_predictions,
    build_ratings,
    validate_calibration_nonregression,
    validate_predictions,
    write_json,
)
```
Replace the calibration block (current L157-162) with:
```python
    # Calibration: frozen-cutoff out-of-sample backtest over the history.
    cal_samples = _calibration_samples(history, as_of)
    cal = build_calibration(cal_samples, generated_at=a.generated_at)
    baseline_path = Path(__file__).resolve().parent.parent / "data" / "calibration_baseline.json"
    # Only enforce non-regression with a meaningful OOS window (tiny test
    # fixtures produce a handful of samples whose metrics are not comparable).
    if len(cal_samples) >= 500 and baseline_path.exists():
        validate_calibration_nonregression(cal, json.loads(baseline_path.read_text()))
    write_json(cal, data / "predictions" / "calibration.json")
    return 0
```
Run: `uv run pytest tests/test_run.py -q`
Expected: **PASS** (`results_small.csv` yields far fewer than 500 OOS samples, so the gate is skipped; determinism intact).

- [ ] **Step 4: End-to-end real-history run proves all gates pass.** Run from `model/`:
```bash
uv run python -m model.run --offline tests/fixtures/espn_scoreboard.json \
  --sims 2000 --seed 42 --generated-at 2026-06-20T00:00:00Z --data-dir /tmp/m5check \
  && uv run python - <<'PY'
import json
b = json.loads(open("/tmp/m5check/predictions/latest.json").read())
print("teams:", len(b["teams"]), "bracket slots:", len(b["bracket"]))
print("sum winCup:", round(sum(t["winCup"] for t in b["teams"]), 4))
print("calibration.json present:",
      __import__("os").path.exists("/tmp/m5check/predictions/calibration.json"))
print("topology r32:", len(json.loads(open("/tmp/m5check/topology.json").read())["r32"]))
PY
```
Expected: exits 0 (so `validate_predictions` — including all conservation/nesting/bracket gates — passed on a real snapshot), prints a non-empty team count, `sum winCup` ≤ 1.0, calibration present True, `topology r32: 16`. (To exercise the full-history calibration gate, additionally run with `--history data/history/results.csv` and confirm exit 0 — the printed/regenerated Brier and log-loss must be ≤ baseline + 0.01.)

- [ ] **Step 5: Full suite + commit.** Run: `uv run pytest -q`
Expected: **PASS** (`67 passed` — 62 + 5 new gate tests).
Commit:
```bash
git add model/model/snapshot.py model/model/run.py model/data/calibration_baseline.json model/tests/test_snapshot.py
git commit -m "$(cat <<'EOF'
M5: hard validation gates (conservation, calibration, bracket sanity)

validate_predictions now enforces per-team stage nesting, team-summed
conservation caps (exact within +/-0.5 for a complete field), and per-slot
sides/winner sub-distribution sanity. run.py gates calibration non-regression
against a pinned pre-Fix-C baseline (brier 0.5226 / logloss 0.8865 + eps 0.01),
enforced only with a >=500-sample OOS window. Fix C must hold or improve them.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

I have everything verified. Here are the three task blocks for the Next.js DATA/CONTRACT track.

---

### Task 6 · [UD1]: Fix A — honest "Round of 32" labels via `reachR32ByTeam`

Repoint **only** the home `QualificationBars` (titled "Round of 32 — Qualification Probability") from `qualify` (group top-2, which shows 0% for already-advanced best-third teams like Ecuador/Senegal/Paraguay) to `reachR32` (P advance to R32 = top-2 **or** best-third). Leave `qualifyByTeam`/`qualificationByTeam` and every other consumer (`/standings` "Q %", `AnalyticsBand`, `ScenarioLab`, `TournamentPulse`) on `qualify`.

**Files**
- Modify `lib/qualification.ts` (add `reachR32ByTeam` after the `qualificationByTeam` const at lines 8–10; the `Pick<PredictionsSnapshot, "generatedAt" | "teams">` at line 4 already exposes `teams[].reachR32`)
- Modify `app/page.tsx` (line 5 import; the `topTeams` selector at lines 31–34; the `QualificationBars` props at line 74)
- Create `lib/qualification.test.ts`

**Interfaces**
- Produces `export const reachR32ByTeam: Record<string, number>` — `team.id → team.reachR32`, parallel in form to the existing `qualificationByTeam` (`lib/qualification.ts:8-10`) so `QualificationBars`' `projected[slugifyTeam(team.name)]` lookup (`components/editorial/QualificationBars.tsx:39`) works unchanged. Verified invariant from the live snapshot: `id === slugify(name)` for all 48 teams; `reachR32 >= qualify` for all 48 (0 violations); 14 teams differ.
- Consumes nothing new (reads the already-imported `latest.json` snapshot).

Steps:

- [ ] **Step 1: Write the failing test for `reachR32ByTeam`.**
  Create `lib/qualification.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { qualificationByTeam, reachR32ByTeam } from "@/lib/qualification";

  describe("reachR32ByTeam", () => {
    it("maps every team id to a probability in [0,1]", () => {
      const ids = Object.keys(reachR32ByTeam);
      expect(ids.length).toBe(48);
      for (const id of ids) {
        const p = reachR32ByTeam[id];
        expect(typeof p).toBe("number");
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    });

    it("dominates qualify for every team (reachR32 ⊇ top-2)", () => {
      // reachR32 = P(top-2 OR best-third) >= P(top-2) = qualify, per-sim, always.
      for (const id of Object.keys(reachR32ByTeam)) {
        expect(reachR32ByTeam[id]).toBeGreaterThanOrEqual(qualificationByTeam[id] - 1e-9);
      }
    });

    it("differs from qualify for at least one already-advanced team", () => {
      // The whole point of Fix A: best-third teams read 0% under `qualify`.
      const differ = Object.keys(reachR32ByTeam).filter(
        (id) => reachR32ByTeam[id] > qualificationByTeam[id] + 1e-6,
      );
      expect(differ.length).toBeGreaterThan(0);
    });
  });
  ```
  Run it and show it FAILS (the export does not exist yet):
  ```
  npx vitest run lib/qualification.test.ts
  ```
  Expected: FAIL — `SyntaxError: The requested module '@/lib/qualification' does not provide an export named 'reachR32ByTeam'` (or a TS resolution error).

- [ ] **Step 2: Add `reachR32ByTeam` (minimal impl).**
  In `lib/qualification.ts`, insert immediately after the `qualificationByTeam` block (after line 10):
  ```ts
  // Fix A: the home "Round of 32" bars use reachR32 (P advance to R32 = group
  // top-2 OR best-third) so already-advanced best-third teams stop reading 0%.
  // qualify (group top-2) is intentionally left untouched for every OTHER
  // consumer: /standings "Q %", AnalyticsBand, ScenarioLab, TournamentPulse.
  export const reachR32ByTeam = Object.fromEntries(
    snapshot.teams.map((team) => [team.id, team.reachR32]),
  );
  ```
  Run the test and show it PASSES:
  ```
  npx vitest run lib/qualification.test.ts
  ```
  Expected: PASS — 3 passed.

- [ ] **Step 3: Repoint the home `QualificationBars` data source in `app/page.tsx`.**
  Change the import at line 5:
  ```ts
  import { qualificationByTeam, qualificationGeneratedAt, reachR32ByTeam } from "@/lib/qualification";
  ```
  Change the `topTeams` selector at lines 31–34 so the displayed top-6 (and their bars) rank by the metric actually shown:
  ```tsx
    const topTeams = [...predictions.teams]
      .sort((a, b) => b.reachR32 - a.reachR32)
      .slice(0, 6)
      .map((t, i) => ({ name: t.name, rank: i + 1 }));
  ```
  Change ONLY the home bars' `projected` prop at line 74 (leave the `TournamentPulse` `projected={qualificationByTeam}` at lines 79–84 untouched):
  ```tsx
        <QualificationBars teams={topTeams} projected={reachR32ByTeam} />
  ```

- [ ] **Step 4: Verify wiring + types.**
  Confirm the home bars use `reachR32ByTeam` and that no other consumer was touched:
  ```
  grep -n "reachR32ByTeam\|qualificationByTeam" app/page.tsx
  npx tsc --noEmit
  ```
  Expected: the `QualificationBars` line shows `projected={reachR32ByTeam}`; the `TournamentPulse` line still shows `projected={qualificationByTeam}`; `tsc` exits 0 with no output. Confirm untouched consumers still read `qualify`:
  ```
  grep -rn "qualificationByTeam\|qualifyByTeam" app components | grep -v "app/page.tsx"
  ```
  Expected: hits in `/standings`, `AnalyticsBand`, `ScenarioLab`, `TournamentPulse` only — all still on `qualify`.

- [ ] **Step 5: Run the full lib suite and commit.**
  ```
  npx vitest run
  ```
  Expected: PASS — all `lib/**/*.test.ts` green (including the pre-existing `lib/predictions.test.ts`).
  ```
  git add lib/qualification.ts lib/qualification.test.ts app/page.tsx
  git commit -m "Fix A: home Round-of-32 bars use reachR32, not qualify

  Add reachR32ByTeam (parallel to qualificationByTeam) and repoint ONLY the
  home QualificationBars + its app/page.tsx topTeams selector. /standings,
  AnalyticsBand, ScenarioLab, TournamentPulse stay on qualify (group top-2).

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

**Deliverable:** the home "Round of 32" bars render honest advance-to-R32 probabilities; `lib/qualification.test.ts` proves the new helper's invariants; no other `qualify` consumer changed.

---

### Task 7 · [UD2]: Locked bracket/topology types + slim committed `data/topology.json`

Add the locked data contract to `lib/predictions.ts`, wire a static import of a slim committed `data/topology.json` (the web must **never** import `model/data/bracket_2026.json` — it carries the ~5000-line `thirds_table` the UI never needs), and add the canonical 31-slot list + round map + a structural validator. The current snapshot's `bracket` is still the old never-consumed `{slot, teamProbs}[]` (15 slots M89–M104); this task replaces the **type** wholesale and makes `bracket` optional so the UI degrades gracefully until Track P emits the new shape.

**Files**
- Modify `lib/predictions.ts`: add the topology JSON import (after line 3); add `BracketRound`/`BracketSlotProb`/`BracketSlot`/`R32Tie`/`Progression`/`Topology` interfaces (after the `GroupProb` interface, line 26); add `bracket?: BracketSlot[]` to `PredictionsSnapshot` (after `groups`, line 36, inside the block at lines 28–37); add `export const topology` (after the `calibration` export, line 71); append `BRACKET_ROUNDS`, `BRACKET_SLOTS`, `roundForSlot`, `validateBracketSlots` at end of file (after line 113)
- Create `data/topology.json` (slim, committed; stands in for the model build's output until Track P lands — content below is the verified normalization of `model/data/bracket_2026.json`'s `r32` + `progression`, third refs collapsed to the `3X` placeholder, `thirds_table` excluded)
- Create `lib/topology.test.ts`

**Interfaces** (VERBATIM from the locked contract)
- Produces (in `lib/predictions.ts`):
  ```ts
  export type BracketRound = "R32" | "R16" | "QF" | "SF" | "F";
  export interface BracketSlotProb { id: string; prob: number }
  export interface BracketSlot {
    slot: string;                 // "M73".."M104"
    round: BracketRound;
    sides: [BracketSlotProb[], BracketSlotProb[]];
    winner: BracketSlotProb[];
  }
  export interface R32Tie { slot: string; homeRef: string; awayRef: string } // "1A","2B","3X"
  export type Progression = Record<string, [string, string]>;
  export interface Topology { r32: R32Tie[]; progression: Progression }
  export const BRACKET_ROUNDS: BracketRound[];      // ["R32","R16","QF","SF","F"]
  export const BRACKET_SLOTS: string[];             // 31 ids M73..M104, M103 OMITTED
  export function roundForSlot(slot: string): BracketRound;
  export function validateBracketSlots(bracket: BracketSlot[] | undefined): boolean;
  export const topology: Topology;                  // from data/topology.json
  ```
- Consumes: `data/topology.json` (slim). Round boundaries (verified from progression feeders): R32=M73..M88, R16=M89..M96, QF=M97..M100, SF=M101..M102, F=M104.

Steps:

- [ ] **Step 1: Write the failing contract test.**
  Create `lib/topology.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import {
    BRACKET_ROUNDS,
    BRACKET_SLOTS,
    roundForSlot,
    topology,
    validateBracketSlots,
  } from "@/lib/predictions";
  import type { BracketSlot } from "@/lib/predictions";

  describe("BRACKET_SLOTS / roundForSlot", () => {
    it("is exactly the 31 knockout slots M73..M104 with M103 omitted", () => {
      expect(BRACKET_SLOTS.length).toBe(31);
      expect(BRACKET_SLOTS[0]).toBe("M73");
      expect(BRACKET_SLOTS[BRACKET_SLOTS.length - 1]).toBe("M104");
      expect(BRACKET_SLOTS).not.toContain("M103");
      expect(new Set(BRACKET_SLOTS).size).toBe(31);
    });

    it("maps each slot to the verified round band", () => {
      const counts = { R32: 0, R16: 0, QF: 0, SF: 0, F: 0 } as Record<string, number>;
      for (const slot of BRACKET_SLOTS) counts[roundForSlot(slot)]++;
      expect(counts).toEqual({ R32: 16, R16: 8, QF: 4, SF: 2, F: 1 });
      expect(roundForSlot("M73")).toBe("R32");
      expect(roundForSlot("M88")).toBe("R32");
      expect(roundForSlot("M89")).toBe("R16");
      expect(roundForSlot("M97")).toBe("QF");
      expect(roundForSlot("M101")).toBe("SF");
      expect(roundForSlot("M104")).toBe("F");
      expect(() => roundForSlot("M103")).toThrow();
    });

    it("orders the rounds R32 -> F", () => {
      expect(BRACKET_ROUNDS).toEqual(["R32", "R16", "QF", "SF", "F"]);
    });
  });

  describe("data/topology.json", () => {
    it("has 16 R32 ties with valid refs and 3X best-third placeholders", () => {
      expect(topology.r32.length).toBe(16);
      const ref = /^([12][A-L]|3X)$/;
      for (const tie of topology.r32) {
        expect(tie.slot).toMatch(/^M(7[3-9]|8[0-8])$/);
        expect(tie.homeRef).toMatch(ref);
        expect(tie.awayRef).toMatch(ref);
      }
      // Exactly the 8 best-third fixtures carry a 3X away-ref (FIFA Annex-C set).
      const thirdSlots = topology.r32.filter((t) => t.awayRef === "3X").map((t) => t.slot).sort();
      expect(thirdSlots).toEqual(["M74", "M77", "M79", "M80", "M81", "M82", "M85", "M87"]);
    });

    it("progression feeders union with R32 slots covers exactly BRACKET_SLOTS", () => {
      const progKeys = Object.keys(topology.progression);
      expect(progKeys.length).toBe(15); // M89..M104 minus M103
      for (const [slot, feeders] of Object.entries(topology.progression)) {
        expect(feeders).toHaveLength(2);
        for (const f of feeders) expect(BRACKET_SLOTS).toContain(f);
      }
      const all = new Set([...topology.r32.map((t) => t.slot), ...progKeys]);
      expect([...all].sort()).toEqual([...BRACKET_SLOTS].sort());
    });
  });

  describe("validateBracketSlots", () => {
    const complete: BracketSlot[] = BRACKET_SLOTS.map((slot) => ({
      slot,
      round: roundForSlot(slot),
      sides: [[{ id: "x", prob: 1 }], [{ id: "y", prob: 1 }]],
      winner: [{ id: "x", prob: 0.6 }, { id: "y", prob: 0.4 }],
    }));

    it("accepts a well-formed 31-slot bracket", () => {
      expect(validateBracketSlots(complete)).toBe(true);
    });

    it("rejects absent, short, mis-rounded, or malformed brackets", () => {
      expect(validateBracketSlots(undefined)).toBe(false);
      expect(validateBracketSlots(complete.slice(0, 30))).toBe(false);
      const wrongRound = complete.map((s, i) =>
        i === 0 ? { ...s, round: "F" as const } : s,
      );
      expect(validateBracketSlots(wrongRound)).toBe(false);
      const oneSide = complete.map((s, i) =>
        i === 0 ? { ...s, sides: [[{ id: "x", prob: 1 }]] as unknown as BracketSlot["sides"] } : s,
      );
      expect(validateBracketSlots(oneSide)).toBe(false);
    });
  });
  ```
  Run it and show it FAILS:
  ```
  npx vitest run lib/topology.test.ts
  ```
  Expected: FAIL — module `@/lib/predictions` provides no `BRACKET_SLOTS`/`topology`/`roundForSlot`/`validateBracketSlots`, and `data/topology.json` does not exist.

- [ ] **Step 2: Create the slim committed `data/topology.json`.**
  Write `data/topology.json` (verbatim — verified normalization of `model/data/bracket_2026.json`; the away-ref `3rd@1X` placeholders are collapsed to `3X`, and `thirds_table` is excluded so the web bundle never carries it):
  ```json
  {
    "r32": [
      { "slot": "M73", "homeRef": "2A", "awayRef": "2B" },
      { "slot": "M74", "homeRef": "1E", "awayRef": "3X" },
      { "slot": "M75", "homeRef": "1F", "awayRef": "2C" },
      { "slot": "M76", "homeRef": "1C", "awayRef": "2F" },
      { "slot": "M77", "homeRef": "1I", "awayRef": "3X" },
      { "slot": "M78", "homeRef": "2E", "awayRef": "2I" },
      { "slot": "M79", "homeRef": "1A", "awayRef": "3X" },
      { "slot": "M80", "homeRef": "1L", "awayRef": "3X" },
      { "slot": "M81", "homeRef": "1D", "awayRef": "3X" },
      { "slot": "M82", "homeRef": "1G", "awayRef": "3X" },
      { "slot": "M83", "homeRef": "2K", "awayRef": "2L" },
      { "slot": "M84", "homeRef": "1H", "awayRef": "2J" },
      { "slot": "M85", "homeRef": "1B", "awayRef": "3X" },
      { "slot": "M86", "homeRef": "1J", "awayRef": "2H" },
      { "slot": "M87", "homeRef": "1K", "awayRef": "3X" },
      { "slot": "M88", "homeRef": "2D", "awayRef": "2G" }
    ],
    "progression": {
      "M89": ["M74", "M77"],
      "M90": ["M73", "M75"],
      "M91": ["M76", "M78"],
      "M92": ["M79", "M80"],
      "M93": ["M83", "M84"],
      "M94": ["M81", "M82"],
      "M95": ["M86", "M88"],
      "M96": ["M85", "M87"],
      "M97": ["M89", "M90"],
      "M98": ["M93", "M94"],
      "M99": ["M91", "M92"],
      "M100": ["M95", "M96"],
      "M101": ["M97", "M98"],
      "M102": ["M99", "M100"],
      "M104": ["M101", "M102"]
    }
  }
  ```

- [ ] **Step 3: Add the locked types, topology import, slot/round constants, and validator to `lib/predictions.ts`.**
  Add the import after line 3 (`import ratingsJson from "@/data/ratings/latest.json";`):
  ```ts
  import topologyJson from "@/data/topology.json";
  ```
  Insert the bracket/topology interfaces immediately after the `GroupProb` interface (after line 26):
  ```ts
  // --- THE DRAW: locked bracket contract (camelCase to match the snapshot) ---
  export type BracketRound = "R32" | "R16" | "QF" | "SF" | "F";

  export interface BracketSlotProb {
    id: string;
    prob: number;
  }

  /** One knockout match slot M73..M104. `sides` = each participant side's
   *  distribution (who reaches that side); `winner` = who advances/wins. Each
   *  list is prob >= 0.005, sorted desc, capped at 12 — UI must NOT assume it
   *  sums to 1 (tail dropped). */
  export interface BracketSlot {
    slot: string;
    round: BracketRound;
    sides: [BracketSlotProb[], BracketSlotProb[]];
    winner: BracketSlotProb[];
  }

  /** Slim topology (data/topology.json). Refs: "1A" (winner), "2B" (runner-up),
   *  "3X" (a best-third placeholder). The web imports THIS, never
   *  model/data/bracket_2026.json (which carries the 5000-line thirds_table). */
  export interface R32Tie {
    slot: string;
    homeRef: string;
    awayRef: string;
  }
  export type Progression = Record<string, [string, string]>;
  export interface Topology {
    r32: R32Tie[];
    progression: Progression;
  }
  ```
  Add the `bracket` field inside `PredictionsSnapshot` (after the `groups: GroupProb[];` line, line 36). Optional, because the live snapshot still carries the legacy `{slot, teamProbs}[]` shape until Track P re-emits — the UI degrades gracefully when absent/invalid:
  ```ts
    groups: GroupProb[];
    /** Exactly 31 slots M73..M104 (M103 third-place OMITTED). Optional until
     *  the model emit (Track P) lands; validate with validateBracketSlots. */
    bracket?: BracketSlot[];
  ```
  Add the topology export after the `calibration` export (after line 71):
  ```ts
  export const topology = topologyJson as unknown as Topology;
  ```
  Append at end of file (after line 113):
  ```ts
  /** Round columns, R32 -> Final. */
  export const BRACKET_ROUNDS: BracketRound[] = ["R32", "R16", "QF", "SF", "F"];

  /** The 31 knockout slots in tree order. M103 (third-place playoff) is omitted
   *  by design — the engine does not model it. */
  export const BRACKET_SLOTS: string[] = [
    "M73", "M74", "M75", "M76", "M77", "M78", "M79", "M80",
    "M81", "M82", "M83", "M84", "M85", "M86", "M87", "M88", // R32 (16)
    "M89", "M90", "M91", "M92", "M93", "M94", "M95", "M96", // R16 (8)
    "M97", "M98", "M99", "M100",                            // QF (4)
    "M101", "M102",                                         // SF (2)
    "M104",                                                 // F (1)
  ];

  /** Verified round boundaries from the progression feeders. Throws on a
   *  non-knockout slot (e.g. M103), which must never appear in the bracket. */
  export function roundForSlot(slot: string): BracketRound {
    const n = Number.parseInt(slot.slice(1), 10);
    if (n >= 73 && n <= 88) return "R32";
    if (n >= 89 && n <= 96) return "R16";
    if (n >= 97 && n <= 100) return "QF";
    if (n === 101 || n === 102) return "SF";
    if (n === 104) return "F";
    throw new Error(`slot ${slot} is not a knockout bracket slot`);
  }

  /** Structural guard for graceful UI degradation: exactly the 31 BRACKET_SLOTS,
   *  each with the correct round and a two-element sides tuple + winner array. */
  export function validateBracketSlots(bracket: BracketSlot[] | undefined): boolean {
    if (!bracket || bracket.length !== BRACKET_SLOTS.length) return false;
    const expected = new Set(BRACKET_SLOTS);
    const seen = new Set<string>();
    for (const s of bracket) {
      if (!expected.has(s.slot) || seen.has(s.slot)) return false;
      seen.add(s.slot);
      if (s.round !== roundForSlot(s.slot)) return false;
      if (!Array.isArray(s.sides) || s.sides.length !== 2) return false;
      if (!Array.isArray(s.winner)) return false;
    }
    return seen.size === BRACKET_SLOTS.length;
  }
  ```
  Run the test and show it PASSES:
  ```
  npx vitest run lib/topology.test.ts
  ```
  Expected: PASS — all groups green.

- [ ] **Step 4: Typecheck, full suite, and commit.**
  ```
  npx tsc --noEmit && npx vitest run
  ```
  Expected: `tsc` exits 0; all `lib/**/*.test.ts` green.
  ```
  git add lib/predictions.ts data/topology.json lib/topology.test.ts
  git commit -m "Add locked bracket/topology contract + slim data/topology.json

  BracketSlotProb/BracketSlot/R32Tie/Progression/Topology in lib/predictions.ts,
  PredictionsSnapshot.bracket?: BracketSlot[], BRACKET_SLOTS (31, M103 omitted),
  roundForSlot, validateBracketSlots, and a static topology import. Web imports
  the slim data/topology.json, never model/data/bracket_2026.json.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

**Deliverable:** the locked types compile and ship; `data/topology.json` is committed (16 R32 ties, 15 progression entries, 8 `3X` fixtures); `lib/topology.test.ts` proves the 31-slot/round contract and the validator.

---

### Task 8 · [UD3]: `lib/bracket.ts` — render-ready tree + `tracePath`

A pure data-shaping module that turns `predictions.bracket` (+ `topology`) into a render-ready tree (rounds as columns R32→F, each match carrying its two side distributions, winner distribution, and feeder slot ids for connectors), plus `tracePath(tree, teamId)` returning the set of slot ids a team appears in (as a side or winner) — the highlight interaction's backbone. No React; fully unit-tested against a small hand-authored fixture.

**Files**
- Create `lib/bracket.ts`
- Create `lib/bracket.test.ts`

**Interfaces**
- Consumes (from `lib/predictions.ts`, all added in UD2): `BracketSlot`, `BracketSlotProb`, `BracketRound`, `Topology`, `BRACKET_ROUNDS`.
- Produces:
  ```ts
  export interface BracketMatch {
    slot: string;
    round: BracketRound;
    sides: [BracketSlotProb[], BracketSlotProb[]];
    winner: BracketSlotProb[];
    feeders: [string | null, string | null]; // feeder slot ids (R16+) or null,null for R32
  }
  export interface BracketColumn { round: BracketRound; label: string; matches: BracketMatch[] }
  export interface BracketTree { columns: BracketColumn[]; bySlot: Record<string, BracketMatch> }
  export function buildBracketTree(bracket: BracketSlot[] | undefined, topology: Topology): BracketTree;
  export function tracePath(tree: BracketTree, teamId: string): Set<string>;
  ```

Steps:

- [ ] **Step 1: Write the failing test with a small hand-authored fixture.**
  Create `lib/bracket.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { buildBracketTree, tracePath } from "@/lib/bracket";
  import type { BracketSlot, Topology } from "@/lib/predictions";

  // Mini subtree: M73 & M75 (R32) feed M90 (R16). r32 unused by the builder.
  const topo: Topology = {
    r32: [],
    progression: { M90: ["M73", "M75"] },
  };
  const bracket: BracketSlot[] = [
    {
      slot: "M73",
      round: "R32",
      sides: [[{ id: "a", prob: 0.6 }, { id: "b", prob: 0.4 }], [{ id: "c", prob: 0.7 }, { id: "d", prob: 0.3 }]],
      winner: [{ id: "a", prob: 0.5 }, { id: "c", prob: 0.3 }],
    },
    {
      slot: "M75",
      round: "R32",
      sides: [[{ id: "e", prob: 1 }], [{ id: "f", prob: 1 }]],
      winner: [{ id: "e", prob: 0.6 }, { id: "f", prob: 0.4 }],
    },
    {
      slot: "M90",
      round: "R16",
      sides: [[{ id: "a", prob: 0.5 }, { id: "b", prob: 0.2 }], [{ id: "e", prob: 0.6 }]],
      winner: [{ id: "a", prob: 0.4 }, { id: "e", prob: 0.35 }],
    },
  ];

  describe("buildBracketTree", () => {
    it("groups matches into round columns ordered R32 -> F, dropping empty rounds", () => {
      const tree = buildBracketTree(bracket, topo);
      expect(tree.columns.map((c) => c.round)).toEqual(["R32", "R16"]);
      expect(tree.columns[0].label).toBe("Round of 32");
      expect(tree.columns[1].label).toBe("Round of 16");
      expect(tree.columns[0].matches.map((m) => m.slot)).toEqual(["M73", "M75"]);
      expect(tree.columns[1].matches.map((m) => m.slot)).toEqual(["M90"]);
    });

    it("resolves feeder slot ids from progression (null,null for R32)", () => {
      const tree = buildBracketTree(bracket, topo);
      expect(tree.bySlot.M90.feeders).toEqual(["M73", "M75"]);
      expect(tree.bySlot.M73.feeders).toEqual([null, null]);
    });

    it("carries side and winner distributions through unchanged", () => {
      const tree = buildBracketTree(bracket, topo);
      expect(tree.bySlot.M73.sides[0]).toEqual([{ id: "a", prob: 0.6 }, { id: "b", prob: 0.4 }]);
      expect(tree.bySlot.M73.winner[0]).toEqual({ id: "a", prob: 0.5 });
    });

    it("returns an empty tree for an absent bracket", () => {
      const tree = buildBracketTree(undefined, topo);
      expect(tree.columns).toEqual([]);
      expect(tree.bySlot).toEqual({});
    });
  });

  describe("tracePath", () => {
    const tree = buildBracketTree(bracket, topo);

    it("collects every slot a team appears in (side or winner)", () => {
      expect(tracePath(tree, "a")).toEqual(new Set(["M73", "M90"]));
      expect(tracePath(tree, "e")).toEqual(new Set(["M75", "M90"]));
    });

    it("includes a slot when the team is only a losing participant", () => {
      // b reaches M73 (side) and M90 (side) but never wins either.
      expect(tracePath(tree, "b")).toEqual(new Set(["M73", "M90"]));
      // c only appears in M73.
      expect(tracePath(tree, "c")).toEqual(new Set(["M73"]));
    });

    it("returns an empty set for an unknown team", () => {
      expect(tracePath(tree, "zzz")).toEqual(new Set());
    });
  });
  ```
  Run it and show it FAILS:
  ```
  npx vitest run lib/bracket.test.ts
  ```
  Expected: FAIL — `Cannot find module '@/lib/bracket'`.

- [ ] **Step 2: Implement `lib/bracket.ts` (minimal impl).**
  Create `lib/bracket.ts`:
  ```ts
  import { BRACKET_ROUNDS } from "./predictions";
  import type { BracketRound, BracketSlot, BracketSlotProb, Topology } from "./predictions";

  export interface BracketMatch {
    slot: string;
    round: BracketRound;
    sides: [BracketSlotProb[], BracketSlotProb[]];
    winner: BracketSlotProb[];
    /** Feeder slot ids for connector lines (R16+); [null, null] for R32. */
    feeders: [string | null, string | null];
  }

  export interface BracketColumn {
    round: BracketRound;
    label: string;
    matches: BracketMatch[];
  }

  export interface BracketTree {
    columns: BracketColumn[];
    bySlot: Record<string, BracketMatch>;
  }

  const ROUND_LABELS: Record<BracketRound, string> = {
    R32: "Round of 32",
    R16: "Round of 16",
    QF: "Quarterfinal",
    SF: "Semifinal",
    F: "Final",
  };

  const slotNum = (slot: string): number => Number.parseInt(slot.slice(1), 10);

  /** Shape predictions.bracket + topology into round-column tree + slot index.
   *  Honors each slot's emitted `round`; feeders come from topology.progression.
   *  An absent/empty bracket yields an empty (renderable) tree. */
  export function buildBracketTree(
    bracket: BracketSlot[] | undefined,
    topology: Topology,
  ): BracketTree {
    const bySlot: Record<string, BracketMatch> = {};
    for (const s of bracket ?? []) {
      const feeders = topology.progression[s.slot];
      bySlot[s.slot] = {
        slot: s.slot,
        round: s.round,
        sides: [s.sides[0] ?? [], s.sides[1] ?? []],
        winner: s.winner ?? [],
        feeders: feeders ? [feeders[0], feeders[1]] : [null, null],
      };
    }
    const columns: BracketColumn[] = BRACKET_ROUNDS.map((round) => ({
      round,
      label: ROUND_LABELS[round],
      matches: Object.values(bySlot)
        .filter((m) => m.round === round)
        .sort((a, b) => slotNum(a.slot) - slotNum(b.slot)),
    })).filter((col) => col.matches.length > 0);
    return { columns, bySlot };
  }

  /** Every slot id where `teamId` appears on a side OR in the winner list —
   *  the highlight interaction's "road to the final". */
  export function tracePath(tree: BracketTree, teamId: string): Set<string> {
    const path = new Set<string>();
    for (const m of Object.values(tree.bySlot)) {
      const present =
        m.sides[0].some((p) => p.id === teamId) ||
        m.sides[1].some((p) => p.id === teamId) ||
        m.winner.some((p) => p.id === teamId);
      if (present) path.add(m.slot);
    }
    return path;
  }
  ```
  Run the test and show it PASSES:
  ```
  npx vitest run lib/bracket.test.ts
  ```
  Expected: PASS — `buildBracketTree` and `tracePath` groups all green.

- [ ] **Step 3: Typecheck, full suite, and commit.**
  ```
  npx tsc --noEmit && npx vitest run
  ```
  Expected: `tsc` exits 0; all `lib/**/*.test.ts` green (UD1, UD2, UD3 + pre-existing).
  ```
  git add lib/bracket.ts lib/bracket.test.ts
  git commit -m "Add lib/bracket.ts: render-ready tree + tracePath

  buildBracketTree groups predictions.bracket into R32..F columns with feeder
  slot ids from topology.progression; tracePath returns the slot set a team
  appears in (side or winner) for the road-to-the-final highlight. Pure,
  React-free, unit-tested against a hand-authored subtree fixture.

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

**Deliverable:** `lib/bracket.ts` exposes `buildBracketTree`/`tracePath` over the locked contract, fully unit-tested (column ordering, feeder resolution, distribution pass-through, graceful empty tree, side-or-winner path tracing) — the data layer the `/bracket` UI track consumes.

---

I have everything I need. Note one key constraint I found: vitest config (`/Users/ajaiupadhyaya/Documents/worldcup/vitest.config.ts`) uses `environment: "node"` and `include: ["lib/**/*.test.ts"]`, with **no** `@testing-library/react` installed and **zero** existing `.test.tsx` files. So all testable view-logic must live as pure `.ts` under `lib/` to be picked up. The tasks below honor that.

---

### Task 9 · [UV1]: `/bracket` server route, loading/empty states, and the base BracketBoard

**Files**
- Create `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts` (pure view helpers; client-safe, no React)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts` (vitest, node env — matches existing `lib/**/*.test.ts` glob in `vitest.config.ts`)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx` (`"use client"` — base columns + inline `SlotCard`; enhanced by UV2/UV3/UV4)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/app/bracket/page.tsx` (server component: loads snapshot + slim topology, builds tree, `generateMetadata`, renders `<BracketBoard>` or empty state)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/app/bracket/loading.tsx` (route skeleton)

**Interfaces**
- **Consumes** (built by sibling tracks — prerequisites that must be merged before this task builds):
  - From `@/lib/predictions` (data-contract task): `interface BracketSlotProb { id: string; prob: number }`, `interface BracketSlot { slot: string; round: "R32"|"R16"|"QF"|"SF"|"F"; sides: [BracketSlotProb[], BracketSlotProb[]]; winner: BracketSlotProb[] }`, `PredictionsSnapshot.bracket?: BracketSlot[]`, existing `PredTeam`, `predictions`, `formatProb`.
  - From `@/lib/bracket` (logic/VM track): `type Round = "R32"|"R16"|"QF"|"SF"|"F"`; `interface BracketMatch { slot: string; round: Round; sides: [BracketSlotProb[], BracketSlotProb[]]; winner: BracketSlotProb[]; feeders: [string,string]|null }`; `interface BracketTree { rounds: Record<Round, BracketMatch[]>; bySlot: Record<string, BracketMatch>; champion: BracketSlotProb[]; generatedAt: string }`; `interface Topology { r32: {slot:string;homeRef:string;awayRef:string}[]; progression: Record<string,[string,string]> }`; `buildBracketTree(snapshot: PredictionsSnapshot, topology: Topology): BracketTree`.
  - `@/data/topology.json` (slim file written by the model build — the web must import THIS, never `model/data/bracket_2026.json`).
- **Produces**: `ROUND_ORDER: Round[]`, `ROUND_LABELS: Record<Round,string>`, `mostLikely(dist: BracketSlotProb[]): BracketSlotProb|null`, `prettifyId(id: string): string`; component `BracketBoard({ tree, teams })`; route `/bracket`.

- [ ] **Step 1: Write the failing test for the pure view helpers.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { ROUND_ORDER, ROUND_LABELS, mostLikely, prettifyId } from "@/lib/bracketView";
  import type { BracketSlotProb } from "@/lib/predictions";

  describe("ROUND_ORDER / ROUND_LABELS", () => {
    it("lists the five knockout rounds in R32→Final order", () => {
      expect(ROUND_ORDER).toEqual(["R32", "R16", "QF", "SF", "F"]);
    });
    it("labels every round", () => {
      expect(ROUND_ORDER.map((r) => ROUND_LABELS[r])).toEqual([
        "Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final",
      ]);
    });
  });

  describe("mostLikely", () => {
    const dist: BracketSlotProb[] = [
      { id: "argentina", prob: 0.41 },
      { id: "brazil", prob: 0.32 },
    ];
    it("returns the highest-probability entry", () => {
      expect(mostLikely(dist)?.id).toBe("argentina");
    });
    it("does not assume the list is pre-sorted", () => {
      expect(mostLikely([{ id: "a", prob: 0.1 }, { id: "b", prob: 0.9 }])?.id).toBe("b");
    });
    it("returns null for an empty or missing distribution", () => {
      expect(mostLikely([])).toBeNull();
      expect(mostLikely(undefined as unknown as BracketSlotProb[])).toBeNull();
    });
  });

  describe("prettifyId", () => {
    it("turns a slug id into a display name", () => {
      expect(prettifyId("south-korea")).toBe("South Korea");
      expect(prettifyId("brazil")).toBe("Brazil");
      expect(prettifyId("")).toBe("");
    });
  });
  ```
  Run it and show the expected FAIL (module does not exist yet):
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected: `Error: Failed to resolve import "@/lib/bracketView"` → `Test Files 1 failed`.

- [ ] **Step 2: Implement the pure view helpers (minimal).**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts`:
  ```ts
  import type { BracketSlotProb } from "@/lib/predictions";
  import type { Round } from "@/lib/bracket";

  /** Column order, left→right, for the knockout board. */
  export const ROUND_ORDER: Round[] = ["R32", "R16", "QF", "SF", "F"];

  /** Human round labels (Bodoni headings render these). */
  export const ROUND_LABELS: Record<Round, string> = {
    R32: "Round of 32",
    R16: "Round of 16",
    QF: "Quarterfinal",
    SF: "Semifinal",
    F: "Final",
  };

  /**
   * Highest-probability entry of a per-slot distribution. Defends against an
   * unsorted/empty/missing list (the snapshot caps + sorts, but UI must not
   * assume it). Returns null when there is nothing to show.
   */
  export function mostLikely(dist: BracketSlotProb[]): BracketSlotProb | null {
    if (!dist || dist.length === 0) return null;
    let best = dist[0];
    for (const d of dist) if (d.prob > best.prob) best = d;
    return best;
  }

  /** Fallback display name from a snapshot slug id (used when no name lookup hit). */
  export function prettifyId(id: string): string {
    if (!id) return "";
    return id
      .split("-")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  ```
  Run and show expected PASS:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected: `✓ lib/bracketView.test.ts` → `Test Files 1 passed`, `Tests 6 passed`.

- [ ] **Step 3: Create the base BracketBoard client component.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx`:
  ```tsx
  "use client";

  import { useMemo } from "react";
  import type { BracketTree, BracketMatch } from "@/lib/bracket";
  import type { PredTeam } from "@/lib/predictions";
  import { formatProb } from "@/lib/probability";
  import { ROUND_ORDER, ROUND_LABELS, mostLikely, prettifyId } from "@/lib/bracketView";

  export function BracketBoard({ tree, teams }: { tree: BracketTree; teams: PredTeam[] }) {
    const nameById = useMemo(
      () => new Map(teams.map((t) => [t.id, t.name] as const)),
      [teams],
    );
    const name = (id: string) => nameById.get(id) ?? prettifyId(id);

    return (
      <div className="pb-16">
        <BoardHeader generatedAt={tree.generatedAt} />
        <DesktopBoard tree={tree} name={name} />
        <MobileBoard tree={tree} name={name} />
      </div>
    );
  }

  function BoardHeader({ generatedAt }: { generatedAt: string }) {
    return (
      <header className="overflow-hidden px-6 pt-8 sm:px-12">
        <h1 className="headline-bleed text-[clamp(64px,12vw,168px)] text-[var(--foreground)]">
          THE DRAW
        </h1>
        <p className="mt-4 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
          ROUND OF 32 → FINAL · MONTE-CARLO PROJECTION
        </p>
      </header>
    );
  }

  /* ── Desktop: rounds as columns (connectors + path-trace land in UV3) ── */
  function DesktopBoard({
    tree,
    name,
  }: {
    tree: BracketTree;
    name: (id: string) => string;
  }) {
    return (
      <div className="hidden overflow-x-auto px-6 pt-8 sm:px-12 lg:block">
        <div className="mx-auto flex min-w-[1100px] max-w-[1480px]">
          {ROUND_ORDER.map((round) => (
            <div key={round} className="flex flex-1 flex-col">
              <RoundHeading round={round} />
              <div className="flex flex-1 flex-col justify-around gap-3 py-4">
                {tree.rounds[round].map((m) => (
                  <SlotCard key={m.slot} match={m} name={name} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Mobile: every round stacked (round selector + scroll-snap land in UV4) ── */
  function MobileBoard({
    tree,
    name,
  }: {
    tree: BracketTree;
    name: (id: string) => string;
  }) {
    return (
      <div className="px-6 pt-8 lg:hidden">
        {ROUND_ORDER.map((round) => (
          <section key={round} className="mb-8">
            <RoundHeading round={round} />
            <div className="mt-3 flex flex-col gap-3">
              {tree.rounds[round].map((m) => (
                <SlotCard key={m.slot} match={m} name={name} />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  function RoundHeading({ round }: { round: BracketMatch["round"] }) {
    return (
      <div className="section-rule-light flex items-baseline justify-between pb-1 pt-2">
        <span className="section-label">{ROUND_LABELS[round]}</span>
        <span className="text-[9px] tracking-[0.2em] text-[var(--foreground-faint)]">{round}</span>
      </div>
    );
  }

  /* Inline slot: most-likely team per side + advance %. Replaced by the hybrid
     BracketSlot in UV2 — kept deliberately minimal so UV1 ships a real board. */
  function SlotCard({
    match,
    name,
  }: {
    match: BracketMatch;
    name: (id: string) => string;
  }) {
    const top = mostLikely(match.sides[0]);
    const bottom = mostLikely(match.sides[1]);
    const adv = mostLikely(match.winner);
    return (
      <div className="border border-[var(--border)] bg-[var(--paper-pure)]">
        <SlotSide entry={top} advancing={!!adv && adv.id === top?.id} advProb={adv?.prob ?? 0} name={name} />
        <div className="h-px bg-[var(--border)]" />
        <SlotSide entry={bottom} advancing={!!adv && adv.id === bottom?.id} advProb={adv?.prob ?? 0} name={name} />
      </div>
    );
  }

  function SlotSide({
    entry,
    advancing,
    advProb,
    name,
  }: {
    entry: { id: string; prob: number } | null;
    advancing: boolean;
    advProb: number;
    name: (id: string) => string;
  }) {
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 ${
          advancing ? "border-l-2 border-[var(--foreground-accent)]" : "border-l-2 border-transparent"
        }`}
      >
        <span
          className={`truncate font-heading text-[13px] font-semibold tracking-[-0.01em] ${
            advancing ? "text-[var(--foreground)]" : "text-[var(--foreground-secondary)]"
          }`}
        >
          {entry ? name(entry.id).toUpperCase() : "—"}
        </span>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            advancing ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-faint)]"
          }`}
        >
          {advancing ? formatProb(advProb) : entry ? formatProb(entry.prob) : ""}
        </span>
      </div>
    );
  }
  ```
  Typecheck:
  ```
  npx tsc --noEmit
  ```
  Expected: no output (exit 0).

- [ ] **Step 4: Create the loading skeleton.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/app/bracket/loading.tsx`:
  ```tsx
  export default function Loading() {
    return (
      <div className="px-6 pt-8 sm:px-12">
        <div className="h-32 w-2/3 animate-pulse bg-[var(--row-alt)]" />
        <div className="mt-10 flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }, (_, c) => (
            <div key={c} className="flex flex-1 flex-col gap-3">
              {Array.from({ length: Math.max(1, 8 >> c) }, (_, r) => (
                <div key={r} className="h-16 animate-pulse bg-[var(--row-alt)]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 5: Create the server route with `generateMetadata` and empty state.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/app/bracket/page.tsx`:
  ```tsx
  import type { Metadata } from "next";
  import { predictions } from "@/lib/predictions";
  import { buildBracketTree } from "@/lib/bracket";
  import type { Topology } from "@/lib/bracket";
  import topologyJson from "@/data/topology.json";
  import { BracketBoard } from "@/components/bracket/BracketBoard";

  // Slim, web-only topology (r32 + progression). NEVER import
  // model/data/bracket_2026.json — it carries the 5,000-line thirds_table.
  const topology = topologyJson as unknown as Topology;

  export function generateMetadata(): Metadata {
    const title = "THE DRAW — World Cup MMXXVI";
    const description =
      "The full Round of 32 → Final knockout bracket, projected by Monte-Carlo. Trace any team's road to the trophy.";
    return {
      title,
      description,
      openGraph: { title, description, images: ["/api/og/bracket"] },
      twitter: { card: "summary_large_image", title, description, images: ["/api/og/bracket"] },
    };
  }

  export default function BracketPage() {
    const bracket = predictions.bracket;
    if (!Array.isArray(bracket) || bracket.length === 0) {
      return <BracketEmpty />;
    }
    const tree = buildBracketTree(predictions, topology);
    return <BracketBoard tree={tree} teams={predictions.teams} />;
  }

  function BracketEmpty() {
    return (
      <div className="px-6 pt-8 sm:px-12">
        <h1 className="headline-bleed text-[clamp(64px,12vw,168px)] text-[var(--foreground)]">
          THE DRAW
        </h1>
        <div className="mt-10 max-w-prose border border-[var(--border)] bg-[var(--paper-pure)] p-6">
          <p className="section-label">Not yet drawn</p>
          <p className="mt-3 text-[14px] leading-[1.9] text-[var(--foreground-secondary)]">
            The knockout bracket appears once the model emits per-slot
            distributions for the Round of 32 onward. Check back after the next
            snapshot.
          </p>
        </div>
      </div>
    );
  }
  ```
  Build the app (the marquee must build clean against the committed snapshot + topology):
  ```
  npm run build
  ```
  Expected: `✓ Compiled successfully`, `/bracket` listed in the route table, exit 0. Then lint:
  ```
  npm run lint
  ```
  Expected: no errors.

- [ ] **Step 6: Commit.**
  ```
  git add lib/bracketView.ts lib/bracketView.test.ts components/bracket/BracketBoard.tsx app/bracket/page.tsx app/bracket/loading.tsx
  git commit -m "$(printf 'feat(bracket): /bracket route, base BracketBoard, loading/empty states\n\nServer component loads the snapshot + slim data/topology.json, builds the\ntree via buildBracketTree, sets generateMetadata (THE DRAW, OG ->\n/api/og/bracket), and renders a client BracketBoard of rounds-as-columns.\nPure view helpers (ROUND_ORDER/ROUND_LABELS/mostLikely/prettifyId) are\nunit-tested under lib/ (node env).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

**Deliverable:** `/bracket` renders a real R32→Final board from the live snapshot (or a graceful empty state), `generateMetadata` is set, `npm run build` + `npm run lint` + `npx vitest run lib/bracketView.test.ts` all green.

---

### Task 10 · [UV2]: The hybrid BracketSlot (most-likely + advance %, hover/tap full distribution, mcStdErr whisker)

**Files**
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts` (append `STAGE_BY_ROUND`) — after the `ROUND_LABELS` block (currently lines ~13–20)
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts` (append `STAGE_BY_ROUND` tests)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketSlot.tsx` (`"use client"`)
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx` — replace inline `SlotCard`/`SlotSide` (the block created in UV1) with `<BracketSlot>`; thread `stdErrByTeam`

**Interfaces**
- **Consumes**: `BracketMatch`, `BracketSlotProb` (sides/winner are `BracketSlotProb[]`), `PredTeam["mcStdErr"]` (`Record<Stage, number>`), `Stage` from `@/lib/predictions`, `ProbBar` from `@/components/predict/ProbBar`, `formatProb`, `mostLikely`, `prettifyId`.
- **Produces**: `STAGE_BY_ROUND: Record<Round, Stage>`; component
  `BracketSlot({ match, name, stdErrByTeam, selectedTeamId?, onSelectTeam?, state? })` where `state?: "active"|"dim"|"idle"` (selection props are optional so UV2 ships standalone; UV3 feeds them from the path context).

- [ ] **Step 1: Write the failing test for the round→stage map.**
  Append to `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts`:
  ```ts
  import { STAGE_BY_ROUND } from "@/lib/bracketView";

  describe("STAGE_BY_ROUND", () => {
    it("maps each board round to the snapshot stage whose mcStdErr it shows", () => {
      expect(STAGE_BY_ROUND).toEqual({
        R32: "reachR32",
        R16: "reachR16",
        QF: "reachQF",
        SF: "reachSF",
        F: "winCup",
      });
    });
  });
  ```
  Run:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected FAIL: `STAGE_BY_ROUND is not exported` / `undefined`.

- [ ] **Step 2: Implement `STAGE_BY_ROUND`.**
  Append to `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts` (add `Stage` to the existing `@/lib/predictions` import is unnecessary since helpers below reference it; import the type):
  ```ts
  import type { Stage } from "@/lib/predictions";

  /**
   * The snapshot stage whose Monte-Carlo standard error best represents a slot
   * in each round — i.e. the uncertainty of a team *reaching* (or, for the
   * Final, *winning*) that match. Drives the BracketSlot whisker.
   */
  export const STAGE_BY_ROUND: Record<Round, Stage> = {
    R32: "reachR32",
    R16: "reachR16",
    QF: "reachQF",
    SF: "reachSF",
    F: "winCup",
  };
  ```
  Run:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected PASS: `Tests 7 passed`.

- [ ] **Step 3: Create the hybrid BracketSlot.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketSlot.tsx`:
  ```tsx
  "use client";

  import { useState } from "react";
  import type { BracketMatch, BracketSlotProb } from "@/lib/bracket";
  import type { PredTeam } from "@/lib/predictions";
  import { formatProb } from "@/lib/probability";
  import { ProbBar } from "@/components/predict/ProbBar";
  import { mostLikely, prettifyId, STAGE_BY_ROUND } from "@/lib/bracketView";

  export type SlotState = "active" | "dim" | "idle";

  export function BracketSlot({
    match,
    name,
    stdErrByTeam,
    selectedTeamId,
    onSelectTeam,
    state = "idle",
  }: {
    match: BracketMatch;
    name: (id: string) => string;
    stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
    selectedTeamId?: string | null;
    onSelectTeam?: (id: string) => void;
    state?: SlotState;
  }) {
    const [open, setOpen] = useState(false);
    const adv = mostLikely(match.winner);
    const top = mostLikely(match.sides[0]);
    const bottom = mostLikely(match.sides[1]);
    const stage = STAGE_BY_ROUND[match.round];
    const stdErr = (id: string) => stdErrByTeam.get(id)?.[stage];

    return (
      <div
        className={`group border bg-[var(--paper-pure)] transition-opacity duration-300 ${
          state === "dim" ? "opacity-30" : "opacity-100"
        } ${
          state === "active"
            ? "border-[var(--foreground-accent)]"
            : "border-[var(--border)]"
        }`}
        onMouseLeave={() => setOpen(false)}
      >
        {/* Collapsed face: most-likely team per side + advance % */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${name(top?.id ?? "")} vs ${name(bottom?.id ?? "")} — show full distribution`}
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setOpen(true)}
          className="block w-full text-left"
        >
          <CollapsedSide entry={top} advancing={!!adv && adv.id === top?.id} advProb={adv?.prob ?? 0} name={name} selectedTeamId={selectedTeamId} />
          <div className="h-px bg-[var(--border)]" />
          <CollapsedSide entry={bottom} advancing={!!adv && adv.id === bottom?.id} advProb={adv?.prob ?? 0} name={name} selectedTeamId={selectedTeamId} />
        </button>

        {/* Revealed: full per-side distributions + who advances */}
        {open && (
          <div className="border-t border-[var(--border)] bg-[var(--background)] px-3 py-3">
            <DistList label="Top side" dist={match.sides[0]} name={name} stdErr={stdErr} selectedTeamId={selectedTeamId} onSelectTeam={onSelectTeam} />
            <DistList label="Bottom side" dist={match.sides[1]} name={name} stdErr={stdErr} selectedTeamId={selectedTeamId} onSelectTeam={onSelectTeam} />
            <DistList label="Advances" dist={match.winner} name={name} stdErr={stdErr} selectedTeamId={selectedTeamId} onSelectTeam={onSelectTeam} accent />
          </div>
        )}
      </div>
    );
  }

  function CollapsedSide({
    entry,
    advancing,
    advProb,
    name,
    selectedTeamId,
  }: {
    entry: BracketSlotProb | null;
    advancing: boolean;
    advProb: number;
    name: (id: string) => string;
    selectedTeamId?: string | null;
  }) {
    const selected = !!entry && entry.id === selectedTeamId;
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 border-l-2 ${
          selected
            ? "border-[var(--foreground-accent)] bg-[var(--row-alt)]"
            : advancing
              ? "border-[var(--foreground-accent)]"
              : "border-transparent"
        }`}
      >
        <span
          className={`truncate font-heading text-[13px] font-semibold tracking-[-0.01em] ${
            selected || advancing ? "text-[var(--foreground)]" : "text-[var(--foreground-secondary)]"
          }`}
        >
          {entry ? name(entry.id).toUpperCase() : "—"}
        </span>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            advancing ? "text-[var(--foreground-accent)]" : "text-[var(--foreground-faint)]"
          }`}
        >
          {advancing ? formatProb(advProb) : entry ? formatProb(entry.prob) : ""}
        </span>
      </div>
    );
  }

  function DistList({
    label,
    dist,
    name,
    stdErr,
    selectedTeamId,
    onSelectTeam,
    accent = false,
  }: {
    label: string;
    dist: BracketSlotProb[];
    name: (id: string) => string;
    stdErr: (id: string) => number | undefined;
    selectedTeamId?: string | null;
    onSelectTeam?: (id: string) => void;
    accent?: boolean;
  }) {
    if (!dist || dist.length === 0) return null;
    const max = Math.max(...dist.map((d) => d.prob), 0.0001);
    return (
      <div className="mb-3 last:mb-0">
        <div className="mb-1 text-[9px] tracking-[0.2em] text-[var(--foreground-faint)]">
          {label.toUpperCase()}
        </div>
        <div className="flex flex-col gap-1">
          {dist.map((e) => {
            const selected = e.id === selectedTeamId;
            const se = stdErr(e.id);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectTeam?.(e.id)}
                className={`group/row flex items-center gap-2 px-1 py-0.5 text-left ${
                  selected ? "bg-[var(--row-alt)]" : "hover:bg-[var(--row-alt)]"
                }`}
              >
                <span className="w-24 shrink-0 truncate text-[12px] text-[var(--foreground)]">
                  {name(e.id)}
                </span>
                <span className="relative flex-1">
                  <ProbBar
                    value={e.prob / max}
                    color={accent || selected ? "var(--foreground-accent)" : "var(--foreground)"}
                    label={`${name(e.id)}: ${formatProb(e.prob)}`}
                  />
                  {/* mcStdErr whisker: ± standard error rendered over the bar */}
                  {se != null && se > 0 && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 border-x border-[var(--foreground-secondary)]"
                      style={{
                        left: `${Math.max(0, (e.prob - se) / max) * 100}%`,
                        width: `${Math.min(1, (2 * se) / max) * 100}%`,
                      }}
                    />
                  )}
                </span>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--foreground-secondary)]">
                  {formatProb(e.prob)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: Swap the inline SlotCard for BracketSlot in the board.**
  In `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx`:
  Add the import + a memoized `stdErrByTeam`, and replace every `<SlotCard … />` usage with `<BracketSlot … />`, then delete the now-unused `SlotCard`/`SlotSide` functions (the block from UV1 Step 3). Apply these edits:

  Replace the import line
  ```tsx
  import { ROUND_ORDER, ROUND_LABELS, mostLikely, prettifyId } from "@/lib/bracketView";
  ```
  with
  ```tsx
  import { ROUND_ORDER, ROUND_LABELS, prettifyId } from "@/lib/bracketView";
  import { BracketSlot } from "@/components/bracket/BracketSlot";
  ```
  Replace the body of `BracketBoard` (the `nameById`/`name`/`return` block) with:
  ```tsx
    const nameById = useMemo(
      () => new Map(teams.map((t) => [t.id, t.name] as const)),
      [teams],
    );
    const stdErrByTeam = useMemo(
      () => new Map(teams.map((t) => [t.id, t.mcStdErr] as const)),
      [teams],
    );
    const name = (id: string) => nameById.get(id) ?? prettifyId(id);

    return (
      <div className="pb-16">
        <BoardHeader generatedAt={tree.generatedAt} />
        <DesktopBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
        <MobileBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
      </div>
    );
  ```
  Update both `DesktopBoard` and `MobileBoard` signatures to add `stdErrByTeam: Map<string, PredTeam["mcStdErr"]>` and render the slot via:
  ```tsx
  <BracketSlot key={m.slot} match={m} name={name} stdErrByTeam={stdErrByTeam} />
  ```
  Delete the `SlotCard` and `SlotSide` functions entirely. Keep `BoardHeader`, `RoundHeading`, `ROUND_ORDER`, `ROUND_LABELS`. (Add `import type { PredTeam } … `already present; `mostLikely` import is dropped since only BracketSlot uses it.)

  Typecheck + lint (catches any leftover unused symbol):
  ```
  npx tsc --noEmit && npm run lint
  ```
  Expected: exit 0, no errors.

- [ ] **Step 5: Build and commit.**
  ```
  npm run build
  ```
  Expected: `✓ Compiled successfully`.
  ```
  git add lib/bracketView.ts lib/bracketView.test.ts components/bracket/BracketSlot.tsx components/bracket/BracketBoard.tsx
  git commit -m "$(printf 'feat(bracket): hybrid BracketSlot with reveal-on-hover distribution\n\nCollapsed face shows the most-likely team per side + advance %%; hover/tap/\nkeyboard reveals each side and the advance distribution with ProbBars and a\nmcStdErr whisker (stage chosen via STAGE_BY_ROUND). Selection props are\noptional so the slot ships before the path context (UV3).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

**Deliverable:** every slot shows the hybrid view (most-likely + advance %, expandable to full distributions with uncertainty whiskers); `STAGE_BY_ROUND` unit-tested; build/lint/typecheck green.

---

### Task 11 · [UV3]: TeamPathProvider, connector lines, "trace a team's road", and ChampionPanel + dateline

**Files**
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts` (append `computeLayout`, `slotState`, `championLadder`)
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts` (append tests for the three)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/TeamPathProvider.tsx` (`"use client"` — React context)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/ChampionPanel.tsx` (`"use client"`)
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx` — wrap in provider, render ChampionPanel hero + dateline/uncertainty note, replace `DesktopBoard` with an absolute-positioned canvas + SVG connectors, feed `state`/selection from context

**Interfaces**
- **Consumes**: `tracePath(tree, teamId): Set<string>`, `BracketTree`, `BracketMatch` from `@/lib/bracket`; `BracketSlot`, `SlotState`; `ProbBar`; `formatProb`.
- **Produces**:
  - `interface LayoutNode { slot: string; round: Round; col: number; row: number; feeders: [string,string]|null }`; `computeLayout(tree: BracketTree): LayoutNode[]` (row of a parent = mean of its feeders' rows — deterministic, no DOM measurement).
  - `slotState(slot: string, traced: Set<string>|null): "active"|"dim"|"idle"`.
  - `championLadder(champion: BracketSlotProb[], topN?: number): BracketSlotProb[]`.
  - `TeamPathProvider({ tree, children })` + `useTeamPath(): { selectedTeamId, tracedSlots, selectTeam }`.
  - `ChampionPanel({ champion, name })`.

- [ ] **Step 1: Write failing tests for `computeLayout`, `slotState`, `championLadder`.**
  Append to `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts`:
  ```ts
  import { computeLayout, slotState, championLadder } from "@/lib/bracketView";
  import type { BracketTree, BracketMatch } from "@/lib/bracket";

  function mkMatch(p: Partial<BracketMatch> & Pick<BracketMatch, "slot" | "round">): BracketMatch {
    return { sides: [[], []], winner: [], feeders: null, ...p };
  }
  function mkTree(rounds: Partial<BracketTree["rounds"]>): BracketTree {
    const full = { R32: [], R16: [], QF: [], SF: [], F: [], ...rounds } as BracketTree["rounds"];
    const bySlot: BracketTree["bySlot"] = {};
    for (const r of Object.values(full)) for (const m of r) bySlot[m.slot] = m;
    return { rounds: full, bySlot, champion: [], generatedAt: "2026-06-28T00:00:00Z" };
  }

  describe("computeLayout", () => {
    it("places R32 on base rows and each parent at the mean row of its feeders", () => {
      const tree = mkTree({
        R32: [
          mkMatch({ slot: "M73", round: "R32" }),
          mkMatch({ slot: "M74", round: "R32" }),
          mkMatch({ slot: "M75", round: "R32" }),
          mkMatch({ slot: "M76", round: "R32" }),
        ],
        R16: [
          mkMatch({ slot: "M89", round: "R16", feeders: ["M73", "M75"] }),
          mkMatch({ slot: "M90", round: "R16", feeders: ["M74", "M76"] }),
        ],
      });
      const layout = computeLayout(tree);
      const byId = new Map(layout.map((n) => [n.slot, n]));
      expect(byId.get("M73")).toMatchObject({ col: 0, row: 0 });
      expect(byId.get("M75")).toMatchObject({ col: 0, row: 2 });
      // M89 feeds from rows 0 and 2 -> row 1; M90 from 1 and 3 -> row 2
      expect(byId.get("M89")).toMatchObject({ col: 1, row: 1 });
      expect(byId.get("M90")).toMatchObject({ col: 1, row: 2 });
    });
  });

  describe("slotState", () => {
    it("is idle when nothing is traced", () => {
      expect(slotState("M73", null)).toBe("idle");
      expect(slotState("M73", new Set())).toBe("idle");
    });
    it("is active on the traced path and dim elsewhere", () => {
      const traced = new Set(["M73", "M89"]);
      expect(slotState("M73", traced)).toBe("active");
      expect(slotState("M74", traced)).toBe("dim");
    });
  });

  describe("championLadder", () => {
    it("returns the top-N title odds, descending", () => {
      const champ = [
        { id: "brazil", prob: 0.12 },
        { id: "argentina", prob: 0.2 },
        { id: "france", prob: 0.15 },
      ];
      expect(championLadder(champ, 2).map((e) => e.id)).toEqual(["argentina", "france"]);
    });
  });
  ```
  Run:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected FAIL: `computeLayout is not a function` etc.

- [ ] **Step 2: Implement `computeLayout`, `slotState`, `championLadder`.**
  Append to `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts`:
  ```ts
  import type { BracketTree } from "@/lib/bracket";

  export interface LayoutNode {
    slot: string;
    round: Round;
    col: number;
    row: number;
    feeders: [string, string] | null;
  }

  /**
   * Deterministic bracket geometry without DOM measurement: R32 matches take
   * their array index as base row; every later match sits at the mean row of
   * its two feeders. col = ROUND_ORDER index. Used for absolute positioning and
   * SVG connector elbows.
   */
  export function computeLayout(tree: BracketTree): LayoutNode[] {
    const rowBySlot = new Map<string, number>();
    const nodes: LayoutNode[] = [];
    ROUND_ORDER.forEach((round, col) => {
      const matches = tree.rounds[round] ?? [];
      matches.forEach((m, i) => {
        let row: number;
        if (!m.feeders) {
          row = i;
        } else {
          const ra = rowBySlot.get(m.feeders[0]);
          const rb = rowBySlot.get(m.feeders[1]);
          row = ra != null && rb != null ? (ra + rb) / 2 : i;
        }
        rowBySlot.set(m.slot, row);
        nodes.push({ slot: m.slot, round, col, row, feeders: m.feeders });
      });
    });
    return nodes;
  }

  export type SlotVisual = "active" | "dim" | "idle";

  /** Visual state of a slot given the active path trace (null/empty => idle). */
  export function slotState(slot: string, traced: Set<string> | null): SlotVisual {
    if (!traced || traced.size === 0) return "idle";
    return traced.has(slot) ? "active" : "dim";
  }

  /** Top-N title odds (the M104 winner distribution), descending. */
  export function championLadder(champion: BracketSlotProb[], topN = 6): BracketSlotProb[] {
    return [...champion].sort((a, b) => b.prob - a.prob).slice(0, topN);
  }
  ```
  Run:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected PASS: `Tests 11 passed`.

- [ ] **Step 3: Create the TeamPathProvider context.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/TeamPathProvider.tsx`:
  ```tsx
  "use client";

  import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
  import { tracePath } from "@/lib/bracket";
  import type { BracketTree } from "@/lib/bracket";

  interface TeamPathValue {
    selectedTeamId: string | null;
    tracedSlots: Set<string> | null;
    selectTeam: (id: string) => void;
  }

  const TeamPathContext = createContext<TeamPathValue | null>(null);

  export function TeamPathProvider({ tree, children }: { tree: BracketTree; children: ReactNode }) {
    const [selectedTeamId, setSelected] = useState<string | null>(null);
    const tracedSlots = useMemo(
      () => (selectedTeamId ? tracePath(tree, selectedTeamId) : null),
      [tree, selectedTeamId],
    );
    const selectTeam = useCallback(
      (id: string) => setSelected((prev) => (prev === id ? null : id)),
      [],
    );
    const value = useMemo(
      () => ({ selectedTeamId, tracedSlots, selectTeam }),
      [selectedTeamId, tracedSlots, selectTeam],
    );
    return <TeamPathContext.Provider value={value}>{children}</TeamPathContext.Provider>;
  }

  export function useTeamPath(): TeamPathValue {
    const ctx = useContext(TeamPathContext);
    if (!ctx) throw new Error("useTeamPath must be used within a TeamPathProvider");
    return ctx;
  }
  ```

- [ ] **Step 4: Create the ChampionPanel.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/ChampionPanel.tsx`:
  ```tsx
  "use client";

  import type { BracketSlotProb } from "@/lib/bracket";
  import { formatProb } from "@/lib/probability";
  import { ProbBar } from "@/components/predict/ProbBar";
  import { championLadder, mostLikely, prettifyId } from "@/lib/bracketView";
  import { useTeamPath } from "@/components/bracket/TeamPathProvider";

  // Single source of truth for the champion = the M104 winner distribution
  // (tree.champion), which equals teams.winCup.
  export function ChampionPanel({
    champion,
    name,
  }: {
    champion: BracketSlotProb[];
    name: (id: string) => string;
  }) {
    const { selectedTeamId, selectTeam } = useTeamPath();
    const top = mostLikely(champion);
    const ladder = championLadder(champion, 6);
    return (
      <section className="mx-auto mt-8 grid max-w-[1480px] gap-6 px-6 sm:px-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="border border-[var(--border-strong)] bg-[var(--paper-pure)] p-6">
          <p className="section-label">Projected champion</p>
          <p className="mt-2 font-heading text-[clamp(40px,7vw,92px)] font-black italic leading-[0.85] text-[var(--foreground)] misreg">
            {top ? name(top.id).toUpperCase() : "—"}
          </p>
          <p className="mt-3 text-[13px] tracking-[0.04em] text-[var(--foreground-secondary)]">
            {top ? `${formatProb(top.prob)} to lift the trophy` : "Awaiting the draw"}
          </p>
        </div>
        <div className="border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-4 py-2 text-[10px] tracking-[0.2em] text-[var(--foreground-secondary)]">
            TITLE ODDS
          </div>
          {ladder.map((e, i) => {
            const selected = e.id === selectedTeamId;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selected}
                onClick={() => selectTeam(e.id)}
                className={`flex w-full items-center gap-3 border-b border-[var(--border)] px-4 py-2 text-left last:border-b-0 ${
                  selected ? "bg-[var(--row-alt)]" : "hover:bg-[var(--row-alt)]"
                }`}
              >
                <span className="w-5 text-right text-xs text-[var(--foreground-secondary)]">{i + 1}</span>
                <span className="w-32 truncate font-heading text-[13px] font-semibold sm:w-40">
                  {name(e.id).toUpperCase()}
                </span>
                <span className="flex-1">
                  <ProbBar
                    value={e.prob / (ladder[0]?.prob || 1)}
                    color={selected ? "var(--foreground-accent)" : "var(--foreground)"}
                    label={`${name(e.id)}: ${formatProb(e.prob)} to win`}
                  />
                </span>
                <span className="w-12 text-right text-[13px] tabular-nums text-[var(--foreground)]">
                  {formatProb(e.prob)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  // prettifyId is intentionally imported for the fallback path used by callers
  // that pass a name() that may miss; keep tree-shake-safe re-export off.
  export { prettifyId };
  ```

- [ ] **Step 5: Rewrite BracketBoard to wire the provider, connectors, champion hero, dateline, and path-trace.**
  Replace the entire contents of `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx` with:
  ```tsx
  "use client";

  import { useMemo } from "react";
  import type { BracketTree, BracketMatch } from "@/lib/bracket";
  import type { PredTeam } from "@/lib/predictions";
  import {
    ROUND_ORDER,
    ROUND_LABELS,
    prettifyId,
    computeLayout,
    slotState,
  } from "@/lib/bracketView";
  import { BracketSlot } from "@/components/bracket/BracketSlot";
  import { ChampionPanel } from "@/components/bracket/ChampionPanel";
  import { TeamPathProvider, useTeamPath } from "@/components/bracket/TeamPathProvider";

  // Desktop canvas geometry (deterministic from computeLayout).
  const ROW_H = 76;
  const COL_W = 256;
  const SLOT_W = 220;
  const SLOT_H = 60;

  export function BracketBoard({ tree, teams }: { tree: BracketTree; teams: PredTeam[] }) {
    const nameById = useMemo(() => new Map(teams.map((t) => [t.id, t.name] as const)), [teams]);
    const stdErrByTeam = useMemo(() => new Map(teams.map((t) => [t.id, t.mcStdErr] as const)), [teams]);
    const name = (id: string) => nameById.get(id) ?? prettifyId(id);

    return (
      <TeamPathProvider tree={tree}>
        <div className="pb-16">
          <BoardHeader generatedAt={tree.generatedAt} />
          <ChampionPanel champion={tree.champion} name={name} />
          <DesktopBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
          <MobileBoard tree={tree} name={name} stdErrByTeam={stdErrByTeam} />
        </div>
      </TeamPathProvider>
    );
  }

  function BoardHeader({ generatedAt }: { generatedAt: string }) {
    const asOf = (() => {
      const d = new Date(generatedAt);
      return Number.isFinite(d.getTime()) ? d.toUTCString() : "unknown";
    })();
    return (
      <header className="overflow-hidden px-6 pt-8 sm:px-12">
        <h1 className="headline-bleed text-[clamp(64px,12vw,168px)] text-[var(--foreground)]">THE DRAW</h1>
        <p className="mt-4 text-[10px] tracking-[3px] text-[var(--foreground-secondary)]">
          AS OF {asOf} · MONTE-CARLO PROJECTION
        </p>
        <p className="mt-2 max-w-prose text-[12px] leading-[1.8] text-[var(--foreground-faint)]">
          Every figure is a simulated frequency, not a certainty — sides and
          advance odds carry Monte-Carlo error. Tap a team to trace its road.
        </p>
      </header>
    );
  }

  /* ── Desktop: absolute canvas + SVG connectors + path-trace ── */
  function DesktopBoard({
    tree,
    name,
    stdErrByTeam,
  }: {
    tree: BracketTree;
    name: (id: string) => string;
    stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
  }) {
    const { tracedSlots, selectedTeamId, selectTeam } = useTeamPath();
    const layout = useMemo(() => computeLayout(tree), [tree]);
    const pos = useMemo(() => new Map(layout.map((n) => [n.slot, n])), [layout]);

    const rows = Math.max(1, ...layout.filter((n) => n.col === 0).map((n) => n.row + 1));
    const height = rows * ROW_H;
    const width = (ROUND_ORDER.length - 1) * COL_W + SLOT_W;

    const cy = (row: number) => row * ROW_H + ROW_H / 2;
    const leftX = (col: number) => col * COL_W;
    const rightX = (col: number) => col * COL_W + SLOT_W;

    return (
      <div className="hidden overflow-x-auto px-6 pt-10 sm:px-12 lg:block">
        <div className="relative mx-auto" style={{ width, height }}>
          {/* connector elbows */}
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
            {layout.flatMap((n) =>
              !n.feeders
                ? []
                : n.feeders.map((f) => {
                    const fn = pos.get(f);
                    if (!fn) return null;
                    const x1 = rightX(fn.col);
                    const y1 = cy(fn.row);
                    const x2 = leftX(n.col);
                    const y2 = cy(n.row);
                    const midX = (x1 + x2) / 2;
                    const active = !!tracedSlots && tracedSlots.has(n.slot) && tracedSlots.has(f);
                    return (
                      <path
                        key={`${f}->${n.slot}`}
                        d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                        fill="none"
                        stroke={active ? "var(--foreground-accent)" : "var(--border)"}
                        strokeWidth={active ? 2 : 1}
                      />
                    );
                  }),
            )}
          </svg>
          {/* round labels */}
          {ROUND_ORDER.map((round, col) => (
            <div
              key={round}
              className="absolute top-0 -translate-y-7"
              style={{ left: leftX(col), width: SLOT_W }}
            >
              <RoundHeading round={round} />
            </div>
          ))}
          {/* slots */}
          {layout.map((n) => {
            const match = tree.bySlot[n.slot];
            return (
              <div
                key={n.slot}
                className="absolute"
                style={{
                  left: leftX(n.col),
                  top: n.row * ROW_H + (ROW_H - SLOT_H) / 2,
                  width: SLOT_W,
                }}
              >
                <BracketSlot
                  match={match}
                  name={name}
                  stdErrByTeam={stdErrByTeam}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={selectTeam}
                  state={slotState(n.slot, tracedSlots)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Mobile: stacked rounds (round selector added in UV4) ── */
  function MobileBoard({
    tree,
    name,
    stdErrByTeam,
  }: {
    tree: BracketTree;
    name: (id: string) => string;
    stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
  }) {
    const { tracedSlots, selectedTeamId, selectTeam } = useTeamPath();
    return (
      <div className="px-6 pt-8 lg:hidden">
        {ROUND_ORDER.map((round) => (
          <section key={round} className="mb-8">
            <RoundHeading round={round} />
            <div className="mt-3 flex flex-col gap-3">
              {tree.rounds[round].map((m) => (
                <BracketSlot
                  key={m.slot}
                  match={m}
                  name={name}
                  stdErrByTeam={stdErrByTeam}
                  selectedTeamId={selectedTeamId}
                  onSelectTeam={selectTeam}
                  state={slotState(m.slot, tracedSlots)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  function RoundHeading({ round }: { round: BracketMatch["round"] }) {
    return (
      <div className="section-rule-light flex items-baseline justify-between pb-1 pt-2">
        <span className="section-label">{ROUND_LABELS[round]}</span>
        <span className="text-[9px] tracking-[0.2em] text-[var(--foreground-faint)]">{round}</span>
      </div>
    );
  }
  ```
  Typecheck + lint + build:
  ```
  npx tsc --noEmit && npm run lint && npm run build
  ```
  Expected: exit 0; `/bracket` builds; no console-only warnings that fail the build.

- [ ] **Step 6: Commit.**
  ```
  git add lib/bracketView.ts lib/bracketView.test.ts components/bracket/TeamPathProvider.tsx components/bracket/ChampionPanel.tsx components/bracket/BracketBoard.tsx
  git commit -m "$(printf 'feat(bracket): path-trace, SVG connectors, ChampionPanel, dateline\n\nTeamPathProvider (context) drives tracePath highlighting: selecting a team\nlights its slots + connector elbows vermilion and dims the rest. Desktop\nuses an absolute canvas positioned by computeLayout (parent row = mean of\nfeeder rows) with deterministic SVG connectors. ChampionPanel renders the\nM104 winner distribution (single source of truth) + a title-odds ladder.\nHeader shows the AS OF dateline + an honest uncertainty note.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

**Deliverable:** the full tree renders with connector lines; clicking/keyboard-selecting any team (in a slot or the title ladder) lights its road through the bracket and dims everything else; ChampionPanel + dateline + uncertainty note present; layout helpers unit-tested; build/lint/typecheck green.

---

### Task 12 · [UV4]: Mobile round selector / scroll-snap + reduced-motion + keyboard a11y

**Files**
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts` (append `clampRoundIndex`)
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts` (append `clampRoundIndex` tests)
- Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/RoundSelector.tsx` (`"use client"`)
- Modify `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx` — replace `MobileBoard` (the UV3 stacked version) with a round-selector + horizontal scroll-snap board; add a keyboard hint + reduced-motion-safe transitions on the desktop canvas

**Interfaces**
- **Consumes**: `ROUND_ORDER`, `ROUND_LABELS`, `slotState`; `useTeamPath`; `BracketSlot`.
- **Produces**: `clampRoundIndex(i: number): number` (bounds a round index into `[0, ROUND_ORDER.length-1]`); component `RoundSelector({ index, onChange })`.

- [ ] **Step 1: Write the failing test for `clampRoundIndex`.**
  Append to `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.test.ts`:
  ```ts
  import { clampRoundIndex } from "@/lib/bracketView";

  describe("clampRoundIndex", () => {
    it("keeps a valid index unchanged", () => {
      expect(clampRoundIndex(0)).toBe(0);
      expect(clampRoundIndex(4)).toBe(4);
    });
    it("clamps out-of-range and non-finite indices", () => {
      expect(clampRoundIndex(-1)).toBe(0);
      expect(clampRoundIndex(99)).toBe(4);
      expect(clampRoundIndex(NaN)).toBe(0);
    });
  });
  ```
  Run:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected FAIL: `clampRoundIndex is not a function`.

- [ ] **Step 2: Implement `clampRoundIndex`.**
  Append to `/Users/ajaiupadhyaya/Documents/worldcup/lib/bracketView.ts`:
  ```ts
  /** Bound a round index (e.g. from a mobile selector) into ROUND_ORDER range. */
  export function clampRoundIndex(i: number): number {
    if (!Number.isFinite(i)) return 0;
    return Math.max(0, Math.min(ROUND_ORDER.length - 1, Math.round(i)));
  }
  ```
  Run:
  ```
  npx vitest run lib/bracketView.test.ts
  ```
  Expected PASS: `Tests 13 passed`.

- [ ] **Step 3: Create the RoundSelector.**
  Create `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/RoundSelector.tsx`:
  ```tsx
  "use client";

  import { ROUND_ORDER, ROUND_LABELS } from "@/lib/bracketView";

  export function RoundSelector({
    index,
    onChange,
  }: {
    index: number;
    onChange: (i: number) => void;
  }) {
    return (
      <div
        role="tablist"
        aria-label="Knockout round"
        className="sticky top-[60px] z-10 -mx-6 flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-2 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ROUND_ORDER.map((round, i) => {
          const active = i === index;
          return (
            <button
              key={round}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(i)}
              className={`shrink-0 px-3 py-1 text-[10px] tracking-[0.2em] transition-colors ${
                active
                  ? "bg-[var(--foreground)] text-[var(--foreground-inverse)]"
                  : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              {ROUND_LABELS[round].toUpperCase()}
            </button>
          );
        })}
      </div>
    );
  }
  ```

- [ ] **Step 4: Replace MobileBoard with a round-selector + scroll-snap board, and add a keyboard hint.**
  In `/Users/ajaiupadhyaya/Documents/worldcup/components/bracket/BracketBoard.tsx`:
  Add imports (extend the existing `@/lib/bracketView` import to include `clampRoundIndex`, add `useEffect, useRef, useState` to the React import, and import `RoundSelector`):
  ```tsx
  import { useEffect, useMemo, useRef, useState } from "react";
  import { RoundSelector } from "@/components/bracket/RoundSelector";
  ```
  and add `clampRoundIndex` to the existing `from "@/lib/bracketView"` import list.

  Replace the entire `MobileBoard` function (the UV3 stacked version) with:
  ```tsx
  /* ── Mobile: one round per screen, horizontal scroll-snap + tab selector ── */
  function MobileBoard({
    tree,
    name,
    stdErrByTeam,
  }: {
    tree: BracketTree;
    name: (id: string) => string;
    stdErrByTeam: Map<string, PredTeam["mcStdErr"]>;
  }) {
    const { tracedSlots, selectedTeamId, selectTeam } = useTeamPath();
    const [index, setIndex] = useState(0);
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    // Drive the scroller from the tab selection.
    const goTo = (i: number) => {
      const next = clampRoundIndex(i);
      setIndex(next);
      const el = scrollerRef.current;
      const page = el?.children[next] as HTMLElement | undefined;
      page?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    };

    // Keep the selector in sync when the user swipes the scroller.
    useEffect(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const onScroll = () => {
        const i = clampRoundIndex(Math.round(el.scrollLeft / el.clientWidth));
        setIndex((prev) => (prev === i ? prev : i));
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }, []);

    return (
      <div className="px-6 pt-6 lg:hidden">
        <RoundSelector index={index} onChange={goTo} />
        <div
          ref={scrollerRef}
          className="mt-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ROUND_ORDER.map((round) => (
            <section
              key={round}
              className="w-full shrink-0 snap-start pr-2"
              aria-label={ROUND_LABELS[round]}
            >
              <RoundHeading round={round} />
              <div className="mt-3 flex flex-col gap-3">
                {tree.rounds[round].map((m) => (
                  <BracketSlot
                    key={m.slot}
                    match={m}
                    name={name}
                    stdErrByTeam={stdErrByTeam}
                    selectedTeamId={selectedTeamId}
                    onSelectTeam={selectTeam}
                    state={slotState(m.slot, tracedSlots)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {selectedTeamId && (
          <button
            type="button"
            onClick={() => selectTeam(selectedTeamId)}
            className="mt-4 w-full border border-[var(--foreground-accent)] px-3 py-2 text-[11px] tracking-[0.2em] text-[var(--foreground-accent)]"
          >
            CLEAR {name(selectedTeamId).toUpperCase()}&apos;S ROAD
          </button>
        )}
      </div>
    );
  }
  ```
  In `BoardHeader`, append a keyboard hint line after the uncertainty note paragraph:
  ```tsx
        <p className="mt-1 text-[11px] tracking-[0.04em] text-[var(--foreground-faint)]">
          Keyboard: Tab to a team, Enter to trace, Enter again to clear.
        </p>
  ```
  In `DesktopBoard`, make the connector + slot transitions reduced-motion-safe by adding `motion-reduce:transition-none` where transitions are used — update the `<path>` to include a class and the slot wrapper accordingly. Change the `<path … />` opening to add `className="motion-reduce:transition-none"` and confirm `BracketSlot`'s own `transition-opacity` already degrades via the global `prefers-reduced-motion` rules in `app/globals.css` (lines 211–215) plus add `motion-reduce:transition-none` to the slot card root in `BracketSlot` is unnecessary here — the highlight is a color/opacity swap, acceptable under reduced motion. (No code change required beyond the path className.)

  Typecheck + lint + build:
  ```
  npx tsc --noEmit && npm run lint && npm run build
  ```
  Expected: exit 0.

- [ ] **Step 5: Run the full unit suite and commit.**
  ```
  npm run test
  ```
  Expected: all `lib/**/*.test.ts` green, including `lib/bracketView.test.ts` (`Tests 13 passed`) and the pre-existing `lib/predictions.test.ts`.
  ```
  git add lib/bracketView.ts lib/bracketView.test.ts components/bracket/RoundSelector.tsx components/bracket/BracketBoard.tsx
  git commit -m "$(printf 'feat(bracket): mobile round selector, scroll-snap, a11y + reduced-motion\n\nMobile shows one round per screen (snap-x scroller) with a sticky tablist\nRoundSelector kept in sync on swipe; path-trace state persists across\nrounds and a clear-road control appears when a team is selected. Adds a\nkeyboard hint, reduced-motion-safe connector transitions, and clampRoundIndex\n(unit-tested).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
  ```

**Deliverable:** on mobile the bracket is one-round-per-screen with a tab selector and swipe sync, path-trace preserved across rounds with a clear control; keyboard-operable selection with a visible hint; reduced-motion honored. `npm run test`, `npm run build`, `npm run lint`, `npx tsc --noEmit` all green.

---

I have everything I need. Here are the G-track task blocks.

---

### Task 13 · [G1]: Bracket OG share card (`/api/og/bracket`) + tested champion-ladder helper

Builds the 1200×630 share image for THE DRAW — projected champion + top‑4 `winCup` ladder in the editorial palette. The pure data-selection logic lands in `lib/og.ts` so it is covered by the existing vitest config (`vitest.config.ts` → `include: ["lib/**/*.test.ts"]`, `environment: "node"`), and the route mirrors `app/api/og/match/[id]/route.tsx` (`import { ImageResponse } from "next/og"` line 1; `export const dynamic = "force-dynamic"` line 6; `return new ImageResponse(<jsx>, { width: W, height: H })` lines 64/173). satori cannot read the CSS `@import` Bodoni Moda (`app/globals.css:2`), so static `.ttf`s are shipped in `/public` and loaded with `readFile(join(process.cwd(), …))` per the verified fork doc (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md:163‑204`); the satori `FontOptions.data` type is `Buffer | ArrayBuffer` (`node_modules/next/dist/compiled/@vercel/og/satori/index.d.ts:28`), so the `readFile` Buffer is passed directly.

**Files**
- Create `public/fonts/BodoniModa-Regular.ttf`, `public/fonts/BodoniModa-Bold.ttf`, `public/fonts/OFL.txt` (committed font assets + OFL license).
- Create `lib/og.ts` (pure helper).
- Create `lib/og.test.ts` (helper test).
- Create `app/api/og/bracket/route.tsx` (the `ImageResponse` route).

**Interfaces**
- Consumes: `predictions` from `@/lib/predictions` — `predictions.teams: PredTeam[]` (uses `.id`, `.name`, `.winCup`; `PredTeam` defined `lib/predictions.ts:10‑21`), `predictions.generatedAt`, `predictions.simCount`; `formatProb` re-exported from `@/lib/predictions` (`lib/predictions.ts:4`).
- Produces:
  - `bracketOgData(teams: PredTeam[], n?: number): { champion: OgLadderRow | null; ladder: OgLadderRow[] }` where `interface OgLadderRow { id: string; name: string; prob: number }`. Champion is the single source of truth `winCup` distribution (== M104 winner); ladder is the `n` (default 4) highest `winCup` teams, desc.
  - `GET(): Promise<ImageResponse>` at `/api/og/bracket` → 1200×630 PNG.
- Cross-track note (no code here): the Track W `app/bracket/page.tsx` `generateMetadata` must point `openGraph.images` / `twitter.images` at `/api/og/bracket` (mirrors `app/match/[id]/page.tsx:20‑25`). Web imports only `@/lib/predictions` (→ `data/predictions/latest.json`), never `model/data/bracket_2026.json`.

Steps:

- [ ] **Step 1: Acquire static Bodoni Moda weights into `/public`.** Google Fonts only ships a variable `BodoniModa[opsz,wght].ttf`; satori is most reliable with static instances, so instantiate two weights with `fonttools` run ephemerally via `uvx` (no project/model dependency is added — it is a one-time asset build). Run:

  ```bash
  mkdir -p public/fonts
  curl -sL "https://github.com/google/fonts/raw/main/ofl/bodonimoda/BodoniModa%5Bopsz%2Cwght%5D.ttf" -o /tmp/BodoniModa-var.ttf
  curl -sL "https://github.com/google/fonts/raw/main/ofl/bodonimoda/OFL.txt" -o public/fonts/OFL.txt
  uvx fonttools varLib.instancer /tmp/BodoniModa-var.ttf wght=400 opsz=72 -o public/fonts/BodoniModa-Regular.ttf
  uvx fonttools varLib.instancer /tmp/BodoniModa-var.ttf wght=700 opsz=72 -o public/fonts/BodoniModa-Bold.ttf
  file public/fonts/BodoniModa-*.ttf && ls -la public/fonts
  ```

  Expected output (each instancer call ends with a save line; `file` confirms valid TrueType; each `.ttf` is well under satori's 500 KB budget):

  ```
  Saving font to 'public/fonts/BodoniModa-Regular.ttf'
  Saving font to 'public/fonts/BodoniModa-Bold.ttf'
  public/fonts/BodoniModa-Bold.ttf:    TrueType Font data, ...
  public/fonts/BodoniModa-Regular.ttf: TrueType Font data, ...
  -rw-r--r--  ... BodoniModa-Bold.ttf
  -rw-r--r--  ... BodoniModa-Regular.ttf
  -rw-r--r--  ... OFL.txt
  ```

  Confirm `public/` is not git-ignored (`git check-ignore public/fonts/BodoniModa-Bold.ttf` prints nothing).

- [ ] **Step 2: Write the failing helper test.** Create `lib/og.test.ts`:

  ```ts
  import { describe, it, expect } from "vitest";
  import { bracketOgData } from "./og";
  import type { PredTeam } from "./predictions";

  function team(id: string, winCup: number): PredTeam {
    return {
      id,
      name: id.toUpperCase(),
      qualify: 0,
      reachR32: 0,
      reachR16: 0,
      reachQF: 0,
      reachSF: 0,
      reachFinal: 0,
      winCup,
      mcStdErr: {
        qualify: 0,
        reachR32: 0,
        reachR16: 0,
        reachQF: 0,
        reachSF: 0,
        reachFinal: 0,
        winCup: 0,
      },
    };
  }

  describe("bracketOgData", () => {
    it("ranks the champion + top-4 ladder by winCup desc", () => {
      const teams = [
        team("a", 0.05),
        team("b", 0.22),
        team("c", 0.18),
        team("d", 0.01),
        team("e", 0.3),
      ];
      const { champion, ladder } = bracketOgData(teams);
      expect(champion?.id).toBe("e");
      expect(ladder.map((r) => r.id)).toEqual(["e", "b", "c", "a"]);
      expect(ladder).toHaveLength(4);
      expect(champion).toEqual(ladder[0]);
    });

    it("returns a null champion for an empty field", () => {
      const { champion, ladder } = bracketOgData([]);
      expect(champion).toBeNull();
      expect(ladder).toEqual([]);
    });

    it("respects an explicit ladder length", () => {
      const teams = [team("a", 0.1), team("b", 0.2), team("c", 0.3)];
      expect(bracketOgData(teams, 2).ladder.map((r) => r.id)).toEqual(["c", "b"]);
    });
  });
  ```

  Run `npx vitest run lib/og.test.ts`. Expected FAIL — the module does not exist yet:

  ```
  Error: Failed to resolve import "./og" from "lib/og.test.ts".
  ```

- [ ] **Step 3: Implement the helper.** Create `lib/og.ts`:

  ```ts
  import type { PredTeam } from "./predictions";

  export interface OgLadderRow {
    id: string;
    name: string;
    prob: number;
  }

  export interface BracketOgData {
    champion: OgLadderRow | null;
    ladder: OgLadderRow[];
  }

  /**
   * Champion + title-odds ladder for the /bracket OG card. The champion is the
   * single source of truth winCup distribution (== the M104 winner), so the
   * ladder is simply the highest-winCup teams in descending order.
   */
  export function bracketOgData(teams: PredTeam[], n = 4): BracketOgData {
    const ladder: OgLadderRow[] = [...teams]
      .sort((a, b) => b.winCup - a.winCup)
      .slice(0, n)
      .map((t) => ({ id: t.id, name: t.name, prob: t.winCup }));
    return { champion: ladder[0] ?? null, ladder };
  }
  ```

  Run `npx vitest run lib/og.test.ts`. Expected PASS:

  ```
  ✓ lib/og.test.ts (3 tests)
  Test Files  1 passed (1)
       Tests  3 passed (3)
  ```

- [ ] **Step 4: Create the OG route.** Create `app/api/og/bracket/route.tsx`:

  ```tsx
  import { ImageResponse } from "next/og";
  import { readFile } from "node:fs/promises";
  import { join } from "node:path";
  import { predictions, formatProb } from "@/lib/predictions";
  import { bracketOgData } from "@/lib/og";

  export const dynamic = "force-dynamic";

  // 1200x630 share card for THE DRAW: the projected champion + the top-4
  // title-odds ladder, in the editorial palette. The champion is the single
  // source of truth winCup distribution (== the M104 winner). satori cannot read
  // the CSS @import font, so static Bodoni Moda .ttf weights are shipped in
  // /public and loaded here via readFile(join(process.cwd(), ...)).

  const W = 1200;
  const H = 630;
  const PAPER = "#f4f3f0";
  const INK = "#131318";
  const MUTED = "#6b6b73";
  const VERMILION = "#ed3419";

  export async function GET() {
    const [bodoni, bodoniBold] = await Promise.all([
      readFile(join(process.cwd(), "public/fonts/BodoniModa-Regular.ttf")),
      readFile(join(process.cwd(), "public/fonts/BodoniModa-Bold.ttf")),
    ]);

    const { champion, ladder } = bracketOgData(predictions.teams);
    const lead = champion?.prob || 1;

    const generated = new Date(predictions.generatedAt);
    const asOf = Number.isFinite(generated.getTime())
      ? generated
          .toLocaleDateString("en-GB", {
            timeZone: "UTC",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          .toUpperCase()
      : "—";

    return new ImageResponse(
      (
        <div
          style={{
            width: W,
            height: H,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
            background: PAPER,
            color: INK,
            fontFamily: "Bodoni Moda",
          }}
        >
          {/* Masthead */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", height: 3, width: "100%", background: VERMILION }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 18,
              }}
            >
              <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, fontWeight: 700 }}>
                FIFA WORLD CUP 26
              </div>
              <div style={{ display: "flex", fontSize: 18, letterSpacing: 6, color: MUTED }}>
                THE DRAW · KNOCKOUT FORECAST
              </div>
            </div>
          </div>

          {/* Projected champion */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 6, color: MUTED, fontWeight: 700 }}>
              PROJECTED CHAMPION
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 28, marginTop: 6 }}>
              <div style={{ display: "flex", fontSize: 124, lineHeight: 1, fontWeight: 700, color: VERMILION }}>
                {champion ? champion.name.toUpperCase() : "TO BE DECIDED"}
              </div>
              {champion ? (
                <div style={{ display: "flex", fontSize: 56, fontWeight: 700, color: INK }}>
                  {formatProb(champion.prob)}
                </div>
              ) : null}
            </div>
          </div>

          {/* Title-odds ladder */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ladder.map((row, i) => (
              <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div
                  style={{
                    display: "flex",
                    width: 40,
                    fontSize: 26,
                    fontWeight: 700,
                    color: i === 0 ? VERMILION : "#9a9aa2",
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: "flex", width: 360, fontSize: 34, fontWeight: i === 0 ? 700 : 400 }}>
                  {row.name}
                </div>
                <div style={{ display: "flex", flex: 1, height: 16, background: "rgba(19,19,24,0.08)" }}>
                  <div
                    style={{
                      display: "flex",
                      width: `${Math.max(4, (row.prob / lead) * 100)}%`,
                      background: i === 0 ? VERMILION : INK,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 92,
                    justifyContent: "flex-end",
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                >
                  {formatProb(row.prob)}
                </div>
              </div>
            ))}
          </div>

          {/* Dateline */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: 16,
              letterSpacing: 4,
              color: MUTED,
            }}
          >
            <div style={{ display: "flex" }}>
              DIXON-COLES · ELO · MONTE-CARLO · {predictions.simCount.toLocaleString()} SIMS
            </div>
            <div style={{ display: "flex" }}>AS OF {asOf}</div>
          </div>
        </div>
      ),
      {
        width: W,
        height: H,
        fonts: [
          { name: "Bodoni Moda", data: bodoni, weight: 400, style: "normal" },
          { name: "Bodoni Moda", data: bodoniBold, weight: 700, style: "normal" },
        ],
      },
    );
  }
  ```

- [ ] **Step 5: Verify types + render the real PNG.** Run:

  ```bash
  npx tsc --noEmit
  ```

  Expected: no output (clean exit 0). Then render the route from the dev server:

  ```bash
  npm run dev >/tmp/wc-dev.log 2>&1 &
  until grep -q "Ready\|started server\|Local:" /tmp/wc-dev.log; do sleep 1; done
  curl -s http://localhost:3000/api/og/bracket -o /tmp/bracket-og.png
  file /tmp/bracket-og.png
  kill %1
  ```

  Expected output:

  ```
  /tmp/bracket-og.png: PNG image data, 1200 x 630, 8-bit/color RGBA, non-interlaced
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add public/fonts lib/og.ts lib/og.test.ts app/api/og/bracket/route.tsx
  git commit -m "feat(og): bracket share card + tested champion-ladder helper"
  ```

---

### Task 14 · [G2]: Repoint `/predict` "The Bracket" section to `/bracket`

`/predict` currently renders `SurvivalFunnel` as its only "The Bracket" content (`app/predict/page.tsx:53‑55`). Keep the funnel as an inline teaser and append an editorial "VIEW THE FULL DRAW →" link to the new route. `app/predict/page.tsx` is a Server Component (no `"use client"`), so `next/link` is added at the top alongside the existing imports (`app/predict/page.tsx:1‑7`).

**Files**
- Modify `app/predict/page.tsx` (add import near line 1; replace the "The Bracket" `Section` body at lines 53‑55).

**Interfaces**
- Consumes: `Link` from `next/link`; existing `SurvivalFunnel` (`app/predict/page.tsx:4`). Produces: a same-tab navigation to `/bracket`. No exported-API change.

Steps:

- [ ] **Step 1: Establish the failing check.** The link must not exist yet. Run:

  ```bash
  grep -n 'href="/bracket"' app/predict/page.tsx; echo "exit=$?"
  ```

  Expected FAIL (absent → grep exit 1):

  ```
  exit=1
  ```

- [ ] **Step 2: Add the `next/link` import.** In `app/predict/page.tsx`, replace:

  ```tsx
  import type { ReactNode } from "react";
  import { predictions, ratings, calibration } from "@/lib/predictions";
  ```

  with:

  ```tsx
  import type { ReactNode } from "react";
  import Link from "next/link";
  import { predictions, ratings, calibration } from "@/lib/predictions";
  ```

- [ ] **Step 3: Append the teaser link.** Replace the "The Bracket" section body:

  ```tsx
      <Section kicker="probability of reaching each round" title="The Bracket">
        <SurvivalFunnel teams={p.teams} />
      </Section>
  ```

  with:

  ```tsx
      <Section kicker="probability of reaching each round" title="The Bracket">
        <SurvivalFunnel teams={p.teams} />
        <Link
          href="/bracket"
          className="mt-6 inline-flex items-center gap-2 text-[11px] tracking-[3px] text-[var(--foreground-accent)] transition-opacity hover:opacity-70"
        >
          VIEW THE FULL DRAW
          <span aria-hidden>→</span>
        </Link>
      </Section>
  ```

- [ ] **Step 4: Verify.** Run:

  ```bash
  grep -n 'href="/bracket"' app/predict/page.tsx; echo "exit=$?"
  npx tsc --noEmit
  ```

  Expected PASS — the link is present and types are clean:

  ```
  53:        <Link
  exit=0
  ```

  (`tsc --noEmit` prints nothing, exit 0.)

- [ ] **Step 5: Commit.**

  ```bash
  git add app/predict/page.tsx
  git commit -m "feat(predict): link The Bracket teaser to the full /bracket draw"
  ```

---

### Task 15 · [G3]: Add THE DRAW to `SiteNav` + `/bracket` to the sitemap

The global nav `LINKS` array (`components/SiteNav.tsx:6‑12`) and the sitemap path list (`app/sitemap.ts:9`) both omit `/bracket`. Add it to both. THE DRAW sits next to the forecast entry in the nav order.

**Files**
- Modify `components/SiteNav.tsx` (the `LINKS` array, lines 6‑12).
- Modify `app/sitemap.ts` (the path array, line 9).

**Interfaces**
- Consumes/Produces: declarative route registration only. `app/sitemap.ts` returns `MetadataRoute.Sitemap`; the new entry inherits the existing `changeFrequency: "daily"`, `priority: 0.8` mapping (anything other than `""`).

Steps:

- [ ] **Step 1: Establish the failing checks.** Run:

  ```bash
  grep -c "THE DRAW" components/SiteNav.tsx; grep -c "/bracket" app/sitemap.ts
  ```

  Expected FAIL (both absent → both print `0`):

  ```
  0
  0
  ```

- [ ] **Step 2: Add the nav entry.** In `components/SiteNav.tsx`, replace:

  ```tsx
  const LINKS = [
    { href: "/", label: "INDEX" },
    { href: "/#fixtures", label: "FIXTURES" },
    { href: "/standings", label: "TABLES" },
    { href: "/predict", label: "FORECAST" },
    { href: "/scenarios", label: "SCENARIOS" },
  ];
  ```

  with:

  ```tsx
  const LINKS = [
    { href: "/", label: "INDEX" },
    { href: "/#fixtures", label: "FIXTURES" },
    { href: "/standings", label: "TABLES" },
    { href: "/predict", label: "FORECAST" },
    { href: "/bracket", label: "THE DRAW" },
    { href: "/scenarios", label: "SCENARIOS" },
  ];
  ```

  (The existing `isActive` already handles `/bracket` via its `pathname.startsWith(href)` branch — `components/SiteNav.tsx:17`.)

- [ ] **Step 3: Add the sitemap path.** In `app/sitemap.ts`, replace:

  ```ts
    return ["", "/standings", "/predict", "/scenarios"].map((path) => ({
  ```

  with:

  ```ts
    return ["", "/standings", "/predict", "/bracket", "/scenarios"].map((path) => ({
  ```

- [ ] **Step 4: Verify.** Run:

  ```bash
  grep -c "THE DRAW" components/SiteNav.tsx; grep -c "/bracket" app/sitemap.ts
  npx tsc --noEmit
  ```

  Expected PASS — both print `1`, and `tsc` is clean (no output, exit 0):

  ```
  1
  1
  ```

- [ ] **Step 5: Commit.**

  ```bash
  git add components/SiteNav.tsx app/sitemap.ts
  git commit -m "feat(nav): add THE DRAW to site nav + sitemap"
  ```

---

### Task 16 · [G4]: Web-app CI gate (`.github/workflows/web.yml`)

No web CI exists today (only `.github/workflows/predict.yml`, the Python cron, which stays unchanged). Add a lint + typecheck + build gate on push/PR. The repo has `package-lock.json` (so `npm ci` and `actions/setup-node` npm caching work), an eslint flat config `eslint.config.mjs` (so `npm run lint` → bare `eslint` resolves config), and `tsconfig.json`. No secrets are needed: prediction data is committed JSON and the API/live routes are `force-dynamic` (e.g. `app/api/og/bracket/route.tsx`, `app/api/og/match/[id]/route.tsx:6`), so none are exercised at build.

**Files**
- Create `.github/workflows/web.yml`.

**Interfaces**
- Consumes: `package.json` scripts `lint` (`eslint`) and `build` (`next build`); `package-lock.json`. Produces: a `Web CI` GitHub Actions workflow running `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build`.

Steps:

- [ ] **Step 1: Prove the pipeline is green locally first.** The workflow only encodes commands that already pass. Run the exact gate locally:

  ```bash
  npm run lint
  npx tsc --noEmit
  npm run build
  ```

  Expected: lint reports no errors, `tsc --noEmit` prints nothing (exit 0), and `next build` ends with a successful "Compiled successfully" / route summary and exit 0. (Run this after G1–G3 so the new route/links are included.)

- [ ] **Step 2: Create the workflow.** Create `.github/workflows/web.yml`:

  ```yaml
  # .github/workflows/web.yml
  name: Web CI
  on:
    push:
    pull_request:
  permissions:
    contents: read
  concurrency:
    group: web-ci-${{ github.ref }}
    cancel-in-progress: true
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm
        - run: npm ci
        - run: npm run lint
        - run: npx tsc --noEmit
        - run: npm run build
  ```

- [ ] **Step 3: Verify the workflow is valid YAML with the required steps.** Run (pyyaml is pulled ephemerally; nothing is added to any project):

  ```bash
  uv run --no-project --with pyyaml python -c "import yaml; d=yaml.safe_load(open('.github/workflows/web.yml')); steps=[s.get('run','') for s in d['jobs']['build']['steps']]; assert 'npm ci' in steps and 'npm run lint' in steps and 'npx tsc --noEmit' in steps and 'npm run build' in steps, steps; print('web.yml valid:', steps)"
  ```

  Expected:

  ```
  web.yml valid: ['', '', 'npm ci', 'npm run lint', 'npx tsc --noEmit', 'npm run build']
  ```

- [ ] **Step 4: Commit.**

  ```bash
  git add .github/workflows/web.yml
  git commit -m "ci(web): add lint + typecheck + build gate on push/PR"
  ```

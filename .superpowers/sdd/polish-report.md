# Final-Review Polish Pass — Report

## Item 1: Dead local `best8_set` removed (`model/model/simulate.py`)

`best8_set = set(best8)` on line 127 was computed but never referenced again.
Removed the assignment; `best8` (the list) and all downstream uses are unchanged.

## Item 2: `seed` + `sims` included in `inputsHash` (`model/model/run.py`)

Previously the hash covered only `generated_at + len(history) + len(fixtures)`.
Two runs with different `--seed` or `--sims` but identical inputs would produce the
same hash, giving false cache hits.  Added both values to the hashed string:

```python
(a.generated_at + str(len(history)) + str(len(fixtures)) + str(a.seed) + str(a.sims))
```

## Item 3: Calibration leakage-audit clarity (`model/model/run.py`)

`_calibration_samples` already filtered history down to `in_window` (matches `<= as_of`),
then passed the raw `history` list to `fit_strengths(history, as_of=cutoff)`.
`fit_strengths` re-filters internally, so behavior was correct but the call was
misleading — it implied that post-`as_of` matches were being used.

Changed the call to `fit_strengths(in_window, as_of=cutoff)`: the already-filtered
list is passed, making the audit trail transparent.  Behavior is identical.

## Item 4a: Calibration test bin-population guard (`model/tests/test_backtest.py`)

Added:
```python
assert any(b["n"] > 0 for b in bins)  # at least one populated bin
```
An all-empty-bins result (e.g. from an empty sample list being silently tolerated)
could no longer pass.

## Item 4b: `normalize` edge-case tests (`model/tests/test_names.py`)

Added two new test functions:
- `test_normalize_none_returns_empty_string` — `normalize(None) == ""`
- `test_normalize_empty_string_returns_empty_string` — `normalize("") == ""`

Both are covered by the existing `(name or "").strip()` guard in `names.py`.

## Item 4c: Home-advantage path test (`model/tests/test_dixoncoles.py`)

Added `test_home_advantage_applied`:
- Fits on 60 balanced non-neutral matches (A vs B, B vs A, 1-1 each).
- Asserts `s.home_adv > 0.0` — the optimizer must recover a positive home factor.
- Asserts `expected_goals(s, "A", "B", neutral=False)[0] > expected_goals(s, "A", "B", neutral=True)[0]`
  — the home team's xG with the advantage applied exceeds its neutral-venue xG.

The test is deterministic (no randomness) and fast (~0.04 s).

## Full suite result

```
51 passed in 0.80s
```

All 51 tests pass (up from 47 before this pass — 4 new tests added).
Ruff: 16 pre-existing E702 violations in `groups.py` + 1 F401 in `test_predict.py`
(unchanged from the baseline; no new violations introduced).

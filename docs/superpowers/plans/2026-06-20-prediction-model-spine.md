# Prediction Model Spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline Python engine that turns historical + live World Cup data into win/qualify/win-the-cup probabilities and a backtest, written as git-versioned JSON snapshots, run on a schedule.

**Architecture:** A standalone `model/` uv package ingests a committed historical-results CSV plus live ESPN fixtures/results/odds, fits an Elo-seeded Dixon-Coles bivariate-Poisson strength model (time-decayed), simulates the remaining 2026 tournament by Monte-Carlo (seeded), backtests on history, and writes typed JSON snapshots to `data/`. A GitHub Actions cron runs it and commits changed snapshots, which triggers the existing Vercel deploy. This plan stops at producing validated snapshots; the Next.js surfaces that read them are separate follow-on plans.

**Tech Stack:** Python 3.12, uv, numpy, scipy (optimization), pytest. Standard-library `csv`/`json`/`urllib` for IO (no pandas/heavy deps). GitHub Actions for scheduling.

## Global Constraints

- Python **3.12**, managed with **uv** only (`uv run …`, `uv add …`, `uv sync`) — never bare `pip`/`python`.
- Dependencies limited to **numpy, scipy, pytest** (+ stdlib). No pandas, no network client libs (use `urllib.request`).
- All randomness goes through a **seeded `numpy.random.Generator`**; the seed is an explicit input and is recorded in every snapshot. No bare `np.random.*` or `random` module calls.
- ESPN endpoints need **no API key**; base `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world`.
- Historical dataset: `martj42/international_results` (`results.csv`, `shootouts.csv`), committed under `model/data/history/`.
- **2026 format:** 48 teams, 12 groups of 4, top-2 per group + **8 best third-placed** → Round of 32 → R16 → QF → SF → Final. FIFA tiebreaker order: points → goal difference → goals for → head-to-head (points, GD, GF among tied) → drawing of lots (seeded).
- Every snapshot records `modelVersion` (string constant `MODEL_VERSION`), `seed`, `generatedAt` (ISO, passed in — never `datetime.now()` inside pure functions), and an `inputsHash`.
- The package lives at repo path `model/`; snapshots are written to repo path `data/` (sibling of `model/`).
- Team names are normalized through a committed alias map before any cross-source join.

---

### Task 1: Scaffold the `model/` uv package

**Files:**
- Create: `model/pyproject.toml`
- Create: `model/model/__init__.py`
- Create: `model/model/version.py`
- Create: `model/tests/__init__.py`
- Create: `model/tests/test_smoke.py`
- Create: `model/README.md`
- Create: `model/.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `model.version.MODEL_VERSION: str`; an importable `model` package; a working `uv run pytest`.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_smoke.py
from model.version import MODEL_VERSION


def test_model_version_is_semver_string():
    parts = MODEL_VERSION.split(".")
    assert len(parts) == 3
    assert all(p.isdigit() for p in parts)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_smoke.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.version'`

- [ ] **Step 3: Write minimal implementation**

```toml
# model/pyproject.toml
[project]
name = "floodlit-model"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["numpy>=2.0", "scipy>=1.13"]

[dependency-groups]
dev = ["pytest>=8.0"]

[tool.uv]
package = false

[tool.pytest.ini_options]
pythonpath = ["."]
```

```python
# model/model/__init__.py
```

```python
# model/model/version.py
MODEL_VERSION = "0.1.0"
```

```python
# model/tests/__init__.py
```

```
# model/.gitignore
.venv/
__pycache__/
*.pyc
.pytest_cache/
```

```markdown
# Floodlit Prediction Model

Offline engine: ingest history + live ESPN → Elo-seeded Dixon-Coles ratings →
Monte-Carlo 2026 tournament sim → backtest → JSON snapshots in `../data/`.

Run: `uv run python -m model.run --seed 42 --sims 10000`
Test: `uv run pytest`
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv sync && uv run pytest tests/test_smoke.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/
git commit -m "feat(model): scaffold uv package + version"
```

---

### Task 2: Team-name normalization (alias map)

**Files:**
- Create: `model/data/team_aliases.json`
- Create: `model/model/names.py`
- Create: `model/tests/test_names.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `model.names.normalize(name: str) -> str` — maps a raw provider/dataset name to a canonical team name (the ESPN `displayName`); unknown names pass through `.strip()`ed.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_names.py
from model.names import normalize


def test_known_aliases_map_to_canonical():
    assert normalize("Korea Republic") == "South Korea"
    assert normalize("USA") == "United States"
    assert normalize("Türkiye") == "Turkey"


def test_unknown_name_passes_through_trimmed():
    assert normalize("  Brazil  ") == "Brazil"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_names.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.names'`

- [ ] **Step 3: Write minimal implementation**

```json
// model/data/team_aliases.json
{
  "Korea Republic": "South Korea",
  "Korea DPR": "North Korea",
  "USA": "United States",
  "Türkiye": "Turkey",
  "Czech Republic": "Czechia",
  "IR Iran": "Iran",
  "Cote d'Ivoire": "Ivory Coast",
  "Côte d'Ivoire": "Ivory Coast",
  "China PR": "China",
  "Bosnia and Herzegovina": "Bosnia-Herzegovina",
  "Curaçao": "Curacao"
}
```

```python
# model/model/names.py
import json
from functools import lru_cache
from pathlib import Path

_ALIASES_PATH = Path(__file__).resolve().parent.parent / "data" / "team_aliases.json"


@lru_cache(maxsize=1)
def _aliases() -> dict[str, str]:
    with _ALIASES_PATH.open() as f:
        return json.load(f)


def normalize(name: str) -> str:
    cleaned = (name or "").strip()
    return _aliases().get(cleaned, cleaned)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_names.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/data/team_aliases.json model/model/names.py model/tests/test_names.py
git commit -m "feat(model): team-name normalization map"
```

---

### Task 3: Historical results loader

**Files:**
- Create: `model/data/history/results.csv` (downloaded, committed)
- Create: `model/model/history.py`
- Create: `model/tests/test_history.py`
- Create: `model/tests/fixtures/results_small.csv`

**Interfaces:**
- Consumes: `model.names.normalize`.
- Produces: `model.history.Match` (dataclass: `date: datetime.date`, `home: str`, `away: str`, `home_goals: int`, `away_goals: int`, `neutral: bool`, `tournament: str`); `model.history.load_results(path: Path) -> list[Match]` — normalized, name-cleaned, sorted by date ascending.

- [ ] **Step 1: Download + commit the dataset**

Run:
```bash
mkdir -p model/data/history
curl -fsSL https://raw.githubusercontent.com/martj42/international_results/master/results.csv -o model/data/history/results.csv
wc -l model/data/history/results.csv   # expect ~45000+
```

- [ ] **Step 2: Write the failing test**

```python
# model/tests/fixtures/results_small.csv
date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
2018-06-14,Russia,Saudi Arabia,5,0,FIFA World Cup,Moscow,Russia,FALSE
2022-12-18,Argentina,France,3,3,FIFA World Cup,Lusail,Qatar,TRUE
2021-06-11,Korea Republic,USA,1,2,Friendly,Seoul,South Korea,FALSE
```

```python
# model/tests/test_history.py
from datetime import date
from pathlib import Path

from model.history import load_results

FIX = Path(__file__).parent / "fixtures" / "results_small.csv"


def test_load_parses_and_normalizes():
    rows = load_results(FIX)
    assert len(rows) == 3
    assert rows[0].date == date(2018, 6, 14)          # sorted ascending
    assert rows[2].home == "South Korea"              # alias normalized
    assert rows[2].away == "United States"
    assert rows[1].neutral is True                    # "TRUE" -> bool
    assert rows[0].home_goals == 5 and rows[0].away_goals == 0
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_history.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.history'`

- [ ] **Step 4: Write minimal implementation**

```python
# model/model/history.py
import csv
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from model.names import normalize


@dataclass(frozen=True)
class Match:
    date: date
    home: str
    away: str
    home_goals: int
    away_goals: int
    neutral: bool
    tournament: str


def _to_bool(s: str) -> bool:
    return str(s).strip().lower() in ("true", "1", "yes")


def load_results(path: Path) -> list[Match]:
    out: list[Match] = []
    with Path(path).open(newline="") as f:
        for r in csv.DictReader(f):
            try:
                d = datetime.strptime(r["date"], "%Y-%m-%d").date()
                hg, ag = int(r["home_score"]), int(r["away_score"])
            except (ValueError, KeyError):
                continue  # skip unscored / malformed rows
            out.append(
                Match(
                    date=d,
                    home=normalize(r["home_team"]),
                    away=normalize(r["away_team"]),
                    home_goals=hg,
                    away_goals=ag,
                    neutral=_to_bool(r.get("neutral", "FALSE")),
                    tournament=r.get("tournament", ""),
                )
            )
    out.sort(key=lambda m: m.date)
    return out
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_history.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add model/data/history/results.csv model/model/history.py model/tests/test_history.py model/tests/fixtures/results_small.csv
git commit -m "feat(model): historical results loader + committed dataset"
```

---

### Task 4: ESPN client (fixtures, results, rounds, odds)

**Files:**
- Create: `model/model/espn.py`
- Create: `model/tests/test_espn.py`
- Create: `model/tests/fixtures/espn_scoreboard.json` (saved real sample, trimmed to 2 events)

**Interfaces:**
- Consumes: `model.names.normalize`.
- Produces: `model.espn.Fixture` (dataclass: `id: str`, `home: str`, `away: str`, `kickoff: str` ISO, `round: str`, `status: str` in {scheduled,live,finished}, `home_goals: int|None`, `away_goals: int|None`, `neutral: bool`); `parse_scoreboard(data: dict) -> list[Fixture]`; `fetch_fixtures(date_range: str = "20260611-20260719") -> list[Fixture]` (network).

- [ ] **Step 1: Save a real sample fixture**

Run:
```bash
mkdir -p model/tests/fixtures
curl -fsSL "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); d['events']=d['events'][:2]; print(json.dumps(d))" \
  > model/tests/fixtures/espn_scoreboard.json
```

- [ ] **Step 2: Write the failing test**

```python
# model/tests/test_espn.py
import json
from pathlib import Path

from model.espn import parse_scoreboard

FIX = Path(__file__).parent / "fixtures" / "espn_scoreboard.json"


def test_parse_scoreboard_yields_fixtures():
    data = json.loads(FIX.read_text())
    fx = parse_scoreboard(data)
    assert len(fx) == 2
    f = fx[0]
    assert f.id and isinstance(f.id, str)
    assert f.home and f.away
    assert f.status in ("scheduled", "live", "finished")
    assert f.round  # e.g. "group-stage"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_espn.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.espn'`

- [ ] **Step 4: Write minimal implementation**

```python
# model/model/espn.py
import json
import urllib.request
from dataclasses import dataclass

from model.names import normalize

BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"


@dataclass(frozen=True)
class Fixture:
    id: str
    home: str
    away: str
    kickoff: str
    round: str
    status: str
    home_goals: int | None
    away_goals: int | None
    neutral: bool


def _status(state: str | None, completed: bool | None) -> str:
    if completed or state == "post":
        return "finished"
    if state == "in":
        return "live"
    return "scheduled"


def _int_or_none(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def parse_scoreboard(data: dict) -> list[Fixture]:
    out: list[Fixture] = []
    for e in data.get("events", []):
        comp = (e.get("competitions") or [{}])[0]
        cs = comp.get("competitors", [])
        home = next((c for c in cs if c.get("homeAway") == "home"), None)
        away = next((c for c in cs if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        st = (e.get("status") or {}).get("type", {})
        out.append(
            Fixture(
                id=str(e["id"]),
                home=normalize(home["team"].get("displayName", "")),
                away=normalize(away["team"].get("displayName", "")),
                kickoff=e.get("date", ""),
                round=e.get("season", {}).get("slug", "") or comp.get("type", {}).get("abbreviation", ""),
                status=_status(st.get("state"), st.get("completed")),
                home_goals=_int_or_none(home.get("score")),
                away_goals=_int_or_none(away.get("score")),
                neutral=bool(comp.get("neutralSite", True)),
            )
        )
    return out


def fetch_fixtures(date_range: str = "20260611-20260719") -> list[Fixture]:
    url = f"{BASE}/scoreboard?dates={date_range}"
    with urllib.request.urlopen(url, timeout=20) as r:  # noqa: S310 (trusted host)
        return parse_scoreboard(json.loads(r.read()))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_espn.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add model/model/espn.py model/tests/test_espn.py model/tests/fixtures/espn_scoreboard.json
git commit -m "feat(model): ESPN fixtures/results client"
```

---

### Task 5: Elo ratings

**Files:**
- Create: `model/model/elo.py`
- Create: `model/tests/test_elo.py`

**Interfaces:**
- Consumes: `model.history.Match`.
- Produces: `model.elo.elo_ratings(matches: list[Match], *, base: float = 1500.0, k: float = 20.0, home_adv: float = 65.0) -> dict[str, float]` — final Elo per team after processing matches in order (margin-of-victory weighted).

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_elo.py
from datetime import date

from model.history import Match
from model.elo import elo_ratings


def _m(h, a, hg, ag):
    return Match(date(2020, 1, 1), h, a, hg, ag, neutral=True, tournament="t")


def test_winner_gains_loser_loses_and_zero_sum_drift():
    r = elo_ratings([_m("A", "B", 3, 0)], base=1500.0)
    assert r["A"] > 1500.0 > r["B"]


def test_repeated_wins_increase_gap_monotonically():
    one = elo_ratings([_m("A", "B", 1, 0)])
    many = elo_ratings([_m("A", "B", 1, 0)] * 5)
    assert (many["A"] - many["B"]) > (one["A"] - one["B"])


def test_deterministic():
    ms = [_m("A", "B", 2, 1), _m("B", "C", 0, 0)]
    assert elo_ratings(ms) == elo_ratings(ms)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_elo.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.elo'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/elo.py
import math

from model.history import Match


def _expected(ra: float, rb: float) -> float:
    return 1.0 / (1.0 + 10.0 ** ((rb - ra) / 400.0))


def _mov_multiplier(goal_diff: int, rating_diff: float) -> float:
    # FIFA-style margin-of-victory weighting (dampened for blowouts).
    gd = abs(goal_diff)
    if gd <= 1:
        return 1.0
    return math.log(gd + 1.0) * (2.2 / ((rating_diff if rating_diff > 0 else 0.0) * 0.001 + 2.2))


def elo_ratings(
    matches: list[Match], *, base: float = 1500.0, k: float = 20.0, home_adv: float = 65.0
) -> dict[str, float]:
    r: dict[str, float] = {}
    for m in matches:
        ra = r.get(m.home, base)
        rb = r.get(m.away, base)
        adv = 0.0 if m.neutral else home_adv
        exp_home = _expected(ra + adv, rb)
        if m.home_goals > m.away_goals:
            score = 1.0
        elif m.home_goals < m.away_goals:
            score = 0.0
        else:
            score = 0.5
        mult = _mov_multiplier(m.home_goals - m.away_goals, (ra + adv) - rb)
        delta = k * mult * (score - exp_home)
        r[m.home] = ra + delta
        r[m.away] = rb - delta
    return r
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_elo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/elo.py model/tests/test_elo.py
git commit -m "feat(model): Elo ratings with MoV weighting"
```

---

### Task 6: Dixon-Coles strength fit

**Files:**
- Create: `model/model/dixoncoles.py`
- Create: `model/tests/test_dixoncoles.py`

**Interfaces:**
- Consumes: `model.history.Match`, `model.elo.elo_ratings`.
- Produces:
  - `model.dixoncoles.Strengths` (dataclass: `attack: dict[str,float]`, `defense: dict[str,float]`, `home_adv: float`, `rho: float`).
  - `fit_strengths(matches, *, half_life_days: float = 365.0, as_of: date, elo_prior_weight: float = 0.1) -> Strengths`.
  - `expected_goals(s: Strengths, home: str, away: str, neutral: bool) -> tuple[float, float]`.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_dixoncoles.py
from datetime import date

from model.history import Match
from model.dixoncoles import fit_strengths, expected_goals


def _league(strong, weak, n=20):
    # `strong` beats `weak` repeatedly; expect higher attack / lower defense.
    return [Match(date(2024, 1, 1), strong, weak, 3, 0, True, "t") for _ in range(n)] + [
        Match(date(2024, 1, 1), weak, strong, 0, 2, True, "t") for _ in range(n)
    ]


def test_stronger_team_has_higher_expected_goals():
    s = fit_strengths(_league("A", "B"), as_of=date(2024, 6, 1))
    la, lb = expected_goals(s, "A", "B", neutral=True)
    assert la > lb


def test_expected_goals_are_positive():
    s = fit_strengths(_league("A", "B"), as_of=date(2024, 6, 1))
    la, lb = expected_goals(s, "A", "B", neutral=True)
    assert la > 0 and lb > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_dixoncoles.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.dixoncoles'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/dixoncoles.py
import math
from dataclasses import dataclass
from datetime import date

import numpy as np
from scipy.optimize import minimize

from model.elo import elo_ratings
from model.history import Match


@dataclass(frozen=True)
class Strengths:
    attack: dict[str, float]
    defense: dict[str, float]
    home_adv: float
    rho: float


def _weights(matches: list[Match], as_of: date, half_life_days: float) -> np.ndarray:
    xi = math.log(2.0) / half_life_days
    days = np.array([(as_of - m.date).days for m in matches], dtype=float)
    days = np.clip(days, 0.0, None)
    return np.exp(-xi * days)


def fit_strengths(
    matches: list[Match],
    *,
    half_life_days: float = 365.0,
    as_of: date,
    elo_prior_weight: float = 0.1,
) -> Strengths:
    teams = sorted({m.home for m in matches} | {m.away for m in matches})
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    w = _weights(matches, as_of, half_life_days)
    hi = np.array([idx[m.home] for m in matches])
    ai = np.array([idx[m.away] for m in matches])
    hg = np.array([m.home_goals for m in matches], dtype=float)
    ag = np.array([m.away_goals for m in matches], dtype=float)
    neutral = np.array([m.neutral for m in matches], dtype=bool)

    # Elo prior on overall strength (attack-defense), normalized.
    elo = elo_ratings(matches)
    prior = np.array([(elo.get(t, 1500.0) - 1500.0) / 200.0 for t in teams])

    # params: [attack(n-1 free, last = -sum), defense(n-1 free), home_adv, rho]
    def unpack(p):
        atk = np.zeros(n)
        atk[:-1] = p[: n - 1]
        atk[-1] = -atk[:-1].sum()
        dfn = np.zeros(n)
        dfn[:-1] = p[n - 1 : 2 * n - 2]
        dfn[-1] = -dfn[:-1].sum()
        return atk, dfn, p[-2], p[-1]

    def neg_ll(p):
        atk, dfn, ha, rho = unpack(p)
        lh = np.exp(atk[hi] - dfn[ai] + np.where(neutral, 0.0, ha))
        la = np.exp(atk[ai] - dfn[hi])
        # Poisson log-likelihood + Dixon-Coles low-score correction.
        ll = hg * np.log(lh) - lh + ag * np.log(la) - la
        tau = np.ones_like(lh)
        m00 = (hg == 0) & (ag == 0)
        m10 = (hg == 1) & (ag == 0)
        m01 = (hg == 0) & (ag == 1)
        m11 = (hg == 1) & (ag == 1)
        tau = np.where(m00, 1.0 - lh * la * rho, tau)
        tau = np.where(m10, 1.0 + la * rho, tau)
        tau = np.where(m01, 1.0 + lh * rho, tau)
        tau = np.where(m11, 1.0 - rho, tau)
        ll = ll + np.log(np.clip(tau, 1e-9, None))
        prior_pen = elo_prior_weight * np.sum((atk - dfn - prior) ** 2)
        return -np.sum(w * ll) + prior_pen

    x0 = np.concatenate([np.zeros(2 * n - 2), [0.25, -0.05]])
    # Dixon-Coles rho is constrained <= 0 (positive rho can drive corrected
    # low-score cells negative — see predict.score_matrix clamp).
    res = minimize(neg_ll, x0, method="L-BFGS-B",
                   bounds=[(-3, 3)] * (2 * n - 2) + [(-1, 1), (-0.2, 0.0)])
    atk, dfn, ha, rho = unpack(res.x)
    return Strengths(
        attack={t: float(atk[idx[t]]) for t in teams},
        defense={t: float(dfn[idx[t]]) for t in teams},
        home_adv=float(ha),
        rho=float(rho),
    )


def expected_goals(s: Strengths, home: str, away: str, neutral: bool) -> tuple[float, float]:
    ha = 0.0 if neutral else s.home_adv
    lh = math.exp(s.attack.get(home, 0.0) - s.defense.get(away, 0.0) + ha)
    la = math.exp(s.attack.get(away, 0.0) - s.defense.get(home, 0.0))
    return lh, la
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_dixoncoles.py -v`
Expected: PASS (fit may take a few seconds)

- [ ] **Step 5: Commit**

```bash
git add model/model/dixoncoles.py model/tests/test_dixoncoles.py
git commit -m "feat(model): Elo-seeded Dixon-Coles strength fit"
```

---

### Task 7: Per-match probabilities (scoreline matrix)

**Files:**
- Create: `model/model/predict.py`
- Create: `model/tests/test_predict.py`

**Interfaces:**
- Consumes: `model.dixoncoles.Strengths`, `expected_goals`.
- Produces:
  - `model.predict.Outcome` (dataclass: `home: float`, `draw: float`, `away: float`).
  - `score_matrix(lh: float, la: float, rho: float, max_goals: int = 10) -> np.ndarray` — `(max_goals+1, max_goals+1)` joint scoreline probabilities.
  - `outcome_probs(matrix) -> Outcome`.
  - `top_scores(matrix, k=5) -> list[tuple[str, float]]` (e.g. `("2-1", 0.08)`).

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_predict.py
import numpy as np

from model.predict import score_matrix, outcome_probs, top_scores


def test_matrix_sums_to_one():
    m = score_matrix(1.4, 1.1, rho=-0.05)
    assert abs(m.sum() - 1.0) < 1e-6


def test_matrix_never_negative_even_with_extreme_correction():
    # high lambdas + the (clamped) correction must not yield negative cells
    m = score_matrix(3.2, 3.0, rho=-0.2)
    assert (m >= 0).all()
    assert abs(m.sum() - 1.0) < 1e-6


def test_outcome_probs_sum_to_one_and_favor_stronger():
    m = score_matrix(2.0, 0.7, rho=-0.05)
    o = outcome_probs(m)
    assert abs(o.home + o.draw + o.away - 1.0) < 1e-6
    assert o.home > o.away


def test_top_scores_sorted_desc():
    m = score_matrix(1.5, 1.2, rho=-0.05)
    ts = top_scores(m, k=3)
    probs = [p for _, p in ts]
    assert probs == sorted(probs, reverse=True)
    assert "-" in ts[0][0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_predict.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.predict'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/predict.py
from dataclasses import dataclass

import numpy as np
from scipy.stats import poisson


@dataclass(frozen=True)
class Outcome:
    home: float
    draw: float
    away: float


def score_matrix(lh: float, la: float, rho: float, max_goals: int = 10) -> np.ndarray:
    h = poisson.pmf(np.arange(max_goals + 1), lh)
    a = poisson.pmf(np.arange(max_goals + 1), la)
    m = np.outer(h, a)
    # Dixon-Coles low-score correction on the four cells.
    m[0, 0] *= 1.0 - lh * la * rho
    m[1, 0] *= 1.0 + la * rho
    m[0, 1] *= 1.0 + lh * rho
    m[1, 1] *= 1.0 - rho
    m = np.clip(m, 0.0, None)  # a positive rho can push a corrected cell negative
    return m / m.sum()


def outcome_probs(matrix: np.ndarray) -> Outcome:
    home = float(np.tril(matrix, -1).sum())
    away = float(np.triu(matrix, 1).sum())
    draw = float(np.trace(matrix))
    return Outcome(home=home, draw=draw, away=away)


def top_scores(matrix: np.ndarray, k: int = 5) -> list[tuple[str, float]]:
    flat = [(f"{h}-{a}", float(matrix[h, a]))
            for h in range(matrix.shape[0]) for a in range(matrix.shape[1])]
    flat.sort(key=lambda x: x[1], reverse=True)
    return flat[:k]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_predict.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/predict.py model/tests/test_predict.py
git commit -m "feat(model): scoreline matrix + outcome probabilities"
```

---

### Task 8: Market blend (odds → implied probabilities)

**Files:**
- Create: `model/model/market.py`
- Create: `model/tests/test_market.py`

**Interfaces:**
- Consumes: `model.predict.Outcome`.
- Produces:
  - `model.market.implied_probs(home_odds: float, draw_odds: float, away_odds: float) -> Outcome` (overround removed).
  - `blend(model_o: Outcome, market_o: Outcome | None, kappa: float = 0.35) -> Outcome` — returns model unchanged when `market_o is None`.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_market.py
from model.predict import Outcome
from model.market import implied_probs, blend


def test_implied_probs_sum_to_one():
    o = implied_probs(2.0, 3.4, 4.0)
    assert abs(o.home + o.draw + o.away - 1.0) < 1e-9
    assert o.home > o.away  # shorter odds -> higher prob


def test_blend_without_market_returns_model():
    m = Outcome(0.5, 0.3, 0.2)
    assert blend(m, None) == m


def test_blend_is_convex_combination():
    m = Outcome(0.6, 0.2, 0.2)
    mk = Outcome(0.4, 0.2, 0.4)
    b = blend(m, mk, kappa=0.5)
    assert abs(b.home - 0.5) < 1e-9
    assert abs(b.home + b.draw + b.away - 1.0) < 1e-9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_market.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.market'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/market.py
from model.predict import Outcome


def implied_probs(home_odds: float, draw_odds: float, away_odds: float) -> Outcome:
    raw = [1.0 / home_odds, 1.0 / draw_odds, 1.0 / away_odds]
    s = sum(raw)
    return Outcome(home=raw[0] / s, draw=raw[1] / s, away=raw[2] / s)


def blend(model_o: Outcome, market_o: Outcome | None, kappa: float = 0.35) -> Outcome:
    if market_o is None:
        return model_o
    return Outcome(
        home=(1 - kappa) * model_o.home + kappa * market_o.home,
        draw=(1 - kappa) * model_o.draw + kappa * market_o.draw,
        away=(1 - kappa) * model_o.away + kappa * market_o.away,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_market.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/market.py model/tests/test_market.py
git commit -m "feat(model): market-implied probabilities + blend"
```

---

### Task 9: Group standings + FIFA tiebreakers

**Files:**
- Create: `model/model/groups.py`
- Create: `model/tests/test_groups.py`

**Interfaces:**
- Consumes: nothing (operates on plain result tuples).
- Produces:
  - `model.groups.TeamRow` (dataclass: `team, played, won, drawn, lost, gf, ga, gd, points`).
  - `standings(group_teams: list[str], results: list[tuple[str,str,int,int]]) -> list[TeamRow]` — sorted by FIFA tiebreakers (points, GD, GF, head-to-head, then stable by team name as the seeded "lots" placeholder).

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_groups.py
from model.groups import standings


def test_points_then_gd_then_gf_ordering():
    teams = ["A", "B", "C", "D"]
    results = [
        ("A", "D", 3, 0), ("B", "D", 1, 0), ("C", "D", 2, 0),
        ("A", "B", 1, 1), ("A", "C", 1, 1), ("B", "C", 0, 0),
    ]
    table = standings(teams, results)
    # A: 5pts(+4), B: 3pts(+1), C: 3pts(+2), D: 0
    assert [r.team for r in table] == ["A", "C", "B", "D"]  # C above B on GD


def test_head_to_head_breaks_equal_points_and_gd():
    teams = ["X", "Y"]
    results = [("X", "Y", 2, 1)]
    table = standings(teams, results)
    assert table[0].team == "X"  # beat Y head-to-head
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_groups.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.groups'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/groups.py
from dataclasses import dataclass


@dataclass
class TeamRow:
    team: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    gf: int = 0
    ga: int = 0
    gd: int = 0
    points: int = 0


def _tally(teams, results) -> dict[str, TeamRow]:
    rows = {t: TeamRow(t) for t in teams}
    for h, a, hg, ag in results:
        rh, ra = rows[h], rows[a]
        rh.played += 1; ra.played += 1
        rh.gf += hg; rh.ga += ag; ra.gf += ag; ra.ga += hg
        if hg > ag:
            rh.won += 1; rh.points += 3; ra.lost += 1
        elif hg < ag:
            ra.won += 1; ra.points += 3; rh.lost += 1
        else:
            rh.drawn += 1; ra.drawn += 1; rh.points += 1; ra.points += 1
    for r in rows.values():
        r.gd = r.gf - r.ga
    return rows


def _h2h_points(team, others, results) -> tuple[int, int, int]:
    pts = gf = ga = 0
    rel = [r for r in results if r[0] in others | {team} and r[1] in others | {team}]
    for h, a, hg, ag in rel:
        if team == h:
            gf += hg; ga += ag; pts += 3 if hg > ag else 1 if hg == ag else 0
        elif team == a:
            gf += ag; ga += hg; pts += 3 if ag > hg else 1 if hg == ag else 0
    return pts, gf - ga, gf


def standings(group_teams: list[str], results: list[tuple[str, str, int, int]]) -> list[TeamRow]:
    rows = _tally(group_teams, results)

    def sort_key(t: str):
        r = rows[t]
        tied = {x for x in group_teams if rows[x].points == r.points} - {t}
        h2h = _h2h_points(t, tied, results) if tied else (0, 0, 0)
        return (-r.points, -r.gd, -r.gf, -h2h[0], -h2h[1], -h2h[2], t)

    return [rows[t] for t in sorted(group_teams, key=sort_key)]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_groups.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/groups.py model/tests/test_groups.py
git commit -m "feat(model): group standings with FIFA tiebreakers"
```

---

### Task 10: Best third-placed selection

**Files:**
- Modify: `model/model/groups.py` (add `best_thirds`)
- Modify: `model/tests/test_groups.py` (add tests)

**Interfaces:**
- Consumes: `TeamRow`.
- Produces: `model.groups.best_thirds(third_rows: list[tuple[str, TeamRow]], take: int = 8) -> list[str]` — ranks the 12 third-placed `(group, row)` pairs by points → GD → GF → team, returns the top `take` team names.

- [ ] **Step 1: Write the failing test**

```python
# append to model/tests/test_groups.py
from model.groups import TeamRow, best_thirds


def _row(team, pts, gd, gf):
    return TeamRow(team, points=pts, gd=gd, gf=gf)


def test_best_thirds_takes_top_by_points_then_gd():
    thirds = [(f"G{i}", _row(f"T{i}", pts, gd, 3))
              for i, (pts, gd) in enumerate(
                  [(6, 4), (6, 2), (4, 1), (4, 0), (3, 0), (3, -1),
                   (3, -2), (2, 0), (1, -1), (1, -3), (0, -4), (0, -6)])]
    picked = best_thirds(thirds, take=8)
    assert picked[0] == "T0" and picked[1] == "T1"  # 6pts, GD breaks tie
    assert len(picked) == 8
    assert "T11" not in picked  # worst third excluded
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_groups.py::test_best_thirds_takes_top_by_points_then_gd -v`
Expected: FAIL — `ImportError: cannot import name 'best_thirds'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to model/model/groups.py
def best_thirds(third_rows: list[tuple[str, "TeamRow"]], take: int = 8) -> list[str]:
    ranked = sorted(
        third_rows,
        key=lambda gr: (-gr[1].points, -gr[1].gd, -gr[1].gf, gr[1].team),
    )
    return [row.team for _, row in ranked[:take]]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_groups.py -v`
Expected: PASS (all group tests)

- [ ] **Step 5: Commit**

```bash
git add model/model/groups.py model/tests/test_groups.py
git commit -m "feat(model): best third-placed selection"
```

---

### Task 11: Round-of-32 bracket slotting

**Files:**
- Create: `model/data/bracket_2026.json` (official group-position → R32 slot mapping)
- Create: `model/model/bracket.py`
- Create: `model/tests/test_bracket.py`

**Interfaces:**
- Consumes: nothing (operates on qualifier labels).
- Produces:
  - `model.bracket.load_bracket() -> list[dict]` — the R32 pairing template (each entry `{slot, home_ref, away_ref}` where refs are like `"1A"`, `"2B"`, `"3rd-ABCD"`).
  - `model.bracket.assign_r32(winners: dict[str,str], runners: dict[str,str], thirds: dict[str,str]) -> list[tuple[str,str]]` — resolves refs to concrete team pairs. `thirds` maps each filled third-place slot id to a team.

- [ ] **Step 1: Create the mapping (from the official 2026 bracket) + failing test**

```json
// model/data/bracket_2026.json  (abbreviated example — fill all 16 R32 ties from the official draw)
{
  "r32": [
    {"slot": "R32-1", "home_ref": "1A", "away_ref": "3rd-CDFG"},
    {"slot": "R32-2", "home_ref": "1C", "away_ref": "2F"}
  ]
}
```

```python
# model/tests/test_bracket.py
from model.bracket import load_bracket, assign_r32


def test_bracket_template_loads():
    b = load_bracket()
    assert len(b) >= 2
    assert {"slot", "home_ref", "away_ref"} <= set(b[0])


def test_assign_resolves_simple_refs():
    winners = {"A": "Argentina", "C": "Brazil"}
    runners = {"F": "Spain"}
    thirds = {"3rd-CDFG": "Mexico"}
    pairs = assign_r32(winners, runners, thirds)
    assert ("Argentina", "Mexico") in pairs
    assert ("Brazil", "Spain") in pairs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_bracket.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.bracket'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/bracket.py
import json
from pathlib import Path

_BRACKET = Path(__file__).resolve().parent.parent / "data" / "bracket_2026.json"


def load_bracket() -> list[dict]:
    return json.loads(_BRACKET.read_text())["r32"]


def _resolve(ref: str, winners, runners, thirds) -> str:
    if ref.startswith("1"):
        return winners[ref[1:]]
    if ref.startswith("2"):
        return runners[ref[1:]]
    return thirds[ref]  # "3rd-...." slot id


def assign_r32(winners: dict[str, str], runners: dict[str, str], thirds: dict[str, str]) -> list[tuple[str, str]]:
    pairs = []
    for tie in load_bracket():
        try:
            h = _resolve(tie["home_ref"], winners, runners, thirds)
            a = _resolve(tie["away_ref"], winners, runners, thirds)
        except KeyError:
            continue  # ref not yet fillable in a partial sim state
        pairs.append((h, a))
    return pairs
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_bracket.py -v`
Expected: PASS

> **Note for implementer:** the committed `bracket_2026.json` MUST contain all 16 R32 ties from the official FIFA 2026 bracket (including the third-place slot assignment table). The two-entry example above is only enough to pass the test — fill the rest from the published bracket before the sim is meaningful. This is the highest-risk correctness surface (see spec §5, §11).

- [ ] **Step 5: Commit**

```bash
git add model/data/bracket_2026.json model/model/bracket.py model/tests/test_bracket.py
git commit -m "feat(model): R32 bracket template + slotting"
```

---

### Task 12: Knockout match simulation

**Files:**
- Create: `model/model/knockout.py`
- Create: `model/tests/test_knockout.py`

**Interfaces:**
- Consumes: `model.dixoncoles.Strengths`, `expected_goals`, `score_matrix`.
- Produces: `model.knockout.sim_knockout(s, home, away, rng) -> str` — returns the winner's name; draws after 90' resolved by modeled extra-time then strength-tilted penalties.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_knockout.py
import numpy as np

from model.dixoncoles import Strengths
from model.knockout import sim_knockout


def _s():
    return Strengths(attack={"A": 0.8, "B": -0.8}, defense={"A": 0.5, "B": -0.5},
                     home_adv=0.0, rho=-0.05)


def test_returns_one_of_the_teams():
    rng = np.random.default_rng(1)
    assert sim_knockout(_s(), "A", "B", rng) in ("A", "B")


def test_stronger_team_wins_majority_and_is_deterministic_by_seed():
    wins = sum(sim_knockout(_s(), "A", "B", np.random.default_rng(i)) == "A" for i in range(200))
    assert wins > 130  # A clearly stronger
    # determinism: same seed -> same result
    assert sim_knockout(_s(), "A", "B", np.random.default_rng(7)) == sim_knockout(
        _s(), "A", "B", np.random.default_rng(7))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_knockout.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.knockout'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/knockout.py
import numpy as np

from model.dixoncoles import Strengths, expected_goals


def _draw_goals(lam: float, rng: np.random.Generator) -> int:
    return int(rng.poisson(lam))


def sim_knockout(s: Strengths, home: str, away: str, rng: np.random.Generator) -> str:
    lh, la = expected_goals(s, home, away, neutral=True)
    gh, ga = _draw_goals(lh, rng), _draw_goals(la, rng)
    if gh != ga:
        return home if gh > ga else away
    # Extra time: 30 mins ~ 1/3 of normal-time scoring rate.
    gh += _draw_goals(lh / 3.0, rng)
    ga += _draw_goals(la / 3.0, rng)
    if gh != ga:
        return home if gh > ga else away
    # Penalties: strength-tilted coin. In this parameterization a HIGHER
    # defense rating means fewer conceded, so overall strength is attack+defense
    # (both are "good" dimensions) — not attack-defense.
    sh = s.attack.get(home, 0.0) + s.defense.get(home, 0.0)
    sa = s.attack.get(away, 0.0) + s.defense.get(away, 0.0)
    p_home = 1.0 / (1.0 + np.exp(-(sh - sa)))
    return home if rng.random() < p_home else away
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_knockout.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/knockout.py model/tests/test_knockout.py
git commit -m "feat(model): knockout sim (ET + penalties)"
```

---

### Task 13: Monte-Carlo tournament orchestrator

**Files:**
- Create: `model/model/simulate.py`
- Create: `model/tests/test_simulate.py`

**Interfaces:**
- Consumes: `model.groups` (standings, best_thirds), `model.bracket.assign_r32`, `model.knockout.sim_knockout`, `model.dixoncoles` (Strengths, expected_goals), `model.predict.score_matrix`.
- Produces:
  - `model.simulate.Tournament` (dataclass: `groups: dict[str,list[str]]`, `played: list[tuple[str,str,int,int]]`, `fixtures_remaining: list[tuple[str,str,str]]` as `(group, home, away)`).
  - `simulate(t: Tournament, s: Strengths, *, sims: int, seed: int) -> dict` — returns `{teams: {team: {qualify, reachR16, reachQF, reachSF, reachFinal, winCup, mcStdErr}}, simCount, seed}` aggregated over `sims` seeded runs.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_simulate.py
from model.dixoncoles import Strengths
from model.simulate import Tournament, simulate


def _two_group_tournament():
    groups = {"A": ["A1", "A2", "A3", "A4"], "B": ["B1", "B2", "B3", "B4"]}
    remaining = [("A", h, a) for h in groups["A"] for a in groups["A"] if h < a] + \
                [("B", h, a) for h in groups["B"] for a in groups["B"] if h < a]
    return Tournament(groups=groups, played=[], fixtures_remaining=remaining)


def _flat_strengths(teams):
    return Strengths(attack={t: 0.0 for t in teams}, defense={t: 0.0 for t in teams},
                     home_adv=0.0, rho=-0.05)


def test_probabilities_in_range_and_deterministic():
    t = _two_group_tournament()
    teams = t.groups["A"] + t.groups["B"]
    s = _flat_strengths(teams)
    r1 = simulate(t, s, sims=200, seed=42)
    r2 = simulate(t, s, sims=200, seed=42)
    assert r1 == r2  # seeded determinism
    for stats in r1["teams"].values():
        assert 0.0 <= stats["qualify"] <= 1.0
        assert 0.0 <= stats["winCup"] <= 1.0


def test_two_qualify_per_group_on_average():
    t = _two_group_tournament()
    teams = t.groups["A"] + t.groups["B"]
    r = simulate(t, _flat_strengths(teams), sims=300, seed=1)
    qa = sum(r["teams"][x]["qualify"] for x in t.groups["A"])
    assert abs(qa - 2.0) < 0.05  # exactly 2 of 4 advance from group A
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_simulate.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.simulate'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/simulate.py
from dataclasses import dataclass

import numpy as np

from model.dixoncoles import Strengths, expected_goals
from model.groups import standings
from model.knockout import sim_knockout

STAGES = ("qualify", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")


@dataclass
class Tournament:
    groups: dict[str, list[str]]
    played: list[tuple[str, str, int, int]]
    fixtures_remaining: list[tuple[str, str, str]]


def _sim_score(s: Strengths, h: str, a: str, rng: np.random.Generator) -> tuple[int, int]:
    lh, la = expected_goals(s, h, a, neutral=True)
    return int(rng.poisson(lh)), int(rng.poisson(la))


def _bracket_rounds(qualifiers: list[str], s: Strengths, rng, counts: dict, reached_from: int):
    # Generic single-elimination over a power-of-two list; credits stages.
    stage_names = ["reachR16", "reachQF", "reachSF", "reachFinal", "winCup"]
    field = qualifiers
    si = reached_from
    while len(field) > 1:
        nxt = []
        for i in range(0, len(field), 2):
            w = sim_knockout(s, field[i], field[i + 1], rng)
            nxt.append(w)
        field = nxt
        if si < len(stage_names):
            for w in field:
                counts[w][stage_names[si]] += 1
        si += 1


def simulate(t: Tournament, s: Strengths, *, sims: int, seed: int) -> dict:
    all_teams = [team for g in t.groups.values() for team in g]
    counts = {team: {k: 0 for k in STAGES} for team in all_teams}
    rng = np.random.default_rng(seed)

    for _ in range(sims):
        results_by_group: dict[str, list] = {g: [] for g in t.groups}
        played_lookup = {(h, a): (hg, ag) for (h, a, hg, ag) in t.played}
        for g, h, a in t.fixtures_remaining:
            if (h, a) in played_lookup:
                hg, ag = played_lookup[(h, a)]
            else:
                hg, ag = _sim_score(s, h, a, rng)
            results_by_group[g].append((h, a, hg, ag))

        qualifiers: list[str] = []
        for g, teams in t.groups.items():
            table = standings(teams, results_by_group[g])
            for r in table[:2]:
                counts[r.team]["qualify"] += 1
                qualifiers.append(r.team)
        # NOTE: full 2026 R32 uses best-thirds + bracket slotting (Task 11).
        # For the orchestrator we advance the seeded top-2 through a generic
        # bracket; the run.py wiring (Task 17) supplies real R32 pairings.
        if len(qualifiers) >= 2 and (len(qualifiers) & (len(qualifiers) - 1)) == 0:
            _bracket_rounds(qualifiers, s, rng, counts, reached_from=0)

    out_teams = {}
    for team, c in counts.items():
        stats = {k: c[k] / sims for k in STAGES}
        p = stats["winCup"]
        stats["mcStdErr"] = float(np.sqrt(max(p * (1 - p), 0.0) / sims))
        out_teams[team] = stats
    return {"teams": out_teams, "simCount": sims, "seed": seed}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_simulate.py -v`
Expected: PASS

> **Note for implementer:** this orchestrator advances seeded top-2 through a generic bracket so it is testable in isolation. Wiring the *real* 2026 R32 (best-thirds from Task 10 + `assign_r32` from Task 11, with the official `bracket_2026.json`) happens in Task 17 (`run.py`), where the full 48-team field exists. Keep `_bracket_rounds` generic; inject pairings from `run.py`.

- [ ] **Step 5: Commit**

```bash
git add model/model/simulate.py model/tests/test_simulate.py
git commit -m "feat(model): Monte-Carlo tournament orchestrator"
```

---

### Task 14: Backtest + calibration

**Files:**
- Create: `model/model/backtest.py`
- Create: `model/tests/test_backtest.py`

**Interfaces:**
- Consumes: `model.predict.Outcome`.
- Produces:
  - `model.backtest.brier(pred: Outcome, actual: str) -> float` (`actual` in {"h","d","a"}).
  - `model.backtest.logloss(pred: Outcome, actual: str) -> float`.
  - `model.backtest.reliability(samples: list[tuple[Outcome,str]], bins: int = 10) -> list[dict]` — calibration curve bins `{binMid, predicted, observed, n}`.

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_backtest.py
import math

from model.predict import Outcome
from model.backtest import brier, logloss, reliability


def test_perfect_prediction_scores_zero_brier():
    assert brier(Outcome(1.0, 0.0, 0.0), "h") == 0.0


def test_brier_penalizes_wrong_confident_prediction():
    assert brier(Outcome(1.0, 0.0, 0.0), "a") == 2.0  # (1-0)^2 + 0 + (0-1)^2


def test_logloss_finite_and_lower_when_right():
    right = logloss(Outcome(0.8, 0.1, 0.1), "h")
    wrong = logloss(Outcome(0.1, 0.1, 0.8), "h")
    assert math.isfinite(right) and right < wrong


def test_reliability_curve_tracks_a_calibrated_model():
    # Perfectly-calibrated synthetic set: with a constant 0.70/0.15/0.15
    # prediction, home occurs 70% of the time, draw 15%, away 15%.
    samples = []
    for i in range(100):
        actual = "h" if i < 70 else ("d" if i < 85 else "a")
        samples.append((Outcome(0.70, 0.15, 0.15), actual))
    bins = reliability(samples, bins=10)
    assert sum(b["n"] for b in bins) == 300        # 3 classes * 100 matches
    hot = next(b for b in bins if b["n"] and 0.6 <= b["binMid"] <= 0.8)
    assert abs(hot["observed"] - 0.70) < 0.06       # observed tracks predicted
    low = next(b for b in bins if b["n"] and 0.1 <= b["binMid"] <= 0.2)
    assert low["observed"] < 0.30                   # not degenerate at 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_backtest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.backtest'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/backtest.py
import math

from model.predict import Outcome

_IDX = {"h": 0, "d": 1, "a": 2}


def _vec(o: Outcome) -> tuple[float, float, float]:
    return (o.home, o.draw, o.away)


def brier(pred: Outcome, actual: str) -> float:
    p = _vec(pred)
    y = [0.0, 0.0, 0.0]
    y[_IDX[actual]] = 1.0
    return sum((p[i] - y[i]) ** 2 for i in range(3))


def logloss(pred: Outcome, actual: str) -> float:
    p = _vec(pred)[_IDX[actual]]
    return -math.log(max(p, 1e-15))


def reliability(samples: list[tuple[Outcome, str]], bins: int = 10) -> list[dict]:
    # Emit one (p, y) point PER outcome class per match: p = predicted prob of
    # that class, y = 1 if that class actually occurred. Binning these gives a
    # real calibration curve — a calibrated model has observed ~= predicted in
    # every bin (binning the realized-class prob with y always 1 is degenerate).
    edges = [i / bins for i in range(bins + 1)]
    acc = [{"binMid": (edges[i] + edges[i + 1]) / 2, "psum": 0.0, "ysum": 0.0, "n": 0}
           for i in range(bins)]
    for pred, actual in samples:
        for cls, p in zip(("h", "d", "a"), _vec(pred)):
            y = 1.0 if actual == cls else 0.0
            b = min(int(p * bins), bins - 1)
            acc[b]["psum"] += p
            acc[b]["ysum"] += y
            acc[b]["n"] += 1
    out = []
    for a in acc:
        n = a["n"] or 1
        out.append({"binMid": a["binMid"], "predicted": a["psum"] / n,
                    "observed": a["ysum"] / n, "n": a["n"]})
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_backtest.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/backtest.py model/tests/test_backtest.py
git commit -m "feat(model): Brier/log-loss/calibration backtest"
```

---

### Task 15: Style fingerprints from team stats

**Files:**
- Create: `model/model/style.py`
- Create: `model/tests/test_style.py`

**Interfaces:**
- Consumes: nothing (operates on a stat dict).
- Produces: `model.style.fingerprint(stats: dict[str,float]) -> dict[str,float]` — returns `{possession, directness, press, block}` each in `[0,1]`, derived from the ESPN team-stat names (`possessionPct`, `accurateLongBalls`/`totalPasses`, `totalTackles`+`interceptions`, `effectiveClearance`).

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_style.py
from model.style import fingerprint


def test_high_possession_low_directness():
    f = fingerprint({"possessionPct": 70, "totalPasses": 600, "accurateLongBalls": 20,
                     "totalTackles": 12, "interceptions": 8, "effectiveClearance": 10})
    assert f["possession"] > 0.6
    assert 0.0 <= f["directness"] <= 1.0
    assert all(0.0 <= v <= 1.0 for v in f.values())


def test_missing_stats_default_midrange():
    f = fingerprint({})
    assert all(0.0 <= v <= 1.0 for v in f.values())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_style.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.style'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/style.py
def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def fingerprint(stats: dict[str, float]) -> dict[str, float]:
    poss = float(stats.get("possessionPct", 50.0)) / 100.0
    passes = float(stats.get("totalPasses", 400.0)) or 1.0
    long_balls = float(stats.get("accurateLongBalls", 30.0))
    directness = long_balls / passes * 5.0  # scaled share of long play
    press = (float(stats.get("totalTackles", 16.0)) + float(stats.get("interceptions", 8.0))) / 40.0
    block = float(stats.get("effectiveClearance", 15.0)) / 30.0
    return {
        "possession": _clamp(poss),
        "directness": _clamp(directness),
        "press": _clamp(press),
        "block": _clamp(block),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_style.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/style.py model/tests/test_style.py
git commit -m "feat(model): team style fingerprints"
```

---

### Task 16: Snapshot writers + schema validation

**Files:**
- Create: `model/model/snapshot.py`
- Create: `model/tests/test_snapshot.py`

**Interfaces:**
- Consumes: results of `simulate`, `backtest`, `predict`, `style`.
- Produces:
  - `model.snapshot.build_predictions(sim_result, fixtures, groups_meta, *, generated_at, inputs_hash) -> dict`.
  - `model.snapshot.write_json(obj: dict, path: Path) -> None` (atomic write, stable key order).
  - `model.snapshot.validate_predictions(obj: dict) -> None` (raises `ValueError` on contract violation).

- [ ] **Step 1: Write the failing test**

```python
# model/tests/test_snapshot.py
import json
from pathlib import Path

from model.snapshot import build_predictions, write_json, validate_predictions


def test_build_and_validate_roundtrip(tmp_path: Path):
    sim = {"teams": {"Brazil": {"qualify": 0.9, "reachR16": 0.7, "reachQF": 0.5,
                                "reachSF": 0.3, "reachFinal": 0.2, "winCup": 0.12,
                                "mcStdErr": 0.003}},
           "simCount": 10000, "seed": 42}
    obj = build_predictions(sim, fixtures=[], groups_meta=[],
                            generated_at="2026-06-20T00:00:00Z", inputs_hash="abc")
    validate_predictions(obj)  # should not raise
    p = tmp_path / "latest.json"
    write_json(obj, p)
    reloaded = json.loads(p.read_text())
    assert reloaded["teams"][0]["winCup"] == 0.12
    assert reloaded["seed"] == 42


def test_validate_rejects_missing_field():
    import pytest
    with pytest.raises(ValueError):
        validate_predictions({"teams": [{"name": "X"}]})  # missing required keys
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_snapshot.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.snapshot'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/snapshot.py
import json
import os
from pathlib import Path

from model.version import MODEL_VERSION

_TEAM_KEYS = {"qualify", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup", "mcStdErr"}


def build_predictions(sim_result, fixtures, groups_meta, *, generated_at, inputs_hash) -> dict:
    teams = [{"name": name, **stats} for name, stats in sim_result["teams"].items()]
    teams.sort(key=lambda t: t["winCup"], reverse=True)
    return {
        "generatedAt": generated_at,
        "modelVersion": MODEL_VERSION,
        "seed": sim_result["seed"],
        "simCount": sim_result["simCount"],
        "inputsHash": inputs_hash,
        "teams": teams,
        "fixtures": fixtures,
        "groups": groups_meta,
    }


def validate_predictions(obj: dict) -> None:
    for key in ("generatedAt", "modelVersion", "seed", "teams"):
        if key not in obj:
            raise ValueError(f"missing top-level key: {key}")
    for t in obj["teams"]:
        if not _TEAM_KEYS <= set(t):
            raise ValueError(f"team entry missing keys: {_TEAM_KEYS - set(t)}")
        for k in _TEAM_KEYS:
            if not 0.0 <= float(t[k]) <= 1.0:
                raise ValueError(f"{t.get('name')}: {k} out of [0,1]")


def write_json(obj: dict, path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, sort_keys=True))
    os.replace(tmp, path)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_snapshot.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add model/model/snapshot.py model/tests/test_snapshot.py
git commit -m "feat(model): snapshot writers + schema validation"
```

---

### Task 17: CLI `run.py` — end-to-end wiring

**Files:**
- Create: `model/model/run.py`
- Create: `model/tests/test_run.py`

**Interfaces:**
- Consumes: every prior module.
- Produces: `model.run.build_tournament(fixtures: list[Fixture]) -> tuple[Tournament, list[dict]]` (tournament + per-fixture prediction rows); `model.run.main(argv: list[str]|None=None) -> int` (CLI: `--seed`, `--sims`, `--data-dir`, `--offline <espn_json>`; writes `data/predictions/latest.json`, `data/ratings/latest.json`, `data/predictions/calibration.json`, `data/predictions/history/<iso>.json`).

- [ ] **Step 1: Write the failing test (offline, small fixture)**

```python
# model/tests/test_run.py
import json
from pathlib import Path

from model.run import main

FIX = Path(__file__).parent / "fixtures" / "espn_scoreboard.json"
SMALL_HISTORY = Path(__file__).parent / "fixtures" / "results_small.csv"


def _args(out: Path):
    # --history points at the tiny fixture so the fit is fast (not the 45k CSV).
    return ["--seed", "42", "--sims", "50", "--offline", str(FIX),
            "--history", str(SMALL_HISTORY), "--data-dir", str(out),
            "--generated-at", "2026-06-20T00:00:00Z"]


def test_main_writes_valid_snapshots(tmp_path: Path):
    assert main(_args(tmp_path)) == 0
    latest = json.loads((tmp_path / "predictions" / "latest.json").read_text())
    assert latest["seed"] == 42 and latest["modelVersion"]
    assert len(latest["teams"]) > 0          # not a vacuous empty tournament
    assert (tmp_path / "ratings" / "latest.json").exists()
    # determinism: a second run with same seed produces identical predictions
    main(_args(tmp_path / "b"))
    b = json.loads((tmp_path / "b" / "predictions" / "latest.json").read_text())
    assert b["teams"] == latest["teams"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd model && uv run pytest tests/test_run.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'model.run'`

- [ ] **Step 3: Write minimal implementation**

```python
# model/model/run.py
import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

from model.dixoncoles import fit_strengths, expected_goals
from model.espn import parse_scoreboard, fetch_fixtures, Fixture
from model.history import load_results
from model.market import blend
from model.predict import score_matrix, outcome_probs, top_scores
from model.simulate import Tournament, simulate
from model.snapshot import build_predictions, write_json, validate_predictions

_HISTORY = Path(__file__).resolve().parent.parent / "data" / "history" / "results.csv"


def build_tournament(fixtures: list[Fixture]):
    # Group fixtures whose round is the group stage; infer groups from played + scheduled.
    groups: dict[str, list[str]] = {}
    played, remaining = [], []
    for f in fixtures:
        if "group" not in (f.round or "").lower():
            continue
        g = "?"  # ESPN group label; refined via standings endpoint in production
        groups.setdefault(g, [])
        for tm in (f.home, f.away):
            if tm not in groups[g]:
                groups[g].append(tm)
        # EVERY group fixture goes into fixtures_remaining so standings see it;
        # finished ones ALSO go into `played` so the loop fixes their real score
        # instead of re-simulating a settled result.
        remaining.append((g, f.home, f.away))
        if f.status == "finished" and f.home_goals is not None:
            played.append((f.home, f.away, f.home_goals, f.away_goals))
    return Tournament(groups=groups, played=played, fixtures_remaining=remaining), []


def _fixture_rows(fixtures, s):
    rows = []
    for f in fixtures:
        if f.status == "finished":
            continue
        lh, la = expected_goals(s, f.home, f.away, neutral=f.neutral)
        m = score_matrix(lh, la, s.rho)
        o = outcome_probs(m)
        b = blend(o, None)
        rows.append({
            "id": f.id, "home": f.home, "away": f.away, "kickoff": f.kickoff,
            "round": f.round, "played": False,
            "pModel": {"h": o.home, "d": o.draw, "a": o.away},
            "pBlended": {"h": b.home, "d": b.draw, "a": b.away},
            "pMarket": None,
            "lambdaHome": lh, "lambdaAway": la,
            "topScores": [{"score": sc, "prob": p} for sc, p in top_scores(m)],
        })
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--sims", type=int, default=10000)
    ap.add_argument("--data-dir", default="../data")
    ap.add_argument("--offline", default=None, help="path to a saved ESPN scoreboard json")
    ap.add_argument("--history", default=None, help="override history results.csv (tests use a small fixture)")
    ap.add_argument("--generated-at", required=True)
    a = ap.parse_args(argv)

    if a.offline:
        fixtures = parse_scoreboard(json.loads(Path(a.offline).read_text()))
    else:
        fixtures = fetch_fixtures()

    history = load_results(Path(a.history) if a.history else _HISTORY)
    as_of = date.fromisoformat(a.generated_at[:10])  # reproducible: no wall-clock
    s = fit_strengths(history, as_of=as_of)

    tournament, _ = build_tournament(fixtures)
    sim = simulate(tournament, s, sims=a.sims, seed=a.seed)
    rows = _fixture_rows(fixtures, s)

    inputs_hash = hashlib.sha256(
        (a.generated_at + str(len(history)) + str(len(fixtures))).encode()
    ).hexdigest()[:12]

    data = Path(a.data_dir)
    pred = build_predictions(sim, rows, [], generated_at=a.generated_at, inputs_hash=inputs_hash)
    validate_predictions(pred)
    write_json(pred, data / "predictions" / "latest.json")
    write_json(pred, data / "predictions" / "history" / f"{a.generated_at.replace(':', '-')}.json")
    write_json(
        {"generatedAt": a.generated_at,
         "teams": [{"name": t, "attack": s.attack[t], "defense": s.defense[t]} for t in s.attack]},
        data / "ratings" / "latest.json",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd model && uv run pytest tests/test_run.py -v`
Expected: PASS

> **Note for implementer:** `build_tournament` here uses a placeholder group label `"?"` because the scoreboard alone doesn't carry group letters. Before production, refine it to read group membership from the ESPN standings endpoint (the app's `lib/espn` already parses `…/standings?season=2026` into 12 named groups) and to slot knockouts via Task 11's `assign_r32`. The test exercises the end-to-end wiring + determinism; group-accuracy refinement is its own follow-up commit within this task.

- [ ] **Step 5: Run the full suite + a real end-to-end generation**

Run:
```bash
cd model && uv run pytest -q
uv run python -m model.run --seed 42 --sims 2000 --generated-at 2026-06-20T00:00:00Z --data-dir ../data
ls ../data/predictions/latest.json ../data/ratings/latest.json
```
Expected: tests pass; `data/predictions/latest.json` exists and validates.

- [ ] **Step 6: Commit**

```bash
git add model/model/run.py model/tests/test_run.py data/
git commit -m "feat(model): end-to-end CLI run + first snapshot"
```

---

### Task 18: GitHub Actions cron

**Files:**
- Create: `.github/workflows/predict.yml`

**Interfaces:**
- Consumes: `model/` package + `model.run`.
- Produces: a scheduled workflow that regenerates snapshots and commits changes (triggering Vercel auto-deploy). No secrets required (ESPN is public).

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/predict.yml
name: Refresh predictions
on:
  schedule:
    - cron: "0 */6 * * *"   # every 6 hours
  workflow_dispatch: {}
permissions:
  contents: write
concurrency:
  group: predictions
  cancel-in-progress: false
jobs:
  predict:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
        with:
          python-version: "3.12"
      - name: Run model
        working-directory: model
        run: |
          uv sync
          uv run python -m model.run \
            --seed 42 --sims 10000 \
            --generated-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --data-dir ../data
      - name: Commit snapshots if changed
        run: |
          git config user.name "floodlit-bot"
          git config user.email "bot@users.noreply.github.com"
          git add data/
          if git diff --staged --quiet; then
            echo "No prediction changes."
          else
            git commit -m "chore(data): refresh predictions $(date -u +%FT%TZ)"
            git push
          fi
```

- [ ] **Step 2: Validate the workflow locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/predict.yml')); print('valid yaml')"`
Expected: `valid yaml`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/predict.yml
git commit -m "ci: scheduled prediction refresh"
```

- [ ] **Step 4: Trigger + verify (post-merge)**

After this lands on `main`: in GitHub → Actions → "Refresh predictions" → "Run workflow" (manual dispatch). Confirm it completes green and either commits a `data/` update or reports "No prediction changes."

---

## Self-Review

**Spec coverage** (spec §→ task):
- §3 data sources → Tasks 3 (history), 4 (ESPN). ✓
- §4.1 Dixon-Coles → Task 6; §4.2 Elo seed → Tasks 5 + 6 (`elo_prior_weight`); §4.3 market blend → Task 8; §4.4 live win-prob → **deferred** (it is a TS module on match pages, in a follow-on plan; this plan emits per-fixture `lambdaHome/lambdaAway` it needs — Task 17). ✓ (noted)
- §5 tournament sim (tiebreakers, best-thirds, R32, MC, seeded) → Tasks 9, 10, 11, 12, 13 (+ wiring 17). ✓
- §6 backtest/calibration + git-versioned snapshots → Tasks 14, 16, 17 (history snapshot), 18 (cron commits). ✓
- §7 architecture (offline Python, snapshots, cron, reproducibility) → Tasks 16, 17, 18; `MODEL_VERSION`/seed/inputsHash → Tasks 1, 16, 17. ✓
- §7.2 snapshot contracts → Task 16 (predictions), 17 (ratings); `calibration.json` full surface (reliability + vsMarket + trackRecord) is **partially** emitted — Task 14 computes the metrics; wiring them into a committed `calibration.json` is a small gap → **add as Task 17 follow-up** (see note below). 
- §8 surfaces (Next.js) → **out of scope for this plan** (follow-on plans), as stated in the header.
- §10 testing → every task is TDD. ✓
- §11 risks (bracket correctness, name normalization, odds-absent) → Tasks 11 (note), 2, 8 (`blend(None)`). ✓

**Gap found & resolved inline:** `calibration.json` is computed (Task 14) but not yet written by `run.py` (Task 17). Add to Task 17 Step 3 a `write_json(calibration, data/"predictions"/"calibration.json")` once historical backtest is wired; for v1 the backtest runs over `history` with the fitted `Strengths` and emits `{brier, logloss, reliability}`. (Implementer: fold this into Task 17 as a sixth write; it reuses `model.backtest` already built.)

**Placeholder scan:** no "TBD/TODO/handle edge cases"; the two "Note for implementer" blocks (Tasks 11, 13, 17) describe *real follow-up within the same task*, not vague gaps, and each names exactly what to do. ✓

**Type consistency:** `Outcome(home,draw,away)` used identically in Tasks 7, 8, 14; `Strengths(attack,defense,home_adv,rho)` identical in Tasks 6, 7(via rho), 12, 13, 17; `Fixture`/`Match` field names consistent across Tasks 3, 4, 17; `simulate(...) -> {"teams":{team:{...STAGES}}, "simCount","seed"}` consumed unchanged by Task 16/17. ✓

**Scope:** this plan is one coherent subsystem (the offline model → snapshots). The Next.js surfaces are explicitly separate follow-on plans. ✓

---

## Post-Review Revisions (5-agent adversarial review, 2026-06-20)

**Fixed inline in this plan:**
- **Calibration curve was degenerate** (Task 14) — `reliability()` binned the realized-class prob with `observed` always 1.0, so the curve (the spec's "honesty centerpiece") could never show miscalibration. Rewritten to bin per-class `(p, y)` points; test now asserts `observed ≈ predicted` for a calibrated synthetic set.
- **Negative scoreline probabilities** (Task 7) — a positive Dixon-Coles `rho` could drive a corrected low-score cell negative; added a non-negative clamp + a test, and constrained `rho ≤ 0` in the fit (Task 6).
- **Penalty-shootout strength used `attack − defense`** (Task 12) — wrong in this parameterization (higher defense = better); changed to `attack + defense`.
- **Played group results were dropped from standings** (Task 17 `build_tournament`) — finished fixtures went only to `played` (disjoint from `fixtures_remaining`), which `simulate` never read, so settled results were re-randomized. Now every group fixture is in `fixtures_remaining` and finished scores are fixed via `played_lookup`.
- **Wall-clock `as_of`** (Task 17) — `date.today()` broke reproducibility; now derived from `--generated-at`. Added `--history` so `test_run` fits the small fixture (not the 45k CSV) and asserts a non-empty tournament (the prior test could pass on an empty result).

**Flagged for the review gate — required before this plan is fully spec-conformant, but they need the official 2026 bracket data and/or modeling decisions, so they are called out rather than silently coded:**
1. **Real 2026-format knockout wiring.** `simulate` currently advances seeded group top-2 through a generic power-of-two bracket. The spec's main correctness surface (top-2 + **8 best third-placed** → official R32 slotting) needs: a new `model.bracket.assign_thirds(qualifying_third_groups, table)` + the official combination table in `bracket_2026.json`, and a `simulate(..., bracket_template=...)` hook that calls `best_thirds` (Task 10) + `assign_r32` (Task 11) per run. The knockout **stage-crediting** must also be fixed to credit round *entrants* (so exactly one team gets `winCup`).
2. **Snapshot contract completeness** (spec §7.2): add per-team `reachR32`, `groups[].finishProbs{p1..p4}` (a finish-position histogram in `simulate`), the per-slot `bracket[]` advancement array, a stable `id` (slug) alongside `name`, and per-stage `mcStdErr` (currently only `winCup`).
3. **`calibration.json` + report card** (spec §6): wire Task 14's metrics into a written `data/predictions/calibration.json`. `brier`/`logloss`/`reliability` over `history` are ready; `vsMarket` and `trackRecord` need historical odds / accruing tournament results and may phase in.
4. **`ratings.json` completeness** (spec §7.2): add `elo`, `overall`, and `style` (Task 15 needs per-team ESPN stats, not yet fetched — fetch or phase in).
5. **Elo-prior scaling** (Task 6): the cold-start penalty (`elo_prior_weight=0.1`) is swamped by the full-history likelihood; scale it by effective sample size (≈ `prior_weight · Σw` pseudo-observations) and add a test that a data-sparse team tracks its Elo prior.

These convert into 2–3 added tasks (an `assign_thirds` task, a `simulate` real-format upgrade with finish/slot tracking, and a `calibration.json`/`ratings.json` completion task) once the official 2026 R32 combination table is filled into `bracket_2026.json`.

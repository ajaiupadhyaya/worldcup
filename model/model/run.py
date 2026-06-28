import argparse
import hashlib
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from model.dixoncoles import fit_strengths, expected_goals
from model.elo import elo_ratings
from model.espn import parse_scoreboard, fetch_fixtures, Fixture
from model.history import Match, load_results
from model.market import blend
from model.predict import score_matrix, outcome_probs, top_scores
from model.bracket import build_topology
from model.simulate import Tournament, simulate
from model.snapshot import (
    build_calibration,
    build_predictions,
    build_ratings,
    validate_predictions,
    write_json,
)

_HISTORY = Path(__file__).resolve().parent.parent / "data" / "history" / "results.csv"

# Cap on post-cutoff matches scored in the calibration backtest, to keep the
# cron runtime bounded over the full ~45k-row history. We take the most-recent
# matches after the cutoff (the largest in-distribution OOS window).
_CALIBRATION_MAX_SAMPLES = 3000


def build_tournament(fixtures: list[Fixture]):
    # Group fixtures by their real ESPN group label (A..L); infer each group's
    # teams from played + scheduled matches. Fixtures without a group letter
    # (knockouts, or group matches ESPN hasn't labelled) are not group-stage.
    groups: dict[str, list[str]] = {}
    played, remaining = [], []
    for f in fixtures:
        g = f.group
        if not g:
            continue
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


def _outcome_label(home_goals: int, away_goals: int) -> str:
    if home_goals > away_goals:
        return "h"
    if home_goals < away_goals:
        return "a"
    return "d"


def _calibration_samples(history: list[Match], as_of: date) -> list[tuple]:
    """Frozen-cutoff out-of-sample backtest.

    Fit strengths ONCE on all matches up to a cutoff (~1 year before the most
    recent match, but never after `as_of`), then predict every later match with
    that frozen fit. This is a legitimate OOS evaluation at a fraction of the
    cost of a per-match walk-forward refit. Only matches whose BOTH teams were
    present in the fit are scored (others would fall back to default strengths
    and add no signal). Caps to the most-recent `_CALIBRATION_MAX_SAMPLES`.
    """
    in_window = [m for m in history if m.date <= as_of]
    if not in_window:
        return []
    latest = max(m.date for m in in_window)
    cutoff = min(latest - timedelta(days=365), as_of)
    fit_matches = [m for m in in_window if m.date <= cutoff]
    if not fit_matches:
        return []
    s = fit_strengths(in_window, as_of=cutoff)
    known = set(s.attack)
    post = [m for m in in_window if m.date > cutoff and m.home in known and m.away in known]
    post.sort(key=lambda m: m.date)
    post = post[-_CALIBRATION_MAX_SAMPLES:]

    samples: list[tuple] = []
    for m in post:
        lh, la = expected_goals(s, m.home, m.away, neutral=m.neutral)
        o = outcome_probs(score_matrix(lh, la, s.rho))
        samples.append((o, _outcome_label(m.home_goals, m.away_goals)))
    return samples


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
        (a.generated_at + str(len(history)) + str(len(fixtures)) + str(a.seed) + str(a.sims)).encode()
    ).hexdigest()[:12]

    data = Path(a.data_dir)
    pred = build_predictions(sim, rows, generated_at=a.generated_at, inputs_hash=inputs_hash)
    validate_predictions(pred)
    write_json(pred, data / "predictions" / "latest.json")
    write_json(pred, data / "predictions" / "history" / f"{a.generated_at.replace(':', '-')}.json")
    # Slim topology for the web (never imports model/data/bracket_2026.json).
    write_json(build_topology(), data / "topology.json")

    # Ratings: attack/defense from the fit + Elo over the as_of-filtered history.
    # `style` is left empty here (per-team ESPN season stats aren't fetched in
    # this plan — an explicit follow-on populates them via model.style.fingerprint).
    elo = elo_ratings([m for m in history if m.date <= as_of])
    write_json(
        build_ratings(s, elo, {t: {} for t in s.attack}, generated_at=a.generated_at),
        data / "ratings" / "latest.json",
    )

    # Calibration: frozen-cutoff out-of-sample backtest over the history.
    cal_samples = _calibration_samples(history, as_of)
    write_json(
        build_calibration(cal_samples, generated_at=a.generated_at),
        data / "predictions" / "calibration.json",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

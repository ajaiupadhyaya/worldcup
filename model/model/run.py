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

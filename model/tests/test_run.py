import json
from pathlib import Path

from model.espn import Fixture
from model.run import build_tournament, main

FIX = Path(__file__).parent / "fixtures" / "espn_scoreboard.json"
SMALL_HISTORY = Path(__file__).parent / "fixtures" / "results_small.csv"


def _gf(fid, home, away, group, status="scheduled", hg=None, ag=None):
    return Fixture(
        id=fid, home=home, away=away, kickoff="2026-06-11T19:00Z",
        round="group-stage", status=status, home_goals=hg, away_goals=ag,
        neutral=True, group=group,
    )


def test_build_tournament_uses_real_group_labels():
    fx = [
        _gf("1", "Mexico", "South Africa", "A"),
        _gf("2", "France", "Senegal", "B"),
        _gf("3", "Mexico", "France", "A", status="finished", hg=2, ag=1),
    ]
    t, _ = build_tournament(fx)
    assert set(t.groups) == {"A", "B"}
    assert "?" not in t.groups
    assert t.groups["A"] == ["Mexico", "South Africa", "France"]
    assert t.groups["B"] == ["France", "Senegal"]
    # The finished group-A match is recorded as a settled result.
    assert ("Mexico", "France", 2, 1) in t.played


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
    assert "id" in latest["teams"][0]        # stable slug present
    assert "groups" in latest and "bracket" in latest

    # ratings snapshot: rows carry elo + overall (attack+defense) + style
    ratings = json.loads((tmp_path / "ratings" / "latest.json").read_text())
    assert ratings["teams"], "ratings should not be empty"
    r0 = ratings["teams"][0]
    for k in ("id", "name", "attack", "defense", "elo", "overall", "style"):
        assert k in r0, f"ratings row missing {k}"

    # calibration snapshot: out-of-sample backtest metrics
    cal = json.loads((tmp_path / "predictions" / "calibration.json").read_text())
    for k in ("generatedAt", "brier", "logloss", "reliability"):
        assert k in cal, f"calibration missing {k}"
    assert isinstance(cal["reliability"], list)

    topo = json.loads((tmp_path / "topology.json").read_text())
    assert set(topo) == {"r32", "progression"}
    assert len(topo["r32"]) == 16
    assert topo["progression"]["M89"] == ["M74", "M77"]

    # determinism: a second run with same seed produces identical predictions
    main(_args(tmp_path / "b"))
    b = json.loads((tmp_path / "b" / "predictions" / "latest.json").read_text())
    assert b["teams"] == latest["teams"]
    bcal = json.loads((tmp_path / "b" / "predictions" / "calibration.json").read_text())
    assert bcal == cal

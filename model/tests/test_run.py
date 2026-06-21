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

import json
from pathlib import Path

from model.predict import Outcome
from model.snapshot import (
    _TEAM_KEYS,
    build_calibration,
    build_predictions,
    build_ratings,
    validate_predictions,
    write_json,
)


def test_build_and_validate_roundtrip(tmp_path: Path):
    stages = {"qualify": 0.9, "reachR32": 0.9, "reachR16": 0.7, "reachQF": 0.5,
              "reachSF": 0.3, "reachFinal": 0.2, "winCup": 0.12}
    sim = {"teams": {"Brazil": {**stages,
                                "mcStdErr": {k: 0.003 for k in stages}}},
           "simCount": 10000, "seed": 42}
    obj = build_predictions(sim, fixtures=[],
                            generated_at="2026-06-20T00:00:00Z", inputs_hash="abc")
    validate_predictions(obj)  # should not raise
    p = tmp_path / "latest.json"
    write_json(obj, p)
    reloaded = json.loads(p.read_text())
    assert reloaded["teams"][0]["winCup"] == 0.12
    assert reloaded["teams"][0]["id"] == "brazil"
    assert reloaded["seed"] == 42


def test_validate_rejects_missing_field():
    import pytest
    with pytest.raises(ValueError):
        validate_predictions({"teams": [{"name": "X"}]})  # missing required keys


def test_team_keys_include_reachR32_and_groups_bracket():
    assert "reachR32" in _TEAM_KEYS
    sim = {"teams": {"Brazil": {k: 0.5 for k in
            ("qualify", "reachR32", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")}},
           "groups": [{"group": "C", "teams": [{"id": "Brazil",
                       "finishProbs": {"p1": .6, "p2": .25, "p3": .1, "p4": .05}}]}],
           "bracket": [{"slot": "M104", "round": "F",
                        "sides": [[{"id": "brazil", "prob": .5}],
                                  [{"id": "france", "prob": .5}]],
                        "winner": [{"id": "brazil", "prob": .12}]}],
           "simCount": 100, "seed": 1}
    obj = build_predictions(sim, fixtures=[], generated_at="2026-06-20T00:00:00Z", inputs_hash="x")
    assert obj["groups"][0]["group"] == "C"
    assert obj["bracket"][0]["slot"] == "M104"
    assert obj["bracket"][0]["round"] == "F"
    assert obj["bracket"][0]["winner"][0]["id"] == "brazil"
    assert obj["teams"][0]["reachR32"] == 0.5
    assert obj["teams"][0]["id"] == "brazil"


def test_build_predictions_passes_through_thirds_table_complete():
    sim = {"teams": {"Brazil": {k: 0.5 for k in
            ("qualify", "reachR32", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")}},
           "groups": [], "bracket": [], "thirdsTableComplete": False,
           "simCount": 100, "seed": 1}
    obj = build_predictions(sim, fixtures=[], generated_at="2026-06-20T00:00:00Z", inputs_hash="x")
    assert obj["thirdsTableComplete"] is False


class _Strengths:
    def __init__(self, attack, defense):
        self.attack = attack
        self.defense = defense


def test_build_ratings_rows():
    s = _Strengths(attack={"Brazil": 0.4, "Spain": 0.3},
                   defense={"Brazil": 0.2, "Spain": 0.25})
    out = build_ratings(s, {"Brazil": 1850.0}, {"Brazil": {"possession": 0.6}},
                        generated_at="2026-06-20T00:00:00Z")
    by_name = {r["name"]: r for r in out["teams"]}
    bra = by_name["Brazil"]
    assert bra["id"] == "brazil"
    assert bra["attack"] == 0.4 and bra["defense"] == 0.2
    assert bra["elo"] == 1850.0
    assert abs(bra["overall"] - 0.6) < 1e-9
    assert bra["style"] == {"possession": 0.6}
    # team absent from elo/style maps gets defaults
    esp = by_name["Spain"]
    assert esp["elo"] == 1500.0 and esp["style"] == {}
    assert out["generatedAt"] == "2026-06-20T00:00:00Z"


def test_build_calibration_metrics():
    samples = [
        (Outcome(home=0.7, draw=0.2, away=0.1), "h"),
        (Outcome(home=0.2, draw=0.6, away=0.2), "d"),
        (Outcome(home=0.1, draw=0.3, away=0.6), "a"),
    ]
    out = build_calibration(samples, generated_at="2026-06-20T00:00:00Z")
    assert out["generatedAt"] == "2026-06-20T00:00:00Z"
    assert out["brier"] > 0.0
    assert out["logloss"] > 0.0
    assert isinstance(out["reliability"], list) and out["reliability"]


def test_build_calibration_empty_samples_safe():
    out = build_calibration([], generated_at="2026-06-20T00:00:00Z")
    assert out["brier"] == 0.0 and out["logloss"] == 0.0


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


def test_partial_tournament_skips_qualify_reachR32_guard():
    """Regression: partial field (reachR32 total < 31.5) must NOT raise even when
    qualify=1.0 and reachR32=0.0 for a team.  If the guard were made unconditional
    this test would fail."""
    stages = {"qualify": 1.0, "reachR32": 0.0, "reachR16": 0.0,
              "reachQF": 0.0, "reachSF": 0.0, "reachFinal": 0.0, "winCup": 0.0}
    team = {"id": "brazil", "name": "Brazil", **stages,
            "mcStdErr": {k: 0.0 for k in stages}}
    # total reachR32 = 0.0 < 31.5 → partial field → guard is skipped
    validate_predictions({"generatedAt": "x", "modelVersion": "v", "seed": 1,
                          "teams": [team]})  # must not raise


def test_calibration_nonregression_gate():
    import pytest
    from model.snapshot import validate_calibration_nonregression
    # Illustrative values to exercise the function arithmetic;
    # the live baseline is model/data/calibration_baseline.json (fw=0.4).
    base = {"brier": 0.5226, "logloss": 0.8865, "eps": 0.01}
    validate_calibration_nonregression({"brier": 0.52, "logloss": 0.88}, base)  # ok
    with pytest.raises(ValueError):
        validate_calibration_nonregression({"brier": 0.55, "logloss": 0.88}, base)
    with pytest.raises(ValueError):
        validate_calibration_nonregression({"brier": 0.52, "logloss": 0.95}, base)

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

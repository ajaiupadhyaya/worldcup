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

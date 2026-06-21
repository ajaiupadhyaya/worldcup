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


def test_parse_scoreboard_extracts_group_from_alt_note():
    # Both fixture events carry altGameNote "FIFA World Cup, Group A".
    data = json.loads(FIX.read_text())
    fx = parse_scoreboard(data)
    assert all(f.group == "A" for f in fx)


def test_parse_scoreboard_group_blank_for_knockout():
    # Knockout events have no "Group X" in their note -> empty group label.
    ev = {
        "events": [
            {
                "id": "9001",
                "date": "2026-07-04T19:00Z",
                "season": {"slug": "round-of-32"},
                "competitions": [
                    {
                        "altGameNote": "FIFA World Cup, Round of 32",
                        "neutralSite": True,
                        "status": {"type": {"state": "pre", "completed": False}},
                        "competitors": [
                            {"homeAway": "home", "team": {"displayName": "Brazil"}, "score": None},
                            {"homeAway": "away", "team": {"displayName": "Spain"}, "score": None},
                        ],
                    }
                ],
            }
        ]
    }
    f = parse_scoreboard(ev)[0]
    assert f.group == ""

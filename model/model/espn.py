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

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
                home = normalize(r["home_team"])
                away = normalize(r["away_team"])
                out.append(
                    Match(
                        date=d,
                        home=home,
                        away=away,
                        home_goals=hg,
                        away_goals=ag,
                        neutral=_to_bool(r.get("neutral", "FALSE")),
                        tournament=r.get("tournament", ""),
                    )
                )
            except (ValueError, KeyError):
                continue  # skip unscored / malformed rows
    out.sort(key=lambda m: m.date)
    return out

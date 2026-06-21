from datetime import date
from pathlib import Path

from model.history import load_results

FIX = Path(__file__).parent / "fixtures" / "results_small.csv"


def test_load_parses_and_normalizes():
    rows = load_results(FIX)
    assert len(rows) == 3
    assert rows[0].date == date(2018, 6, 14)          # sorted ascending
    assert rows[2].home == "South Korea"              # alias normalized
    assert rows[2].away == "United States"
    assert rows[1].neutral is True                    # "TRUE" -> bool
    assert rows[0].home_goals == 5 and rows[0].away_goals == 0
    assert rows[2].date == date(2022, 12, 18)        # Korea match is latest

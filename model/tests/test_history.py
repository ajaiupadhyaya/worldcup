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


def test_load_skips_rows_with_missing_team_fields(tmp_path):
    """Test that rows with missing team columns are skipped, not crashed."""
    csv_file = tmp_path / "test_results.csv"
    # Header is missing away_team column; DictReader will not have that key in the row dict
    csv_file.write_text(
        "date,home_team,home_score,away_score,tournament\n"
        "2020-06-01,Brazil,2,1,Friendly\n"
    )
    rows = load_results(csv_file)
    # Row is missing away_team column, so should be skipped instead of crashing
    assert len(rows) == 0

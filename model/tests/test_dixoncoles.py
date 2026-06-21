from datetime import date

from model.history import Match
from model.dixoncoles import fit_strengths, expected_goals


def _league(strong, weak, n=20):
    # `strong` beats `weak` repeatedly; expect higher attack / lower defense.
    return [Match(date(2024, 1, 1), strong, weak, 3, 0, True, "t") for _ in range(n)] + [
        Match(date(2024, 1, 1), weak, strong, 0, 2, True, "t") for _ in range(n)
    ]


def test_stronger_team_has_higher_expected_goals():
    s = fit_strengths(_league("A", "B"), as_of=date(2024, 6, 1))
    la, lb = expected_goals(s, "A", "B", neutral=True)
    assert la > lb


def test_expected_goals_are_positive():
    s = fit_strengths(_league("A", "B"), as_of=date(2024, 6, 1))
    la, lb = expected_goals(s, "A", "B", neutral=True)
    assert la > 0 and lb > 0

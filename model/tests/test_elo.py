from datetime import date

from model.history import Match
from model.elo import elo_ratings


def _m(h, a, hg, ag):
    return Match(date(2020, 1, 1), h, a, hg, ag, neutral=True, tournament="t")


def test_winner_gains_loser_loses_and_zero_sum_drift():
    r = elo_ratings([_m("A", "B", 3, 0)], base=1500.0)
    assert r["A"] > 1500.0 > r["B"]


def test_repeated_wins_increase_gap_monotonically():
    one = elo_ratings([_m("A", "B", 1, 0)])
    many = elo_ratings([_m("A", "B", 1, 0)] * 5)
    assert (many["A"] - many["B"]) > (one["A"] - one["B"])


def test_deterministic():
    ms = [_m("A", "B", 2, 1), _m("B", "C", 0, 0)]
    assert elo_ratings(ms) == elo_ratings(ms)

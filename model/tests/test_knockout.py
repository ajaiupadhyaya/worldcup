import numpy as np

from model.dixoncoles import Strengths
from model.knockout import sim_knockout


def _s():
    return Strengths(attack={"A": 0.8, "B": -0.8}, defense={"A": 0.5, "B": -0.5},
                     home_adv=0.0, rho=-0.05)


def test_returns_one_of_the_teams():
    rng = np.random.default_rng(1)
    assert sim_knockout(_s(), "A", "B", rng) in ("A", "B")


def test_stronger_team_wins_majority_and_is_deterministic_by_seed():
    wins = sum(sim_knockout(_s(), "A", "B", np.random.default_rng(i)) == "A" for i in range(200))
    assert wins > 130  # A clearly stronger
    # determinism: same seed -> same result
    assert sim_knockout(_s(), "A", "B", np.random.default_rng(7)) == sim_knockout(
        _s(), "A", "B", np.random.default_rng(7))

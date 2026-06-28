import numpy as np

from model.dixoncoles import Strengths, expected_goals
from model.predict import sample_scoreline


def sim_knockout(s: Strengths, home: str, away: str, rng: np.random.Generator) -> str:
    lh, la = expected_goals(s, home, away, neutral=True)
    gh, ga = sample_scoreline(lh, la, s.rho, rng)
    if gh != ga:
        return home if gh > ga else away
    # Extra time: 30 mins ~ 1/3 of normal-time rate, same DC coupling.
    eth, eta = sample_scoreline(lh / 3.0, la / 3.0, s.rho, rng)
    gh += eth
    ga += eta
    if gh != ga:
        return home if gh > ga else away
    # Penalties: strength-tilted coin. A HIGHER defense rating means fewer
    # conceded, so overall strength is attack+defense (both "good" dimensions).
    sh = s.attack.get(home, 0.0) + s.defense.get(home, 0.0)
    sa = s.attack.get(away, 0.0) + s.defense.get(away, 0.0)
    p_home = 1.0 / (1.0 + np.exp(-(sh - sa)))
    return home if rng.random() < p_home else away

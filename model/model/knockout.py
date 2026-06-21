import numpy as np

from model.dixoncoles import Strengths, expected_goals


def _draw_goals(lam: float, rng: np.random.Generator) -> int:
    return int(rng.poisson(lam))


def sim_knockout(s: Strengths, home: str, away: str, rng: np.random.Generator) -> str:
    lh, la = expected_goals(s, home, away, neutral=True)
    gh, ga = _draw_goals(lh, rng), _draw_goals(la, rng)
    if gh != ga:
        return home if gh > ga else away
    # Extra time: 30 mins ~ 1/3 of normal-time scoring rate.
    gh += _draw_goals(lh / 3.0, rng)
    ga += _draw_goals(la / 3.0, rng)
    if gh != ga:
        return home if gh > ga else away
    # Penalties: strength-tilted coin. In this parameterization a HIGHER
    # defense rating means fewer conceded, so overall strength is attack+defense
    # (both are "good" dimensions) — not attack-defense.
    sh = s.attack.get(home, 0.0) + s.defense.get(home, 0.0)
    sa = s.attack.get(away, 0.0) + s.defense.get(away, 0.0)
    p_home = 1.0 / (1.0 + np.exp(-(sh - sa)))
    return home if rng.random() < p_home else away

import math

from model.history import Match


def _expected(ra: float, rb: float) -> float:
    return 1.0 / (1.0 + 10.0 ** ((rb - ra) / 400.0))


def _mov_multiplier(goal_diff: int, rating_diff: float) -> float:
    # FIFA-style margin-of-victory weighting (dampened for blowouts).
    gd = abs(goal_diff)
    if gd <= 1:
        return 1.0
    return math.log(gd + 1.0) * (2.2 / ((rating_diff if rating_diff > 0 else 0.0) * 0.001 + 2.2))


def elo_ratings(
    matches: list[Match], *, base: float = 1500.0, k: float = 20.0, home_adv: float = 65.0
) -> dict[str, float]:
    r: dict[str, float] = {}
    for m in matches:
        ra = r.get(m.home, base)
        rb = r.get(m.away, base)
        adv = 0.0 if m.neutral else home_adv
        exp_home = _expected(ra + adv, rb)
        if m.home_goals > m.away_goals:
            score = 1.0
        elif m.home_goals < m.away_goals:
            score = 0.0
        else:
            score = 0.5
        mult = _mov_multiplier(m.home_goals - m.away_goals, (ra + adv) - rb)
        delta = k * mult * (score - exp_home)
        r[m.home] = ra + delta
        r[m.away] = rb - delta
    return r

import math
from dataclasses import dataclass
from datetime import date

import numpy as np
from scipy.optimize import minimize

from model.elo import elo_ratings
from model.history import Match


@dataclass(frozen=True)
class Strengths:
    attack: dict[str, float]
    defense: dict[str, float]
    home_adv: float
    rho: float


def _weights(matches: list[Match], as_of: date, half_life_days: float) -> np.ndarray:
    xi = math.log(2.0) / half_life_days
    days = np.array([(as_of - m.date).days for m in matches], dtype=float)
    days = np.clip(days, 0.0, None)
    return np.exp(-xi * days)


def fit_strengths(
    matches: list[Match],
    *,
    half_life_days: float = 365.0,
    as_of: date,
    elo_prior_weight: float = 0.1,
) -> Strengths:
    # Enforce as_of semantics: exclude any match dated after the cutoff so that
    # callers (e.g. walk-forward backtests) cannot leak future results into the
    # Elo prior seed or the likelihood weights.
    matches = [m for m in matches if m.date <= as_of]
    if not matches:
        raise ValueError(f"fit_strengths: no matches on or before as_of={as_of}")
    teams = sorted({m.home for m in matches} | {m.away for m in matches})
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    w = _weights(matches, as_of, half_life_days)
    hi = np.array([idx[m.home] for m in matches])
    ai = np.array([idx[m.away] for m in matches])
    hg = np.array([m.home_goals for m in matches], dtype=float)
    ag = np.array([m.away_goals for m in matches], dtype=float)
    neutral = np.array([m.neutral for m in matches], dtype=bool)

    # Elo prior on overall strength (attack-defense), normalized.
    elo = elo_ratings(matches)
    prior = np.array([(elo.get(t, 1500.0) - 1500.0) / 200.0 for t in teams])

    # params: [attack(n-1 free, last = -sum), defense(n-1 free), home_adv, rho]
    def unpack(p):
        atk = np.zeros(n)
        atk[:-1] = p[: n - 1]
        atk[-1] = -atk[:-1].sum()
        dfn = np.zeros(n)
        dfn[:-1] = p[n - 1 : 2 * n - 2]
        dfn[-1] = -dfn[:-1].sum()
        return atk, dfn, p[-2], p[-1]

    def neg_ll(p):
        atk, dfn, ha, rho = unpack(p)
        lh = np.exp(atk[hi] - dfn[ai] + np.where(neutral, 0.0, ha))
        la = np.exp(atk[ai] - dfn[hi])
        # Poisson log-likelihood + Dixon-Coles low-score correction.
        ll = hg * np.log(lh) - lh + ag * np.log(la) - la
        tau = np.ones_like(lh)
        m00 = (hg == 0) & (ag == 0)
        m10 = (hg == 1) & (ag == 0)
        m01 = (hg == 0) & (ag == 1)
        m11 = (hg == 1) & (ag == 1)
        tau = np.where(m00, 1.0 - lh * la * rho, tau)
        tau = np.where(m10, 1.0 + la * rho, tau)
        tau = np.where(m01, 1.0 + lh * rho, tau)
        tau = np.where(m11, 1.0 - rho, tau)
        ll = ll + np.log(np.clip(tau, 1e-9, None))
        # Scale the prior to the data magnitude so it actually anchors
        # data-sparse teams instead of being swamped by the full-history
        # likelihood (Σw·ll is O(10^3-10^4); an unscaled O(10^1) penalty does
        # nothing). `elo_prior_weight` is then "prior pseudo-matches per team",
        # tunable by backtest.
        prior_strength = elo_prior_weight * w.sum() / max(n, 1)
        prior_pen = prior_strength * np.sum((atk - dfn - prior) ** 2)
        return -np.sum(w * ll) + prior_pen

    x0 = np.concatenate([np.zeros(2 * n - 2), [0.25, -0.05]])
    # Dixon-Coles rho is constrained <= 0 (positive rho can drive corrected
    # low-score cells negative — see predict.score_matrix clamp).
    res = minimize(neg_ll, x0, method="L-BFGS-B",
                   bounds=[(-3, 3)] * (2 * n - 2) + [(-1, 1), (-0.2, 0.0)])
    atk, dfn, ha, rho = unpack(res.x)
    return Strengths(
        attack={t: float(atk[idx[t]]) for t in teams},
        defense={t: float(dfn[idx[t]]) for t in teams},
        home_adv=float(ha),
        rho=float(rho),
    )


def expected_goals(s: Strengths, home: str, away: str, neutral: bool) -> tuple[float, float]:
    ha = 0.0 if neutral else s.home_adv
    lh = math.exp(s.attack.get(home, 0.0) - s.defense.get(away, 0.0) + ha)
    la = math.exp(s.attack.get(away, 0.0) - s.defense.get(home, 0.0))
    return lh, la

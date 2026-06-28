from dataclasses import dataclass

import numpy as np
from scipy.stats import poisson


@dataclass(frozen=True)
class Outcome:
    home: float
    draw: float
    away: float


def score_matrix(lh: float, la: float, rho: float, max_goals: int = 10) -> np.ndarray:
    h = poisson.pmf(np.arange(max_goals + 1), lh)
    a = poisson.pmf(np.arange(max_goals + 1), la)
    m = np.outer(h, a)
    # Dixon-Coles low-score correction on the four cells.
    m[0, 0] *= 1.0 - lh * la * rho
    m[1, 0] *= 1.0 + la * rho
    m[0, 1] *= 1.0 + lh * rho
    m[1, 1] *= 1.0 - rho
    m = np.clip(m, 0.0, None)  # a positive rho can push a corrected cell negative
    return m / m.sum()


def outcome_probs(matrix: np.ndarray) -> Outcome:
    home = float(np.tril(matrix, -1).sum())
    away = float(np.triu(matrix, 1).sum())
    draw = float(np.trace(matrix))
    return Outcome(home=home, draw=draw, away=away)


def top_scores(matrix: np.ndarray, k: int = 5) -> list[tuple[str, float]]:
    flat = [(f"{h}-{a}", float(matrix[h, a]))
            for h in range(matrix.shape[0]) for a in range(matrix.shape[1])]
    flat.sort(key=lambda x: x[1], reverse=True)
    return flat[:k]


from functools import lru_cache  # noqa: E402  (kept near its use)


@lru_cache(maxsize=None)
def _corrected_flat(lh: float, la: float, rho: float, max_goals: int = 10):
    """Flattened DC-corrected score matrix for an ordered (lh, la, rho).

    Cached because the MC draws ~10^6 scorelines per run but the distinct
    (lambda_home, lambda_away) pairs are bounded by realized fixtures (<~5k).
    Returns (flat_probs, n_cols) for rng.choice over flattened cells.
    """
    m = score_matrix(lh, la, rho, max_goals)
    return m.ravel(), m.shape[1]


def sample_scoreline(lh: float, la: float, rho: float, rng) -> tuple[int, int]:
    """Sample (home_goals, away_goals) from the DC-corrected joint distribution."""
    flat, ncols = _corrected_flat(lh, la, rho)
    idx = int(rng.choice(flat.size, p=flat))
    return idx // ncols, idx % ncols

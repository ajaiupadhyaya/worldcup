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

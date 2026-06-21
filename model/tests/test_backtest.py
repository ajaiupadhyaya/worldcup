import math

from model.predict import Outcome
from model.backtest import brier, logloss, reliability


def test_perfect_prediction_scores_zero_brier():
    assert brier(Outcome(1.0, 0.0, 0.0), "h") == 0.0


def test_brier_penalizes_wrong_confident_prediction():
    assert brier(Outcome(1.0, 0.0, 0.0), "a") == 2.0  # (1-0)^2 + 0 + (0-1)^2


def test_logloss_finite_and_lower_when_right():
    right = logloss(Outcome(0.8, 0.1, 0.1), "h")
    wrong = logloss(Outcome(0.1, 0.1, 0.8), "h")
    assert math.isfinite(right) and right < wrong


def test_reliability_curve_tracks_a_calibrated_model():
    # Perfectly-calibrated synthetic set: with a constant 0.70/0.15/0.15
    # prediction, home occurs 70% of the time, draw 15%, away 15%.
    samples = []
    for i in range(100):
        actual = "h" if i < 70 else ("d" if i < 85 else "a")
        samples.append((Outcome(0.70, 0.15, 0.15), actual))
    bins = reliability(samples, bins=10)
    assert sum(b["n"] for b in bins) == 300        # 3 classes * 100 matches
    assert any(b["n"] > 0 for b in bins)           # at least one populated bin
    hot = next(b for b in bins if b["n"] and 0.6 <= b["binMid"] <= 0.8)
    assert abs(hot["observed"] - 0.70) < 0.06       # observed tracks predicted
    low = next(b for b in bins if b["n"] and 0.1 <= b["binMid"] <= 0.2)
    assert low["observed"] < 0.30                   # not degenerate at 1.0

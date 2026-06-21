from model.predict import Outcome
from model.market import implied_probs, blend


def test_implied_probs_sum_to_one():
    o = implied_probs(2.0, 3.4, 4.0)
    assert abs(o.home + o.draw + o.away - 1.0) < 1e-9
    assert o.home > o.away  # shorter odds -> higher prob


def test_blend_without_market_returns_model():
    m = Outcome(0.5, 0.3, 0.2)
    assert blend(m, None) == m


def test_blend_is_convex_combination():
    m = Outcome(0.6, 0.2, 0.2)
    mk = Outcome(0.4, 0.2, 0.4)
    b = blend(m, mk, kappa=0.5)
    assert abs(b.home - 0.5) < 1e-9
    assert abs(b.home + b.draw + b.away - 1.0) < 1e-9

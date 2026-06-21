from model.predict import score_matrix, outcome_probs, top_scores


def test_matrix_sums_to_one():
    m = score_matrix(1.4, 1.1, rho=-0.05)
    assert abs(m.sum() - 1.0) < 1e-6


def test_matrix_never_negative_even_with_extreme_correction():
    # high lambdas + the (clamped) correction must not yield negative cells
    m = score_matrix(3.2, 3.0, rho=-0.2)
    assert (m >= 0).all()
    assert abs(m.sum() - 1.0) < 1e-6


def test_outcome_probs_sum_to_one_and_favor_stronger():
    m = score_matrix(2.0, 0.7, rho=-0.05)
    o = outcome_probs(m)
    assert abs(o.home + o.draw + o.away - 1.0) < 1e-6
    assert o.home > o.away


def test_top_scores_sorted_desc():
    m = score_matrix(1.5, 1.2, rho=-0.05)
    ts = top_scores(m, k=3)
    probs = [p for _, p in ts]
    assert probs == sorted(probs, reverse=True)
    assert "-" in ts[0][0]

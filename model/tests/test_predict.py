from model.predict import score_matrix, outcome_probs, top_scores


def test_sample_scoreline_deterministic_and_in_range():
    import numpy as np
    from model.predict import sample_scoreline
    a = sample_scoreline(1.6, 1.1, -0.05, np.random.default_rng(3))
    b = sample_scoreline(1.6, 1.1, -0.05, np.random.default_rng(3))
    assert a == b                       # seeded determinism
    assert 0 <= a[0] <= 10 and 0 <= a[1] <= 10


def test_sample_scoreline_marginals_track_lambda():
    import numpy as np
    from model.predict import sample_scoreline
    rng = np.random.default_rng(0)
    draws = [sample_scoreline(2.4, 0.6, -0.05, rng) for _ in range(4000)]
    mh = sum(h for h, _ in draws) / len(draws)
    ma = sum(a for _, a in draws) / len(draws)
    assert mh > ma                      # home lambda dominates
    assert abs(mh - 2.4) < 0.25         # empirical mean near lambda_home


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

from datetime import date

from model.history import Match
from model.dixoncoles import fit_strengths, expected_goals


def _league(strong, weak, n=20):
    # `strong` beats `weak` repeatedly; expect higher attack / lower defense.
    return [Match(date(2024, 1, 1), strong, weak, 3, 0, True, "t") for _ in range(n)] + [
        Match(date(2024, 1, 1), weak, strong, 0, 2, True, "t") for _ in range(n)
    ]


def test_stronger_team_has_higher_expected_goals():
    s = fit_strengths(_league("A", "B"), as_of=date(2024, 6, 1))
    la, lb = expected_goals(s, "A", "B", neutral=True)
    assert la > lb


def test_expected_goals_are_positive():
    s = fit_strengths(_league("A", "B"), as_of=date(2024, 6, 1))
    la, lb = expected_goals(s, "A", "B", neutral=True)
    assert la > 0 and lb > 0


def test_home_advantage_applied():
    """Fit on non-neutral matches and verify home team gets a boost."""
    matches = [
        Match(date(2024, 1, i + 1), "A", "B", 1, 1, False, "t") for i in range(30)
    ] + [
        Match(date(2024, 1, i + 1), "B", "A", 1, 1, False, "t") for i in range(30)
    ]
    s = fit_strengths(matches, as_of=date(2024, 6, 1))
    # Home advantage coefficient should be positive (home team boosted).
    assert s.home_adv > 0.0
    # Expected goals for A at home should exceed A on a neutral venue.
    lh_home, _ = expected_goals(s, "A", "B", neutral=False)
    lh_neutral, _ = expected_goals(s, "A", "B", neutral=True)
    assert lh_home > lh_neutral


def test_fit_strengths_excludes_post_cutoff_matches():
    """Leak-guard: matches after as_of must not influence the fit.

    Build two lists that are identical up to a cutoff date, but the second
    list also contains post-cutoff matches where B dominates A.  Both calls
    use the same as_of=cutoff, so the extra future matches must be silently
    ignored and both fits must agree that A is the stronger team.
    """
    cutoff = date(2024, 6, 1)

    # Pre-cutoff history: A beats B convincingly (20 matches each way).
    pre = [
        Match(date(2024, 1, 1), "A", "B", 3, 0, True, "t") for _ in range(20)
    ] + [
        Match(date(2024, 1, 1), "B", "A", 0, 2, True, "t") for _ in range(20)
    ]

    # Post-cutoff noise: B dominates A — should be invisible to the fit.
    post = [
        Match(date(2024, 9, 1), "B", "A", 5, 0, True, "t") for _ in range(30)
    ] + [
        Match(date(2024, 9, 1), "A", "B", 0, 4, True, "t") for _ in range(30)
    ]

    s_clean = fit_strengths(pre, as_of=cutoff)
    s_leaked = fit_strengths(pre + post, as_of=cutoff)

    # Both fits must agree: A has higher expected goals vs B.
    la_clean, lb_clean = expected_goals(s_clean, "A", "B", neutral=True)
    la_leaked, lb_leaked = expected_goals(s_leaked, "A", "B", neutral=True)

    assert la_clean > lb_clean, "baseline: A should dominate B on pre-cutoff data"
    assert la_leaked > lb_leaked, "leak guard failed: post-cutoff matches flipped the ordering"

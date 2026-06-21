from model.dixoncoles import Strengths
from model.simulate import Tournament, simulate


def _two_group_tournament():
    groups = {"A": ["A1", "A2", "A3", "A4"], "B": ["B1", "B2", "B3", "B4"]}
    remaining = [("A", h, a) for h in groups["A"] for a in groups["A"] if h < a] + \
                [("B", h, a) for h in groups["B"] for a in groups["B"] if h < a]
    return Tournament(groups=groups, played=[], fixtures_remaining=remaining)


def _flat_strengths(teams):
    return Strengths(attack={t: 0.0 for t in teams}, defense={t: 0.0 for t in teams},
                     home_adv=0.0, rho=-0.05)


def test_probabilities_in_range_and_deterministic():
    t = _two_group_tournament()
    teams = t.groups["A"] + t.groups["B"]
    s = _flat_strengths(teams)
    r1 = simulate(t, s, sims=200, seed=42)
    r2 = simulate(t, s, sims=200, seed=42)
    assert r1 == r2  # seeded determinism
    for stats in r1["teams"].values():
        assert 0.0 <= stats["qualify"] <= 1.0
        assert 0.0 <= stats["winCup"] <= 1.0


def test_two_qualify_per_group_on_average():
    t = _two_group_tournament()
    teams = t.groups["A"] + t.groups["B"]
    r = simulate(t, _flat_strengths(teams), sims=300, seed=1)
    qa = sum(r["teams"][x]["qualify"] for x in t.groups["A"])
    assert abs(qa - 2.0) < 0.05  # exactly 2 of 4 advance from group A


def test_played_results_drive_standings_disjoint():
    # "Alpha" has already won all 3 of its group matches (9 pts, +9 GD).
    # The other 3 teams have split results (3 pts max possible) so Alpha
    # is guaranteed to top Group A regardless of remaining Beta/Gamma/Delta
    # head-to-head fixtures.  Those remaining fixtures are in fixtures_remaining
    # and NOT in played — the disjoint split that exposed the original bug.
    groups = {
        "A": ["Alpha", "Beta", "Gamma", "Delta"],
        "B": ["B1", "B2", "B3", "B4"],
    }
    # Alpha beat every opponent 3-0; opponents have 0 pts from Alpha games.
    # Remaining A fixtures: Beta vs Gamma, Beta vs Delta, Gamma vs Delta.
    # Even if one team wins both, it gets 6 pts — Alpha has 9.  Alpha tops A.
    played = [
        ("Alpha", "Beta", 3, 0),
        ("Alpha", "Gamma", 3, 0),
        ("Alpha", "Delta", 3, 0),
    ]
    remaining_a = [
        ("A", "Beta", "Gamma"),
        ("A", "Beta", "Delta"),
        ("A", "Gamma", "Delta"),
    ]
    remaining_b = [
        ("B", h, a)
        for h in groups["B"]
        for a in groups["B"]
        if h < a
    ]
    t = Tournament(
        groups=groups,
        played=played,
        fixtures_remaining=remaining_a + remaining_b,
    )
    all_teams = groups["A"] + groups["B"]
    s = _flat_strengths(all_teams)
    r = simulate(t, s, sims=200, seed=7)
    # Alpha's 9 pts / +9 GD is unreachable — it must always qualify.
    assert r["teams"]["Alpha"]["qualify"] == 1.0

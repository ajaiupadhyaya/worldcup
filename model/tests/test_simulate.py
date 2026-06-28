from model.dixoncoles import Strengths
from model.simulate import STAGES, Tournament, simulate


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


def _twelve_group_tournament():
    groups = {g: [f"{g}{i}" for i in range(1, 5)] for g in "ABCDEFGHIJKL"}
    remaining = [(g, h, a) for g, v in groups.items() for h in v for a in v if h < a]
    return Tournament(groups=groups, played=[], fixtures_remaining=remaining)


def test_real_format_exactly_one_champion_and_stage_monotonicity():
    # 12 groups A..L of 4 -> full 2026 field; flat strengths.
    t = _twelve_group_tournament()
    teams = [tm for v in t.groups.values() for tm in v]
    s = _flat_strengths(teams)
    r = simulate(t, s, sims=120, seed=7)
    champ = sum(r["teams"][x]["winCup"] for x in teams)
    fin = sum(r["teams"][x]["reachFinal"] for x in teams)
    assert abs(champ - 1.0) < 1e-9        # exactly one champion per sim
    assert abs(fin - 2.0) < 1e-9          # exactly two finalists per sim
    for x in teams:                        # stages non-increasing
        st = r["teams"][x]
        assert (st["qualify"] >= st["reachR16"] >= st["reachQF"]
                >= st["reachSF"] >= st["reachFinal"] >= st["winCup"])
    # finishProbs sum to 1 per team
    fp = next(tt["finishProbs"] for grp in r["groups"] if grp["group"] == "A"
              for tt in grp["teams"])
    assert abs(fp["p1"] + fp["p2"] + fp["p3"] + fp["p4"] - 1.0) < 1e-9


def test_real_format_output_shape():
    t = _twelve_group_tournament()
    teams = [tm for v in t.groups.values() for tm in v]
    r = simulate(t, _flat_strengths(teams), sims=40, seed=3)
    # per-stage mcStdErr is a dict keyed by every STAGE
    stats = r["teams"]["A1"]
    assert set(stats["mcStdErr"]) == set(STAGES)
    assert all(v >= 0.0 for v in stats["mcStdErr"].values())
    # every team carries reachR32 plus all STAGES
    assert "reachR32" in stats
    for k in STAGES:
        assert 0.0 <= stats[k] <= 1.0
    # bracket advancement array is present and well-formed
    assert isinstance(r["bracket"], list)
    for slot in r["bracket"]:
        assert "slot" in slot and isinstance(slot["teamProbs"], list)
    # 32 teams enter R32 in each sim (sum of reachR32 over all teams == 32)
    assert abs(sum(r["teams"][x]["reachR32"] for x in teams) - 32.0) < 1e-9
    # exactly 16 reach R16 per sim
    assert abs(sum(r["teams"][x]["reachR16"] for x in teams) - 16.0) < 1e-9
    assert r["thirdsTableComplete"] is True


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

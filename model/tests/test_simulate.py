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
    r = simulate(t, _flat_strengths(teams), sims=200, seed=3)
    stats = r["teams"]["A1"]
    assert set(stats["mcStdErr"]) == set(STAGES)
    assert all(v >= 0.0 for v in stats["mcStdErr"].values())
    assert "reachR32" in stats
    for k in STAGES:
        assert 0.0 <= stats[k] <= 1.0
    assert abs(sum(r["teams"][x]["reachR32"] for x in teams) - 32.0) < 1e-9
    assert abs(sum(r["teams"][x]["reachR16"] for x in teams) - 16.0) < 1e-9
    assert r["thirdsTableComplete"] is True

    # Bracket: exactly 31 slots M73..M104 with M103 (third-place) omitted.
    bracket = r["bracket"]
    slots = [s["slot"] for s in bracket]
    assert len(bracket) == 31
    assert slots == [f"M{n}" for n in range(73, 105) if n != 103]
    rounds = {s["slot"]: s["round"] for s in bracket}
    assert rounds["M73"] == "R32" and rounds["M88"] == "R32"
    assert rounds["M89"] == "R16" and rounds["M96"] == "R16"
    assert rounds["M97"] == "QF" and rounds["M100"] == "QF"
    assert rounds["M101"] == "SF" and rounds["M102"] == "SF"
    assert rounds["M104"] == "F"
    for s in bracket:
        assert len(s["sides"]) == 2
        for lst in (*s["sides"], s["winner"]):
            assert all(0.005 <= e["prob"] <= 1.0 for e in lst)
            assert len(lst) <= 12
            assert sum(e["prob"] for e in lst) <= 1.0 + 1e-9

    # Champion single source of truth: M104 winner distribution == winCup.
    win_by_id = {tt["id"]: r["teams"][nm]["winCup"]
                 for nm, tt in [(nm, {"id": nm.lower()}) for nm in teams]}
    m104 = next(s for s in bracket if s["slot"] == "M104")
    for e in m104["winner"]:
        assert abs(e["prob"] - win_by_id[e["id"]]) < 1e-9


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

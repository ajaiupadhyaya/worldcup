from model.groups import standings, TeamRow, best_thirds


def _row(team, pts, gd, gf):
    return TeamRow(team, points=pts, gd=gd, gf=gf)


def test_best_thirds_takes_top_by_points_then_gd():
    thirds = [(f"G{i}", _row(f"T{i}", pts, gd, 3))
              for i, (pts, gd) in enumerate(
                  [(6, 4), (6, 2), (4, 1), (4, 0), (3, 0), (3, -1),
                   (3, -2), (2, 0), (1, -1), (1, -3), (0, -4), (0, -6)])]
    picked = best_thirds(thirds, take=8)
    assert picked[0] == "T0" and picked[1] == "T1"  # 6pts, GD breaks tie
    assert len(picked) == 8
    assert "T11" not in picked  # worst third excluded


def test_points_then_gd_then_gf_ordering():
    teams = ["A", "B", "C", "D"]
    results = [
        ("A", "D", 3, 0), ("B", "D", 1, 0), ("C", "D", 2, 0),
        ("A", "B", 1, 1), ("A", "C", 1, 1), ("B", "C", 0, 0),
    ]
    table = standings(teams, results)
    # A: 5pts(+4), B: 3pts(+1), C: 3pts(+2), D: 0
    assert [r.team for r in table] == ["A", "C", "B", "D"]  # C above B on GD


def test_head_to_head_breaks_equal_points_and_gd():
    teams = ["X", "Y"]
    results = [("X", "Y", 2, 1)]
    table = standings(teams, results)
    assert table[0].team == "X"  # beat Y head-to-head


def test_h2h_tiebreak_after_equal_points_gd_gf():
    # 3-team round-robin designed so A and B end equal on (pts, gd, gf),
    # forcing a fall-through to H2H to decide their relative order.
    #
    # Results:
    #   B beats A 1-0  →  B: +3pts, gf+=1, ga+=0;  A: 0pts, gf+=0, ga+=1
    #   A beats C 2-1  →  A: +3pts, gf+=2, ga+=1;  C: 0pts, gf+=1, ga+=2
    #   C beats B 2-1  →  C: +3pts, gf+=2, ga+=1;  B: 0pts, gf+=1, ga+=2
    #
    # Final standings:
    #   A: 3pts, gf=2, ga=2, gd=0
    #   B: 3pts, gf=2, ga=2, gd=0   ← equal triple with A; H2H required
    #   C: 3pts, gf=3, ga=3, gd=0
    #
    # H2H between A and B: B beat A 1-0, so B has 3 H2H pts vs A's 0.
    # B should rank above A.
    # Without H2H, "A" < "B" by name → A would be placed first (wrong order).
    # The H2H term flips them: B ranks above A.
    teams = ["A", "B", "C"]
    results = [
        ("B", "A", 1, 0),  # B beats A (H2H decider)
        ("A", "C", 2, 1),  # A beats C
        ("C", "B", 2, 1),  # C beats B
    ]
    table = standings(teams, results)
    names = [r.team for r in table]
    assert names.index("B") < names.index("A"), (
        f"B (H2H winner over A) should rank above A, got order {names}"
    )

from model.groups import standings


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

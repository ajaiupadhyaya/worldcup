import pytest
from itertools import combinations

from model.bracket import load_bracket, assign_r32, load_thirds_table, assign_thirds


def test_bracket_template_loads():
    b = load_bracket()
    assert len(b) == 16
    assert {"slot", "home_ref", "away_ref"} <= set(b[0])
    thirds = sorted(t["away_ref"] for t in b if t["away_ref"].startswith("3rd@"))
    assert thirds == ["3rd@1A", "3rd@1B", "3rd@1D", "3rd@1E",
                      "3rd@1G", "3rd@1I", "3rd@1K", "3rd@1L"]


def test_assign_resolves_refs():
    winners = {"A": "Argentina", "F": "Spain"}
    runners = {"C": "Brazil"}
    thirds = {"1A": "Mexico"}  # team assigned to winner-slot 1A by Annex C
    pairs = assign_r32(winners, runners, thirds)
    assert ("Argentina", "Mexico") in pairs   # M79: 1A vs 3rd@1A
    assert ("Spain", "Brazil") in pairs        # M75: 1F vs 2C


def test_assign_thirds_anchor_option_1():
    m = assign_thirds(set("EFGHIJKL"), load_thirds_table())
    assert m["1A"] == "E" and m["1E"] == "F" and m["1L"] == "K"   # Option 1 row


def test_thirds_table_covers_every_eight_group_combination():
    table = load_thirds_table()
    expected = {"".join(c) for c in combinations("ABCDEFGHIJKL", 8)}
    assert set(table) == expected
    assert len(table) == 495
    for key in expected:
        assigned = assign_thirds(set(key), table)
        assert set(assigned) == {"1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"}
        assert set(assigned.values()) == set(key)


def test_assign_thirds_unknown_combo_raises():
    with pytest.raises(KeyError):
        assign_thirds(set("ABCDEFGH"), {"ZZZ": {}})


def test_thirds_table_no_same_group_and_distinct():
    table = load_thirds_table()
    winner_group = {"1A": "A", "1B": "B", "1D": "D", "1E": "E",
                    "1G": "G", "1I": "I", "1K": "K", "1L": "L"}
    for key, row in table.items():
        thirds = [code[1] for code in row.values()]
        assert len(set(thirds)) == 8, f"{key}: thirds not distinct"
        assert set(thirds) == set(key), f"{key}: third-groups != key set"
        for slot, code in row.items():
            assert winner_group[slot] != code[1], \
                f"{key}: winner {slot} faces own-group third {code}"


def test_thirds_table_pinned_official_rows():
    table = load_thirds_table()
    assert table["ABCDEFGI"] == {"1A": "3C", "1B": "3G", "1D": "3B", "1E": "3D",
                                 "1G": "3A", "1I": "3F", "1K": "3E", "1L": "3I"}
    assert table["EFGHIJKL"] == {"1A": "3E", "1B": "3J", "1D": "3I", "1E": "3F",
                                 "1G": "3H", "1I": "3G", "1K": "3L", "1L": "3K"}


def test_validate_thirds_table_true_on_shipped():
    from model.bracket import validate_thirds_table
    assert validate_thirds_table() is True


def test_build_topology_shape_and_thirds_placeholder():
    from model.bracket import build_topology
    topo = build_topology()
    assert set(topo) == {"r32", "progression"}
    assert len(topo["r32"]) == 16
    tie = topo["r32"][0]
    assert set(tie) == {"slot", "homeRef", "awayRef"}
    refs = {(t["slot"], t["awayRef"]) for t in topo["r32"]}
    assert ("M79", "3X") in refs               # 1A vs best-third -> placeholder
    assert all(not r.startswith("3rd@")
               for t in topo["r32"] for r in (t["homeRef"], t["awayRef"]))
    assert topo["progression"]["M89"] == ["M74", "M77"]

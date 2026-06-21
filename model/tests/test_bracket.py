from model.bracket import load_bracket, assign_r32


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

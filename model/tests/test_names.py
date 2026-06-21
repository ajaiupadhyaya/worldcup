from model.names import normalize


def test_known_aliases_map_to_canonical():
    assert normalize("Korea Republic") == "South Korea"
    assert normalize("USA") == "United States"
    assert normalize("Türkiye") == "Turkey"


def test_unknown_name_passes_through_trimmed():
    assert normalize("  Brazil  ") == "Brazil"

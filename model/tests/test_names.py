from model.names import normalize


def test_known_aliases_map_to_canonical():
    assert normalize("Korea Republic") == "South Korea"
    assert normalize("USA") == "United States"
    assert normalize("Türkiye") == "Turkey"


def test_unknown_name_passes_through_trimmed():
    assert normalize("  Brazil  ") == "Brazil"


def test_normalize_none_returns_empty_string():
    assert normalize(None) == ""


def test_normalize_empty_string_returns_empty_string():
    assert normalize("") == ""

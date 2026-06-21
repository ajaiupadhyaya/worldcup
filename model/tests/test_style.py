from model.style import fingerprint


def test_high_possession_low_directness():
    f = fingerprint({"possessionPct": 70, "totalPasses": 600, "accurateLongBalls": 20,
                     "totalTackles": 12, "interceptions": 8, "effectiveClearance": 10})
    assert f["possession"] > 0.6
    assert 0.0 <= f["directness"] <= 1.0
    assert all(0.0 <= v <= 1.0 for v in f.values())


def test_missing_stats_default_midrange():
    f = fingerprint({})
    assert all(0.0 <= v <= 1.0 for v in f.values())

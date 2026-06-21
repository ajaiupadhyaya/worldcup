def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def fingerprint(stats: dict[str, float]) -> dict[str, float]:
    poss = float(stats.get("possessionPct", 50.0)) / 100.0
    passes = float(stats.get("totalPasses", 400.0)) or 1.0
    long_balls = float(stats.get("accurateLongBalls", 30.0))
    directness = long_balls / passes * 5.0  # scaled share of long play
    press = (float(stats.get("totalTackles", 16.0)) + float(stats.get("interceptions", 8.0))) / 40.0
    block = float(stats.get("effectiveClearance", 15.0)) / 30.0
    return {
        "possession": _clamp(poss),
        "directness": _clamp(directness),
        "press": _clamp(press),
        "block": _clamp(block),
    }

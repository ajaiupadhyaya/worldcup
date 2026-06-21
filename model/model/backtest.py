import math

from model.predict import Outcome

_IDX = {"h": 0, "d": 1, "a": 2}


def _vec(o: Outcome) -> tuple[float, float, float]:
    return (o.home, o.draw, o.away)


def brier(pred: Outcome, actual: str) -> float:
    p = _vec(pred)
    y = [0.0, 0.0, 0.0]
    y[_IDX[actual]] = 1.0
    return sum((p[i] - y[i]) ** 2 for i in range(3))


def logloss(pred: Outcome, actual: str) -> float:
    p = _vec(pred)[_IDX[actual]]
    return -math.log(max(p, 1e-15))


def reliability(samples: list[tuple[Outcome, str]], bins: int = 10) -> list[dict]:
    # Emit one (p, y) point PER outcome class per match: p = predicted prob of
    # that class, y = 1 if that class actually occurred. Binning these gives a
    # real calibration curve — a calibrated model has observed ~= predicted in
    # every bin (binning the realized-class prob with y always 1 is degenerate).
    edges = [i / bins for i in range(bins + 1)]
    acc = [{"binMid": (edges[i] + edges[i + 1]) / 2, "psum": 0.0, "ysum": 0.0, "n": 0}
           for i in range(bins)]
    for pred, actual in samples:
        for cls, p in zip(("h", "d", "a"), _vec(pred)):
            y = 1.0 if actual == cls else 0.0
            b = min(int(p * bins), bins - 1)
            acc[b]["psum"] += p
            acc[b]["ysum"] += y
            acc[b]["n"] += 1
    out = []
    for a in acc:
        n = a["n"] or 1
        out.append({"binMid": a["binMid"], "predicted": a["psum"] / n,
                    "observed": a["ysum"] / n, "n": a["n"]})
    return out

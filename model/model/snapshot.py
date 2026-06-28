import json
import os
from pathlib import Path

from model.backtest import brier, logloss, reliability
from model.version import MODEL_VERSION

_STAGE_KEYS = {"qualify", "reachR32", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup"}
_TEAM_KEYS = _STAGE_KEYS | {"mcStdErr"}


def _slug(name: str) -> str:
    return name.lower().replace("'", "").replace(" ", "-")


def build_predictions(sim_result, fixtures, *, generated_at, inputs_hash) -> dict:
    teams = [
        {"id": _slug(name), "name": name, **stats}
        for name, stats in sim_result["teams"].items()
    ]
    teams.sort(key=lambda t: t["winCup"], reverse=True)
    out = {
        "generatedAt": generated_at,
        "modelVersion": MODEL_VERSION,
        "seed": sim_result["seed"],
        "simCount": sim_result["simCount"],
        "inputsHash": inputs_hash,
        "teams": teams,
        "fixtures": fixtures,
        "groups": sim_result.get("groups", []),
        "bracket": sim_result.get("bracket", []),
    }
    if "thirdsTableComplete" in sim_result:
        out["thirdsTableComplete"] = sim_result["thirdsTableComplete"]
    return out


def build_ratings(strengths, elo, style_by_team, *, generated_at) -> dict:
    rows = []
    for tm in strengths.attack:
        attack = strengths.attack[tm]
        defense = strengths.defense[tm]
        rows.append({
            "id": _slug(tm),
            "name": tm,
            "attack": attack,
            "defense": defense,
            "elo": elo.get(tm, 1500.0),
            "overall": attack + defense,
            "style": style_by_team.get(tm, {}),
        })
    rows.sort(key=lambda r: r["overall"], reverse=True)
    return {"generatedAt": generated_at, "teams": rows}


def build_calibration(samples, *, generated_at) -> dict:
    """Out-of-sample calibration metrics from (Outcome, actual) samples.

    `actual` is one of "h"/"d"/"a". `brier`/`logloss` are averaged over the
    samples; `reliability` is the binned per-class calibration curve.
    """
    n = max(len(samples), 1)
    return {
        "generatedAt": generated_at,
        "brier": sum(brier(p, y) for p, y in samples) / n if samples else 0.0,
        "logloss": sum(logloss(p, y) for p, y in samples) / n if samples else 0.0,
        "reliability": reliability(samples),
    }


def validate_predictions(obj: dict) -> None:
    for key in ("generatedAt", "modelVersion", "seed", "teams"):
        if key not in obj:
            raise ValueError(f"missing top-level key: {key}")
    for t in obj["teams"]:
        if not _TEAM_KEYS <= set(t):
            raise ValueError(f"team entry missing keys: {_TEAM_KEYS - set(t)}")
        for k in _STAGE_KEYS:
            if not 0.0 <= float(t[k]) <= 1.0:
                raise ValueError(f"{t.get('name')}: {k} out of [0,1]")
        err = t["mcStdErr"]
        if not isinstance(err, dict):
            raise ValueError(f"{t.get('name')}: mcStdErr must be a per-stage dict")
        for k in _STAGE_KEYS:
            if k not in err or float(err[k]) < 0.0:
                raise ValueError(f"{t.get('name')}: mcStdErr[{k}] invalid")

    # --- Conservation caps — compute totals first (needed by nesting guards too).
    caps = {"qualify": 24, "reachR32": 32, "reachR16": 16,
            "reachQF": 8, "reachSF": 4, "reachFinal": 2, "winCup": 1}
    totals = {k: sum(float(t[k]) for t in obj["teams"]) for k in caps}
    for k, cap in caps.items():
        if totals[k] > cap + 1e-6:
            raise ValueError(f"conservation: sum {k}={totals[k]:.4f} exceeds cap {cap}")
    if totals["reachR32"] >= 31.5:          # structurally complete field
        for k, cap in caps.items():
            if abs(totals[k] - cap) > 0.5:
                raise ValueError(
                    f"conservation: sum {k}={totals[k]:.4f} != {cap} (full field)")

    # --- Per-team stage nesting. A team only reaches a later round through the
    # earlier ones; reachR32 dominates qualify because best-thirds also advance.
    # The qualify ≤ reachR32 constraint is only enforceable when the R32 bracket
    # is structurally populated (partial-tournament states leave R32 refs
    # unresolved so reachR32 stays at 0 for teams that genuinely qualified).
    eps = 1e-9
    chain = ("reachR32", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")
    for t in obj["teams"]:
        if totals["reachR32"] >= 31.5 and float(t["qualify"]) > float(t["reachR32"]) + eps:
            raise ValueError(f"{t.get('name')}: qualify > reachR32")
        for earlier, later in zip(chain, chain[1:]):
            if float(t[later]) > float(t[earlier]) + eps:
                raise ValueError(f"{t.get('name')}: {later} > {earlier} (nesting)")

    # --- Bracket per-slot sanity: each side / winner list is a sub-distribution.
    for sl in obj.get("bracket", []):
        for lst in (*sl.get("sides", []), sl.get("winner", [])):
            s = 0.0
            for e in lst:
                p = float(e["prob"])
                if not 0.0 <= p <= 1.0:
                    raise ValueError(f"{sl.get('slot')}: prob {p} out of [0,1]")
                s += p
            if s > 1.0 + 1e-6:
                raise ValueError(f"{sl.get('slot')}: list sums to {s:.4f} > 1")


def validate_calibration_nonregression(metrics: dict, baseline: dict) -> None:
    """Fail if Brier or log-loss worsen beyond eps vs the recorded baseline."""
    eps = float(baseline.get("eps", 0.01))
    for k in ("brier", "logloss"):
        if float(metrics[k]) > float(baseline[k]) + eps:
            raise ValueError(
                f"calibration regression: {k}={float(metrics[k]):.4f} > "
                f"baseline {float(baseline[k]):.4f} + eps {eps}")


def write_json(obj: dict, path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, sort_keys=True))
    os.replace(tmp, path)

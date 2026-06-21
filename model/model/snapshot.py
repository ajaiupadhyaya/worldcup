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


def write_json(obj: dict, path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, sort_keys=True))
    os.replace(tmp, path)

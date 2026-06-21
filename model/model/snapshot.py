import json
import os
from pathlib import Path

from model.version import MODEL_VERSION

_TEAM_KEYS = {"qualify", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup", "mcStdErr"}


def build_predictions(sim_result, fixtures, groups_meta, *, generated_at, inputs_hash) -> dict:
    teams = [{"name": name, **stats} for name, stats in sim_result["teams"].items()]
    teams.sort(key=lambda t: t["winCup"], reverse=True)
    return {
        "generatedAt": generated_at,
        "modelVersion": MODEL_VERSION,
        "seed": sim_result["seed"],
        "simCount": sim_result["simCount"],
        "inputsHash": inputs_hash,
        "teams": teams,
        "fixtures": fixtures,
        "groups": groups_meta,
    }


def validate_predictions(obj: dict) -> None:
    for key in ("generatedAt", "modelVersion", "seed", "teams"):
        if key not in obj:
            raise ValueError(f"missing top-level key: {key}")
    for t in obj["teams"]:
        if not _TEAM_KEYS <= set(t):
            raise ValueError(f"team entry missing keys: {_TEAM_KEYS - set(t)}")
        for k in _TEAM_KEYS:
            if not 0.0 <= float(t[k]) <= 1.0:
                raise ValueError(f"{t.get('name')}: {k} out of [0,1]")


def write_json(obj: dict, path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, sort_keys=True))
    os.replace(tmp, path)

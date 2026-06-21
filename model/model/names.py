import json
from functools import lru_cache
from pathlib import Path

_ALIASES_PATH = Path(__file__).resolve().parent.parent / "data" / "team_aliases.json"


@lru_cache(maxsize=1)
def _aliases() -> dict[str, str]:
    with _ALIASES_PATH.open() as f:
        return json.load(f)


def normalize(name: str) -> str:
    cleaned = (name or "").strip()
    return _aliases().get(cleaned, cleaned)

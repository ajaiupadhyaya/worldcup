import json
from functools import lru_cache
from itertools import combinations
from pathlib import Path

_BRACKET = Path(__file__).resolve().parent.parent / "data" / "bracket_2026.json"

# The eight R32 winner-slots that face a best-third-placed team (Annex C), and
# the group each one wins — used to forbid a winner facing its own group's third.
_THIRDS_WINNER_GROUP = {"1A": "A", "1B": "B", "1D": "D", "1E": "E",
                        "1G": "G", "1I": "I", "1K": "K", "1L": "L"}


@lru_cache(maxsize=1)
def _bracket_json() -> dict:
    return json.loads(_BRACKET.read_text())


@lru_cache(maxsize=1)
def load_bracket() -> list[dict]:
    return _bracket_json()["r32"]


@lru_cache(maxsize=1)
def load_progression() -> dict:
    return _bracket_json()["progression"]


def _resolve(ref: str, winners, runners, thirds) -> str:
    if ref.startswith("3rd@"):
        return thirds[ref[4:]]        # "3rd@1E" -> thirds["1E"]
    pos, grp = ref[0], ref[1:]
    if pos == "1":
        return winners[grp]
    if pos == "2":
        return runners[grp]
    raise KeyError(ref)


def assign_r32(winners: dict[str, str], runners: dict[str, str], thirds: dict[str, str]) -> list[tuple[str, str]]:
    pairs = []
    for tie in load_bracket():
        try:
            h = _resolve(tie["home_ref"], winners, runners, thirds)
            a = _resolve(tie["away_ref"], winners, runners, thirds)
        except KeyError:
            continue  # ref not yet fillable in a partial sim state
        pairs.append((h, a))
    return pairs


@lru_cache(maxsize=1)
def load_thirds_table() -> dict:
    return _bracket_json()["thirds_table"]


def assign_thirds(qualifying_groups: set[str], table: dict | None = None) -> dict[str, str]:
    table = load_thirds_table() if table is None else table
    key = "".join(sorted(qualifying_groups))            # e.g. "EFGHIJKL"
    row = table[key]                                    # {"1A": "3E", ...}
    return {slot: code[1] for slot, code in row.items()}  # "3E" -> "E"


def validate_thirds_table(table: dict | None = None) -> bool:
    """Real structural validation of the Annex-C table (not a key count).

    True iff: every C(12,8)=495 group-set has a row; each row maps exactly the
    eight thirds winner-slots; each row's eight thirds are distinct and equal the
    key's group set; and no winner slot is paired with its own group's third.
    """
    table = load_thirds_table() if table is None else table
    if set(table) != {"".join(c) for c in combinations("ABCDEFGHIJKL", 8)}:
        return False
    for key, row in table.items():
        if set(row) != set(_THIRDS_WINNER_GROUP):
            return False
        thirds = [code[1] for code in row.values()]
        if len(set(thirds)) != 8 or set(thirds) != set(key):
            return False
        if any(_THIRDS_WINNER_GROUP[slot] == code[1] for slot, code in row.items()):
            return False
    return True

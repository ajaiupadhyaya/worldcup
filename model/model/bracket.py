import json
from pathlib import Path

_BRACKET = Path(__file__).resolve().parent.parent / "data" / "bracket_2026.json"


def load_bracket() -> list[dict]:
    return json.loads(_BRACKET.read_text())["r32"]


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

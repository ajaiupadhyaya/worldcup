from dataclasses import dataclass

import numpy as np

from model.bracket import load_bracket, load_progression
from model.dixoncoles import Strengths, expected_goals
from model.groups import best_thirds, standings
from model.knockout import sim_knockout

STAGES = ("qualify", "reachR32", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")

# Annex C: the eight R32 winner-slots that face a best-third-placed team.
_THIRDS_SLOTS = ("1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L")

# Match-number -> stage credited to that knockout match's winner. The R32 ties
# (M73-M88) credit reachR16 to their winners; the round feeders below credit the
# stage the survivor *reaches*. Exactly one winCup and two reachFinal per sim.
_MATCH_STAGE = {
    **{m: "reachQF" for m in range(89, 97)},      # M89-M96 winners -> QF
    **{m: "reachSF" for m in range(97, 101)},     # M97-M100 winners -> SF
    **{m: "reachFinal" for m in (101, 102)},      # M101-M102 winners -> Final
    104: "winCup",                                # M104 winner -> champion
}


@dataclass
class Tournament:
    groups: dict[str, list[str]]
    played: list[tuple[str, str, int, int]]
    fixtures_remaining: list[tuple[str, str, str]]


def _sim_score(s: Strengths, h: str, a: str, rng: np.random.Generator) -> tuple[int, int]:
    lh, la = expected_goals(s, h, a, neutral=True)
    return int(rng.poisson(lh)), int(rng.poisson(la))


def _resolve_ref(ref: str, winners, runners, thirds_by_slot):
    """Resolve an R32 home/away ref to a team, or None if not fillable."""
    if ref.startswith("3rd@"):
        return thirds_by_slot.get(ref[4:])      # "3rd@1E" -> thirds_by_slot["1E"]
    pos, grp = ref[0], ref[1:]
    if pos == "1":
        return winners.get(grp)
    if pos == "2":
        return runners.get(grp)
    return None


def _slug(name: str) -> str:
    return name.lower().replace("'", "").replace(" ", "-")


def _thirds_assignment(qual_third_groups, third_team, qual_third_order):
    """Annex C winnerSlot -> qualifying third-placed team.

    Tries the official `assign_thirds` table first. Because the shipped table
    has only two anchor rows, most simulated qualifier sets miss it and raise
    KeyError; we then degrade by seeding the eight qualifying third TEAMS into
    the eight winner-slots in a deterministic order. Returns (mapping, complete).
    """
    from model.bracket import assign_thirds

    try:
        slot_group = assign_thirds(qual_third_groups)
        return {slot: third_team[grp] for slot, grp in slot_group.items()}, True
    except KeyError:
        # Deterministic fallback: qualifying third teams in standings-rank order,
        # paired with the eight fixed winner-slots in their canonical order.
        teams_in_order = [third_team[g] for g in qual_third_order]
        return dict(zip(_THIRDS_SLOTS, teams_in_order)), False


def simulate(t: Tournament, s: Strengths, *, sims: int, seed: int) -> dict:
    all_teams = [team for g in t.groups.values() for team in g]
    counts = {team: {k: 0 for k in STAGES} for team in all_teams}
    finish = {team: [0, 0, 0, 0] for team in all_teams}   # 1st..4th tallies
    slot_team: dict[str, dict[str, int]] = {}
    rng = np.random.default_rng(seed)

    template = load_bracket()
    progression = load_progression()
    prog_order = sorted(progression, key=lambda k: int(k[1:]))

    # Precompute constant structures outside the sim loop.
    played_lookup = {(h, a): (hg, ag) for (h, a, hg, ag) in t.played}
    group_of = {team: g for g, teams in t.groups.items() for team in teams}

    thirds_table_complete = True

    for _ in range(sims):
        results_by_group: dict[str, list] = {g: [] for g in t.groups}

        # Seed settled results first (matches in t.played).
        for h, a, hg, ag in t.played:
            grp = group_of.get(h)
            if grp is not None:
                results_by_group[grp].append((h, a, hg, ag))

        # Simulate remaining fixtures, skipping any already seeded from played.
        for g, h, a in t.fixtures_remaining:
            if (h, a) in played_lookup:
                continue
            hg, ag = _sim_score(s, h, a, rng)
            results_by_group[g].append((h, a, hg, ag))

        winners: dict[str, str] = {}
        runners: dict[str, str] = {}
        third_rows: list[tuple[str, object]] = []
        third_team: dict[str, str] = {}
        for g, teams in t.groups.items():
            table = standings(teams, results_by_group[g])
            for pos, row in enumerate(table[:4]):
                finish[row.team][pos] += 1
            if len(table) >= 1:
                winners[g] = table[0].team
                counts[table[0].team]["qualify"] += 1
            if len(table) >= 2:
                runners[g] = table[1].team
                counts[table[1].team]["qualify"] += 1
            if len(table) >= 3:
                third_rows.append((g, table[2]))
                third_team[g] = table[2].team

        # Best 8 of the 12 third-placed rows -> qualifying GROUPS (in rank order).
        best8 = best_thirds(third_rows, take=8)        # team names, ranked
        best8_set = set(best8)
        team_to_group = {row.team: g for g, row in third_rows}
        qual_third_order = [team_to_group[tm] for tm in best8]   # groups, ranked
        qual_third_groups = set(qual_third_order)

        thirds_by_slot, complete = _thirds_assignment(
            qual_third_groups, third_team, qual_third_order
        )
        thirds_table_complete = thirds_table_complete and complete

        # Resolve R32 ties slot-by-slot; keep only fully-fillable ties.
        results: dict[str, str] = {}
        r32_entrants: list[str] = []
        for tie in template:
            h = _resolve_ref(tie["home_ref"], winners, runners, thirds_by_slot)
            a = _resolve_ref(tie["away_ref"], winners, runners, thirds_by_slot)
            if h is None or a is None:
                continue
            slot = tie["slot"]
            r32_entrants.extend((h, a))
            w = sim_knockout(s, h, a, rng)
            results[slot] = w

        # reachR32 -> all 32 R32 entrants; reachR16 -> the 16 R32-tie winners.
        for tm in r32_entrants:
            counts[tm]["reachR32"] += 1
        for w in results.values():
            counts[w]["reachR16"] += 1

        # Progression: each later match feeds from two earlier results. Only
        # run a match when BOTH source results exist (degraded fields skip).
        for m in prog_order:
            a_src, b_src = progression[m]
            if a_src not in results or b_src not in results:
                continue
            w = sim_knockout(s, results[a_src], results[b_src], rng)
            results[m] = w
            stage = _MATCH_STAGE[int(m[1:])]
            counts[w][stage] += 1
            slot_team.setdefault(m, {})
            slot_team[m][w] = slot_team[m].get(w, 0) + 1

    out_teams: dict[str, dict] = {}
    for team, c in counts.items():
        stats = {k: c[k] / sims for k in STAGES}
        stats["mcStdErr"] = {
            k: float(np.sqrt(max(stats[k] * (1 - stats[k]), 0.0) / sims))
            for k in STAGES
        }
        out_teams[team] = stats

    groups_out = [
        {
            "group": g,
            "teams": [
                {
                    "id": _slug(tm),
                    "finishProbs": dict(
                        zip(
                            ("p1", "p2", "p3", "p4"),
                            [finish[tm][i] / sims for i in range(4)],
                        )
                    ),
                }
                for tm in teams
            ],
        }
        for g, teams in t.groups.items()
    ]

    bracket_out = [
        {
            "slot": slot,
            "teamProbs": [
                {"id": _slug(tm), "prob": n / sims}
                for tm, n in sorted(d.items(), key=lambda x: (-x[1], x[0]))
            ],
        }
        for slot, d in sorted(slot_team.items(), key=lambda x: int(x[0][1:]))
    ]

    return {
        "teams": out_teams,
        "groups": groups_out,
        "bracket": bracket_out,
        "simCount": sims,
        "seed": seed,
        "thirdsTableComplete": thirds_table_complete,
    }

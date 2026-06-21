from dataclasses import dataclass

import numpy as np

from model.dixoncoles import Strengths, expected_goals
from model.groups import standings
from model.knockout import sim_knockout

STAGES = ("qualify", "reachR16", "reachQF", "reachSF", "reachFinal", "winCup")


@dataclass
class Tournament:
    groups: dict[str, list[str]]
    played: list[tuple[str, str, int, int]]
    fixtures_remaining: list[tuple[str, str, str]]


def _sim_score(s: Strengths, h: str, a: str, rng: np.random.Generator) -> tuple[int, int]:
    lh, la = expected_goals(s, h, a, neutral=True)
    return int(rng.poisson(lh)), int(rng.poisson(la))


def _bracket_rounds(qualifiers: list[str], s: Strengths, rng, counts: dict, reached_from: int):
    # Generic single-elimination over a power-of-two list; credits stages.
    stage_names = ["reachR16", "reachQF", "reachSF", "reachFinal", "winCup"]
    field = qualifiers
    si = reached_from
    while len(field) > 1:
        nxt = []
        for i in range(0, len(field), 2):
            w = sim_knockout(s, field[i], field[i + 1], rng)
            nxt.append(w)
        field = nxt
        if si < len(stage_names):
            for w in field:
                counts[w][stage_names[si]] += 1
        si += 1


def simulate(t: Tournament, s: Strengths, *, sims: int, seed: int) -> dict:
    all_teams = [team for g in t.groups.values() for team in g]
    counts = {team: {k: 0 for k in STAGES} for team in all_teams}
    rng = np.random.default_rng(seed)

    # Precompute constant structures outside the sim loop.
    played_lookup = {(h, a): (hg, ag) for (h, a, hg, ag) in t.played}
    group_of = {team: g for g, teams in t.groups.items() for team in teams}

    for _ in range(sims):
        results_by_group: dict[str, list] = {g: [] for g in t.groups}

        # Seed settled results first (matches in t.played that are NOT in
        # fixtures_remaining — the natural disjoint caller split).
        for h, a, hg, ag in t.played:
            grp = group_of.get(h)
            if grp is not None:
                results_by_group[grp].append((h, a, hg, ag))

        # Simulate remaining fixtures, skipping any already seeded from played.
        for g, h, a in t.fixtures_remaining:
            if (h, a) in played_lookup:
                # Caller placed this in both collections; don't double-count.
                continue
            hg, ag = _sim_score(s, h, a, rng)
            results_by_group[g].append((h, a, hg, ag))

        qualifiers: list[str] = []
        for g, teams in t.groups.items():
            table = standings(teams, results_by_group[g])
            for r in table[:2]:
                counts[r.team]["qualify"] += 1
                qualifiers.append(r.team)
        # NOTE: full 2026 R32 uses best-thirds + bracket slotting (Task 11).
        # For the orchestrator we advance the seeded top-2 through a generic
        # bracket; the run.py wiring (Task 17) supplies real R32 pairings.
        if len(qualifiers) >= 2 and (len(qualifiers) & (len(qualifiers) - 1)) == 0:
            _bracket_rounds(qualifiers, s, rng, counts, reached_from=0)

    out_teams = {}
    for team, c in counts.items():
        stats = {k: c[k] / sims for k in STAGES}
        p = stats["winCup"]
        stats["mcStdErr"] = float(np.sqrt(max(p * (1 - p), 0.0) / sims))
        out_teams[team] = stats
    return {"teams": out_teams, "simCount": sims, "seed": seed}

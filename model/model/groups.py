from dataclasses import dataclass


@dataclass
class TeamRow:
    team: str
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    gf: int = 0
    ga: int = 0
    gd: int = 0
    points: int = 0


def _tally(teams, results) -> dict[str, TeamRow]:
    rows = {t: TeamRow(t) for t in teams}
    for h, a, hg, ag in results:
        rh, ra = rows[h], rows[a]
        rh.played += 1; ra.played += 1
        rh.gf += hg; rh.ga += ag; ra.gf += ag; ra.ga += hg
        if hg > ag:
            rh.won += 1; rh.points += 3; ra.lost += 1
        elif hg < ag:
            ra.won += 1; ra.points += 3; rh.lost += 1
        else:
            rh.drawn += 1; ra.drawn += 1; rh.points += 1; ra.points += 1
    for r in rows.values():
        r.gd = r.gf - r.ga
    return rows


def _h2h_points(team, others, results) -> tuple[int, int, int]:
    pts = gf = ga = 0
    rel = [r for r in results if r[0] in others | {team} and r[1] in others | {team}]
    for h, a, hg, ag in rel:
        if team == h:
            gf += hg; ga += ag; pts += 3 if hg > ag else 1 if hg == ag else 0
        elif team == a:
            gf += ag; ga += hg; pts += 3 if ag > hg else 1 if hg == ag else 0
    return pts, gf - ga, gf


def standings(group_teams: list[str], results: list[tuple[str, str, int, int]]) -> list[TeamRow]:
    rows = _tally(group_teams, results)

    def sort_key(t: str):
        r = rows[t]
        tied = {x for x in group_teams
                if (rows[x].points, rows[x].gd, rows[x].gf) == (r.points, r.gd, r.gf)} - {t}
        h2h = _h2h_points(t, tied, results) if tied else (0, 0, 0)
        return (-r.points, -r.gd, -r.gf, -h2h[0], -h2h[1], -h2h[2], t)

    return [rows[t] for t in sorted(group_teams, key=sort_key)]


def best_thirds(third_rows: list[tuple[str, "TeamRow"]], take: int = 8) -> list[str]:
    ranked = sorted(
        third_rows,
        key=lambda gr: (-gr[1].points, -gr[1].gd, -gr[1].gf, gr[1].team),
    )
    return [row.team for _, row in ranked[:take]]

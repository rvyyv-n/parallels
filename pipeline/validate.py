import argparse
import json

import numpy as np

from pipeline.assemble import cell_of, index_of
from pipeline.score import challenge, earth_rank, overall

GROUPS = {
    "mars-analog": ("Known Mars analogs", "Places already used to test Mars missions."),
    "moon-analog": ("Polar and highland Moon analogs", "Places used to train for the Moon's highlands and poles."),
    "moon-basalt": ("Basalt and crater training sites", "Places used to train for the Moon's dark plains and craters, not its pole."),
    "ordinary": ("Ordinary places", "Farmland, forest and cities that nobody uses as an analog."),
    "desert": ("Plain deserts", "Big deserts that aren't analogs. They catch a method that only rewards dry, bare ground."),
}

NOT_BLIND = (
    "This is not a blind first run. A throwaway prototype scored the same test places twice on 14 November, "
    "and two lessons from it shaped this version. The weights and pass marks below were committed before this run, "
    "and the places marked blind had never been scored before."
)


def win_rate(a, b):
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    if not len(a) or not len(b):
        return None, 0
    d = a[:, None] - b[None, :]
    return float(((d > 0) + 0.5 * (d == 0)).mean()), int(d.size)


def locate(sites, cells, idx):
    out = {}
    for s in sites:
        r, c = cell_of(s["lat"], s["lon"])
        i = int(idx[r, c])
        out[s["id"]] = None if i < 0 else i
    return out


def place_rows(sites, group, where, score, land_rank, held, target_id):
    rows = []
    for s in sites:
        if group not in s["groups"]:
            continue
        i = where[s["id"]]
        v = None if i is None or not np.isfinite(score[i]) else round(float(score[i]), 4)
        row = {
            "id": s["id"],
            "name": s["name"],
            "lat": s["lat"],
            "lon": s["lon"],
            "group": group,
            "cell": i,
            "score": v,
            "land_rank": None if v is None else round(float(land_rank[i]), 4),
            "best_target": target_id,
            "held_out": s["id"] in held,
            "blind": bool(s.get("blind")),
        }
        if i is None:
            row["note"] = "Not scored: the place's cell is less than 5% land on our grid."
        elif v is None:
            row["note"] = "Not scored: the cell has data for less than 70% of the weight."
        rows.append(row)
    return rows


def check(name, rows, analog, other, mark):
    a = [r for r in rows if r["group"] == analog and r["score"] is not None]
    b = [r["score"] for r in rows if r["group"] == other and r["score"] is not None]
    res, n = win_rate([r["score"] for r in a], b)
    held, _ = win_rate([r["score"] for r in a if r["held_out"]], b)
    blind, _ = win_rate([r["score"] for r in a if r["blind"]], b)
    r3 = lambda x: None if x is None else round(x, 3)
    return {
        "name": name,
        "pass_mark": mark,
        "result": r3(res),
        "passed": None if res is None else res >= mark,
        "n_pairs": n,
        "held_out_only": r3(held),
        "blind_only": r3(blind),
    }


def test(tid, title, body, plain, sites, groups, score, cells, where, held, target_id, checks):
    land_rank = earth_rank(score, 1.0, cells["area"])
    places = []
    for g in groups:
        places += place_rows(sites, g, where, score, land_rank, held, target_id)
    return {
        "id": tid,
        "title": title,
        "body": body,
        "plain": plain,
        "groups": [{"id": g, "name": GROUPS[g][0], "plain": GROUPS[g][1]} for g in groups],
        "places": places,
        "checks": [check(n, places, a, o, m) for n, a, o, m in checks],
        "misses": [],
    }


def terrain_score(scored, cfg, body):
    tw = cfg["trait_weights"][body]["surface"]
    keys = [k for k in cfg["validation"]["basalt_terrain_traits"] if k in scored["ranks"]]
    sc = cfg["scoring"]
    w = {k: tw[k][0] for k in keys}
    s, cov = challenge({k: scored["ranks"][k] for k in keys}, w, sc["floor"], sc["missing_rank"])
    return overall({"terrain": s}, {"terrain": cov}, {"terrain": 1.0}, sc["floor"], sc["missing_rank"], sc["min_weight_with_data"])


def data_checks(cells, where, checks):
    out = []
    for c in checks:
        i = where.get(c["site"])
        v = None if i is None else float(cells["aridity"][i])
        if v is None or not np.isfinite(v):
            out.append({"name": c["name"], "result": "no data in the cell", "passed": False})
        else:
            ok = v < c["below"] if "below" in c else v > c["above"]
            out.append({"name": c["name"], "result": f"{v:.3f}", "passed": bool(ok)})
    return out


def run(cells, scored, sites, cfg, commit):
    v = cfg["validation"]
    pm = v["pass_marks"]
    held = set(v["held_out"])
    where = locate(sites, cells, index_of(cells))
    mars, moon = scored[v["mars_target"]], scored[v["moon_target"]]
    rule = "Each place is scored on its 0.5° cell against {t}, with every scored challenge weighted equally (a weighted geometric mean of the challenge scores, under the same 70% data rule as the map). A pair counts as a win when the analog scores higher; ties count half."
    tests = [
        test(
            "mars", "Mars test", "mars",
            "Known Mars analogs should beat ordinary places and plain deserts. " + rule.format(t="Jezero crater"),
            sites, ["mars-analog", "ordinary", "desert"], mars["equal"], cells, where, held, v["mars_target"],
            [
                ("Known Mars analogs beat ordinary places", "mars-analog", "ordinary", pm["mars_vs_ordinary"]),
                ("Known Mars analogs beat plain deserts", "mars-analog", "desert", pm["mars_vs_desert"]),
            ],
        ),
        test(
            "moon-polar", "Moon test, part 1", "moon",
            "Polar and highland analogs should beat ordinary places. It's a small group, and we say so. " + rule.format(t="the Moon's south pole"),
            sites, ["moon-analog", "ordinary"], moon["equal"], cells, where, held, v["moon_target"],
            [("Polar and highland analogs beat ordinary places", "moon-analog", "ordinary", pm["moon_vs_ordinary"])],
        ),
        test(
            "moon-terrain", "Moon test, part 2", "moon",
            "Basalt and crater training sites stand in for the Moon's dark plains, not its pole, so they are checked only on terrain "
            "(slope, height range and ground under 10° against the south pole), with the same pass mark as the other tests. "
            "Ranking low on rock is expected, not a failure.",
            sites, ["moon-basalt", "ordinary"], terrain_score(moon, cfg, "moon"), cells, where, held, v["moon_target"],
            [("Basalt and crater sites beat ordinary places on terrain", "moon-basalt", "ordinary", pm["basalt_terrain_vs_ordinary"])],
        ),
    ]
    return {
        "weights_commit": commit,
        "not_blind_note": NOT_BLIND,
        "prototype_runs": v["prototype_runs"],
        "tests": tests,
        "data_checks": data_checks(cells, where, v["aridity_checks"]),
    }


def summary(val):
    lines = [f"weights commit {val['weights_commit']}"]
    for t in val["tests"]:
        for c in t["checks"]:
            lines.append(f"{t['title']}: {c['name']}: {c['result']} (pass {c['pass_mark']}, held-out {c['held_out_only']}, blind {c['blind_only']}, pairs {c['n_pairs']})")
        for p in t["places"]:
            if p["score"] is None:
                lines.append(f"  unscored: {p['id']} ({p['note']})")
    for d in val["data_checks"]:
        lines.append(f"data check: {d['name']}: {d['result']} {'pass' if d['passed'] else 'FAIL'}")
    return "\n".join(lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="site/public/data/validation.json")
    print(summary(json.load(open(ap.parse_args().file, encoding="utf8"))))

import argparse
import json

import numpy as np

from pipeline.assemble import cell_of, index_of
from pipeline.score import challenge, earth_rank, overall
from pipeline.traits import TRAITS

GROUPS = {
    "mars-analog": ("Known Mars analogs", "Places already used to test Mars missions."),
    "moon-analog": ("Polar and highland Moon analogs", "Places used to train for the Moon's highlands and poles."),
    "moon-basalt": ("Basalt and crater training sites", "Places used to train for the Moon's dark plains and craters, not its pole."),
    "ordinary": ("Ordinary places", "Farmland, forest and cities that nobody uses as an analog."),
    "desert": ("Plain deserts", "Big deserts that aren't analogs. They catch a method that only rewards dry, bare ground."),
}

WHY = {
    "mars": {
        "arkaroola": "Its hills are far rougher than Jezero's flat crater floor, and its air is clearer than Jezero's dusty sky.",
        "argentine-puna": "The point stands for a whole high plateau, with far more height range than Jezero's floor and clear mountain air.",
        "puga-valley": "It sits in a steep Himalayan valley: almost all land on Earth is flatter.",
        "spotted-lake": "Its cell is steep valley country, and EMIT has no mineral data there, so the lake's salts can't count.",
        "pavilion-lake": "Its cell is steep valley country, and EMIT has no mineral data there.",
        "kangerlussuaq": "Its ground is rough, its sun is low and its air is clear, all far from Jezero.",
        "haughton-crater-devon-island": "Arctic: a small day-to-night swing, a low sun and clear air, far from Jezero. Polar air also reads as wet on the aridity index because so little water can evaporate.",
        "bletterbach": "An Alpine gorge: steep, high-relief ground in a mostly green cell.",
        "gros-morne": "A wet, rugged coast with a small day-to-night swing.",
        "mcmurdo-dry-valleys": "The valleys are smaller than a 0.5° cell, and the cell is mostly ice sheet. Polar air reads as wet on the aridity index because so little water can evaporate, and its sun is low.",
        "chill-ice-lava-tube": "Iceland's cool, wet climate has a small day-to-night swing; the lava tube itself can't be seen by any trait.",
        "gypsum-hill-axel-heiberg": "High Arctic: steep ground, a tiny day-to-night swing and a low sun.",
        "kilauea-iki": "Half of its cell is sea, and the tropical climate is warm with a small day-to-night swing.",
        "bockfjorden-svalbard": "Most of its cell is glacier, its day-to-night swing is tiny and polar air reads as wet on the aridity index.",
        "rio-tinto": "Rio Tinto is an analog for its acid water chemistry, which no trait measures.",
        "don-juan-pond": "Not ranked: the pond sits on an Antarctic cell with no aridity value (ice sheet) and no EMIT minerals, so under 70% of the weight has data.",
    },
    "moon-polar": {
        "lofoten": "Only a small part of its cell is land; the rest is fjord and sea. Its terrain is steep and its sea climate is mild and wet, with a small yearly swing.",
        "stillwater-complex": "At 0.5° the rock map's main rock for its cell isn't plutonic, and the steep mountain ground scores very low on flat industrial strips.",
    },
    "moon-terrain": {
        "kilbourne-hole": "The crater is a hole in a flat desert plain; at 0.5° the cell is mostly flat, while the south-pole target is rugged.",
        "miyake-jima": "Not scored: the island is less than 5% of its cell, the rest is sea.",
    },
}

LABELS = {t["id"]: t["label"] for t in TRAITS}

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


def miss_text(tid, p, cells, ranks):
    parts = [WHY.get(tid, {}).get(p["id"], "")]
    i = p["cell"]
    if i is not None:
        low = sorted((float(r[i]), k) for k, r in ranks.items() if np.isfinite(r[i]))[:3]
        facts = [f"{LABELS[k].lower()} {v:.2f}" for v, k in low]
        land, ice = float(cells["land_frac"][i]), float(cells["ice"][i])
        extra = []
        if land < 0.5:
            extra.append(f"only {land:.0%} of the cell is land")
        if ice > 50:
            extra.append(f"{ice:.0f}% of the cell is permanent ice")
        parts.append("Lowest trait ranks: " + ", ".join(facts) + ("; " + "; ".join(extra) if extra else "") + ".")
    return " ".join(x for x in parts if x)


def test(tid, title, body, plain, sites, groups, score, cells, where, held, target_id, checks, ranks):
    land_rank = earth_rank(score, 1.0, cells["area"])
    places = []
    for g in groups:
        places += place_rows(sites, g, where, score, land_rank, held, target_id)
    misses = [
        {"place": p["id"], "why": miss_text(tid, p, cells, ranks)}
        for p in places
        if p["group"] == groups[0] and (p["land_rank"] is None or p["land_rank"] < 0.5)
    ]
    return {
        "id": tid,
        "title": title,
        "body": body,
        "plain": plain,
        "groups": [{"id": g, "name": GROUPS[g][0], "plain": GROUPS[g][1]} for g in groups],
        "places": places,
        "checks": [check(n, places, a, o, m) for n, a, o, m in checks],
        "misses": misses,
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
            mars["ranks"],
        ),
        test(
            "moon-polar", "Moon test, part 1", "moon",
            "Polar and highland analogs should beat ordinary places. It's a small group, and we say so. " + rule.format(t="the Moon's south pole"),
            sites, ["moon-analog", "ordinary"], moon["equal"], cells, where, held, v["moon_target"],
            [("Polar and highland analogs beat ordinary places", "moon-analog", "ordinary", pm["moon_vs_ordinary"])],
            moon["ranks"],
        ),
        test(
            "moon-terrain", "Moon test, part 2", "moon",
            "Basalt and crater training sites stand in for the Moon's dark plains, not its pole, so they are checked only on terrain "
            "(slope, height range and ground under 10° against the south pole), with the same pass mark as the other tests. "
            "Ranking low on rock is expected, not a failure.",
            sites, ["moon-basalt", "ordinary"], terrain_score(moon, cfg, "moon"), cells, where, held, v["moon_target"],
            [("Basalt and crater sites beat ordinary places on terrain", "moon-basalt", "ordinary", pm["basalt_terrain_vs_ordinary"])],
            {k: moon["ranks"][k] for k in v["basalt_terrain_traits"] if k in moon["ranks"]},
        ),
    ]
    return {
        "weights_commit": commit,
        "summary": result_line(tests),
        "not_blind_note": NOT_BLIND,
        "prototype_runs": v["prototype_runs"],
        "tests": tests,
        "data_checks": data_checks(cells, where, v["aridity_checks"]),
    }


def result_line(tests):
    checks = [c for t in tests for c in t["checks"]]
    passed = [c for c in checks if c["passed"]]
    pct = lambda x: "no result" if x is None else f"{round(x * 100)}%"
    head = "Version 1 passes its own check." if len(passed) == len(checks) else f"Version 1 passes {len(passed)} of its {len(checks)} checks, so it does not pass its own test yet."
    body = " ".join(f"{c['name']}: {pct(c['result'])} of pairs (pass mark {pct(c['pass_mark'])})." for c in checks)
    why = (
        " Most misses are small, rugged or icy analogs that fill only part of a 50 km cell, or polar sites whose cold matches "
        "but whose small day-to-night swing, low sun and clear air do not match Jezero. We publish the result as it came out; "
        "the weights and pass marks were fixed before the run."
    ) if len(passed) < len(checks) else ""
    return head + " " + body + why


def summary(val):
    lines = [f"weights commit {val['weights_commit']}", val.get("summary", "")]
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

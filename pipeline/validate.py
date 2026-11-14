import argparse
import json

import numpy as np

from pipeline.assemble import cell_of, index_of
from pipeline.score import challenge, earth_rank, overall
from pipeline.traits import CHALLENGES, TRAITS

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
    second = second_run(cells, scored, sites, cfg, where, held)
    return {
        "weights_commit": commit,
        "summary": result_line(tests) + " " + second["summary"],
        "not_blind_note": NOT_BLIND,
        "prototype_runs": v["prototype_runs"],
        "tests": tests,
        "second_run": second,
        "data_checks": data_checks(cells, where, v["aridity_checks"]),
    }


SECOND_COMMIT = "d48b9ab"


def uses(site, body):
    u = site.get("used_for")
    if u is None:
        return None
    if isinstance(u, dict):
        return u.get(body)
    return u


def entries(sites, body, groups, scored_ids):
    out, unchecked = [], []
    for s in sites:
        if not set(s["groups"]) & set(groups):
            continue
        u = uses(s, body)
        if not u:
            unchecked.append({"place": s["id"], "why": f"No use is tagged for the {body.capitalize()}, so there is no challenge to check it on."})
            continue
        for c in u:
            if c in ("shelter", "other"):
                unchecked.append({"place": s["id"], "why": f"Used for {c}, which we do not score."})
            elif c not in scored_ids:
                unchecked.append({"place": s["id"], "why": f"Used for {c}, which is not a scored challenge for the {body.capitalize()}."})
            else:
                out.append((s, c))
    return out, unchecked


def pair_counts(a, b):
    r, n = win_rate(a, b)
    return (0.0, 0) if r is None else (r * n, n)


def tally(rows, other, mark, name, min_sites, pooled=False):
    def rate(sel):
        wins = pairs = 0
        for c in {r["challenge"] for r in rows}:
            a = [r["score"] for r in rows if r["challenge"] == c and sel(r)]
            b = [o["score"] for o in other if o["challenge"] == c]
            w, n = pair_counts(a, b)
            wins += w
            pairs += n
        return (None if pairs == 0 else round(wins / pairs, 3)), pairs

    res, n = rate(lambda r: True)
    few = not pooled and len(rows) < min_sites
    return {
        "name": name + (f" (too few sites: {len(rows)}, fewer than {min_sites}, so no pass or fail)" if few else ""),
        "pass_mark": mark,
        "result": res,
        "passed": None if few or res is None else res >= mark,
        "n_pairs": n,
        "held_out_only": rate(lambda r: r["held_out"])[0],
        "blind_only": rate(lambda r: r["blind"])[0],
    }


def second_test(body, target_id, sc, cells, sites, groups, where, held, cfg):
    sr = cfg["validation"]["second_run"]
    names = {c["id"]: c["name"] for c in CHALLENGES[body]}
    ch = sc["challenges"]
    found, unchecked = entries(sites, body, groups, set(ch))
    land = {}
    places = []

    def row(s, c, group):
        if c not in land:
            land[c] = earth_rank(ch[c], 1.0, cells["area"])
        i = where[s["id"]]
        v = None if i is None or not np.isfinite(ch[c][i]) else round(float(ch[c][i]), 4)
        return {
            "id": s["id"], "name": s["name"], "lat": s["lat"], "lon": s["lon"], "group": group, "challenge": c,
            "cell": i, "score": v, "land_rank": None if v is None else round(float(land[c][i]), 4),
            "best_target": target_id, "held_out": s["id"] in held, "blind": bool(s.get("blind")),
        }

    analogs = []
    for s, c in found:
        r = row(s, c, f"analog:{c}")
        if r["score"] is None:
            why = "its cell is less than 5% land on our grid" if r["cell"] is None else "its cell has no data for this challenge"
            unchecked.append({"place": s["id"], "why": f"Used for {names[c]}, but {why}."})
            r["note"] = "Not scored: " + why + "."
        analogs.append(r)
    used = [c for c in ch if any(r["challenge"] == c for r in analogs)]
    controls = {"ordinary": [s for s in sites if "ordinary" in s["groups"]]}
    if body == "mars":
        controls["desert"] = [s for s in sites if "desert" in s["groups"]]
    others = {g: [row(s, c, g) for c in used for s in ss] for g, ss in controls.items()}
    scored_a = [r for r in analogs if r["score"] is not None]
    scored_o = {g: [r for r in rs if r["score"] is not None] for g, rs in others.items()}
    pm, k = sr["pass_marks"], sr["min_sites_per_challenge"]
    checks = []
    for c in used:
        a = [r for r in scored_a if r["challenge"] == c]
        checks.append(tally(a, scored_o["ordinary"], pm["vs_ordinary"], f"{names[c]}: analogs used for it beat ordinary places", k))
        if body == "mars":
            checks.append(tally(a, scored_o["desert"], pm["vs_desert"], f"{names[c]}: analogs used for it beat plain deserts", k))
    checks.append(tally(scored_a, scored_o["ordinary"], pm["vs_ordinary"], "All challenges pooled: analogs beat ordinary places on the challenges they are used for", k, pooled=True))
    groups_out = [{"id": f"analog:{c}", "name": f"Analogs used for {names[c]}", "plain": f"Known analogs whose papers say they are used for {names[c]}, scored on {names[c]} alone."} for c in used]
    groups_out += [{"id": g, "name": GROUPS[g][0], "plain": GROUPS[g][1]} for g in controls]
    title = "Moon, challenge by challenge" if body == "moon" else "Mars, challenge by challenge"
    test_ = {
        "id": f"second-{body}", "title": title, "body": body,
        "plain": sr["rule"] + " " + sr["pooled_rule"] + " " + sr["few_sites_note"],
        "groups": groups_out, "places": analogs + [r for rs in others.values() for r in rs],
        "checks": checks, "misses": [],
    }
    return test_, unchecked


def second_run(cells, scored, sites, cfg, where, held):
    v = cfg["validation"]
    sr = v["second_run"]
    tests, unchecked = [], []
    for body, tid, groups in (("moon", v["moon_target"], sr["moon_groups"]), ("mars", v["mars_target"], sr["mars_groups"])):
        t, u = second_test(body, tid, scored[tid], cells, sites, groups, where, held, cfg)
        tests.append(t)
        unchecked += [dict(x, place=f"{x['place']} ({body.capitalize()})") for x in u]
    return {
        "title": "Second run: each analog on what it is used for",
        "plain": (
            "The first run scored every known analog on its overall match, but no place on Earth copies everything, and analogs are "
            "chosen for particular jobs. This run checks each analog only on the challenges its papers say it is used for, against "
            "ordinary places on the same challenge. We designed it after seeing the first run's totals, so it helps explain the first "
            "result and is not independent proof."
        ),
        "designed_after_first_run": True,
        "config_commit": SECOND_COMMIT,
        "summary": second_line(tests),
        "tests": tests,
        "unchecked": unchecked,
    }


def second_line(tests):
    checks = [c for t in tests for c in t["checks"] if c["passed"] is not None]
    passed = [c for c in checks if c["passed"]]
    pct = lambda x: "no result" if x is None else f"{round(x * 100)}%"
    pooled = [f"{t['body'].capitalize()} {pct(c['result'])}" for t in tests for c in t["checks"] if c["name"].startswith("All challenges pooled")]
    head = (
        f"In a second run, designed after seeing those totals, each analog was checked only on the challenges it is used for: "
        f"{len(passed)} of {len(checks)} checks with enough sites pass"
    )
    tail = "." if len(passed) == len(checks) else ", so the second run does not pass in full either."
    return head + tail + " Pooled against ordinary places (pass mark 80%): " + ", ".join(pooled) + "."


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
    sr = val.get("second_run")
    if sr:
        lines.append(sr["summary"])
        for t in sr["tests"]:
            for c in t["checks"]:
                lines.append(f"{t['title']}: {c['name']}: {c['result']} (pass {c['pass_mark']}, passed {c['passed']}, held-out {c['held_out_only']}, blind {c['blind_only']}, pairs {c['n_pairs']})")
        for u in sr["unchecked"]:
            lines.append(f"  unchecked: {u['place']}: {u['why']}")
    for d in val["data_checks"]:
        lines.append(f"data check: {d['name']}: {d['result']} {'pass' if d['passed'] else 'FAIL'}")
    return "\n".join(lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="site/public/data/validation.json")
    print(summary(json.load(open(ap.parse_args().file, encoding="utf8"))))

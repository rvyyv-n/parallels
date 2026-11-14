import json

import numpy as np
import pytest

from pipeline.assemble import ROOT, load_config
from pipeline.validate import check, locate, place_rows, win_rate
from pipeline.assemble import index_of

CFG = load_config()


def test_win_rate_counts_pairs_and_ties_half():
    r, n = win_rate([3, 1], [2, 1])
    assert n == 4
    assert r == pytest.approx((1 + 1 + 0 + 0.5) / 4)


def test_win_rate_empty_group():
    assert win_rate([], [1, 2]) == (None, 0)


def split(pool, seed):
    p = np.random.default_rng(seed).permutation(len(pool))
    return sorted(pool[i] for i in p[: len(pool) // 2])


def test_held_out_split_is_the_seeded_half_of_the_pool():
    v = CFG["validation"]
    assert v["pool"] == sorted(v["pool"])
    assert split(v["pool"], v["seed"]) == v["held_out"]
    assert len(v["held_out"]) == len(v["pool"]) // 2


def test_pool_holds_every_non_blind_known_analog():
    sites = json.loads((ROOT / "pipeline" / "sites.json").read_text(encoding="utf8"))
    analogs = {s["id"] for s in sites if set(s["groups"]) & {"moon-analog", "mars-analog", "moon-basalt"} and not s.get("blind")}
    assert analogs == set(CFG["validation"]["pool"])


def test_places_without_a_score_are_listed_not_dropped():
    cells = {"row": np.array([0, 0]), "col": np.array([0, 1])}
    sites = [
        {"id": "a", "name": "A", "lat": 89.9, "lon": -179.9, "groups": ["mars-analog"]},
        {"id": "b", "name": "B", "lat": 89.9, "lon": -179.4, "groups": ["mars-analog"], "blind": True},
        {"id": "c", "name": "C", "lat": 0, "lon": 0, "groups": ["mars-analog"]},
        {"id": "o", "name": "O", "lat": 89.9, "lon": -179.9, "groups": ["ordinary"]},
    ]
    where = locate(sites, cells, index_of(cells))
    score = np.array([0.9, np.nan])
    rows = place_rows(sites, "mars-analog", where, score, np.array([0.8, np.nan]), {"a"}, "mars-jezero")
    assert [r["id"] for r in rows] == ["a", "b", "c"]
    assert rows[1]["score"] is None and "70%" in rows[1]["note"]
    assert rows[2]["cell"] is None and "5% land" in rows[2]["note"]
    assert rows[0]["held_out"] and rows[1]["blind"]


def test_check_reports_all_held_out_and_blind():
    rows = [
        {"group": "mars-analog", "score": 0.9, "held_out": True, "blind": False},
        {"group": "mars-analog", "score": 0.1, "held_out": False, "blind": True},
        {"group": "ordinary", "score": 0.5, "held_out": False, "blind": False},
    ]
    c = check("x", rows, "mars-analog", "ordinary", 0.8)
    assert c["result"] == 0.5 and c["passed"] is False and c["n_pairs"] == 2
    assert c["held_out_only"] == 1.0 and c["blind_only"] == 0.0


from pipeline.validate import entries, second_run, tally


def site(sid, lat, lon, groups, used_for=None, blind=False):
    s = {"id": sid, "name": sid, "lat": lat, "lon": lon, "groups": groups, "blind": blind}
    if used_for is not None:
        s["used_for"] = used_for
    return s


def mini_world():
    n = 8
    cells = {"row": np.zeros(n, int), "col": np.arange(n), "area": np.ones(n)}
    lon = lambda j: -179.75 + 0.5 * j
    sites = [
        site("a1", 89.75, lon(0), ["mars-analog"], ["surface"]),
        site("a2", 89.75, lon(1), ["mars-analog"], ["surface", "shelter"]),
        site("a3", 89.75, lon(2), ["mars-analog"], ["surface"], blind=True),
        site("a4", 89.75, lon(3), ["mars-analog"], ["life"]),
        site("both", 89.75, lon(4), ["moon-analog", "mars-analog"], {"mars": ["surface"], "moon": ["surface"]}),
        site("gap", 89.75, lon(5), ["mars-analog"], ["dryness"]),
        site("o1", 89.75, lon(6), ["ordinary"]),
        site("d1", 89.75, lon(7), ["desert"]),
    ]
    nan = np.nan
    mars = {"challenges": {
        "surface": np.array([0.9, 0.8, 0.1, 0.0, 0.7, 0.0, 0.5, 0.6]),
        "life": np.array([0, 0, 0, 0.9, 0, 0, 0.2, 0.95]),
        "dryness": np.array([0, 0, 0, 0, 0, nan, 0.3, 0.3]),
    }}
    moon = {"challenges": {"surface": np.array([0, 0, 0, 0, 0.9, 0, 0.2, 0])}}
    cfg = {"validation": {"moon_target": "moon", "mars_target": "mars", "second_run": {
        "rule": "r", "pooled_rule": "p", "few_sites_note": "f", "min_sites_per_challenge": 3,
        "pass_marks": {"vs_ordinary": 0.8, "vs_desert": 0.6}, "moon_groups": ["moon-analog", "moon-basalt"], "mars_groups": ["mars-analog"]}}}
    return cells, sites, {"mars": mars, "moon": moon}, cfg


def run_second():
    from pipeline.assemble import index_of
    cells, sites, scored, cfg = mini_world()
    where = locate(sites, cells, index_of(cells))
    return second_run(cells, scored, sites, cfg, where, {"a1"})


def checks_of(sr, body):
    return {c["name"].split(" (")[0]: c for t in sr["tests"] if t["body"] == body for c in t["checks"]}


def test_each_analog_is_paired_on_its_own_challenge():
    sr = run_second()
    mars = next(t for t in sr["tests"] if t["body"] == "mars")
    rows = [(p["id"], p["challenge"], p["score"]) for p in mars["places"] if p["group"].startswith("analog:")]
    assert ("a4", "life", 0.9) in rows and ("a1", "surface", 0.9) in rows
    assert not any(r[0] == "a4" and r[1] == "surface" for r in rows)
    ordinary = [(p["challenge"], p["score"]) for p in mars["places"] if p["group"] == "ordinary"]
    assert ("life", 0.2) in ordinary and ("surface", 0.5) in ordinary
    c = checks_of(sr, "mars")["Surface: analogs used for it beat ordinary places"]
    assert c["result"] == 0.75 and c["n_pairs"] == 4 and c["passed"] is False
    assert c["held_out_only"] == 1.0 and c["blind_only"] == 0.0


def test_too_few_sites_gives_no_pass_or_fail():
    c = checks_of(run_second(), "mars")["Signs of life: analogs used for it beat ordinary places"]
    assert c["passed"] is None and "too few sites" in c["name"]
    assert c["result"] == 1.0


def test_pooled_counts_every_entry_on_its_own_challenge():
    c = checks_of(run_second(), "mars")["All challenges pooled: analogs beat ordinary places on the challenges they are used for"]
    assert c["n_pairs"] == 5
    assert c["result"] == 0.8 and c["passed"] is True


def test_site_in_both_bodies_uses_each_bodys_list():
    sr = run_second()
    moon = next(t for t in sr["tests"] if t["body"] == "moon")
    assert [(p["id"], p["challenge"]) for p in moon["places"] if p["group"].startswith("analog:")] == [("both", "surface")]


def test_unchecked_lists_unscored_uses_and_empty_cells():
    why = {u["place"]: u["why"] for u in run_second()["unchecked"]}
    assert "shelter" in why["a2 (Mars)"]
    assert "no data" in why["gap (Mars)"]
    assert len([k for k in why if k.startswith("a2")]) == 1


def test_entries_with_no_use_for_a_body():
    s = [site("x", 0, 0, ["moon-analog"], {"mars": ["surface"]})]
    found, unchecked = entries(s, "moon", ["moon-analog"], {"surface"})
    assert found == [] and "No use is tagged" in unchecked[0]["why"]


def test_tally_ties_count_half():
    rows = [{"challenge": "c", "score": 0.5, "held_out": False, "blind": False}] * 3
    c = tally(rows, [{"challenge": "c", "score": 0.5}], 0.8, "x", 3)
    assert c["result"] == 0.5 and c["passed"] is False

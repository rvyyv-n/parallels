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

import numpy as np
import pytest

from pipeline.assemble import load_config
from pipeline.publish import filter_scores, headline, inputs, stability, weight_tables
from pipeline.score import score_target
from pipeline.traits import FILTERS


def world(n=60, seed=3):
    rng = np.random.default_rng(seed)
    cells = {k: rng.random(n) * 10 for k in ("ts_coldest", "swing_day_ground", "swing_day_air", "aridity", "sun_height", "slope_200", "relief_200", "safe10_200", "bare_share", "frozen_months", "aod", "usable", "rock_volcanic")}
    cells["mineral_groups"] = np.where(rng.random(n) < 0.5, 3.0, np.nan)
    cells["area"] = np.ones(n)
    target = {"id": "mars-jezero", "body": "mars", "short": "Jezero", "values": {"t_min_ground_c": {"value": 5}, "daily_swing_c": {"value": 5}, "slope_median_deg": {"value": 1.5}, "relief_m": {"value": 8}, "share_under_10": {"value": 0.05}, "noon_sun_deg": {"value": 7}, "dust_tau": {"value": 4}, "frozen_months": {"value": 3}}}
    return cells, target


def test_unchanged_weights_reproduce_the_published_scores():
    cells, target = world()
    cfg = load_config(method="1.2")
    s = score_target(cells, target, cfg)
    traits, chs, wc, wf = weight_tables(cfg, "mars", s["ranks"])
    logs, have = inputs(s, traits, cfg["scoring"])
    out = filter_scores(logs, have, wc, wf, cfg["scoring"])
    for i, f in enumerate(FILTERS):
        assert np.allclose(np.nan_to_num(out[i], nan=-1), np.nan_to_num(s["scores"][f["id"]], nan=-1))


def test_stability_is_repeatable_and_counts_top_cells():
    cells, target = world()
    cfg = load_config(method="1.2")
    s = score_target(cells, target, cfg)
    a, b = stability(s, cfg, "mars", runs=50), stability(s, cfg, "mars", runs=50)
    for f in FILTERS:
        assert np.array_equal(a[f["id"]]["stable"], b[f["id"]]["stable"])
        assert len(a[f["id"]]["top"]) == 20 and set(a[f["id"]]["stable"]) <= set(a[f["id"]]["top"])


def test_headline_takes_the_best_cell_that_clears_the_bar():
    n = 1000
    s = np.linspace(0, 1, n)
    cells = {"lat": np.full(n, 10.0), "lon": np.zeros(n), "area": np.ones(n), "region": np.full(n, -1.0), "terrain_type": np.zeros(n),
             "nearest_analog_km": np.full(n, 500.0), "ice": np.zeros(n), "slope_200": np.ones(n)}
    cells["lat"][n - 1] = -70
    cells["nearest_analog_km"][n - 2] = 50
    cells["ice"][n - 3] = 80
    scored = {"scores": {"rover": s}, "ranks": {"slope": s}, "values": {"slope": {"value": 1.0}}}
    cfg = {"trait_weights": {"mars": {"surface": {"slope": [1, ""]}}}, "filter_weights": {"rover": {"mars": {"surface": [1, ""]}}}}
    h, runners = headline(cells, scored, cfg, {"body": "mars", "short": "Jezero"}, [], "rover", 100)
    assert h["cell"] == n - 4
    assert [r["cell"] for r in runners] == [n - 5, n - 6, n - 7, n - 8]
    assert "top 1%" in h["why"]

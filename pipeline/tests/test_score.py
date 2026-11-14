import numpy as np
import pytest

from pipeline.score import part_weights, challenge, combine, earth_rank, overall, mineral_share, score_target, target_value, yearround
from pipeline.traits import trait


def test_closest_place_ranks_top():
    r = earth_rank([0, 10, 20, 30, 40], -10, np.ones(5))
    assert r[0] == pytest.approx(0.9)
    assert r[4] == pytest.approx(0.1)


def test_area_weighting_counts_land_not_cells():
    r = earth_rank([0, 10, 20], 0, np.array([1.0, 1.0, 8.0]))
    assert r[0] == pytest.approx((9 + 0.5) / 10)
    assert r[1] == pytest.approx((8 + 0.5) / 10)
    assert r[2] == pytest.approx(4 / 10)


def test_ties_count_half():
    r = earth_rank([5, 5, 9], 0, np.ones(3))
    assert r[0] == pytest.approx((1 + 1) / 3)
    assert r[0] == r[1]


def test_target_far_outside_earth_range_still_orders_places():
    r = earth_rank([-60, -40, -20, 0, 20], -248, np.ones(5))
    assert list(np.argsort(-r)) == [0, 1, 2, 3, 4]


def test_missing_values_get_no_rank_and_are_not_counted():
    r = earth_rank([np.nan, 1, 2], 0, np.ones(3))
    assert np.isnan(r[0])
    assert r[1] == pytest.approx(0.75)


def test_no_target_gives_no_rank():
    assert np.isnan(earth_rank([1, 2], None, np.ones(2))).all()


def test_weighted_geometric_mean():
    s = combine({"a": [0.25], "b": [1.0]}, {"a": 1, "b": 1})
    assert s[0] == pytest.approx(0.5)


def test_weights_tilt_the_mean():
    s = combine({"a": [0.25], "b": [1.0]}, {"a": 3, "b": 1})
    assert s[0] == pytest.approx(0.25 ** 0.75)


def test_floor_stops_one_zero_wiping_out_the_score():
    s = combine({"a": [0.0], "b": [1.0]}, {"a": 1, "b": 1})
    assert s[0] == pytest.approx(0.1)


def test_missing_counts_as_half():
    s = combine({"a": [np.nan], "b": [1.0], "c": [1.0], "d": [1.0]}, {k: 1 for k in "abcd"})
    assert s[0] == pytest.approx(0.5 ** 0.25)


def test_challenge_scores_whenever_one_trait_has_data():
    s, cov = challenge({"a": [np.nan, np.nan], "b": [1.0, np.nan]}, {"a": 1, "b": 3})
    assert s[0] == pytest.approx(0.5 ** 0.25)
    assert cov[0] == pytest.approx(0.75)
    assert np.isnan(s[1]) and cov[1] == 0


def test_overall_gate_follows_weight_down_to_traits():
    ch = {"res": np.array([0.5, 0.5]), "heat": np.array([0.9, 0.9])}
    cov = {"res": np.array([0.5, 0.0]), "heat": np.array([1.0, 1.0])}
    s = overall(ch, cov, {"res": 1, "heat": 2})
    assert s[0] == pytest.approx((0.5 * 0.9 ** 2) ** (1 / 3))
    assert np.isnan(s[1])
    s = overall(ch, cov, {"res": 1, "heat": 1})
    assert s[0] == pytest.approx((0.5 * 0.9) ** 0.5)
    assert np.isnan(s[1])


def test_one_missing_trait_does_not_unrank_a_cell():
    ch, cov = challenge({"frozen": [0.8], "minerals": [np.nan]}, {"frozen": 1, "minerals": 1})
    heat, hcov = challenge({"cold": [0.6]}, {"cold": 1})
    atm, acov = challenge({"dust": [0.7]}, {"dust": 1})
    s = overall({"res": ch, "heat": heat, "atm": atm}, {"res": cov, "heat": hcov, "atm": acov}, {"res": 1, "heat": 1, "atm": 1})
    assert np.isfinite(s[0])


def test_yearround_term_lowers_part_year_places():
    s = yearround(np.array([0.8, 0.8]), np.array([1.0, 0.1]), 0.25)
    assert s[0] == pytest.approx(0.8 ** 0.75)
    assert s[1] < s[0]


def test_mineral_share_counts_only_target_groups():
    bits = np.array([0b0011, 0b1000, np.nan])
    s = mineral_share(bits, ["clays", "carbonates", "sulfates"])
    assert s[0] == pytest.approx(2 / 3)
    assert s[1] == 0
    assert np.isnan(s[2])


def test_target_values_convert_units():
    t = {"id": "moon-south-pole", "values": {"t_min_k": {"value": 40.0}, "t_max_k": {"value": 250.0}, "share_under_10": {"value": 0.5}}}
    assert target_value(trait("cold"), "moon", t)["value"] == pytest.approx(-233.15)
    assert target_value(trait("season_swing"), "moon", t)["value"] == pytest.approx(210.0)
    assert target_value(trait("safe10"), "moon", t)["value"] == pytest.approx(50.0)
    assert target_value(trait("dust"), "moon", t) is None


def test_traits_a_target_lacks_are_left_out():
    n = 50
    rng = np.random.default_rng(1)
    cells = {k: rng.random(n) * 10 for k in ("ts_coldest", "swing_day_ground", "swing_day_air", "aridity", "sun_height", "slope_200", "relief_200", "safe10_200", "bare_share", "frozen_months", "aod", "usable")}
    cells["mineral_groups"] = np.full(n, 3.0)
    cells["area"] = np.ones(n)
    cfg = {
        "scoring": {"floor": 0.01, "missing_rank": 0.5, "min_weight_with_data": 0.7, "yearround_share": 0.25},
        "trait_weights": {"mars": {"surface": {k: [1, ""] for k in ("slope", "safe10", "relief", "minerals", "bare")}, "resources": {"frozen": [1, ""], "minerals": [1, ""]}, "dryness": {"dry": [1, ""]}, "heat": {k: [1, ""] for k in ("cold", "day_swing_ground", "day_swing_air")}, "atmosphere": {"dust": [1, ""], "bare": [1, ""]}, "life": {k: [1, ""] for k in ("minerals", "dry", "cold", "bare")}}},
        "filter_weights": {"rover": {"mars": {"surface": [1, ""], "atmosphere": [1, ""]}}, "life_support": {"mars": {"resources": [1, ""], "heat": [1, ""], "atmosphere": [1, ""]}}, "habitat": {"mars": {"surface": [1, ""], "heat": [1, ""]}}},
    }
    target = {"id": "mars-jezero", "body": "mars", "values": {"t_min_ground_c": {"value": -90}, "daily_swing_c": {"value": 50}, "slope_median_deg": {"value": 1.5}, "relief_m": {"value": 80}, "share_under_10": {"value": 1.0}, "noon_sun_deg": {"value": 70}, "dust_tau": {"value": 0.4}}}
    s = score_target(cells, target, cfg)
    assert "day_swing_ground" not in s["ranks"] and "day_swing_air" in s["ranks"]
    assert "frozen" not in s["ranks"]
    assert set(s["coverage"]) == set(s["challenges"])
    target["values"]["frozen_months"] = {"value": 12, "dataset": "x", "stat": "", "resolution": "", "kind": "derived"}
    s2 = score_target(cells, target, cfg)
    assert "frozen" in s2["ranks"]
    cells["mineral_groups"] = np.full(n, np.nan)
    s3 = score_target(cells, target, cfg)
    assert np.allclose(s3["coverage"]["resources"], 0.5)
    assert np.isfinite(s3["scores"]["life_support"]).all()
    assert set(s["scores"]) == {"rover", "rover:yr", "life_support", "life_support:yr", "habitat", "habitat:yr"}
    assert np.isfinite(s["scores"]["habitat"]).all()
    assert s["ranks"]["minerals"] == pytest.approx(np.full(n, 0.5))


def test_parts_count_equally_and_share_inside():
    w = part_weights({"surface": [{"name": "a", "traits": ["slope", "relief"]}, {"name": "b", "traits": ["safe10"]}], "res": [{"name": "w", "traits": ["x"]}, {"name": "o", "traits": ["x"]}]})
    assert w["surface"] == {"slope": 0.5, "relief": 0.5, "safe10": 1.0}
    assert w["res"] == {"x": 2.0}


def test_config_11_weights_follow_its_parts_and_v1_is_untouched():
    import json
    from pipeline.assemble import CONFIG, load_config
    over = json.loads((CONFIG.parent / "v1.1.json").read_text(encoding="utf8"))
    for body, chs in over["parts"].items():
        w = part_weights(chs)
        assert {c: {t: v[0] for t, v in ts.items()} for c, ts in over["trait_weights"][body].items()} == w
    base, new = load_config(), load_config(method="1.1")
    assert base["trait_weights"]["mars"]["surface"]["bare"][0] == 1
    assert new["trait_weights"]["mars"]["surface"]["bare"][0] == 1 and new["trait_weights"]["mars"]["surface"]["volcanic_rock"][0] == 0.5
    assert new["trait_weights"]["moon"]["industrial"] == base["trait_weights"]["moon"]["industrial"]
    assert new["filter_weights"] == base["filter_weights"] and new["validation"] == base["validation"]
    assert new["version"] == "v1.1" and "adoption_rule" in new

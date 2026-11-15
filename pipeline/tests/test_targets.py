import json
import math

import numpy as np
import pytest
from pyproj import Transformer

from pipeline.targets import (
    MOON,
    MORE_MOON,
    POLAR_MAPS,
    OUT,
    RAW,
    combine,
    dci_cell,
    geo_bounds,
    grs_value,
    ground_strength,
    haversine_km,
    lon180,
    median_value,
    moon_anchor,
    polar_latlon,
    polar_scale,
    polar_xy,
    tes_cell,
    tes_slices,
    tes_value,
    val,
)

TERRAIN = ("slope_median_deg", "slope_p90_deg", "share_under_10", "share_under_5", "relief_m")

needs_output = pytest.mark.skipif(not OUT.exists(), reason="run python -m pipeline.targets first")
needs_raw = pytest.mark.skipif(not (RAW / "moon" / "AVGVISIB_75S_120M_201608.TIF").exists(), reason="raw Moon files not downloaded")


def doc():
    return json.loads(OUT.read_text(encoding="utf-8"))


def targets():
    return doc()["targets"]


@pytest.mark.parametrize("lat,lon", [(-90, 0), (-89.5, 45), (-85, -120), (-80, 179.9), (-75.2, 10)])
def test_polar_round_trip(lat, lon):
    back_lat, back_lon = polar_latlon(*polar_xy(lat, lon))
    assert back_lat == pytest.approx(lat, abs=1e-9)
    if lat > -90:
        assert lon180(back_lon) == pytest.approx(lon, abs=1e-9)


def test_polar_matches_proj():
    t = Transformer.from_crs("+proj=longlat +R=1737400 +no_defs",
                             "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs", always_xy=True)
    for lat, lon in [(-89, 30), (-85.98, -1.67), (-82.26, -54.58)]:
        x, y = t.transform(lon, lat)
        assert polar_xy(lat, lon) == pytest.approx((x, y), abs=1e-3)


def test_polar_scale_is_one_at_pole():
    assert polar_scale(-90) == 1
    assert polar_scale(-85) == pytest.approx(1.0019, abs=1e-4)


def test_rim_anchors_sit_one_radius_from_centre():
    for rule in ("rim_pole", "rim_away"):
        lat, lon = moon_anchor("Nobile", rule)
        km = abs(lat - -85.2752) * math.pi / 180 * 1737.4
        assert km == pytest.approx(79.272 / 2, rel=0.01)
        assert lon == pytest.approx(53.2725)
    assert moon_anchor("Nobile", "rim_pole")[0] < moon_anchor("Nobile", "rim_away")[0]


def test_lon180():
    assert lon180(184.3) == pytest.approx(-175.7)
    assert lon180(239.91) == pytest.approx(-120.09)
    assert lon180(-10) == -10


def test_geo_bounds_is_10_km_on_the_ground():
    w, s, e, n = geo_bounds(60, 10, 5000, 3396190)
    assert (n - s) * math.pi / 180 * 3396190 == pytest.approx(10000)
    assert (e - w) * math.pi / 180 * 3396190 * math.cos(math.radians(60)) == pytest.approx(10000)


def test_grs_value_picks_the_5_degree_bin():
    rows = [(17.5, 77.5, 3.5, 0.2), (47.5, 182.5, 5.3, 0.3), (-87.5, 2.5, 9999.999, 9999.999)]
    assert grs_value(rows, 18.38, 77.58) == (3.5, 0.2)
    assert grs_value(rows, 47.2, -175.7) == (5.3, 0.3)
    assert grs_value(rows, -88, 4) == (None, None)


def test_dci_cell_starts_at_minus_180():
    assert dci_cell(90, -180) == (0, 0)
    assert dci_cell(0, 0) == (1440, 2880)
    assert dci_cell(-5.4, 137.8) == (1526, 5084)


def test_tes_cell_is_20_per_degree_from_minus_180():
    assert tes_cell(90, -180) == (0, 0)
    assert tes_cell(0, 0) == (1800, 3600)
    assert tes_cell(18.38, 77.58) == (1432, 5151)
    assert tes_cell(-89.99, 179.99) == (3599, 7199)


def test_tes_slices_cover_the_window_and_fall_back_to_3x3():
    rows, cols, small = tes_slices(0, 0)
    assert not small
    assert 3 <= rows.stop - rows.start <= 4 and 3 <= cols.stop - cols.start <= 4
    assert rows.start <= 1800 <= rows.stop and cols.start <= 3600 <= cols.stop
    rows, cols, small = tes_slices(0, 0, half_m=500)
    assert small and (rows, cols) == (slice(1799, 1802), slice(3599, 3602))


def test_tes_value_drops_masked_and_zero_pixels():
    ti = np.zeros((3600, 7200), dtype=">i2")
    mask = np.ones((3600, 7200), dtype="u1")
    rows, cols, _ = tes_slices(0, 0)
    ti[rows, cols] = 300
    ti[rows.start, cols.start] = 5000
    mask[rows.start, cols.start] = 0
    ti[rows.start + 1, cols.start] = 0
    value, n, small = tes_value(ti, mask, 0, 0)
    assert value == 300 and not small
    assert n == (rows.stop - rows.start) * (cols.stop - cols.start) - 2
    mask[rows, cols] = 0
    assert tes_value(ti, mask, 0, 0)[0] is None


def test_ground_strength_bands():
    assert ground_strength(300)[0] == "above"
    assert ground_strength(120)[0] == "inside"
    assert ground_strength(68)[0] == "below"
    assert ground_strength(None)[0] is None


def test_haversine():
    assert haversine_km(0, 0, 0, 1) == pytest.approx(math.radians(1) * 3396.19, rel=1e-6)


def fake_region(i, **values):
    return {"id": f"r{i}", "name": f"r{i}", "values": {
        k: val(v, "lola-ldem-240m", "region stat", "computed") for k, v in values.items()}}


def test_nine_region_median():
    regions = [fake_region(i, a=x, b=None if i == 0 else float(i)) for i, x in enumerate([5, 1, 9, 3, 7, 2, 8, 4, 6])]
    out = combine(regions)
    assert out["a"]["value"] == 5
    assert out["b"]["value"] == pytest.approx(4.5)
    assert "8 regions" in out["b"]["note"]
    assert out["a"]["stat"] == "median of NASA's nine Artemis III candidate regions (10 km window each)"
    assert median_value([{"value": None}]) is None


def test_published_values_pass_through_combine():
    regions = [fake_region(i, a=i) for i in range(9)]
    for r in regions:
        r["values"]["p"] = val(55, "hayne-2017", "published", "published")
    assert combine(regions)["p"]["value"] == 55


@needs_output
def test_every_value_names_a_listed_dataset():
    d = doc()
    ids = {x["id"] for x in d["datasets"]}
    assert len(ids) == len(d["datasets"])
    for x in d["datasets"]:
        assert set(x) == {"id", "name", "agency", "url", "licence", "used_for", "archive"}
    values = []
    for t in d["targets"]:
        values += [(t["id"], k, v) for k, v in t["values"].items()]
        for r in t.get("regions", []):
            values += [(r["id"], k, v) for k, v in r["values"].items()]
    values += [("label", k, v) for k, v in d["labels"]["mars_caves"].items()] + [("label", "pits", d["labels"]["lunar_pits"])]
    for who, k, v in values:
        assert {"value", "stat", "dataset", "resolution", "kind"} <= set(v), (who, k)
        assert v["kind"] in ("computed", "published", "derived"), (who, k)
        if v["dataset"] is None:
            assert v["value"] is None and v.get("note"), (who, k)
        else:
            assert v["dataset"] in ids, (who, k)
        if v["value"] is None:
            assert v.get("note"), (who, k)


@needs_output
def test_targets_and_defaults():
    ts = targets()
    assert len(ts) == 16
    assert len({t["id"] for t in ts}) == 16
    assert [t["id"] for t in ts if t["default"]] == ["moon-south-pole", "mars-jezero"]
    combined = ts[0]
    more = {"moon-shackleton-rim"}
    assert [r["id"] for r in combined["regions"]] == [t["id"] for t in ts if t["body"] == "moon" and t is not combined and t["id"] not in more]
    assert len(combined["regions"]) == len(MOON) == 9
    for t in ts:
        for k in TERRAIN:
            assert t["values"][k]["value"] is not None, (t["id"], k)


@needs_output
def test_combined_moon_values_are_the_region_median():
    combined = targets()[0]
    for k in ("slope_median_deg", "t_min_k", "t_swing_k", "lit_share", "psr_share"):
        vals = [r["values"][k]["value"] for r in combined["regions"]]
        assert combined["values"][k]["value"] == pytest.approx(float(np.median(vals)), abs=0.01), k


@needs_output
def test_mars_frozen_months_and_thermal_inertia():
    for t in targets():
        if t["body"] == "mars":
            assert t["values"]["frozen_months"]["value"] == 12
            assert t["values"]["frozen_months"]["kind"] == "derived"
            assert t["values"]["thermal_inertia"]["value"] is not None
            assert t["values"]["ground_strength_note"]["note"]


@needs_output
@needs_raw
def test_moon_values_agree_with_published():
    moon = {t["name"]: t["values"] for t in targets() if t["body"] == "moon" and "regions" not in t}
    assert len(moon) == len(MOON) + len(MORE_MOON)
    best_lit = max(v["lit_share"]["value"] for v in moon.values())
    assert 0.75 < best_lit <= 0.95
    shadowed = [v for v in moon.values() if v["lit_share_median"]["value"] < 0.05]
    assert shadowed
    assert all(v["t_min_coldest_k"]["value"] < 110 for v in shadowed)
    assert all(v["t_min_k"]["value"] < 110 for v in shadowed)


@needs_output
def test_shackleton_rim_has_every_polar_map_and_stays_out_of_the_combined_target():
    ts = {t["id"]: t for t in targets()}
    s = ts["moon-shackleton-rim"]
    assert all(s["values"][k]["value"] is not None for k in POLAR_MAPS)
    assert s["lat"] < -89.9
    assert "moon-shackleton-rim" not in [r["id"] for r in ts["moon-south-pole"]["regions"]]
    assert not any("nine Artemis III" in f["text"] for f in s["facts"])


def test_shackleton_rim_anchor_is_one_radius_from_its_centre():
    lat, lon, d, _ = (-89.67, 129.78, 20.92, 5450)
    a = moon_anchor("Shackleton", "rim_pole")
    x0, y0 = polar_xy(lat, lon)
    x1, y1 = polar_xy(*a)
    assert math.hypot(x1 - x0, y1 - y0) / polar_scale(lat) == pytest.approx(d * 500, rel=0.01)

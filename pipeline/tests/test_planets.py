import json
import math

import pytest
from pyproj import Transformer

from pipeline.planets import (
    MOON,
    OUT,
    RAW,
    dci_cell,
    geo_bounds,
    grs_value,
    lon180,
    moon_anchor,
    polar_latlon,
    polar_scale,
    polar_xy,
)

TERRAIN = ("slope_median_deg", "slope_p90_deg", "share_under_10", "share_under_5", "relief_m")

needs_output = pytest.mark.skipif(not OUT.exists(), reason="run python -m pipeline.planets first")
needs_raw = pytest.mark.skipif(not (RAW / "AVGVISIB_75S_120M_201608.TIF").exists(), reason="raw Moon files not downloaded")


def targets():
    return json.loads(OUT.read_text(encoding="utf-8"))["targets"]


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


@needs_output
def test_all_targets_have_terrain():
    ts = targets()
    assert len(ts) == 14
    assert len({t["id"] for t in ts}) == 14
    for t in ts:
        for k in TERRAIN:
            assert t["values"][k]["value"] is not None, (t["id"], k)


@needs_output
def test_every_value_has_a_source():
    for t in targets():
        for k, v in t["values"].items():
            assert v["kind"] in ("computed", "published", "derived"), (t["id"], k)
            assert v["source"]
            if v["value"] is None:
                assert v.get("note"), (t["id"], k)


@needs_output
@needs_raw
def test_moon_values_agree_with_published():
    moon = {t["name"]: t["values"] for t in targets() if t["body"] == "moon"}
    assert len(moon) == len(MOON)
    best_lit = max(v["lit_share"]["value"] for v in moon.values())
    assert 0.75 < best_lit <= 0.92
    shadowed = [v for v in moon.values() if v["lit_share_median"]["value"] < 0.05]
    assert shadowed
    assert all(v["t_min_coldest_k"]["value"] < 110 for v in shadowed)
    assert all(v["t_min_k"]["value"] < 110 for v in shadowed)

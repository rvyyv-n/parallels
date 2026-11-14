import json
import os
import random
from pathlib import Path

import numpy as np
import pytest

from pipeline.earth import (
    DERIVED,
    fetch_power,
    lit_share,
    metric_pixel,
    noon_sun_deg,
    parse_power,
    resample_masked,
    tile_name,
    tiles_for,
    window_bounds,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_noon_sun_at_equator_and_poles():
    assert 70 < noon_sun_deg(0) < 80
    assert noon_sun_deg(90) < 12
    assert noon_sun_deg(90) == noon_sun_deg(-90)


def test_noon_sun_never_negative_in_polar_night():
    assert noon_sun_deg(80) > 0
    assert noon_sun_deg(45) == pytest.approx(45, abs=0.5)


def test_lit_share_is_about_half_everywhere():
    for lat in (0, 30, 60, 75, 89.9, -77):
        assert lit_share(lat) == pytest.approx(0.5, abs=0.02)
    assert lit_share(0) == 0.5


def test_window_is_10_km_across():
    left, bottom, right, top = window_bounds(60, 10)
    width, height = metric_pixel((right - left, top - bottom), 60)
    assert width == pytest.approx(10_000)
    assert height == pytest.approx(10_000)


def test_tile_names_use_lower_left_corner():
    assert tile_name(-25, -71) == "Copernicus_DSM_COG_30_S25_00_W071_00_DEM"
    assert tile_name(5, 7) == "Copernicus_DSM_COG_30_N05_00_E007_00_DEM"


def test_window_on_a_corner_spans_four_tiles():
    names = tiles_for(window_bounds(0.0, 0.0))
    assert sorted(names) == sorted(
        [tile_name(-1, -1), tile_name(-1, 0), tile_name(0, -1), tile_name(0, 0)]
    )
    assert tiles_for(window_bounds(10.5, 10.5)) == [tile_name(10, 10)]


def test_parse_power_fixture():
    v = parse_power(json.loads((FIXTURES / "power_yungay.json").read_text()))
    assert v["t_min_c"] == -0.64
    assert v["t_max_c"] == 32.93
    assert v["seasonal_swing_c"] == 33.57
    assert v["frozen_months"] == 0
    assert v["precip_mm_day"] == 0.02
    assert v["rh_pct"] == 44.09
    assert v["sun_kwh_m2_day"] == 5.9551


def test_parse_power_fill_value_is_null():
    doc = json.loads((FIXTURES / "power_yungay.json").read_text())
    doc["properties"]["parameter"]["RH2M"]["ANN"] = -999.0
    doc["properties"]["parameter"]["T2M"]["JUL"] = -999.0
    v = parse_power(doc)
    assert v["rh_pct"] is None
    assert v["frozen_months"] is None


@pytest.mark.skipif(not os.environ.get("RUN_NETWORK"), reason="set RUN_NETWORK=1")
def test_reference_climate_matches_fresh_fetch():
    points = json.loads((DERIVED / "earth_reference.json").read_text())["points"]
    for p in random.Random(1).sample(points, 5):
        fresh = parse_power(fetch_power(p["lat"], p["lon"], use_cache=False))
        assert {k: p["values"][k] for k in fresh} == fresh


def test_ocean_gap_does_not_spread_across_the_window():
    dem = np.tile(np.arange(100.0) * 10, (100, 1))
    dem[:, :20] = np.nan
    out = resample_masked(dem, 90.0, 90.0, 240.0)
    assert np.isnan(out).mean() == pytest.approx(0.2, abs=0.05)
    assert np.isfinite(out[:, -1]).all()

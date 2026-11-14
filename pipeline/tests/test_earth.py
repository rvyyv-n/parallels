import datetime
import json
import os
import random
from pathlib import Path

import numpy as np
import pytest

from pipeline.earth import (
    DERIVED,
    class_of,
    decode,
    fetch_power,
    fetch_surface,
    land_cover_summary,
    latest_times,
    lit_share,
    load_colormap,
    metric_pixel,
    ndvi_of,
    ndvi_summary,
    noon_sun_deg,
    parse_power,
    parse_surface,
    parse_times,
    read_png,
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


def test_parse_surface_fixture():
    v = parse_surface(json.loads((FIXTURES / "power_surface_yungay.json").read_text()))
    assert v == {
        "ts_min_c": -2.44,
        "ts_max_c": 45.22,
        "ts_seasonal_swing_c": 47.66,
        "ts_daily_range_c": 28.59,
        "frozen_months_surface": 0,
        "soil_wetness": 0.1,
        "aod_550": 0.04,
    }


def test_parse_surface_counts_frozen_months_and_nulls_fill():
    doc = json.loads((FIXTURES / "power_surface_yungay.json").read_text())
    p = doc["properties"]["parameter"]
    p["TS"]["JUN"] = p["TS"]["JUL"] = -3.0
    p["AOD_55"]["ANN"] = -999.0
    del p["TS_RANGE"]
    v = parse_surface(doc)
    assert v["frozen_months_surface"] == 2
    assert v["aod_550"] is None
    assert v["ts_daily_range_c"] is None


def test_land_cover_fixture_decodes_to_barren_and_ice():
    cmap = load_colormap((FIXTURES / "colormap_igbp.xml").read_text())
    classes = decode(read_png((FIXTURES / "land_cover_dry_valleys.png").read_bytes()), cmap, class_of)
    assert classes.shape == (8, 24)
    assert set(np.unique(classes).tolist()) == {10.0, 15.0, 16.0}
    labels = {int(c): e["label"] for e in cmap.values() for c in e["source"].split(",")}
    v = land_cover_summary(classes, labels)
    assert v["land_cover_main"] == "Permanent Snow and Ice"
    assert v["bare_share"] + v["ice_share"] == pytest.approx(189 / 192, abs=0.002)


def test_land_cover_shares_skip_water_and_unknown_colours():
    cmap = load_colormap((FIXTURES / "colormap_igbp.xml").read_text())
    rgba = np.array(
        [[[191, 191, 189, 255], [191, 191, 189, 255], [134, 202, 227, 255], [134, 202, 227, 255]],
         [[250, 239, 115, 255], [255, 255, 255, 255], [1, 2, 3, 255], [0, 0, 0, 0]]],
        dtype=np.uint8,
    )
    classes = decode(rgba, cmap, class_of)
    assert np.isnan(classes[1, 2]) and np.isnan(classes[1, 3])
    labels = {int(c): e["label"] for e in cmap.values() for c in e["source"].split(",")}
    v = land_cover_summary(classes, labels)
    assert v["bare_share"] == 0.5
    assert v["ice_share"] == 0.25
    assert v["land_cover_main"] in {"Barren", "Water Bodies"}
    assert land_cover_summary(None, labels) == {"bare_share": None, "ice_share": None, "land_cover_main": None}


def test_ndvi_inverts_to_bin_middle_and_drops_transparent():
    cmap = load_colormap((FIXTURES / "colormap_ndvi.xml").read_text())
    rgba = np.array([[[0, 100, 0, 255], [0, 100, 1, 255], [241, 236, 236, 255], [0, 0, 0, 0]]], dtype=np.uint8)
    v = decode(rgba, cmap, ndvi_of)
    assert v[0, :3] == pytest.approx([0.8251, 0.8351, 0.0026])
    assert np.isnan(v[0, 3])
    assert ndvi_summary([v, None]) == {"ndvi_max": round(float(np.nanmean(v)), 3)}
    assert ndvi_summary([v[:, 3:], None]) == {"ndvi_max": None}


def test_latest_times_skip_years_without_a_full_ndvi_record():
    land = parse_times("2001-01-01/2024-01-01/P1Y")
    ndvi = parse_times("2000-03-01/2025-03-01/P1M,2025-05-01/2026-10-01/P1M")
    assert datetime.date(2025, 4, 1) not in ndvi
    assert latest_times(land, ndvi) == ("2024-01-01", ("2025-01-01", "2025-07-01"))


@pytest.mark.skipif(not os.environ.get("RUN_NETWORK"), reason="set RUN_NETWORK=1")
def test_reference_climate_matches_fresh_fetch():
    points = json.loads((DERIVED / "earth_reference.json").read_text())["points"]
    for p in random.Random(1).sample(points, 5):
        fresh = parse_power(fetch_power(p["lat"], p["lon"], use_cache=False))
        fresh |= parse_surface(fetch_surface(p["lat"], p["lon"], use_cache=False))
        assert {k: p["values"][k] for k in fresh} == fresh


def test_ocean_gap_does_not_spread_across_the_window():
    dem = np.tile(np.arange(100.0) * 10, (100, 1))
    dem[:, :20] = np.nan
    out = resample_masked(dem, 90.0, 90.0, 240.0)
    assert np.isnan(out).mean() == pytest.approx(0.2, abs=0.05)
    assert np.isfinite(out[:, -1]).all()

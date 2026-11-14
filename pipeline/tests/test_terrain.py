import numpy as np

from pipeline.terrain import resample, slope_deg, terrain_metrics


def plane(rows, cols, px, slope):
    x = np.arange(cols) * px
    return np.tile(x * np.tan(np.radians(slope)), (rows, 1))


def test_slope_of_tilted_plane():
    dem = plane(20, 20, 240.0, 15.0)
    s = slope_deg(dem, 240.0)
    assert np.allclose(s, 15.0, atol=0.01)


def test_flat_ground_is_all_safe():
    m = terrain_metrics(np.zeros((40, 40)), 240.0)
    assert m["slope_median_deg"] == 0
    assert m["share_under_10"] == 1
    assert m["share_under_5"] == 1
    assert m["relief_m"] == 0


def test_steep_plane_is_unsafe():
    m = terrain_metrics(plane(40, 40, 200.0, 20.0), 200.0)
    assert abs(m["slope_median_deg"] - 20) < 0.1
    assert m["share_under_10"] == 0


def test_nan_cells_are_ignored():
    dem = np.zeros((30, 30))
    dem[:5] = np.nan
    m = terrain_metrics(dem, 240.0)
    assert m["share_under_10"] == 1


def test_resample_keeps_slope():
    dem = plane(120, 120, 90.0, 8.0)
    out = resample(dem, 90.0, 90.0, 240.0)
    assert out.shape == (45, 45)
    assert abs(np.nanmedian(slope_deg(out, 240.0)) - 8) < 0.2

import numpy as np
import pytest

from pipeline import climate as c


def test_ra_matches_fao56_example_8():
    assert c.ra_mj(-20.0, 246) == pytest.approx(32.2, abs=0.05)


def test_ra_is_zero_in_polar_night():
    assert c.ra_mj(80.0, 355) == pytest.approx(0.0, abs=1e-9)


def test_hargreaves_hand_worked():
    expected = 0.0023 * 0.408 * 32.2 * (20 + 17.8) * 10 ** 0.5
    assert expected == pytest.approx(3.612, abs=0.001)
    assert c.hargreaves(20.0, 10.0, 32.2) == pytest.approx(3.612, abs=0.001)


def test_hargreaves_cold_gives_zero():
    assert c.hargreaves(-17.8, 10.0, 30.0) == 0
    assert c.hargreaves(-30.0, 10.0, 30.0) == 0


def test_yearly_total_counts_days():
    m = np.ones((12, 1, 1), np.float32)
    assert c.yearly_total(m)[0, 0] == pytest.approx(365.25)


def test_aridity_nan_where_pet_tiny():
    a = c.aridity(np.array([10.0, 500.0, 300.0]), np.array([2000.0, 500.0, 5.0]))
    assert a[0] == pytest.approx(0.005)
    assert a[1] == pytest.approx(1.0)
    assert np.isnan(a[2])


def test_noon_sun_equator_and_pole():
    assert c.noon_sun(np.array([0.0]))[0] == pytest.approx(90 - np.mean(np.abs(23.44 * np.sin(2 * np.pi * (np.arange(1, 366) - 80) / 365))))
    assert c.noon_sun(np.array([89.75]))[0] < 12


def grid_field(src_lat, src_lon):
    return (src_lat[:, None] * 1000 + src_lon[None, :]).astype(np.float64)


def test_bilinear_on_merra_layout():
    lat = np.arange(-90, 90.01, 0.5)
    lon = -180 + 0.625 * np.arange(576)
    out = c.bilinear(grid_field(lat, lon), lat, lon)
    i, j = c.cell(42.0, -93.5)
    assert out[i, j] == pytest.approx(c.LAT[i] * 1000 + c.LON[j], abs=1e-3)
    i, j = c.cell(10.0, 179.9)
    left, right = 179.375, 180.0
    w = (c.LON[j] - left) / 0.625
    expected = c.LAT[i] * 1000 + (1 - w) * left + w * (-180.0)
    assert out[i, j] == pytest.approx(expected, abs=1e-2)


def test_bilinear_never_fills_missing():
    lat = np.arange(-90, 90.01, 0.5)
    lon = -180 + 0.625 * np.arange(576)
    a = np.zeros((len(lat), len(lon)))
    a[int((42.0 + 90) / 0.5), int((-93.75 + 180) / 0.625)] = np.nan
    out = c.bilinear(a, lat, lon)
    assert np.isnan(out[c.cell(42.1, -93.6)])
    assert np.isnan(out).sum() <= 6


def test_repeat_on_ceres_layout():
    lat = np.arange(-89.5, 90, 1.0)
    lon = np.arange(-179.5, 180, 1.0)
    out = c.repeat(grid_field(lat, lon), lat, lon)
    for la, lo in [(-24.08, -69.94), (89.9, -179.9), (-89.9, 179.9), (0.2, 0.2)]:
        i, j = c.cell(la, lo)
        assert out[i, j] == np.floor(la) * 1000 + 500 + np.floor(lo) + 0.5


def test_cell_index():
    assert c.cell(89.9, -179.9) == (0, 0)
    assert c.cell(-89.9, 179.9) == (359, 719)
    assert c.LAT[c.cell(-24.0804, -69.9412)[0]] == -24.25


def test_seasons_bits():
    low = np.full((12, 1, 1), 5.0)
    high = np.full((12, 1, 1), 15.0)
    rain = np.full((12, 1, 1), 1.0)
    low[0], high[0] = -5, 5
    low[1], high[1] = -10, -2
    rain[6] = 10.0
    s = c.seasons(low, high, rain)
    assert s["m_freeze"][0, 0] == 0b1
    assert s["m_frozen"][0, 0] == 0b10
    assert s["m_rain"][0, 0] == 1 << 6
    assert s["m_best"][0, 0] == 0xFFF & ~0b1000011
    assert s["usable"][0, 0] == 9


def test_rain_needs_one_mm():
    rain = np.full((12, 1, 1), 0.1)
    rain[3] = 0.9
    s = c.seasons(np.full((12, 1, 1), 5.0), np.full((12, 1, 1), 15.0), rain)
    assert s["m_rain"][0, 0] == 0


def test_pick_region_prefers_centre_then_majority():
    b = np.full((10, 10), -1)
    b[0, :] = 3
    b[4:6, 4:6] = 7
    assert c.pick_region(b) == 7
    b[4:6, 4:6] = -1
    assert c.pick_region(b) == 3
    assert c.pick_region(np.full((10, 10), -1)) == -1


def test_weighted_median():
    assert c.weighted_median(np.array([1.0, 2.0, 3.0, np.nan]), np.array([1.0, 1.0, 5.0, 1.0])) == 3.0

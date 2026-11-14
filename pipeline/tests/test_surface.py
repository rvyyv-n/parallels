from pathlib import Path

import numpy as np

from pipeline import surface

FIXTURES = Path(__file__).parent / "fixtures"


def test_aggregate_shares_hand_made_block():
    pct = np.zeros((2, 4, 17), dtype=np.uint8)
    pct[0, 0, surface.LC_WATER] = 100
    pct[0, 1, surface.LC_BARREN] = 100
    pct[1, 0, surface.LC_ICE] = 100
    pct[1, 1, 3] = 100
    pct[:, 2:, :] = 255
    out = surface.aggregate_shares(pct, block=2)
    assert out["water_share"][0, 0] == 0.25
    assert out["ice_share"][0, 0] == 0.25
    assert out["lc_valid"][0, 0] == 1.0
    assert np.isclose(out["bare_share"][0, 0], 1 / 3)
    assert np.isclose(out["veg_share"][0, 0], 1 / 3)
    assert out["lc_valid"][0, 1] == 0.0
    assert np.isnan(out["bare_share"][0, 1])


def test_aggregate_shares_all_water_has_no_land():
    pct = np.zeros((2, 2, 17), dtype=np.uint8)
    pct[..., surface.LC_WATER] = 100
    out = surface.aggregate_shares(pct, block=2)
    assert out["water_share"][0, 0] == 1.0
    assert np.isnan(out["bare_share"][0, 0])


def test_aggregate_partial_percent_lowers_valid():
    pct = np.zeros((2, 2, 17), dtype=np.uint8)
    pct[..., surface.LC_BARREN] = 50
    out = surface.aggregate_shares(pct, block=2)
    assert out["lc_valid"][0, 0] == 0.5
    assert out["bare_share"][0, 0] == 1.0


def test_glim_groups_from_fixture():
    codes = surface.parse_glim(FIXTURES / "surface_glim.asc")
    assert np.isnan(codes[0, 0])
    assert surface.glim_group(codes, "rock_ice")[0, 1] == 1
    assert surface.glim_group(codes, "rock_evaporite")[0, 2] == 1
    assert surface.glim_group(codes, "rock_plutonic")[0, 3] == 1
    assert surface.glim_group(codes, "rock_volcanic")[1, 1] == 1
    assert surface.glim_group(codes, "rock_volcanic")[1, 2] == 1
    assert surface.glim_group(codes, "rock_volcanic")[1, 3] == 0
    assert np.isnan(surface.glim_group(codes, "rock_water")[0, 0])


def test_glim_volcanic_includes_pyroclastics():
    codes = np.array([[12.0, 8.0]], dtype=np.float32)
    assert list(surface.glim_group(codes, "rock_volcanic")[0]) == [1, 0]


def test_cell_orientation():
    assert surface.cell_lat(0) == 89.75
    assert surface.cell_lat(359) == -89.75
    assert surface.cell_lon(0) == -179.75
    assert surface.cell_lon(719) == 179.75
    assert surface.cell_row(89.9) == 0
    assert surface.cell_row(-89.9) == 359
    assert surface.cell_col(-179.9) == 0
    assert surface.cell_col(0.1) == 360


def test_place_emit_matches_corner_grid():
    arr = np.ones((220, 690), dtype=np.float32)
    full = surface.place_emit(arr, 55.0, -165.0)
    assert np.isfinite(full[70, 30]) and np.isnan(full[69, 30]) and np.isnan(full[70, 29])
    assert np.isfinite(full[289, 719]) and np.isnan(full[290, 719])

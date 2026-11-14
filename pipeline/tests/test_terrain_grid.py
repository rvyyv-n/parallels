import math

import numpy as np

from pipeline.terrain_grid import COLUMNS, block_slices, cell_metrics, edges, tile_corner, tile_name, tile_stats

PX = 240


def ramp(shape, deg):
    x = np.arange(shape[1]) * PX * math.tan(math.radians(deg))
    return np.tile(x, (shape[0], 1)) + 100.0


def test_flat_plane():
    vals, n = cell_metrics(np.full((230, 230), 500.0), PX)
    assert n == 25
    assert vals == [0.0, 1.0, 1.0, 0.0]


def test_uniform_ramp():
    vals, n = cell_metrics(ramp((230, 230), 15), PX)
    assert n == 25
    assert abs(vals[0] - 15) < 0.05
    assert vals[1] == 0 and vals[2] == 0


def test_blocks_cover_without_overlap():
    shape = (230, 197)
    hit = np.zeros(shape, int)
    for s in block_slices(shape, PX):
        hit[s] += 1
    assert (hit == 1).all()
    assert len(block_slices(shape, PX)) == 5 * 4


def test_blocks_fewer_columns_at_high_latitude():
    assert len(block_slices((230, 20), PX)) == 5
    assert len(block_slices((230, 230), PX)) == 25


def test_half_sea_uses_only_land_blocks():
    dem = np.full((100, 100), np.nan)
    dem[:, 50:] = ramp((100, 50), 10)
    vals, n = cell_metrics(dem, PX)
    assert n == 2
    assert abs(vals[0] - 10) < 0.05


def test_all_sea_has_no_blocks():
    vals, n = cell_metrics(np.full((100, 100), np.nan), PX)
    assert n == 0 and all(math.isnan(v) for v in vals)


def test_tile_name_round_trip():
    for lat, lon in [(35, -112), (-90, 45), (0, 6), (78, 15)]:
        assert tile_corner(tile_name(lat, lon)) == (lat, lon)


def test_edges_split_evenly():
    assert edges(10, 2).tolist() == [0, 5, 10]


def test_tile_stats_columns_and_cells():
    dem = np.full((1200, 1200), 300.0)
    dem[:, 600:] = np.nan
    out = tile_stats(dem, (0.0008333, 0.0008333), 0.5)
    land = out[:, COLUMNS.index("land_px")]
    assert land.tolist() == [1, 0, 1, 0]
    assert out[0, COLUMNS.index("slope_240")] == 0
    assert out[1, COLUMNS.index("n_blocks")] == 0
    assert math.isnan(out[1, COLUMNS.index("slope_200")])

import numpy as np
import pytest

from pipeline.assemble import SHAPE, agreement, build, cell_of, cluster, emit_groups, haversine_km, load_config, nearest_km, terrain_tags

CFG = load_config()


def flat(value):
    return np.full(SHAPE, value, float)


def grid(**kw):
    g = {"elev_mean": flat(500.0), "aridity": flat(1.0), "rock_volcanic": flat(0.0), "rock_evaporite": flat(0.0), "ts_annual": flat(15.0)}
    g.update(kw)
    return g


def tag_at(g, cave=None, at=(100, 100)):
    cave = np.zeros(SHAPE, bool) if cave is None else cave
    return int(terrain_tags(g, CFG, cave)[at])


def test_plain_cell_has_no_type():
    assert tag_at(grid()) == 0


def test_frozen_ground_rule():
    assert tag_at(grid(ts_annual=flat(-2.0))) == 4


def test_thresholds_are_in_percent():
    assert tag_at(grid(rock_volcanic=flat(5.0), elev_mean=flat(3000.0))) == 0


def test_volcanic_high_beats_frozen_ground():
    assert tag_at(grid(rock_volcanic=flat(80.0), elev_mean=flat(3000.0), ts_annual=flat(-2.0))) == 2


def test_salt_flat_beats_volcanic_and_basin():
    elev = flat(3000.0)
    elev[100, 100] = 2500.0
    g = grid(rock_volcanic=flat(80.0), rock_evaporite=flat(50.0), elev_mean=elev, aridity=flat(0.05))
    assert tag_at(g) == 3


def test_cave_wins_over_everything():
    cave = np.zeros(SHAPE, bool)
    cave[100, 100] = True
    assert tag_at(grid(ts_annual=flat(-5.0)), cave) == 5


def test_arid_basin_needs_to_sit_lower_than_its_surroundings():
    elev = flat(1000.0)
    elev[100, 100] = 700.0
    assert tag_at(grid(elev_mean=elev, aridity=flat(0.1))) == 1
    assert tag_at(grid(elev_mean=flat(1000.0), aridity=flat(0.1))) == 0
    assert tag_at(grid(elev_mean=elev, aridity=flat(0.5))) == 0


def test_missing_data_gives_no_type():
    assert tag_at(grid(ts_annual=flat(np.nan))) == 0


def test_emit_groups_bits_and_coverage():
    a = flat(np.nan)
    a[0, 0] = 0.1
    b = flat(np.nan)
    b[0, 0] = 0.0
    b[0, 1] = 0.0
    bits, seen = emit_groups({"emit_kaolinite": a, "emit_gypsum": b})
    assert bits[0, 0] == 1 and seen[0, 0] == 1
    assert bits[0, 1] == 0 and seen[0, 1] == 0
    assert np.isnan(bits[5, 5]) and np.isnan(seen[5, 5])


def test_cell_of_matches_grid_centres():
    assert cell_of(89.75, -179.75) == (0, 0)
    assert cell_of(-89.75, 179.75) == (359, 719)
    assert cell_of(0.1, 0.1) == (179, 360)


def test_distances():
    assert haversine_km(0, 0, 0, 1) == pytest.approx(111.19, abs=0.1)
    d = nearest_km(np.array([0.0, 10.0]), np.array([0.0, 0.0]), [{"lat": 0, "lon": 1}, {"lat": 10, "lon": 0}])
    assert d[0] == pytest.approx(111.19, abs=0.1) and d[1] == pytest.approx(0)


def test_clusters_are_repeatable_and_skip_incomplete_cells():
    rng = np.random.default_rng(0)
    cells = {k: rng.random(400) for k in CFG["clustering"]["inputs"]}
    cells["aridity"][0] = np.nan
    a, b = cluster(cells, CFG), cluster(cells, CFG)
    assert (a == b).all()
    assert a[0] == 255
    assert set(np.unique(a[1:])) <= set(range(CFG["clustering"]["k"]))


def test_agreement_table():
    rows, summary = agreement(np.array([0, 0, 0, 1, 1]), np.array([4, 4, 1, 0, 0], np.uint8), 2)
    assert rows[0] == {"cluster": 0, "cells": 3, "top_type": "Frozen ground", "share": pytest.approx(0.667, abs=1e-3)}
    assert "67%" in summary


def test_build_applies_land_rule_and_area():
    land = flat(0.0)
    land[100, 100:103] = [0.04, 0.05, 1.0]
    stages = {"climate": {"land_frac": land, "ts_annual": flat(10.0)}, "terrain": {}, "surface": {"bare_share": flat(0.5)}}
    cells, info = build(stages, {}, [], [], CFG)
    assert list(cells["col"]) == [101, 102]
    assert cells["area"][1] == pytest.approx(np.cos(np.radians(39.75)))
    assert cells["bare_share"][0] == pytest.approx(50.0)
    assert "terrain.slope_240" in info["missing"]

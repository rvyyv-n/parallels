import pytest

from pipeline.scoring import combine, earth_rank


def test_closest_place_ranks_top():
    ref = [0, 10, 20, 30, 40]
    assert earth_rank(-5, -10, ref) == 1.0


def test_furthest_place_ranks_bottom():
    assert earth_rank(100, 0, [1, 2, 3, 4]) == 0.0


def test_target_outside_earth_range_still_orders_places():
    ref = [-60, -40, -20, 0, 20]
    assert earth_rank(-50, -248, ref) > earth_rank(-10, -248, ref)


def test_ties_count_half():
    assert earth_rank(5, 0, [5, 5]) == 0.5


def test_missing_value_has_no_rank():
    assert earth_rank(None, 0, [1, 2]) is None


def test_weighted_geometric_mean():
    assert combine({"a": 0.25, "b": 1.0}, {"a": 1, "b": 1}) == pytest.approx(0.5)


def test_one_zero_cannot_wipe_out_the_score():
    assert combine({"a": 0.0, "b": 1.0}, {"a": 1, "b": 1}) == pytest.approx(0.1)


def test_missing_trait_counts_as_median():
    assert combine({"a": None, "b": 1.0, "c": 1.0, "d": 1.0}, {"a": 1, "b": 1, "c": 1, "d": 1}) == pytest.approx(0.5 ** 0.25)


def test_too_much_missing_gives_no_score():
    assert combine({"a": None, "b": 1.0}, {"a": 1, "b": 1}) is None

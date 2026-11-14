import json

import numpy as np
import pytest

from pipeline.assemble import load_config, load_points
from pipeline.export import CAVES, OUT, RANGE, SITES, decode, encode, export, load_targets, read_bin, synthetic, write_bin

S, N, I, B = "str", "num", "int", "bool"


def opt(spec):
    return ("opt", spec)


def null(spec):
    return ("null", spec)


def enum(*xs):
    return ("enum", xs)


def rec(spec):
    return ("rec", spec)


COLUMN = {"id": S, "dtype": enum("u8", "u16", "i16", "f32"), "offset": I, "scale": opt(N), "add": opt(N), "nodata": opt(N)}
BINFILE = {"file": S, "n": I, "columns": [COLUMN]}
DATASET = {"id": S, "name": S, "agency": enum("NASA", "USGS", "ESA", "partner", "other", "computed"), "url": null(S), "licence": S, "used_for": S, "archive": opt(S)}
TRAIT = {"id": S, "label": S, "unit": S, "digits": I, "plain": S, "column": rec(S), "earth_stat": S, "earth_dataset": S, "earth_resolution": S, "scored_by": opt(enum("distance", "ideal", "presence")), "note": opt(S)}
UNSCORED = {"name": S, "reason": S, "earth_text": opt(S), "target_key": opt(S)}
CHALLENGE = {"id": S, "name": S, "question": S, "only": opt(S), "what_to_test": S, "traits": [{"id": S, "weight": N, "why": S}], "labels": [UNSCORED]}
FILTER = {"id": S, "name": S, "plain": S, "weights": {"moon": rec(N), "mars": rec(N)}, "reasons": rec(S)}
TERRAIN = {"id": I, "key": enum("none", "arid_basin", "volcanic_high", "salt_flat", "frozen_ground", "cave"), "name": S, "rule": S, "cells": I}
TVALUE = {"value": null(N), "stat": S, "dataset": S, "resolution": S, "kind": enum("computed", "published", "derived"), "note": opt(S)}
TARGET = {
    "id": S, "body": enum("moon", "mars"), "name": S, "short": S, "lat": N, "lon": N, "anchor_note": S, "default": B, "bin": BINFILE,
    "values": rec(TVALUE), "shown": rec(TVALUE), "facts": [{"text": S, "source": S, "url": S}],
    "regions": opt([{"id": S, "name": S, "lat": N, "lon": N, "anchor_note": S, "values": rec(TVALUE)}]),
    "headline": opt({"cell": I, "title": S, "why": S, "what_to_test": S}),
}
CANT = {"name": S, "earth": S, "moon": S, "mars": S, "source": S, "url": S}
MANIFEST = {
    "version": enum(1), "method_version": opt(S), "method_note": opt(S), "generated": S, "sample": B,
    "grid": dict(BINFILE, res_deg=N, land_rule=S),
    "regions": [S], "datasets": [DATASET], "traits": [TRAIT],
    "challenges": {"moon": [CHALLENGE], "mars": [CHALLENGE]},
    "filters": [FILTER],
    "scoring": {"floor": N, "missing_rank": N, "min_weight_with_data": N, "rule": S, "layout": opt(S), "yearround_rule": S},
    "terrain_types": [TERRAIN],
    "clustering": {"k": I, "method": S, "inputs": [S], "agreement": [{"cluster": I, "cells": I, "top_type": S, "share": N}], "summary": S},
    "targets": [TARGET], "cant_copy": [CANT],
    "not_in_version": [{"item": S, "reason": S}],
    "benchmarks": [{"n": I, "guide_words": S, "how": S, "where": S}],
    "questions": [{"n": I, "question": S, "answer": S}],
}
LABEL = {"id": S, "name": S, "kind": enum("known_analog", "cave", "ordinary", "plain_desert"), "lat": N, "lon": N, "country": opt(S), "groups": opt([S]), "note": opt(S), "source": S, "analog_source": opt(S)}
PLACE = {"id": S, "name": S, "lat": N, "lon": N, "group": S, "challenge": opt(S), "cell": null(I), "score": null(N), "land_rank": null(N), "best_target": opt(S), "held_out": B, "blind": B, "note": opt(S)}
CHECK = {"name": S, "pass_mark": N, "result": null(N), "passed": null(B), "n_pairs": I, "held_out_only": opt(null(N)), "blind_only": opt(null(N))}
TEST = {"id": S, "title": S, "body": enum("moon", "mars"), "plain": S, "groups": [{"id": S, "name": S, "plain": S}], "places": [PLACE], "checks": [CHECK], "misses": [{"place": S, "why": S}]}
VALIDATION = {"weights_commit": S, "summary": opt(S), "not_blind_note": S, "prototype_runs": [{"date": S, "result": S}], "tests": [TEST], "second_run": opt({"title": S, "plain": S, "designed_after_first_run": enum(True), "config_commit": S, "summary": S, "tests": [TEST], "unchecked": [{"place": S, "why": S}]}), "third_run": opt({"title": S, "plain": S, "designed_after_first_run": enum(True), "config_commit": S, "summary": S, "tests": [TEST], "unchecked": [{"place": S, "why": S}], "method_change": S, "adopted": B, "adoption_rule": S}), "stability": opt(S), "data_checks": [{"name": S, "result": S, "passed": B}]}

KINDS = {
    S: lambda v: isinstance(v, str),
    N: lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    I: lambda v: isinstance(v, int) and not isinstance(v, bool),
    B: lambda v: isinstance(v, bool),
}


def conform(x, spec, path="root"):
    if isinstance(spec, tuple):
        kind, inner = spec
        if kind == "null":
            return [] if x is None else conform(x, inner, path)
        if kind == "enum":
            return [] if x in inner else [f"{path}: {x!r} not in {inner}"]
        if not isinstance(x, dict):
            return [f"{path}: not an object"]
        return [e for k, v in x.items() for e in conform(v, inner, f"{path}.{k}")]
    if isinstance(spec, list):
        if not isinstance(x, list):
            return [f"{path}: not a list"]
        return [e for i, v in enumerate(x) for e in conform(v, spec[0], f"{path}[{i}]")]
    if isinstance(spec, dict):
        if not isinstance(x, dict):
            return [f"{path}: not an object"]
        errs = [f"{path}.{k}: unexpected field" for k in x if k not in spec]
        for k, s in spec.items():
            if isinstance(s, tuple) and s[0] == "opt":
                if k in x:
                    errs += conform(x[k], s[1], f"{path}.{k}")
            elif k not in x:
                errs.append(f"{path}.{k}: missing")
            else:
                errs += conform(x[k], s, f"{path}.{k}")
        return errs
    return [] if KINDS[spec](x) else [f"{path}: {x!r} is not {spec}"]


@pytest.fixture(scope="module")
def stub(tmp_path_factory):
    out = tmp_path_factory.mktemp("data")
    stages, metas = synthetic()
    sites = json.loads(SITES.read_text(encoding="utf8"))
    targets, extra = load_targets()
    cells, scored, _ = export(stages, metas, targets, extra, sites, load_points(CAVES), load_config(), "abc123", True, out)
    load = lambda name: json.loads((out / name).read_text(encoding="utf8"))
    return out, cells, scored, load("manifest.json"), load("labels.json"), load("validation.json")


def test_manifest_matches_contract(stub):
    assert conform(stub[3], MANIFEST) == []


def test_labels_match_contract(stub):
    assert conform(stub[4], [LABEL]) == []


def test_validation_matches_contract(stub):
    v = stub[5]
    assert conform(v, VALIDATION) == []
    assert v["weights_commit"] == "abc123"
    assert "not a blind first run" in v["not_blind_note"]


def test_every_dataset_id_used_exists(stub):
    m = stub[3]
    ids = {d["id"] for d in m["datasets"]}
    used = {t["earth_dataset"] for t in m["traits"]}
    for t in m["targets"]:
        for group in [t["values"], t["shown"]] + [r["values"] for r in t.get("regions", [])]:
            used |= {v["dataset"] for v in group.values()}
    assert used - ids == set()


def test_cross_references(stub):
    m = stub[3]
    traits = {t["id"] for t in m["traits"]}
    cols = {c["id"] for c in m["grid"]["columns"]}
    for t in m["traits"]:
        assert set(t["column"].values()) <= cols
    for body, rows in m["challenges"].items():
        ch = {c["id"] for c in rows}
        assert all(tr["id"] in traits for c in rows for tr in c["traits"])
        for f in m["filters"]:
            assert set(f["weights"][body]) <= ch
    for t in m["targets"]:
        bcols = {c["id"] for c in t["bin"]["columns"]}
        assert {f"rank:{k}" for k in t["values"]} <= bcols
        assert {f"score:{f['id']}" for f in m["filters"]} | {f"score:{f['id']}:yr" for f in m["filters"]} <= bcols
    assert [b["n"] for b in m["benchmarks"]] == [1, 2, 3, 4, 5, 6]
    assert [q["n"] for q in m["questions"]] == list(range(1, 8))


def test_offsets_and_lengths(stub):
    out, _, _, m, _, _ = stub
    size = {"u8": 1, "u16": 2, "i16": 2, "f32": 4}
    for b in [m["grid"]] + [t["bin"] for t in m["targets"]]:
        end = 0
        for c in b["columns"]:
            assert c["offset"] % 4 == 0 and c["offset"] >= end
            end = c["offset"] + b["n"] * size[c["dtype"]]
        assert (out / b["file"]).stat().st_size == end
    assert (out / "cells.bin").stat().st_size < 4.5e6 * m["grid"]["n"] / 75000


def test_cells_round_trip_within_quantisation(stub):
    out, cells, _, m, _, _ = stub
    back = read_bin(out / "cells.bin", m["grid"])
    for c in m["grid"]["columns"]:
        a, b = np.asarray(cells[c["id"]], float), back[c["id"]]
        assert (np.isnan(a) == np.isnan(b)).all(), c["id"]
        ok = np.isfinite(a)
        lo, hi = RANGE[c["dtype"]][:2]
        lo, hi = (lo + (c["nodata"] == lo)) * c["scale"] + c["add"], (hi - (c["nodata"] == hi)) * c["scale"] + c["add"]
        assert np.allclose(np.clip(a[ok], lo, hi), b[ok], rtol=0, atol=c["scale"] / 2 + 1e-6), c["id"]


def test_target_round_trip(stub):
    out, _, scored, m, _, _ = stub
    t = m["targets"][0]
    back = read_bin(out / t["bin"]["file"], t["bin"])
    s = scored[t["id"]]
    for k, v in s["ranks"].items():
        assert np.allclose(np.nan_to_num(v, nan=-1), np.nan_to_num(back[f"rank:{k}"], nan=-1), atol=0.0021)
    for k, v in s["scores"].items():
        assert np.allclose(np.nan_to_num(v, nan=-1), np.nan_to_num(back[f"score:{k}"], nan=-1), atol=0.00006)


def test_encode_clips_and_marks_missing():
    raw = encode([np.nan, -5, 300, 1.26], "u8", 1, 0)
    assert list(raw) == [255, 0, 254, 1]
    col = {"dtype": "u8", "scale": 1, "add": 0, "nodata": 255}
    assert np.isnan(decode(raw, col)[0])


def test_write_bin_pads_to_four_bytes(tmp_path):
    b = write_bin(tmp_path / "x.bin", 3, [("a", [1, 2, 3], "u8", 1, 0), ("b", [1, 2, 3], "u16", 1, 0)])
    assert [c["offset"] for c in b["columns"]] == [0, 4]


@pytest.mark.parametrize("name,spec", [("manifest.json", MANIFEST), ("labels.json", [LABEL]), ("validation.json", VALIDATION)])
def test_published_files_match_contract(name, spec):
    path = OUT / name
    if not path.exists():
        pytest.skip("no exported files")
    assert conform(json.loads(path.read_text(encoding="utf8")), spec) == []


def test_stub_with_method_11_matches_contract(tmp_path):
    stages, metas = synthetic()
    sites = json.loads(SITES.read_text(encoding="utf8"))
    targets, extra = load_targets()
    export(stages, metas, targets, extra, sites, load_points(CAVES), load_config(), "abc", True, tmp_path, load_config(method="1.1"), "def")
    m = json.loads((tmp_path / "manifest.json").read_text(encoding="utf8"))
    v = json.loads((tmp_path / "validation.json").read_text(encoding="utf8"))
    assert conform(m, MANIFEST) == [] and conform(v, VALIDATION) == []
    tr = v["third_run"]
    assert tr["config_commit"] == "def" and len(tr["tests"]) == 5
    assert m["method_version"] == ("1.1" if tr["adopted"] else "1.0")
    mars = next(t for t in m["challenges"]["mars"] if t["id"] == "surface")
    ids = {t["id"] for t in mars["traits"]}
    assert ("volcanic_rock" in ids) == tr["adopted"]

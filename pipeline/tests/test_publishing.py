import json

import numpy as np
import pytest

from pipeline.assemble import ROOT, load_config, load_points, load_publishing, with_publishing
from pipeline.export import CAVES, OUT, SITES, export, load_targets, synthetic
from pipeline.publish import KEEP
from pipeline.tests.test_export import MANIFEST, VALIDATION, conform
from pipeline.traits import CHALLENGES, FILTERS

DT = {"u8": "u1", "u16": "<u2", "i16": "<i2", "f32": "<f4"}
MISSIONS = ("rover", "life_support", "habitat")


def raw(folder, binfile):
    buf = (folder / binfile["file"]).read_bytes()
    return {c["id"]: np.frombuffer(buf, DT[c["dtype"]], binfile["n"], c["offset"]) for c in binfile["columns"]}


def decoded(folder, binfile):
    cols = {c["id"]: c for c in binfile["columns"]}
    out = {}
    for k, r in raw(folder, binfile).items():
        v = r.astype(float)
        v[r == cols[k]["nodata"]] = np.nan
        out[k] = v * cols[k]["scale"] + cols[k]["add"]
    return out


def run(out, publishing):
    stages, metas = synthetic()
    sites = json.loads(SITES.read_text(encoding="utf8"))
    targets, extra = load_targets()
    methods = [("1.1", load_config(method="1.1"), "def"), ("1.2", load_config(method="1.2"), "ghi")]
    export(stages, metas, targets, extra, sites, load_points(CAVES), load_config(), "abc", True, out, methods, publishing)
    load = lambda name: json.loads((out / name).read_text(encoding="utf8"))
    return out, load("manifest.json"), load("validation.json")


@pytest.fixture(scope="module")
def pair(tmp_path_factory):
    return run(tmp_path_factory.mktemp("before"), None), run(tmp_path_factory.mktemp("after"), ("1.3", "pub"))


def test_publishing_matches_contract(pair):
    _, (_, m, v) = pair
    assert conform(m, MANIFEST) == [] and conform(v, VALIDATION) == []


def test_old_columns_runs_and_cells_are_unchanged(pair):
    (a, ma, va), (b, mb, vb) = pair
    assert (a / "cells.bin").read_bytes() == (b / "cells.bin").read_bytes()
    new = {t["id"]: t for t in mb["targets"]}
    for t in ma["targets"]:
        old_cols, new_cols = raw(a, t["bin"]), raw(b, new[t["id"]]["bin"])
        for k, col in old_cols.items():
            assert np.array_equal(col, new_cols[k]), (t["id"], k)
        assert any(k.startswith("score:rover") for k in old_cols)
    assert {k: v for k, v in vb.items() if k != "more_runs"} == {k: v for k, v in va.items() if k != "more_runs"}
    assert vb["more_runs"][: len(va["more_runs"])] == va["more_runs"]
    assert mb["method_version"] == ma["method_version"] == "1.2"
    assert mb["filters"][: len(ma["filters"])] == ma["filters"]


def test_new_moon_targets_are_listed_with_a_bin_and_a_check_note(pair):
    _, (b, m, _) = pair
    pub = json.loads((ROOT / "pipeline" / "config" / "v1.3.json").read_text(encoding="utf8"))
    ts = {t["id"]: t for t in m["targets"]}
    known = {t["id"] for t in load_targets()[0]}
    for tid in pub["targets"]:
        if tid not in known:
            continue
        t = ts[tid]
        assert t["default"] is False and (b / t["bin"]["file"]).exists()
        assert t["bin"]["file"] == f"target-{tid}.bin"
        assert t["check_note"] == "Not checked on its own; the combined south-pole target is checked."
    assert "check_note" not in ts["moon-south-pole"]


def test_balanced_preset_run_is_appended_and_not_adopted(pair):
    _, (_, _, v) = pair
    r = v["more_runs"][-1]
    assert r["preset"] == "balanced" and r["adopted"] is False and r["config_commit"] == "pub"
    assert r["designed_after_first_run"] is True
    assert "did not change" in r["method_change"] and "version 1.2" in r["method_change"]
    assert "No adoption applies" in r["adoption_rule"]


def test_balanced_weights_are_equal_over_every_challenge():
    method = load_config(method="1.2")
    pub = load_publishing("1.3", method)
    bal = pub["filter_weights"]["balanced"]
    for body, rows in CHALLENGES.items():
        assert set(bal[body]) == set(method["trait_weights"][body]) == set(next(f for f in FILTERS if f["id"] == "balanced")["challenges"][body])
        assert len({w for w, _ in bal[body].values()}) == 1
    cfg = with_publishing(load_config(method="1.2"), pub)
    for f in FILTERS:
        for body in CHALLENGES:
            w = np.array([v[0] for v in cfg["filter_weights"][f["id"]][body].values()], float)
            assert (w / w.sum()).sum() == pytest.approx(1.0)
    assert [f["id"] for f in FILTERS] == [*MISSIONS, "balanced"]


def test_publishing_config_is_not_a_method_version():
    with pytest.raises(ValueError):
        load_config(method="1.3")
    with pytest.raises(ValueError):
        load_publishing("1.3", load_config())
    with pytest.raises(ValueError):
        load_publishing("1.2", load_config(method="1.1"))


def stable_keep_checks(folder, m):
    filters = [f["id"] for f in m["filters"]]
    for t in m["targets"]:
        cols = decoded(folder, t["bin"])
        if "stable:balanced" not in cols:
            continue
        for f in filters:
            stable, keep = cols[f"stable:{f}"], cols[f"keep:{f}"]
            assert (keep[stable == 1] >= KEEP - 1e-9).all(), (t["id"], f)
            assert np.isfinite(keep).sum() == 20, (t["id"], f)
            assert np.nanmax(keep) <= 1 and np.nanmin(keep) >= 0
            assert set(np.flatnonzero(stable == 1)) <= set(np.flatnonzero(np.isfinite(keep)))


def test_stable_cells_keep_at_least_the_threshold(pair):
    _, (b, m, _) = pair
    stable_keep_checks(b, m)
    cols = {c["id"]: c for c in m["targets"][0]["bin"]["columns"]}
    assert cols["keep:rover"]["scale"] == 0.01 and cols["keep:rover"]["nodata"] == 255


published = pytest.mark.skipif(not (OUT / "manifest.json").exists(), reason="no exported files")


def published_manifest():
    return json.loads((OUT / "manifest.json").read_text(encoding="utf8"))


@published
def test_published_moon_sites_name_listed_datasets():
    m = published_manifest()
    ids = {d["id"] for d in m["datasets"]}
    new = [t for t in m["targets"] if t.get("check_note")]
    assert {t["id"] for t in new} == {"moon-malapert-massif", "moon-haworth", "moon-nobile-rim-1", "moon-de-gerlache-rim-2", "moon-shackleton-rim"}
    for t in new:
        assert (OUT / t["bin"]["file"]).exists()
        for group in (t["values"], t["shown"]):
            for k, v in group.items():
                assert v["dataset"] in ids, (t["id"], k)


@published
def test_published_stable_cells_keep_at_least_the_threshold():
    m = published_manifest()
    stable_keep_checks(OUT, m)
    assert all(f"keep:{f['id']}" in {c["id"] for c in t["bin"]["columns"]} for t in m["targets"] for f in m["filters"])

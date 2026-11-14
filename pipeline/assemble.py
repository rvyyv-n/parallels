import json
from pathlib import Path

import numpy as np
from scipy import ndimage
from scipy.cluster.vq import kmeans2

from pipeline.traits import INPUTS, MINERAL_GROUPS, TERRAIN_TYPES

ROOT = Path(__file__).resolve().parent.parent
DERIVED = ROOT / "data" / "derived"
CONFIG = ROOT / "pipeline" / "config" / "v1.json"
SHAPE = (360, 720)
RES = 0.5
PERCENT = ("safe10_240", "flat5_240", "safe10_200", "flat5_200", "bare_share", "ice_share", "veg_share", "rock_plutonic", "rock_volcanic", "rock_evaporite")


def load_config(path=CONFIG, method=None):
    cfg = json.loads(Path(path).read_text(encoding="utf8"))
    if method is None:
        return cfg
    over = json.loads((Path(path).parent / f"v{method}.json").read_text(encoding="utf8"))
    for body, chs in over["trait_weights"].items():
        cfg["trait_weights"][body].update(chs)
    for k in ("version", "why", "rule", "parts", "adoption_rule", "plan_notes"):
        if k in over:
            cfg[k] = over[k]
    return cfg


def load_stage(name, root=DERIVED):
    arrays = dict(np.load(root / f"{name}.npz"))
    meta = json.loads((root / f"{name}.json").read_text(encoding="utf8"))
    return arrays, meta


def load_points(path):
    path = Path(path)
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf8"))
    return data if isinstance(data, list) else data.get("caves", data.get("points", []))


def grid_lat():
    return 89.75 - RES * np.arange(SHAPE[0])


def grid_lon():
    return -179.75 + RES * np.arange(SHAPE[1])


def cell_of(lat, lon):
    row = int(np.clip(np.floor((90 - lat) / RES), 0, SHAPE[0] - 1))
    col = int(np.clip(np.floor((lon + 180) / RES), 0, SHAPE[1] - 1))
    return row, col


def emit_groups(surface):
    keys = [k for k in surface if k.startswith("emit_") and not k.endswith("_unc")]
    bits = np.zeros(SHAPE)
    any_data = np.zeros(SHAPE, bool)
    for i, minerals in enumerate(MINERAL_GROUPS.values()):
        cols = [surface[k] for k in keys if any(m in k for m in minerals)]
        if not cols:
            continue
        stack = np.stack([np.asarray(c, float) for c in cols])
        has = np.isfinite(stack).any(axis=0)
        present = (np.nan_to_num(stack, nan=0.0) > 0).any(axis=0)
        any_data |= has
        bits += present * (1 << i)
    seen = np.where(any_data, sum(((bits.astype(int) >> i) & 1) for i in range(len(MINERAL_GROUPS))), np.nan)
    return np.where(any_data, bits, np.nan), seen


def neighbourhood_mean(z, ok, half):
    size = 2 * half + 1
    modes = ("nearest", "wrap")
    num = ndimage.uniform_filter(np.where(ok, z, 0.0), size=size, mode=modes)
    den = ndimage.uniform_filter(ok.astype(float), size=size, mode=modes)
    with np.errstate(invalid="ignore", divide="ignore"):
        return num / den


def terrain_tags(g, cfg, cave):
    t = cfg["terrain"]
    elev = g["elev_mean"]
    ok = np.isfinite(elev)
    around = neighbourhood_mean(elev, ok, int(round(t["arid_basin"]["window_deg"] / RES)))
    with np.errstate(invalid="ignore"):
        rules = {
            "cave": cave,
            "salt_flat": (g["rock_evaporite"] >= t["salt_flat"]["min_evaporite_pct"]) & (g["aridity"] < t["salt_flat"]["max_aridity"]),
            "volcanic_high": (g["rock_volcanic"] >= t["volcanic_high"]["min_volcanic_pct"]) & (elev > t["volcanic_high"]["min_elev_m"]),
            "arid_basin": (g["aridity"] < t["arid_basin"]["max_aridity"]) & (elev <= around - t["arid_basin"]["min_drop_m"]),
            "frozen_ground": g["ts_annual"] < t["frozen_ground"]["max_annual_ground_c"],
        }
    ids = {key: i for i, key, _ in TERRAIN_TYPES}
    out = np.zeros(np.shape(elev), np.uint8)
    for key in reversed(t["order"]):
        out[rules[key]] = ids[key]
    return out


def terrain_rules(cfg):
    t = cfg["terrain"]
    return {
        "none": "Meets none of the rules below.",
        "arid_basin": f"Aridity index below {t['arid_basin']['max_aridity']} and at least {t['arid_basin']['min_drop_m']} m lower than the average land within {t['arid_basin']['window_deg']:g}° around it.",
        "volcanic_high": f"Volcanic rock is the cell's main rock on the GLiM rock map (the half-degree map gives one main rock per cell, so \"at least {t['volcanic_high']['min_volcanic_pct']}%\" is read as \"main rock\") and average height above {t['volcanic_high']['min_elev_m']:,} m.",
        "salt_flat": f"Evaporite (salt) rock is the cell's main rock on the GLiM rock map (the half-degree map gives one main rock per cell, so \"at least {t['salt_flat']['min_evaporite_pct']}%\" is read as \"main rock\") and aridity index below {t['salt_flat']['max_aridity']}.",
        "frozen_ground": f"Yearly average ground temperature below {t['frozen_ground']['max_annual_ground_c']:g} °C (NASA POWER).",
        "cave": "A known cave or lava tube from our list lies in the cell. Caves can't be seen from orbit, so this is a list, not a map.",
    }


def cluster(cells, cfg):
    c = cfg["clustering"]
    cols = []
    for k in c["inputs"]:
        v = np.asarray(cells[k], float)
        if k in c["log_inputs"]:
            v = np.log10(np.maximum(v, 0) + 0.01)
        cols.append(v)
    x = np.stack(cols, axis=1)
    ok = np.isfinite(x).all(axis=1)
    labels = np.full(len(x), 255, np.uint8)
    if ok.sum() < c["k"]:
        return labels
    z = x[ok]
    z = (z - z.mean(axis=0)) / np.where(z.std(axis=0) > 0, z.std(axis=0), 1)
    _, lab = kmeans2(z, c["k"], minit="++", seed=c["seed"])
    labels[ok] = lab
    return labels


def agreement(labels, tags, k):
    names = {i: name for i, _, name in TERRAIN_TYPES}
    rows = []
    hit = tagged = 0
    for c in range(k):
        m = labels == c
        if not m.any():
            continue
        counts = np.bincount(tags[m], minlength=len(names))
        top = int(counts.argmax())
        rows.append({"cluster": c, "cells": int(m.sum()), "top_type": names[top], "share": round(float(counts[top] / m.sum()), 3)})
        typed = counts.copy()
        typed[0] = 0
        if typed.sum():
            tagged += int(typed.sum())
            hit += int(typed.max())
    share = hit / tagged if tagged else 0.0
    summary = (
        f"The clusters were made from the trait values alone, without the terrain rules. "
        f"{round(share * 100)}% of cells with a terrain type sit in a cluster where their type is the most common one."
    )
    return rows, summary


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2 - lon1)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * 6371.0 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def nearest_km(lat, lon, points):
    if not points:
        return np.full(len(lat), np.nan)
    plat = np.array([p["lat"] for p in points])
    plon = np.array([p["lon"] for p in points])
    return haversine_km(lat[:, None], lon[:, None], plat[None, :], plon[None, :]).min(axis=1)


def known_analogs(sites):
    return [s for s in sites if s.get("blind") or not set(s["groups"]) <= {"ordinary", "desert"}]


def earth_caves(caves):
    return [c for c in caves if c.get("body", "earth") == "earth"]


def build(stages, metas, sites, caves, cfg):
    grid, missing = {}, []
    for name, (stage, key) in INPUTS.items():
        a = stages.get(stage, {}).get(key)
        if a is None:
            missing.append(f"{stage}.{key}")
            grid[name] = np.full(SHAPE, np.nan)
            continue
        a = np.asarray(a, float)
        unit = metas.get(stage, {}).get("columns", {}).get(key, {}).get("unit", "")
        grid[name] = a * 100 if name in PERCENT and unit != "%" else a
    grid["mineral_groups"], grid["minerals_seen"] = emit_groups(stages.get("surface", {}))
    lat2 = np.repeat(grid_lat()[:, None], SHAPE[1], axis=1)
    lon2 = np.repeat(grid_lon()[None, :], SHAPE[0], axis=0)
    land = np.nan_to_num(grid["land_frac"]) >= cfg["land_rule"]["min_land_frac"]
    cave = np.zeros(SHAPE, bool)
    for c in earth_caves(caves):
        cave[cell_of(c["lat"], c["lon"])] = True
    tags = terrain_tags(grid, cfg, cave & land)
    rows, cols = np.nonzero(land)
    cells = {k: v[rows, cols] for k, v in grid.items()}
    cells["row"], cells["col"] = rows, cols
    cells["lat"], cells["lon"] = lat2[rows, cols], lon2[rows, cols]
    cells["area"] = np.cos(np.radians(cells["lat"])) * cells["land_frac"]
    cells["terrain_type"] = tags[rows, cols]
    cells["ice"] = cells["ice_share"]
    cells["cluster"] = cluster(cells, cfg)
    cells["nearest_analog_km"] = nearest_km(cells["lat"], cells["lon"], known_analogs(sites))
    rows_, summary = agreement(cells["cluster"], cells["terrain_type"], cfg["clustering"]["k"])
    info = {"missing": missing, "agreement": rows_, "summary": summary}
    return cells, info


def index_of(cells):
    idx = np.full(SHAPE, -1, np.int64)
    idx[cells["row"], cells["col"]] = np.arange(len(cells["row"]))
    return idx

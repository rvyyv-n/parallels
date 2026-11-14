import argparse
import json
import math
import re
import time
import warnings
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.enums import Resampling
from scipy import ndimage

from pipeline.terrain import WINDOW_M, resample, terrain_metrics

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "glo90"
DERIVED = ROOT / "data" / "derived"
BUCKET = "https://copernicus-dem-90m.s3.amazonaws.com"
GDAL_ENV = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif"}
M_PER_DEG_LAT = 110_574
M_PER_DEG_LON = 111_320
SCALES = (240, 200)
KEYS = ("slope_median_deg", "share_under_10", "share_under_5", "relief_m")
NAMES = ("slope", "safe10", "flat5", "relief")
COLUMNS = [f"{n}_{px}" for px in SCALES for n in NAMES] + ["elev_mean", "elev_min", "n_blocks", "land_px"]
MIN_PX = 5
MIN_VALID = 0.5
TRIES = 3

UNITS = {"slope": "deg", "safe10": "share 0-1", "flat5": "share 0-1", "relief": "m"}
STATS = {
    "slope": "median over the cell's ~10 km blocks of the block median slope",
    "safe10": "median over the cell's ~10 km blocks of the share of ground under 10 degrees",
    "flat5": "median over the cell's ~10 km blocks of the share of ground under 5 degrees",
    "relief": "median over the cell's ~10 km blocks of the block relief (95th minus 5th height percentile)",
}


def tile_name(lat, lon):
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"Copernicus_DSM_COG_30_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def tile_corner(name):
    m = re.search(r"_([NS])(\d+)_00_([EW])(\d+)_00_DEM", name)
    lat, lon = int(m[2]), int(m[4])
    return -lat if m[1] == "S" else lat, -lon if m[3] == "W" else lon


def pixel_m(res, lat):
    return res[0] * M_PER_DEG_LON * math.cos(math.radians(lat)), res[1] * M_PER_DEG_LAT


def edges(n, k):
    return np.round(np.linspace(0, n, k + 1)).astype(int)


def block_slices(shape, px):
    rows = edges(shape[0], max(1, int(shape[0] * px // WINDOW_M)))
    cols = edges(shape[1], max(1, int(shape[1] * px // WINDOW_M)))
    return [
        (slice(rows[a], rows[a + 1]), slice(cols[b], cols[b + 1]))
        for a in range(len(rows) - 1)
        for b in range(len(cols) - 1)
    ]


def block_metrics(block, px):
    if min(block.shape) < MIN_PX or np.isfinite(block).mean() < MIN_VALID:
        return None
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            m = terrain_metrics(block, px)
    except (ValueError, IndexError):
        return None
    v = [m[k] for k in KEYS]
    return v if all(math.isfinite(x) for x in v) else None


def cell_metrics(dem, px):
    found = [v for v in (block_metrics(dem[s], px) for s in block_slices(dem.shape, px)) if v]
    if not found:
        return [np.nan] * 4, 0
    return np.median(found, axis=0).tolist(), len(found)


def resample_masked(dem, dx, dy, px):
    gap = np.isnan(dem)
    if not gap.any():
        return resample(dem, dx, dy, px)
    nearest = ndimage.distance_transform_edt(gap, return_distances=False, return_indices=True)
    out = resample(dem[tuple(nearest)], dx, dy, px)
    out[resample(gap.astype(float), dx, dy, px) > 0.5] = np.nan
    return out


def tile_stats(dem, res, lat):
    out = np.full((4, len(COLUMNS)), np.nan, dtype=np.float32)
    out[:, COLUMNS.index("n_blocks")] = 0
    out[:, COLUMNS.index("land_px")] = 0
    if not np.isfinite(dem).any():
        return out
    dx, dy = pixel_m(res, lat)
    scaled = {px: resample_masked(dem, dx, dy, px) for px in SCALES}
    nr, nc = edges(dem.shape[0], 2), edges(dem.shape[1], 2)
    sr = {px: (edges(a.shape[0], 2), edges(a.shape[1], 2)) for px, a in scaled.items()}
    for k in range(4):
        r, c = divmod(k, 2)
        cell = dem[nr[r] : nr[r + 1], nc[c] : nc[c + 1]]
        land = cell[np.isfinite(cell)]
        out[k, COLUMNS.index("land_px")] = land.size / cell.size
        if not land.size:
            continue
        out[k, COLUMNS.index("elev_mean")] = land.mean()
        out[k, COLUMNS.index("elev_min")] = land.min()
        for i, px in enumerate(SCALES):
            rows, cols = sr[px]
            vals, n = cell_metrics(scaled[px][rows[r] : rows[r + 1], cols[c] : cols[c + 1]], px)
            out[k, i * 4 : i * 4 + 4] = vals
            if px == SCALES[0]:
                out[k, COLUMNS.index("n_blocks")] = n
    return out


def read_tile(name, factor):
    with rasterio.Env(**GDAL_ENV), rasterio.open(f"/vsicurl/{BUCKET}/{name}/{name}.tif") as d:
        shape = (d.height // factor, d.width // factor)
        a = d.read(1, out_shape=shape, resampling=Resampling.average if factor > 1 else Resampling.nearest)
        res = (d.res[0] * d.width / shape[1], d.res[1] * d.height / shape[0])
    a = a.astype(np.float64)
    a[a == 0] = np.nan
    return a, res


def do_tile(name, factor, folder):
    path = folder / f"{name}.npz"
    if path.exists():
        return name, True
    lat, _ = tile_corner(name)
    for attempt in range(TRIES):
        try:
            dem, res = read_tile(name, factor)
            np.savez_compressed(path, vals=tile_stats(dem, res, lat + 0.5))
            return name, True
        except Exception:
            time.sleep(2**attempt)
    return name, False


def do_chunk(args):
    names, factor, folder, threads = args
    with ThreadPoolExecutor(threads) as pool:
        return list(pool.map(lambda n: do_tile(n, factor, folder), names))


def tile_list():
    path = RAW / "tileList.txt"
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        r = requests.get(f"{BUCKET}/tileList.txt", timeout=60)
        r.raise_for_status()
        path.write_text(r.text)
    return sorted(
        line.split("/")[0].strip() for line in path.read_text().split() if line.strip().endswith(".tif") or "/" not in line
    )


def run(names, factor, folder, procs, threads, every=500):
    folder.mkdir(parents=True, exist_ok=True)
    todo = [n for n in names if not (folder / f"{n}.npz").exists()]
    chunks = [(todo[i : i + threads * 2], factor, folder, threads) for i in range(0, len(todo), threads * 2)]
    failed, done, start = [], 0, time.time()
    with ProcessPoolExecutor(procs) as pool:
        for result in pool.map(do_chunk, chunks):
            for name, ok in result:
                done += 1
                if not ok:
                    failed.append(name)
                if done % every == 0:
                    print(f"{done}/{len(todo)} tiles, {len(failed)} failed, {time.time() - start:.0f} s", flush=True)
    (folder / "failed.txt").write_text("\n".join(failed))
    print(f"{done} tiles processed, {len(failed)} failed, {time.time() - start:.0f} s", flush=True)
    return failed


def bench(names, procs, threads):
    pick = names[:: max(1, len(names) // 40)][:40]
    for factor in (1, 2):
        folder = RAW / f"bench_f{factor}"
        start = time.time()
        run(pick, factor, folder, procs, threads)
        took = time.time() - start
        print(f"factor {factor}: {took:.1f} s for {len(pick)} tiles, projected {took / len(pick) * len(names) / 60:.0f} min for {len(names)}")


def assemble(names, factor, folder):
    grid = {c: np.full((360, 720), np.nan, dtype=np.float32) for c in COLUMNS}
    for c in ("n_blocks", "land_px"):
        grid[c][:] = 0
    for name in names:
        path = folder / f"{name}.npz"
        if not path.exists():
            continue
        lat, lon = tile_corner(name)
        i0, j0 = round((90 - (lat + 1)) / 0.5), round((lon + 180) / 0.5)
        vals = np.load(path)["vals"]
        for k in range(4):
            r, c = divmod(k, 2)
            for col, idx in zip(COLUMNS, range(len(COLUMNS))):
                grid[col][i0 + r, j0 + c] = vals[k, idx]
    return grid


def meta(factor):
    px_m = round(90 * factor)
    res = f"Copernicus DEM GLO-90 read at {px_m} m pixels" + (
        " (full resolution)" if factor == 1 else f" (overview factor {factor}, averaged)"
    )
    cols = {}
    for scale in SCALES:
        for n in NAMES:
            cols[f"{n}_{scale}"] = {
                "unit": UNITS[n],
                "stat": f"{STATS[n]}, with slopes at {scale} m (np.gradient on a {scale} m resample)",
                "dataset": "glo90",
                "resolution": res + f"; smoothed and resampled to {scale} m, blocks about 10 km",
                "note": "blocks need at least 50% valid land pixels; NaN where no block qualifies",
            }
    cols["elev_mean"] = {"unit": "m", "stat": "mean height over land pixels in the cell", "dataset": "glo90", "resolution": res, "note": "sea (height exactly 0) excluded"}
    cols["elev_min"] = {"unit": "m", "stat": "lowest height over land pixels in the cell", "dataset": "glo90", "resolution": res, "note": "sea (height exactly 0) excluded"}
    cols["n_blocks"] = {"unit": "count", "stat": "number of valid ~10 km blocks used at the 240 m scale", "dataset": "glo90", "resolution": res, "note": "0 where no block qualifies"}
    cols["land_px"] = {"unit": "share 0-1", "stat": "share of the cell's pixels that are land", "dataset": "glo90", "resolution": res, "note": "sea and no-data are pixels at exactly 0 m"}
    return {
        "columns": cols,
        "datasets": [
            {
                "id": "glo90",
                "name": "Copernicus DEM GLO-90 (on AWS Open Data)",
                "agency": "ESA",
                "url": "https://copernicus-dem-90m.s3.amazonaws.com/",
                "licence": "Copernicus DEM licence: free for any use with attribution",
                "used_for": "Earth terrain statistics per 0.5 degree cell, comparable with Moon and Mars target windows",
                "archive": "Copernicus Data Space / AWS Open Data",
            }
        ],
        "method": {
            "factor": factor,
            "pixel_m": px_m,
            "blocks": "cells split into blocks of about 10 km (5 x 5 at the equator, fewer columns at high latitude); the cell value is the median over blocks with at least 50% valid land pixels",
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int)
    ap.add_argument("--factor", type=int, default=1)
    ap.add_argument("--procs", type=int, default=8)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--bench", action="store_true")
    a = ap.parse_args()
    names = tile_list()
    if a.bench:
        return bench(names, a.procs, a.threads)
    if a.limit:
        names = names[:: max(1, len(names) // a.limit)][: a.limit]
    folder = RAW / "results" / f"f{a.factor}"
    failed = run(names, a.factor, folder, a.procs, a.threads)
    if a.limit:
        return
    grid = assemble(names, a.factor, folder)
    DERIVED.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(DERIVED / "terrain.npz", **grid)
    doc = meta(a.factor)
    doc["method"]["failed_tiles"] = failed
    (DERIVED / "terrain.json").write_text(json.dumps(doc, indent=1))
    print(f"cells with data: {int((grid['n_blocks'] > 0).sum())}, failed tiles: {len(failed)}")


if __name__ == "__main__":
    main()

import datetime
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.merge import merge
from scipy import ndimage

from pipeline.terrain import WINDOW_M, resample, terrain_metrics

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
POWER_DIR = RAW / "power"
DEM_DIR = RAW / "dem"
DERIVED = Path(__file__).resolve().parent / "derived"

POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
POWER_PARAMS = "T2M,T2M_MIN,T2M_MAX,T2M_RANGE,PRECTOTCORR,RH2M,WS10M,ALLSKY_SFC_SW_DWN"
DEM_BUCKET = "https://copernicus-dem-90m.s3.amazonaws.com"
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
M_PER_DEG_LAT = 110_574
M_PER_DEG_LON = 111_320
SEED = 20261114
REFERENCE_SIZE = 300
WORKERS = 4
GDAL_ENV = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif"}

SOURCES = {
    "climate": {
        "name": "NASA POWER climatology (MERRA-2 and CERES SYN1deg), 2001-2025",
        "url": "https://power.larc.nasa.gov/api/temporal/climatology/point",
    },
    "terrain": {
        "name": "Copernicus DEM GLO-90 (ESA, on AWS Open Data)",
        "url": "https://copernicus-dem-90m.s3.amazonaws.com/",
    },
    "sun": {"name": "Computed from latitude (solar declination model)", "url": None},
}


def declination(day):
    return 23.44 * np.sin(2 * np.pi * (day - 80) / 365)


def noon_sun_deg(lat):
    d = declination(np.arange(1, 366))
    return round(float(np.mean(np.clip(90 - np.abs(lat - d), 0, None))), 2)


def lit_share(lat):
    d = np.radians(declination(np.arange(1, 366)))
    phi = math.radians(lat)
    cos_h = np.clip(-math.tan(phi) * np.tan(d), -1, 1)
    return round(float(np.mean(np.arccos(cos_h) / np.pi)), 3)


def window_bounds(lat, lon, size_m=WINDOW_M):
    half_lat = size_m / 2 / M_PER_DEG_LAT
    half_lon = min(180.0, size_m / 2 / (M_PER_DEG_LON * max(math.cos(math.radians(lat)), 1e-6)))
    return (
        max(-180.0, lon - half_lon),
        max(-90.0, lat - half_lat),
        min(180.0, lon + half_lon),
        min(90.0, lat + half_lat),
    )


def tile_name(lat, lon):
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"Copernicus_DSM_COG_30_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"


def tiles_for(bounds):
    left, bottom, right, top = bounds
    lats = range(math.floor(bottom), min(math.floor(top), 89) + 1)
    lons = range(math.floor(left), min(math.floor(right), 179) + 1)
    return [tile_name(a, o) for a in lats for o in lons]


def metric_pixel(res_deg, lat):
    return (
        res_deg[0] * M_PER_DEG_LON * math.cos(math.radians(lat)),
        res_deg[1] * M_PER_DEG_LAT,
    )


def parse_power(doc):
    p = doc["properties"]["parameter"]

    def ann(key):
        v = p.get(key, {}).get("ANN")
        return None if v is None or v <= -999 else v

    t_min, t_max = ann("T2M_MIN"), ann("T2M_MAX")
    monthly = [p.get("T2M", {}).get(m) for m in MONTHS]
    frozen = None if any(v is None or v <= -999 for v in monthly) else sum(v < 0 for v in monthly)
    return {
        "t_min_c": t_min,
        "t_max_c": t_max,
        "daily_range_c": ann("T2M_RANGE"),
        "seasonal_swing_c": None if t_min is None or t_max is None else round(t_max - t_min, 2),
        "frozen_months": frozen,
        "precip_mm_day": ann("PRECTOTCORR"),
        "rh_pct": ann("RH2M"),
        "wind_ms": ann("WS10M"),
        "sun_kwh_m2_day": ann("ALLSKY_SFC_SW_DWN"),
    }


def fetch_power(lat, lon, use_cache=True):
    path = POWER_DIR / f"{lat:.4f}_{lon:.4f}.json"
    if use_cache and path.exists():
        return json.loads(path.read_text())
    params = {
        "parameters": POWER_PARAMS,
        "community": "RE",
        "longitude": round(lon, 4),
        "latitude": round(lat, 4),
        "format": "JSON",
    }
    for attempt in range(5):
        try:
            r = requests.get(POWER_URL, params=params, timeout=90)
            if r.status_code == 200:
                doc = r.json()
                if use_cache:
                    POWER_DIR.mkdir(parents=True, exist_ok=True)
                    path.write_text(json.dumps(doc))
                return doc
        except (requests.RequestException, ValueError):
            pass
        time.sleep(2 ** attempt)
    return None


def climate(lat, lon):
    doc = fetch_power(lat, lon)
    if doc is None:
        return dict.fromkeys(parse_power({"properties": {"parameter": {}}}))
    return parse_power(doc)


def load_tile_list():
    path = DEM_DIR / "tileList.txt"
    if not path.exists():
        DEM_DIR.mkdir(parents=True, exist_ok=True)
        r = requests.get(f"{DEM_BUCKET}/tileList.txt", timeout=60)
        r.raise_for_status()
        path.write_text(r.text)
    return set(path.read_text().split())


def read_window(lat, lon, tiles):
    path = DEM_DIR / f"{lat:.4f}_{lon:.4f}.npz"
    if path.exists():
        z = np.load(path)
        return z["dem"], tuple(z["res"])
    bounds = window_bounds(lat, lon)
    names = [t for t in tiles_for(bounds) if t in tiles]
    if not names:
        return None, None
    urls = [f"/vsicurl/{DEM_BUCKET}/{n}/{n}.tif" for n in names]
    centre = tile_name(math.floor(lat), math.floor(lon))
    for attempt in range(4):
        try:
            with rasterio.Env(**GDAL_ENV):
                with rasterio.open(urls[names.index(centre)] if centre in names else urls[0]) as d:
                    res = d.res
                data, _ = merge(urls, bounds=bounds, res=res, nodata=np.nan, dtype="float32", indexes=[1])
            dem = data[0].astype(float)
            dem[dem == 0] = np.nan
            DEM_DIR.mkdir(parents=True, exist_ok=True)
            np.savez_compressed(path, dem=dem, res=np.array(res))
            return dem, res
        except Exception:
            time.sleep(2 ** attempt)
    return None, None


def is_land(dem):
    if dem is None:
        return False
    r, c = dem.shape
    return bool(np.isfinite(dem[r // 2, c // 2]))


def resample_masked(dem, dx, dy, px):
    gap = np.isnan(dem)
    if not gap.any():
        return resample(dem, dx, dy, px)
    nearest = ndimage.distance_transform_edt(gap, return_distances=False, return_indices=True)
    out = resample(dem[tuple(nearest)], dx, dy, px)
    out[resample(gap.astype(float), dx, dy, px) > 0.5] = np.nan
    return out


def terrain(lat, lon, dem, res):
    if dem is None or not np.isfinite(dem).any():
        return {"elevation_m": None, "terrain_240": None, "terrain_200": None}
    dx, dy = metric_pixel(res, lat)
    out = {"elevation_m": round(float(np.nanmedian(dem)), 1)}
    for px in (240, 200):
        try:
            m = terrain_metrics(resample_masked(dem, dx, dy, px), px)
        except (ValueError, IndexError):
            m = None
        out[f"terrain_{px}"] = m if m and all(math.isfinite(v) for v in m.values()) else None
    return out


def values(lat, lon, tiles, window=None):
    dem, res = window if window else read_window(lat, lon, tiles)
    return {
        **climate(lat, lon),
        "noon_sun_deg": noon_sun_deg(lat),
        "lit_share": lit_share(lat),
        **terrain(lat, lon, dem, res),
    }


def random_points(rng, n):
    lat = np.degrees(np.arcsin(rng.uniform(-1, 1, n)))
    lon = rng.uniform(-180, 180, n)
    return [(round(float(a), 4), round(float(o), 4)) for a, o in zip(lat, lon)]


def reference_points(tiles, pool):
    rng = np.random.default_rng(SEED)
    land = []
    while len(land) < REFERENCE_SIZE:
        batch = random_points(rng, 200)
        maybe = [p for p in batch if tile_name(math.floor(p[0]), math.floor(p[1])) in tiles]
        windows = pool.map(lambda p: read_window(*p, tiles), maybe)
        land += [(p, w) for p, w in zip(maybe, windows) if is_land(w[0])]
    return land[:REFERENCE_SIZE]


def write(name, key, rows):
    DERIVED.mkdir(exist_ok=True)
    doc = {"generated": datetime.date.today().isoformat(), "sources": SOURCES, key: rows}
    (DERIVED / name).write_text(json.dumps(doc, indent=1))


def main():
    start = time.time()
    tiles = load_tile_list()
    sites = json.loads((Path(__file__).resolve().parent / "sites.json").read_text())
    with ThreadPoolExecutor(WORKERS) as pool:
        site_values = list(pool.map(lambda s: values(s["lat"], s["lon"], tiles), sites))
        write("earth_sites.json", "sites", [{"id": s["id"], "values": v} for s, v in zip(sites, site_values)])
        land = reference_points(tiles, pool)
        ref_values = list(pool.map(lambda pw: values(*pw[0], tiles, pw[1]), land))
        write(
            "earth_reference.json",
            "points",
            [{"lat": p[0], "lon": p[1], "values": v} for (p, _), v in zip(land, ref_values)],
        )
    print(f"{len(sites)} sites, {len(land)} reference points, {time.time() - start:.0f} s")


if __name__ == "__main__":
    main()

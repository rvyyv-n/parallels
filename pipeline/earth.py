import datetime
import json
import math
import re
import time
import warnings
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.errors import NotGeoreferencedWarning, RasterioError
from rasterio.io import MemoryFile
from rasterio.merge import merge
from scipy import ndimage

from pipeline.terrain import WINDOW_M, resample, terrain_metrics

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
POWER_DIR = RAW / "power"
SURFACE_DIR = RAW / "power_surface"
GIBS_DIR = RAW / "gibs"
DEM_DIR = RAW / "dem"
DERIVED = Path(__file__).resolve().parent / "derived"

POWER_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
POWER_PARAMS = "T2M,T2M_MIN,T2M_MAX,T2M_RANGE,PRECTOTCORR,RH2M,WS10M,ALLSKY_SFC_SW_DWN"
SURFACE_PARAMS = "TS,TS_MIN,TS_MAX,TS_RANGE,GWETTOP,AOD_55"
GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
COLORMAPS = "https://gibs.earthdata.nasa.gov/colormaps/v1.3"
LAND_COVER = {
    "layer": "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual",
    "colormap": "MODIS_IGBP_Land_Cover_Type",
    "res": 0.00439453125,
}
NDVI = {"layer": "MODIS_Terra_L3_NDVI_Monthly", "colormap": "MODIS_L3_NDVI", "res": 0.0087890625}
WATER, UNCLASSIFIED, ICE, BARREN = (0, 17), 255, 15, 16
MAX_PX = 1024
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
    "land_cover": {
        "name": "NASA MODIS land cover type (MCD12Q1, IGBP classes), via NASA GIBS",
        "url": f"{GIBS_WMS}?layer={LAND_COVER['layer']}",
        "colormap": f"{COLORMAPS}/{LAND_COVER['colormap']}.xml",
    },
    "vegetation": {
        "name": "NASA MODIS Terra monthly vegetation index (NDVI), via NASA GIBS",
        "url": f"{GIBS_WMS}?layer={NDVI['layer']}",
        "colormap": f"{COLORMAPS}/{NDVI['colormap']}.xml",
    },
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


def annual(p, key):
    v = p.get(key, {}).get("ANN")
    return None if v is None or v <= -999 else v


def months_below_zero(p, key):
    monthly = [p.get(key, {}).get(m) for m in MONTHS]
    return None if any(v is None or v <= -999 for v in monthly) else sum(v < 0 for v in monthly)


def parse_power(doc):
    p = doc["properties"]["parameter"]
    t_min, t_max = annual(p, "T2M_MIN"), annual(p, "T2M_MAX")
    return {
        "t_min_c": t_min,
        "t_max_c": t_max,
        "daily_range_c": annual(p, "T2M_RANGE"),
        "seasonal_swing_c": None if t_min is None or t_max is None else round(t_max - t_min, 2),
        "frozen_months": months_below_zero(p, "T2M"),
        "precip_mm_day": annual(p, "PRECTOTCORR"),
        "rh_pct": annual(p, "RH2M"),
        "wind_ms": annual(p, "WS10M"),
        "sun_kwh_m2_day": annual(p, "ALLSKY_SFC_SW_DWN"),
    }


def parse_surface(doc):
    p = doc["properties"]["parameter"]
    ts_min, ts_max = annual(p, "TS_MIN"), annual(p, "TS_MAX")
    return {
        "ts_min_c": ts_min,
        "ts_max_c": ts_max,
        "ts_seasonal_swing_c": None if ts_min is None or ts_max is None else round(ts_max - ts_min, 2),
        "ts_daily_range_c": annual(p, "TS_RANGE"),
        "frozen_months_surface": months_below_zero(p, "TS"),
        "soil_wetness": annual(p, "GWETTOP"),
        "aod_550": annual(p, "AOD_55"),
    }


def get(url, params=None, timeout=90):
    for attempt in range(5):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r
        except requests.RequestException:
            pass
        time.sleep(2 ** attempt)
    return None


def fetch_power(lat, lon, use_cache=True, parameters=POWER_PARAMS, community="RE", folder=POWER_DIR):
    path = folder / f"{lat:.4f}_{lon:.4f}.json"
    if use_cache and path.exists():
        return json.loads(path.read_text())
    params = {
        "parameters": parameters,
        "community": community,
        "longitude": round(lon, 4),
        "latitude": round(lat, 4),
        "format": "JSON",
    }
    r = get(POWER_URL, params)
    try:
        doc = r.json() if r else None
    except ValueError:
        doc = None
    if doc and use_cache:
        folder.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc))
    return doc


def fetch_surface(lat, lon, use_cache=True):
    return fetch_power(lat, lon, use_cache, SURFACE_PARAMS, "AG", SURFACE_DIR)


def climate(lat, lon):
    empty = {"properties": {"parameter": {}}}
    return {**parse_power(fetch_power(lat, lon) or empty), **parse_surface(fetch_surface(lat, lon) or empty)}


def cached(path, url, params=None):
    if path.exists():
        return path.read_bytes()
    r = get(url, params)
    if r is None:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(r.content)
    return r.content


def parse_times(text):
    out = []
    for part in text.strip().split(","):
        bits = part.split("/")
        day = datetime.date.fromisoformat(bits[0][:10])
        if len(bits) == 1:
            out.append(day)
            continue
        end = datetime.date.fromisoformat(bits[1][:10])
        n, unit = re.fullmatch(r"P(\d+)([YMD])", bits[2]).groups()
        while day <= end:
            out.append(day)
            if unit == "D":
                day += datetime.timedelta(days=int(n))
            else:
                months = day.month - 1 + int(n) * (12 if unit == "Y" else 1)
                day = day.replace(year=day.year + months // 12, month=months % 12 + 1)
    return out


def layer_times(capabilities, layer):
    for el in ET.fromstring(capabilities).iter():
        if el.tag.endswith("Layer") and any(c.tag.endswith("Name") and c.text == layer for c in el):
            dim = next(c for c in el if c.tag.endswith("Dimension") and c.get("name") == "time")
            return parse_times(dim.text)
    raise KeyError(layer)


def latest_times(land_times, ndvi_times):
    have = set(ndvi_times)
    year = max(
        d.year
        for d in have
        if {datetime.date(d.year, 1, 1), datetime.date(d.year, 7, 1), datetime.date(d.year, 12, 1)} <= have
    )
    return max(land_times).isoformat(), (f"{year}-01-01", f"{year}-07-01")


def gibs_times():
    caps = cached(
        GIBS_DIR / "wms_capabilities.xml",
        GIBS_WMS,
        {"SERVICE": "WMS", "REQUEST": "GetCapabilities", "VERSION": "1.3.0"},
    )
    return latest_times(layer_times(caps, LAND_COVER["layer"]), layer_times(caps, NDVI["layer"]))


def load_colormap(text):
    out = {}
    for cmap in ET.fromstring(text).iter("ColorMap"):
        labels = {e.get("id"): e.get("tooltip") for e in cmap.iter("LegendEntry")}
        for e in cmap.iter("ColorMapEntry"):
            if e.get("transparent") == "true":
                continue
            r, g, b = (int(x) for x in e.get("rgb").split(","))
            out[(r << 16) | (g << 8) | b] = {
                "source": e.get("sourceValue"),
                "value": e.get("value"),
                "label": labels.get(e.get("ref")),
            }
    return out


def decode(rgba, colormap, field):
    key = (rgba[..., 0].astype(np.int64) << 16) | (rgba[..., 1].astype(np.int64) << 8) | rgba[..., 2]
    codes, inverse = np.unique(key, return_inverse=True)
    lut = np.array([field(colormap[c]) if c in colormap else np.nan for c in codes.tolist()], dtype=float)
    out = lut[inverse.reshape(key.shape)]
    out[rgba[..., 3] == 0] = np.nan
    return out


def class_of(entry):
    return float(entry["source"].split(",")[0])


def ndvi_of(entry):
    lo, hi = (float(x) for x in entry["value"].strip("[]()").split(","))
    return (lo + hi) / 2


def read_png(data):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", NotGeoreferencedWarning)
        with MemoryFile(data) as f, f.open() as d:
            a = d.read()
            cmap = d.colormap(1) if d.count == 1 else None
    if cmap is not None:
        return np.array([cmap.get(i, (0, 0, 0, 0)) for i in range(256)], dtype=np.uint8)[a[0]]
    if len(a) == 3:
        a = np.concatenate([a, np.full_like(a[:1], 255)])
    return np.moveaxis(a, 0, -1)


def gibs_box(spec, when, lat, lon):
    left, bottom, right, top = window_bounds(lat, lon)
    params = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.3.0",
        "LAYERS": spec["layer"],
        "STYLES": "",
        "CRS": "EPSG:4326",
        "BBOX": f"{bottom},{left},{top},{right}",
        "WIDTH": min(MAX_PX, max(1, round((right - left) / spec["res"]))),
        "HEIGHT": max(1, round((top - bottom) / spec["res"])),
        "FORMAT": "image/png",
        "TIME": when,
    }
    path = GIBS_DIR / spec["layer"] / when / f"{lat:.4f}_{lon:.4f}.png"
    data = cached(path, GIBS_WMS, params)
    try:
        return read_png(data) if data else None
    except RasterioError:
        path.unlink(missing_ok=True)
        return None


def land_cover_summary(classes, labels):
    known = classes[np.isfinite(classes)].astype(int) if classes is not None else np.array([], int)
    if not len(known):
        return {"bare_share": None, "ice_share": None, "land_cover_main": None}
    land = known[~np.isin(known, WATER) & (known != UNCLASSIFIED)]
    share = (lambda c: round(float(np.mean(land == c)), 3)) if len(land) else (lambda c: None)
    return {
        "bare_share": share(BARREN),
        "ice_share": share(ICE),
        "land_cover_main": labels.get(int(np.bincount(known).argmax())),
    }


def ndvi_summary(months):
    means = [float(np.nanmean(m)) for m in months if m is not None and np.isfinite(m).any()]
    return {"ndvi_max": round(max(means), 3) if means else None}


def gibs_setup():
    def colormap(spec):
        return load_colormap(cached(GIBS_DIR / f"{spec['colormap']}.xml", f"{COLORMAPS}/{spec['colormap']}.xml"))

    land = colormap(LAND_COVER)
    labels = {int(c): e["label"] for e in land.values() for c in e["source"].split(",")}
    return {"times": gibs_times(), "land": land, "labels": labels, "ndvi": colormap(NDVI)}


def cover(lat, lon, gibs):
    land_time, ndvi_times = gibs["times"]
    rgba = gibs_box(LAND_COVER, land_time, lat, lon)
    classes = None if rgba is None else decode(rgba, gibs["land"], class_of)
    months = [gibs_box(NDVI, t, lat, lon) for t in ndvi_times]
    return {
        **land_cover_summary(classes, gibs["labels"]),
        **ndvi_summary([None if m is None else decode(m, gibs["ndvi"], ndvi_of) for m in months]),
    }


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


def values(lat, lon, tiles, gibs, window=None):
    dem, res = window if window else read_window(lat, lon, tiles)
    return {
        **climate(lat, lon),
        "noon_sun_deg": noon_sun_deg(lat),
        "lit_share": lit_share(lat),
        **terrain(lat, lon, dem, res),
        **cover(lat, lon, gibs),
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


def write(name, key, rows, gibs):
    DERIVED.mkdir(exist_ok=True)
    land_time, ndvi_times = gibs["times"]
    sources = {
        **SOURCES,
        "land_cover": {**SOURCES["land_cover"], "time": land_time},
        "vegetation": {**SOURCES["vegetation"], "time": list(ndvi_times)},
    }
    doc = {"generated": datetime.date.today().isoformat(), "sources": sources, key: rows}
    (DERIVED / name).write_text(json.dumps(doc, indent=1))


def main():
    start = time.time()
    tiles = load_tile_list()
    gibs = gibs_setup()
    sites = json.loads((Path(__file__).resolve().parent / "sites.json").read_text())
    with ThreadPoolExecutor(WORKERS) as pool:
        site_values = list(pool.map(lambda s: values(s["lat"], s["lon"], tiles, gibs), sites))
        write("earth_sites.json", "sites", [{"id": s["id"], "values": v} for s, v in zip(sites, site_values)], gibs)
        land = reference_points(tiles, pool)
        ref_values = list(pool.map(lambda pw: values(*pw[0], tiles, gibs, pw[1]), land))
        write(
            "earth_reference.json",
            "points",
            [{"lat": p[0], "lon": p[1], "values": v} for (p, _), v in zip(land, ref_values)],
            gibs,
        )
    print(f"{len(sites)} sites, {len(land)} reference points, {time.time() - start:.0f} s")


if __name__ == "__main__":
    main()

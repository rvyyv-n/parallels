import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import requests
import shapefile
import xarray as xr
from rasterio import features
from rasterio.transform import from_origin

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
POWER_DIR = RAW / "power"
NE_DIR = RAW / "naturalearth"
OUT = ROOT / "data" / "derived"
BUCKET = "nasa-power"
MERRA_STORE = "merra2/temporal/power_merra2_climatology_temporal_lst.zarr"
CERES_STORE = "syn1deg/temporal/power_syn1deg_climatology_temporal_lst.zarr"
MERRA_VARS = ["TS", "TS_MIN", "TS_MAX", "TS_RANGE", "T2M", "T2M_MIN", "T2M_MAX", "T2M_RANGE", "PRECTOTCORR", "WS10M", "RH2M"]
CERES_VARS = ["AOD_55", "ALLSKY_SFC_UV_INDEX", "ALLSKY_SRF_ALB"]
NE_LAND = "https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip"
NE_ADMIN1 = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip"
POINT_API = "https://power.larc.nasa.gov/api/temporal/climatology/point"

NROW, NCOL, STEP = 360, 720, 0.5
LAT = 89.75 - STEP * np.arange(NROW)
LON = -179.75 + STEP * np.arange(NCOL)
FINE = 10
MID_DAY = np.array([15, 46, 74, 105, 135, 162, 198, 228, 258, 288, 318, 344])
MONTH_DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
GSC = 0.0820
HARGREAVES_T0 = 17.8
MIN_PET_MM_YR = 10.0
RAIN_FACTOR, RAIN_MIN = 1.5, 1.0

MERRA_RES = "0.5 deg lat x 0.625 deg lon (MERRA-2), bilinear to the 0.5 deg grid"
CERES_RES = "1 deg (CERES SYN1deg native), each value repeated onto its four 0.5 deg cells"
PERIOD = "2001-2025 monthly climatology (period from the POWER API header; the Zarr store's own attributes still say 2001-2020)"


def cell(lat, lon):
    return int(np.clip(np.floor((90 - lat) / STEP), 0, NROW - 1)), int(np.clip(np.floor((lon + 180) / STEP), 0, NCOL - 1))


def bilinear(a, src_lat, src_lon):
    fi = (LAT - src_lat[0]) / (src_lat[1] - src_lat[0])
    i0 = np.clip(np.floor(fi).astype(int), 0, len(src_lat) - 2)
    wi = (fi - i0)[:, None]
    dlon = src_lon[1] - src_lon[0]
    fj = ((LON - src_lon[0]) % 360) / dlon
    j0 = np.floor(fj).astype(int) % len(src_lon)
    j1 = (j0 + 1) % len(src_lon)
    wj = (fj - np.floor(fj))[None, :]
    lo = a[..., i0, :]
    hi = a[..., i0 + 1, :]
    row = lo * (1 - wi) + hi * wi
    return (row[..., j0] * (1 - wj) + row[..., j1] * wj).astype(np.float32)


def repeat(a, src_lat, src_lon):
    i = np.floor((LAT - (src_lat[0] - (src_lat[1] - src_lat[0]) / 2)) / (src_lat[1] - src_lat[0])).astype(int)
    dlon = src_lon[1] - src_lon[0]
    j = np.floor(((LON - (src_lon[0] - dlon / 2)) % 360) / dlon).astype(int)
    return a[..., i[:, None], j[None, :]].astype(np.float32)


def declination_fao(doy):
    return 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)


def ra_mj(lat_deg, doy):
    phi = np.radians(np.asarray(lat_deg, dtype=float))
    d = declination_fao(doy)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(d), -1, 1))
    return 24 * 60 / np.pi * GSC * dr * (ws * np.sin(phi) * np.sin(d) + np.cos(phi) * np.cos(d) * np.sin(ws))


def hargreaves(t_mean, t_range, ra):
    pet = 0.0023 * 0.408 * ra * (t_mean + HARGREAVES_T0) * np.sqrt(np.clip(t_range, 0, None))
    return np.where(t_mean <= -HARGREAVES_T0, 0.0, pet)


def pet_monthly(t_mean_m, t_range_m, lat):
    ra = np.stack([ra_mj(lat, d) for d in MID_DAY])[:, :, None]
    return hargreaves(t_mean_m, t_range_m, ra).astype(np.float32)


def yearly_total(m):
    return np.tensordot(MONTH_DAYS, m, axes=1).astype(np.float32)


def aridity(p_yr, pet_yr):
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(pet_yr >= MIN_PET_MM_YR, p_yr / pet_yr, np.nan).astype(np.float32)


def noon_sun(lat):
    d = 23.44 * np.sin(2 * np.pi * (np.arange(1, 366) - 80) / 365)
    return np.clip(90 - np.abs(np.asarray(lat, dtype=float)[..., None] - d), 0, None).mean(-1)


def bitmask(flags):
    bits = (1 << np.arange(12)).astype(np.uint16)
    return np.where(flags, bits[:, None, None], 0).sum(0).astype(np.uint16)


def popcount(mask):
    return sum((mask >> k) & 1 for k in range(12)).astype(np.uint8)


def seasons(t_low_m, t_high_m, precip_m):
    freeze = (t_low_m < 0) & (t_high_m > 0)
    mean = precip_m.mean(0)
    rain = (precip_m >= RAIN_FACTOR * mean) & (precip_m >= RAIN_MIN)
    frozen = t_high_m < 0
    bad = np.isnan(t_low_m) | np.isnan(t_high_m) | np.isnan(precip_m)
    best = ~(freeze | rain | frozen | bad)
    out = {"m_freeze": bitmask(freeze), "m_rain": bitmask(rain), "m_frozen": bitmask(frozen), "m_best": bitmask(best)}
    out["usable"] = popcount(out["m_best"])
    return out


def block_mean(fine):
    return fine.reshape(NROW, FINE, NCOL, FINE).mean((1, 3)).astype(np.float32)


def fetch_store(store, names, path):
    if not path.exists():
        import s3fs
        fs = s3fs.S3FileSystem(anon=True)
        ds = xr.open_zarr(s3fs.S3Map(f"{BUCKET}/{store}", s3=fs))[names].load()
        path.parent.mkdir(parents=True, exist_ok=True)
        ds.to_netcdf(path)
    return xr.open_dataset(path).load()


def fetch_zip(url, folder):
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / url.rsplit("/", 1)[1]
    if not path.exists():
        r = requests.get(url, timeout=300)
        r.raise_for_status()
        path.write_bytes(r.content)
    stem = path.stem
    if not (folder / f"{stem}.shp").exists():
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                if Path(n).stem == stem:
                    (folder / Path(n).name).write_bytes(z.read(n))
    return folder / f"{stem}.shp"


def fine_raster(shapes, fill, dtype):
    transform = from_origin(-180, 90, STEP / FINE, STEP / FINE)
    return features.rasterize(shapes, out_shape=(NROW * FINE, NCOL * FINE), transform=transform, fill=fill, dtype=dtype)


def land_fraction():
    shp = fetch_zip(NE_LAND, NE_DIR)
    shapes = ((s.__geo_interface__, 1) for s in shapefile.Reader(str(shp)).shapes())
    return block_mean(fine_raster(shapes, 0, "uint8").astype(np.float32))


def pick_region(block):
    c = block[FINE // 2 - 1:FINE // 2 + 1, FINE // 2 - 1:FINE // 2 + 1].ravel()
    for pool in (c, block.ravel()):
        pool = pool[pool >= 0]
        if pool.size:
            v, n = np.unique(pool, return_counts=True)
            return v[np.argmax(n)]
    return -1


def regions():
    shp = fetch_zip(NE_ADMIN1, NE_DIR)
    r = shapefile.Reader(str(shp), encoding="utf-8", encodingErrors="replace")
    names, shapes, index = [], [], {}
    for sr in r.iterShapeRecords():
        rec = sr.record.as_dict()
        label = ", ".join(x for x in (rec.get("name") or "", rec.get("admin") or "") if x)
        k = index.setdefault(label, len(names))
        if k == len(names):
            names.append(label)
        shapes.append((sr.shape.__geo_interface__, k))
    fine = fine_raster(shapes, -1, "int32").reshape(NROW, FINE, NCOL, FINE).transpose(0, 2, 1, 3)
    rid = np.full((NROW, NCOL), -1, np.int32)
    for i, j in zip(*np.nonzero((fine >= 0).any((2, 3)))):
        rid[i, j] = pick_region(fine[i, j])
    return rid, names


def build():
    merra = fetch_store(MERRA_STORE, MERRA_VARS, POWER_DIR / "merra2_climatology.nc")
    ceres = fetch_store(CERES_STORE, CERES_VARS, POWER_DIR / "syn1deg_climatology.nc")
    mlat, mlon = merra.lat.values, merra.lon.values
    clat, clon = ceres.lat.values, ceres.lon.values
    m = {v: bilinear(merra[v].values, mlat, mlon) for v in MERRA_VARS}
    c = {v: repeat(ceres[v].values, clat, clon) for v in CERES_VARS}

    col = {}
    col["ts_mean_m"], col["ts_min_m"], col["ts_max_m"] = m["TS"][:12], m["TS_MIN"][:12], m["TS_MAX"][:12]
    col["t2m_mean_m"], col["t2m_min_m"], col["t2m_max_m"] = m["T2M"][:12], m["T2M_MIN"][:12], m["T2M_MAX"][:12]
    col["ts_coldest"] = col["ts_min_m"].min(0)
    col["ts_hottest"] = col["ts_max_m"].max(0)
    col["swing_year"] = col["ts_hottest"] - col["ts_coldest"]
    col["swing_day_ground"] = m["TS_RANGE"][12]
    col["swing_day_air"] = m["T2M_RANGE"][12]
    col["ts_annual"] = m["TS"][12]
    col["frozen_months"] = np.where(np.isnan(col["ts_mean_m"]).any(0), np.nan, (col["ts_mean_m"] < 0).sum(0)).astype(np.float32)
    col["precip_m"] = m["PRECTOTCORR"][:12]
    col["precip_mm_yr"] = yearly_total(col["precip_m"])
    col["pet_m"] = pet_monthly(col["t2m_mean_m"], m["T2M_RANGE"][:12], LAT)
    col["pet_mm_yr"] = yearly_total(col["pet_m"])
    col["aridity"] = aridity(col["precip_mm_yr"], col["pet_mm_yr"])
    col["sun_height"] = np.repeat(noon_sun(LAT)[:, None], NCOL, 1).astype(np.float32)
    col["aod"] = c["AOD_55"][12]
    col["wind"] = m["WS10M"][12]
    col["uv_index"] = c["ALLSKY_SFC_UV_INDEX"][12]
    col["albedo"] = c["ALLSKY_SRF_ALB"][12]
    col["rh"] = m["RH2M"][12]
    half = m["T2M_RANGE"][:12] / 2
    col.update(seasons(col["t2m_mean_m"] - half, col["t2m_mean_m"] + half, col["precip_m"]))
    col["land_frac"] = land_fraction()
    col["region_id"], names = regions()

    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT / "climate.npz", **col)
    meta = {"columns": columns_meta(), "datasets": DATASETS, "regions": names}
    (OUT / "climate.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
    return col, names


def columns_meta():
    def c(unit, stat, dataset, resolution=MERRA_RES, note=""):
        return {"unit": unit, "stat": stat, "dataset": dataset, "resolution": resolution, "note": note}

    extreme = ("POWER's climatology TS_MIN/TS_MAX/T2M_MIN/T2M_MAX are extremes, not means of daily minima or maxima: "
               "the lowest (highest) hourly value in that calendar month over all years of the period (cell_methods 'time: min'/'time: max'). "
               "Example: Iowa (42N, 93.75W) July T2M_MIN 9.3 C, T2M_MAX 42.1 C, while the mean daily range is 11.2 C.")
    p, cer = "power_merra2", "power_syn1deg"
    seas = ("Mean daily low and high are estimated as T2M -/+ T2M_RANGE/2 (POWER's monthly mean daily range), "
            "because POWER's climatology T2M_MIN/T2M_MAX are record extremes, not mean daily values. Bit i = month i+1.")
    return {
        "ts_mean_m": c("C", f"monthly mean skin temperature TS, {PERIOD}", p),
        "ts_min_m": c("C", "monthly record-low hourly skin temperature TS_MIN over the period", p, note=extreme),
        "ts_max_m": c("C", "monthly record-high hourly skin temperature TS_MAX over the period", p, note=extreme),
        "t2m_mean_m": c("C", "monthly mean 2 m air temperature T2M", p),
        "t2m_min_m": c("C", "monthly record-low hourly 2 m air temperature T2M_MIN", p, note=extreme),
        "t2m_max_m": c("C", "monthly record-high hourly 2 m air temperature T2M_MAX", p, note=extreme),
        "ts_coldest": c("C", "min over months of ts_min_m: coldest hourly skin temperature in the record", p, note="From TS_MIN (an extreme), not TS."),
        "ts_hottest": c("C", "max over months of ts_max_m: hottest hourly skin temperature in the record", p, note="From TS_MAX (an extreme), not TS."),
        "swing_year": c("C", "ts_hottest - ts_coldest", p),
        "swing_day_ground": c("C", "annual mean of the daily skin temperature range TS_RANGE (POWER ANN value)", p),
        "swing_day_air": c("C", "annual mean of the daily 2 m air temperature range T2M_RANGE (POWER ANN value)", p),
        "ts_annual": c("C", "annual mean skin temperature TS (POWER ANN value)", p),
        "frozen_months": c("months", "count of months with ts_mean_m below 0 C", p),
        "precip_m": c("mm/day", "monthly mean bias-corrected precipitation PRECTOTCORR", p),
        "precip_mm_yr": c("mm/yr", "sum over months of precip_m x days in month (Feb 28.25)", p),
        "pet_m": c("mm/day", "Hargreaves-Samani (1985) potential evapotranspiration: 0.0023 x 0.408 Ra (T2M + 17.8) sqrt(T2M_RANGE)", "hargreaves",
                   note="Ra from latitude and mid-month day of year (FAO-56 eq. 21-25). The temperature difference is POWER's mean daily range T2M_RANGE, "
                        "not T2M_MAX - T2M_MIN, because those are record extremes and would inflate PET. Months with T2M at or below -17.8 C give 0."),
        "pet_mm_yr": c("mm/yr", "sum over months of pet_m x days in month", "hargreaves"),
        "aridity": c("ratio", "UNEP aridity index precip_mm_yr / pet_mm_yr", "hargreaves",
                     note=f"NaN where pet_mm_yr is below {MIN_PET_MM_YR:g} mm/yr (ice sheets, polar interiors): the ratio there divides by a near-zero "
                          "temperature-driven estimate and means 'too cold to evaporate', not wet or dry."),
        "sun_height": c("deg", "yearly mean of noon sun elevation, max(0, 90 - |lat - declination|), declination 23.44 sin(2pi(d-80)/365)", "computed",
                        "exact per 0.5 deg row"),
        "aod": c("1", "annual mean aerosol optical depth at 550 nm AOD_55", cer, CERES_RES),
        "wind": c("m/s", "annual mean 10 m wind speed WS10M", p),
        "uv_index": c("1", "annual mean all-sky surface UV index ALLSKY_SFC_UV_INDEX", cer, CERES_RES),
        "albedo": c("1", "annual mean all-sky surface albedo ALLSKY_SRF_ALB", cer, CERES_RES),
        "rh": c("%", "annual mean 2 m relative humidity RH2M", p),
        "m_freeze": c("bitmask", "months whose estimated mean daily low < 0 C and mean daily high > 0 C (freeze-thaw)", p, note=seas),
        "m_rain": c("bitmask", f"months with precip_m >= {RAIN_FACTOR} x the cell's mean monthly precip and >= {RAIN_MIN} mm/day", p),
        "m_frozen": c("bitmask", "months whose estimated mean daily high < 0 C (frozen solid)", p, note=seas),
        "m_best": c("bitmask", "months in none of m_freeze, m_rain, m_frozen", p),
        "usable": c("months", "number of months in m_best", p),
        "land_frac": c("0-1", "share of the cell covered by land polygons, rasterised at 0.05 deg (pixel centre rule) and averaged", "ne_land",
                       "0.05 deg raster of 1:10m polygons, averaged to 0.5 deg"),
        "region_id": c("index", "admin-1 region at the cell centre (majority of the 4 central 0.05 deg pixels); if none, the most common admin-1 region in the cell; -1 if none",
                       "ne_admin1", "0.05 deg raster of 1:10m polygons", "Index into 'regions' in climate.json, labelled 'name, country'."),
    }


DATASETS = [
    {"id": "power_merra2", "name": "NASA POWER climatology, MERRA-2 meteorology (power_merra2_climatology_temporal_lst.zarr)", "agency": "NASA",
     "url": "https://nasa-power.s3.amazonaws.com/index.html", "licence": "NASA open data, no restrictions",
     "used_for": "ground and air temperature, daily range, precipitation, wind, humidity, seasons", "archive": "NASA POWER on AWS Open Data"},
    {"id": "power_syn1deg", "name": "NASA POWER climatology, CERES SYN1deg radiation (power_syn1deg_climatology_temporal_lst.zarr)", "agency": "NASA",
     "url": "https://nasa-power.s3.amazonaws.com/index.html", "licence": "NASA open data, no restrictions",
     "used_for": "aerosol optical depth, UV index, surface albedo", "archive": "NASA POWER on AWS Open Data"},
    {"id": "hargreaves", "name": "Hargreaves-Samani (1985) potential evapotranspiration with FAO-56 extraterrestrial radiation, from POWER T2M and T2M_RANGE",
     "agency": "computed", "url": "https://www.fao.org/4/x0490e/x0490e07.htm", "licence": "method",
     "used_for": "potential evaporation and the UNEP aridity index", "archive": "computed"},
    {"id": "computed", "name": "Solar geometry from latitude", "agency": "computed", "url": "", "licence": "method",
     "used_for": "noon sun height", "archive": "computed"},
    {"id": "ne_land", "name": "Natural Earth 1:10m land polygons (ne_10m_land)", "agency": "other", "url": NE_LAND, "licence": "public domain",
     "used_for": "land fraction of each cell", "archive": "Natural Earth"},
    {"id": "ne_admin1", "name": "Natural Earth 1:10m admin-1 states and provinces (ne_10m_admin_1_states_provinces)", "agency": "other", "url": NE_ADMIN1,
     "licence": "public domain", "used_for": "region and country names", "archive": "Natural Earth"},
]


def load():
    return dict(np.load(OUT / "climate.npz")), json.loads((OUT / "climate.json").read_text(encoding="utf-8"))


def weighted_median(v, w):
    ok = np.isfinite(v) & (w > 0)
    v, w = v[ok], w[ok]
    order = np.argsort(v)
    cw = np.cumsum(w[order])
    return float(v[order][np.searchsorted(cw, cw[-1] / 2)])


def point(lat, lon, community, params):
    r = requests.get(POINT_API, params={"parameters": params, "community": community, "latitude": lat, "longitude": lon, "format": "JSON"}, timeout=120)
    r.raise_for_status()
    return r.json()["properties"]["parameter"]


def check():
    col, meta = load()
    land = col["land_frac"]
    rng = np.random.default_rng(20261115)
    cand = np.argwhere(land >= 0.95)
    merra = xr.open_dataset(POWER_DIR / "merra2_climatology.nc")
    print("1. POWER point API vs grid (our bilinear cell value | raw store node nearest the cell centre | API at the cell centre)")
    for i, j in cand[rng.choice(len(cand), 5, replace=False)]:
        lat, lon = float(LAT[i]), float(LON[j])
        p = point(lat, lon, "AG", "TS,T2M,PRECTOTCORR")
        node = merra.sel(lat=lat, lon=lon, method="nearest")
        api_p = sum(p["PRECTOTCORR"][k] * d for k, d in zip(list(p["PRECTOTCORR"])[:12], MONTH_DAYS))
        node_p = float(np.dot(MONTH_DAYS, node["PRECTOTCORR"].values[:12]))
        print(f"  ({lat:.2f}, {lon:.2f}) node ({float(node.lat):.2f}, {float(node.lon):.3f})"
              f"  ts_annual {col['ts_annual'][i, j]:.2f} | {float(node['TS'][12]):.2f} | {p['TS']['ANN']:.2f}"
              f"  t2m_jul {col['t2m_mean_m'][6, i, j]:.2f} | {float(node['T2M'][6]):.2f} | {p['T2M']['JUL']:.2f}"
              f"  precip_mm_yr {col['precip_mm_yr'][i, j]:.1f} | {node_p:.1f} | {api_p:.1f}")
    print("2. Aridity")
    for name, lat, lon, rule in [("Yungay", -24.0804, -69.9412, "< 0.05"), ("Iowa", 42.0, -93.5, "> 0.65")]:
        i, j = cell(lat, lon)
        print(f"  {name} cell ({LAT[i]}, {LON[j]}): aridity {col['aridity'][i, j]:.4f} (want {rule}), "
              f"precip {col['precip_mm_yr'][i, j]:.1f} mm/yr, pet {col['pet_mm_yr'][i, j]:.1f} mm/yr")
    print("4. Sites in cells with land_frac > 0")
    sites = json.loads((ROOT / "pipeline" / "sites.json").read_text(encoding="utf-8"))
    bad = [(s["id"], float(land[cell(s["lat"], s["lon"])])) for s in sites if land[cell(s["lat"], s["lon"])] <= 0]
    print(f"  {len(sites) - len(bad)} of {len(sites)} ok", *(f"\n  NOT LAND: {b}" for b in bad))
    print("5. Sanity")
    w = land * np.cos(np.radians(LAT))[:, None]
    for k in ("ts_coldest", "aridity", "frozen_months"):
        print(f"  land-area-weighted median {k}: {weighted_median(col[k], w):.3f}")
    print(f"  cells with land_frac >= 0.05: {int((land >= 0.05).sum())}")
    named = (col["region_id"] >= 0) & (land >= 0.05)
    print(f"  of those with a region name: {int(named.sum())}")


if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    else:
        build()

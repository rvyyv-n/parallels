import json
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "derived"
GLIM_URL = "https://hdl.handle.net/10013/epic.39939.d001"
GLIM_FILE = "glim_wgs84_0point5deg.txt.asc"
EMIT_NAME = "EMIT_L3_ASA_002.nc"
CELL = 0.5
ROWS, COLS = 360, 720

GLIM_LEGEND = {
    1: ("su", "unconsolidated sediments"),
    2: ("vb", "basic volcanic rocks"),
    3: ("ss", "siliciclastic sedimentary rocks"),
    4: ("pb", "basic plutonic rocks"),
    5: ("sm", "mixed sedimentary rocks"),
    6: ("sc", "carbonate sedimentary rocks"),
    7: ("va", "acid volcanic rocks"),
    8: ("mt", "metamorphics"),
    9: ("pa", "acid plutonic rocks"),
    10: ("vi", "intermediate volcanic rocks"),
    11: ("wb", "water bodies"),
    12: ("py", "pyroclastics"),
    13: ("pi", "intermediate plutonic rocks"),
    14: ("ev", "evaporites"),
    15: ("nd", "no data"),
    16: ("ig", "ice and glaciers"),
}
GLIM_GROUPS = {
    "rock_plutonic": ("pa", "pi", "pb"),
    "rock_volcanic": ("va", "vi", "vb", "py"),
    "rock_evaporite": ("ev",),
    "rock_ice": ("ig",),
    "rock_water": ("wb",),
}
EMIT_MINERALS = [
    "Calcite", "Chlorite", "Dolomite", "Goethite", "Gypsum", "Hematite",
    "Illite+Muscovite", "Kaolinite", "Montmorillonite", "Vermiculite",
]
LC_FILE = "MCD12C1.A2025001.061.2026269181218.hdf"
LC_BLOCK = 10
LC_WATER, LC_ICE, LC_BARREN = 0, 15, 16


def cell_lat(i):
    return 89.75 - CELL * np.asarray(i)


def cell_lon(j):
    return -179.75 + CELL * np.asarray(j)


def cell_row(lat):
    return np.clip(np.floor((90 - np.asarray(lat)) / CELL).astype(int), 0, ROWS - 1)


def cell_col(lon):
    return np.clip(np.floor((np.asarray(lon) + 180) / CELL).astype(int), 0, COLS - 1)


def glim_group(codes, group):
    wanted = [c for c, (short, _) in GLIM_LEGEND.items() if short in GLIM_GROUPS[group]]
    out = np.isin(codes, wanted).astype(np.float32)
    out[np.isnan(codes)] = np.nan
    return out


def parse_glim(path):
    grid = np.loadtxt(path, skiprows=6)
    return np.where(grid < 0, np.nan, grid).astype(np.float32)


def aggregate_shares(pct, block=LC_BLOCK):
    h, w, k = pct.shape
    fill = (pct == 255).any(axis=2)
    p = np.where(fill[..., None], 0, pct).astype(np.float64)
    sums = p.reshape(h // block, block, w // block, block, k).sum(axis=(1, 3))
    n = float(block * block * 100)
    valid = sums.sum(axis=2)
    water = sums[..., LC_WATER]
    ice = sums[..., LC_ICE]
    barren = sums[..., LC_BARREN]
    land = valid - water
    has_land = land > 0
    safe = np.where(has_land, land, 1)
    return {
        "bare_share": np.where(has_land, barren / safe, np.nan).astype(np.float32),
        "ice_share": (ice / n).astype(np.float32),
        "water_share": (water / n).astype(np.float32),
        "veg_share": np.where(has_land, (land - barren - ice) / safe, np.nan).astype(np.float32),
        "lc_valid": (valid / n).astype(np.float32),
    }


def place_emit(arr, lat0, lon0):
    full = np.full((ROWS, COLS), np.nan, dtype=np.float32)
    r = int(cell_row(lat0 - 0.25))
    c = int(cell_col(lon0 + 0.25))
    full[r:r + arr.shape[0], c:c + arr.shape[1]] = arr
    return full


def download_glim():
    folder = RAW / "glim"
    folder.mkdir(parents=True, exist_ok=True)
    archive = folder / "glim.zip"
    if not archive.exists():
        import requests
        archive.write_bytes(requests.get(GLIM_URL, timeout=120).content)
    target = folder / "x" / GLIM_FILE
    if not target.exists():
        with zipfile.ZipFile(archive) as z:
            z.extractall(folder / "x")
    return target


def download_earthaccess(short_name, version, folder, name=None, index=-1):
    import earthaccess
    folder.mkdir(parents=True, exist_ok=True)
    if name and (folder / name).exists():
        return folder / name
    earthaccess.login(strategy="netrc")
    found = earthaccess.search_data(short_name=short_name, version=version)
    return earthaccess.download([found[index]], str(folder))[0]


def save(columns, meta):
    OUT.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT / "surface.npz", **columns)
    (OUT / "surface.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


def glim_stage(columns, meta):
    path = download_glim()
    codes = parse_glim(str(path))
    columns["glim_class"] = codes
    res = "0.5 degree, one dominant class per cell"
    meta["columns"]["glim_class"] = {
        "unit": "class code", "stat": "dominant lithology class", "dataset": "glim",
        "resolution": res, "note": "codes in glim_legend; NaN where GLiM has no value (ocean)",
    }
    for group, shorts in GLIM_GROUPS.items():
        columns[group] = glim_group(codes, group)
        meta["columns"][group] = {
            "unit": "flag 0/1", "stat": "dominant class is " + "/".join(shorts), "dataset": "glim",
            "resolution": res, "note": "1 when the cell's dominant class is in the group; shares are not in this version",
        }
    meta["glim_legend"] = {str(c): {"short": s, "name": n} for c, (s, n) in GLIM_LEGEND.items()}
    meta["datasets"].append({
        "id": "glim", "name": "GLiM Global Lithological Map, 0.5 degree grid (Hartmann and Moosdorf 2012)",
        "agency": "other", "url": "https://doi.org/10.1594/PANGAEA.788537", "licence": "CC BY 3.0",
        "used_for": "Rock type per cell: plutonic, volcanic, evaporite, ice, water",
        "archive": "PANGAEA (University of Hamburg)",
    })


def emit_stage(columns, meta):
    import xarray as xr
    path = download_earthaccess("EMITL3ASA", "002", RAW / "emit", EMIT_NAME)
    ds = xr.open_dataset(path)
    lat0, lon0 = float(ds.lat.values[0]), float(ds.lon.values[0])
    for m in EMIT_MINERALS:
        key = m.lower().replace("+", "_")
        base = ds[m].values.astype(np.float32)
        low = ds[m + "_UQ_low_grainsize"].values.astype(np.float32)
        high = ds[m + "_UQ_high_grainsize"].values.astype(np.float32)
        columns["emit_" + key] = place_emit(base, lat0, lon0)
        columns["emit_" + key + "_unc"] = place_emit(np.abs(low - high), lat0, lon0)
        meta["columns"]["emit_" + key] = {
            "unit": "mass fraction (the file has no units attribute)", "stat": "baseline aggregated spectral abundance",
            "dataset": "emit_l3asa", "resolution": "0.5 degree, 55N to 55S only",
            "note": "NaN outside EMIT coverage or masked for vegetation, water, cloud, urban",
        }
        meta["columns"]["emit_" + key + "_unc"] = {
            "unit": "mass fraction", "stat": "abs(UQ_low_grainsize - UQ_high_grainsize), the 2.5 to 97.5 percentile grain-size spread",
            "dataset": "emit_l3asa", "resolution": "0.5 degree, 55N to 55S only",
            "note": "computed from the two uncertainty layers in the file",
        }
    meta["emit_summary"] = ds.attrs["summary"]
    meta["emit_note"] = (
        "Grid coordinates in the file are cell upper-left corners (cells span lat-0.5..lat, lon..lon+0.5); "
        "this places the coastline best against the GLiM land mask, so cells map 1:1 onto our grid."
    )
    meta["datasets"].append({
        "id": "emit_l3asa", "name": "EMIT L3 Aggregated Mineral Spectral Abundance 0.5 Deg V002 (EMITL3ASA)",
        "agency": "NASA", "url": "https://doi.org/10.5067/EMIT/EMITL3ASA.002", "licence": "Freely distributed (NASA open data)",
        "used_for": "Surface mineral abundance (iron oxides, clays, sulfates, carbonates) per cell",
        "archive": "NASA Earthdata (LP DAAC)",
    })


def landcover_stage(columns, meta):
    from pyhdf.SD import SD
    path = download_earthaccess("MCD12C1", "061", RAW / "landcover", LC_FILE)
    sds = SD(str(path)).select("Land_Cover_Type_1_Percent")
    parts = {}
    step = 100
    for r in range(0, 3600, step):
        pct = sds.get(start=(r, 0, 0), count=(step, 7200, 17), stride=(1, 1, 1))
        for k, v in aggregate_shares(pct).items():
            parts.setdefault(k, []).append(v)
    for k, v in parts.items():
        columns[k] = np.concatenate(v, axis=0)
    res = "0.05 degree pixels aggregated to 0.5 degree, IGBP classes, year 2025"
    notes = {
        "bare_share": ("barren or sparsely vegetated pixels / land pixels", "NaN where the cell has no land"),
        "ice_share": ("snow and ice pixels / all pixels", ""),
        "water_share": ("water pixels / all pixels", ""),
        "veg_share": ("land pixels that are neither barren nor snow/ice / land pixels", "NaN where the cell has no land"),
        "lc_valid": ("classified pixels / all pixels", "share of the cell MODIS could classify"),
    }
    for k, (stat, note) in notes.items():
        meta["columns"][k] = {"unit": "share 0-1", "stat": stat, "dataset": "mcd12c1", "resolution": res, "note": note}
    meta["datasets"].append({
        "id": "mcd12c1", "name": "MODIS/Terra+Aqua Land Cover Type Yearly L3 Global 0.05 Deg CMG (MCD12C1) v061, 2025",
        "agency": "NASA", "url": "https://doi.org/10.5067/MODIS/MCD12C1.061", "licence": "NASA open data (LP DAAC, no restrictions)",
        "used_for": "Share of each cell that is barren, snow/ice or water, from per-class percentages",
        "archive": "NASA Earthdata (LP DAAC)",
    })


def main():
    columns, meta = {}, {"columns": {}, "datasets": []}
    for stage in (glim_stage, emit_stage, landcover_stage):
        stage(columns, meta)
        save(columns, meta)
        print(stage.__name__, "saved", len(columns), "columns")


if __name__ == "__main__":
    main()

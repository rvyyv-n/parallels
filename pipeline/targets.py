import csv
import datetime
import json
import math
import time
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.windows import from_bounds

from pipeline.terrain import WINDOW_M, resample, terrain_metrics

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = Path(__file__).resolve().parent / "derived" / "targets_v1.json"

MOON_R = 1737400.0
MARS_R = 3396190.0
HALF = WINDOW_M / 2
TES_PPD = 20
DCI_PPD = 16
PSR_DN = 20000

LOLA_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img"
DIVINER_URL = "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_{}-float.tif"
DIVINER_DIR = "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/"
PGDA_URL = "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF"
PSR_URL = "https://pgda.gsfc.nasa.gov/data/MoonIllumination/LPSR_75S_120M_201608.TIF"
PSR_LABEL_URL = "http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/LPSR_75S_120M_201608.LBL"
PGDA_PAGE = "https://pgda.gsfc.nasa.gov/products/69"
GAZETTEER_URL = "https://planetarynames.wr.usgs.gov/Feature/{}"
MARS_DEM_URL = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
GRS_URL = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab"
DCI_URL = "https://www.mars.asu.edu/~ruff/DCI/dci_lo_ice_dust_16ppd_shifted.pds"
TES_BASE = "https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/"
TES_NIGHT_URL = TES_BASE + "global_ti_night_2007.img"
TES_MASK_URL = TES_BASE + "global_ti_msk_night_2007.img"
TES_PAGE = "https://pds-geosciences.wustl.edu/missions/mgs/tes-timap.html"
GOLOMBEK_URL = "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2020JE006502"
HAYNE_URL = "https://arxiv.org/abs/1711.00977"
CAVES_URL = "https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing"
CAVES_ZIP_URL = "https://astrogeology.usgs.gov/ckan/dataset/c2960f77-ee20-4cc6-ac85-abbecc0fc7f6/resource/ccd54fb2-9a50-46bf-8971-80c241bb2f40/download/mars_cave_catalog.zip"
ARTEMIS_URL = "https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf"
REGIONS_URL = "https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/"
MOON_FACT_URL = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html"
MARS_FACT_URL = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html"
REMS_URL = "https://science.nasa.gov/resource/steady-temperatures-at-mars-gale-crater"
GOMEZ_URL = "https://www-mars.lmd.jussieu.fr/granada2017/abstracts/gomez-elvira_granada2017.pdf"
LEMMON_MSL_URL = "https://doi.org/10.17632/tbh3pg39xc"
MEDA_URL = "https://www.nature.com/articles/s41561-022-01084-0"
ZORZANO_URL = "https://doi.org/10.1038/s41598-024-57458-4"
LEMMON_M2020_URL = "https://doi.org/10.1029/2022GL100126"

PD = "Public NASA data; no restriction stated on the product page"
PUBLISHED = "published paper"

DATASETS = {
    "lola-ldem-240m": dict(
        name="LRO LOLA polar elevation map LDEM_75S_240M", agency="NASA", url=LOLA_URL, licence=PD,
        used_for="Moon slopes, relief and share of gentle ground in each 10 km window; places the Diviner and PGDA windows.",
        archive="NASA PDS Geosciences Node", resolution="240 m"),
    "diviner-polar-south": dict(
        name="LRO Diviner south polar winter-minimum and summer-maximum temperature maps (80°S to the pole)",
        agency="NASA", url=DIVINER_DIR, licence="No licence stated on the Diviner team's download page",
        used_for="Moon coldest and warmest ground temperatures and the summer-to-winter swing.",
        archive="UCLA Diviner team site", resolution="240 m"),
    "pgda-avgvisib": dict(
        name="LOLA/PGDA average solar visibility AVGVISIB_75S_120M", agency="NASA", url=PGDA_URL, licence=PD,
        used_for="Moon share of time in sunlight (best-lit pixel and window median).",
        archive="NASA PGDA (Goddard)", resolution="120 m"),
    "pgda-psr": dict(
        name="LOLA/PGDA permanent shadow map LPSR_75S_120M", agency="NASA", url=PGDA_PAGE, licence=PD,
        used_for="Moon share of each 10 km window in permanent shadow.",
        archive="NASA PGDA (Goddard)", resolution="120 m"),
    "hrsc-mola-dem": dict(
        name="USGS HRSC–MOLA blended elevation map of Mars, 200 m", agency="USGS", url=MARS_DEM_URL,
        licence="Open download from USGS Astrogeology; no licence stated on the file page",
        used_for="Mars slopes, relief and share of gentle ground in each 10 km window.",
        archive="USGS Astrogeology", resolution="200 m"),
    "ody-grs": dict(
        name="Mars Odyssey GRS water-equivalent hydrogen H2O_SR_5X5", agency="NASA", url=GRS_URL, licence=PD,
        used_for="Mars hydrogen (as water-equivalent) in the top metre.",
        archive="NASA PDS Geosciences Node", resolution="5 degree bins smoothed over 10 degrees"),
    "tes-dci": dict(
        name="TES dust cover index (Ruff and Christensen 2002)", agency="NASA", url=DCI_URL,
        licence="Open download from the Arizona State University TES team; no licence stated",
        used_for="Mars surface dust cover.",
        archive="Arizona State University (TES)", resolution="16 pixels per degree"),
    "tes-ti": dict(
        name="MGS TES thermal inertia maps, night map and interpolation mask (MGS-M-TES-5-TIMAP-V1.0)",
        agency="NASA", url=TES_NIGHT_URL, licence=PD,
        used_for="Mars thermal inertia, read against NASA's landing-site rule that thermal inertia above 100–140 "
                 f"J m-2 K-1 s-1/2 means load-bearing ground rather than thick loose dust (Golombek et al. 2020, {GOLOMBEK_URL}).",
        archive="NASA PDS Geosciences Node", resolution="20 pixels per degree (about 3 km)"),
    "mars-cave-catalog": dict(
        name="Mars Global Cave Candidate Catalog v1 (Cushing)", agency="USGS", url=CAVES_URL,
        licence="Open download from USGS Astrogeology; no licence stated on the page",
        used_for="Cave-candidate label: count within 200 km of each Mars target and the nearest one.",
        archive="USGS Astrogeology", resolution="point list"),
    "usgs-gazetteer": dict(
        name="USGS Gazetteer of Planetary Nomenclature (lunar feature positions)", agency="USGS",
        url="https://planetarynames.wr.usgs.gov/", licence="Open lookup; no licence stated",
        used_for="Anchor positions of the nine Artemis III regions.", archive="USGS Astrogeology",
        resolution="feature centre"),
    "artemis-overview": dict(
        name="NASA Artemis overview for Space Apps 2025", agency="NASA", url=ARTEMIS_URL, licence="NASA public document",
        used_for="Sun height at the south pole, 2–7° above the horizon.", archive=PUBLISHED, resolution="published range"),
    "nssdc-moon-fact": dict(
        name="NASA NSSDC Moon fact sheet", agency="NASA", url=MOON_FACT_URL, licence="NASA public document",
        used_for="Noon sun height from latitude (with the Moon's 1.54° tilt).", archive=PUBLISHED, resolution="computed from latitude"),
    "nssdc-mars-fact": dict(
        name="NASA NSSDC Mars fact sheet", agency="NASA", url=MARS_FACT_URL, licence="NASA public document",
        used_for="Noon sun height from latitude (with Mars's 25.2° tilt); planet-wide average temperature for the frozen-months value.",
        archive=PUBLISHED, resolution="computed from latitude; planet-wide average"),
    "hayne-2017": dict(
        name="Hayne et al. 2017, Global regolith thermophysical properties of the Moon from the Diviner Lunar Radiometer Experiment",
        agency="other", url=HAYNE_URL, licence="Open-access preprint", used_for="Moon-wide thermal inertia label.",
        archive=PUBLISHED, resolution="Moon-wide average"),
    "rems-gale-air": dict(
        name="NASA/JPL, REMS air temperature at Gale, Aug 2012–Feb 2013", agency="NASA", url=REMS_URL,
        licence="NASA public page", used_for="Gale air temperatures.", archive=PUBLISHED, resolution="one site"),
    "gomez-elvira-2017": dict(
        name="Gómez-Elvira et al. 2017, REMS ground temperature at Gale", agency="other", url=GOMEZ_URL,
        licence="Conference abstract", used_for="Gale ground temperatures.", archive=PUBLISHED, resolution="one site"),
    "lemmon-msl-tau": dict(
        name="Lemmon et al., MSL Mastcam solar-imaging optical depth record", agency="other", url=LEMMON_MSL_URL,
        licence="Open dataset", used_for="Gale dust optical depth.", archive=PUBLISHED, resolution="one site"),
    "meda-2023": dict(
        name="Rodríguez-Manfredi et al. 2023, Perseverance MEDA", agency="other", url=MEDA_URL,
        licence="Open-access paper", used_for="Jezero daily air-temperature swing.", archive=PUBLISHED, resolution="one site"),
    "zorzano-2024": dict(
        name="Zorzano et al. 2024, MEDA thermal infrared sensor over one Mars year", agency="other", url=ZORZANO_URL,
        licence="Open-access paper", used_for="Jezero ground temperature.", archive=PUBLISHED, resolution="one site"),
    "lemmon-2022": dict(
        name="Lemmon et al. 2022, Perseverance Mastcam-Z solar imaging", agency="other", url=LEMMON_M2020_URL,
        licence="Open-access paper", used_for="Jezero dust optical depth.", archive=PUBLISHED, resolution="one site"),
}

GAZETTEER = {
    "Cabeus B": (-82.2587, 305.4154, 59.617, 8058),
    "Haworth": (-87.45, 354.83, 51.423, 14502),
    "Mons Malapert": (-85.98, 358.33, 67.0, 16338),
    "Mons Mouton": (-84.6, 31.0, 130.0, 16070),
    "Nobile": (-85.2752, 53.2725, 79.272, 4321),
    "de Gerlache": (-88.4849, 271.6553, 32.705, 1439),
    "Slater": (-88.0792, 111.2881, 25.119, 15325),
}
MONS_MOUTON_MIN_LAT = -86.1098

MOON = [
    ("Peak near Cabeus B", "Cabeus B", "centre",
     "USGS Gazetteer centre of Cabeus B; NASA gives no centre point and the window samples the satellite crater's middle, not a specific peak."),
    ("Haworth", "Haworth", "centre",
     "USGS Gazetteer centre of Haworth crater; the window samples the crater floor, while NASA's region lies around it."),
    ("Malapert Massif", "Mons Malapert", "centre",
     "USGS Gazetteer centre of Mons Malapert, the massif the region is named after."),
    ("Mons Mouton Plateau", "Mons Mouton", "centre",
     "USGS Gazetteer centre of Mons Mouton, taken as its summit plateau."),
    ("Mons Mouton", "Mons Mouton", "flank",
     "Half way from the USGS Gazetteer centre of Mons Mouton to the pole-ward edge of its Gazetteer extent (86.11° S), on the same meridian, so it differs from the Plateau anchor."),
    ("Nobile Rim 1", "Nobile", "rim_pole",
     "Point on Nobile's rim facing the pole: Gazetteer centre moved one radius (half the Gazetteer diameter) toward the pole. Which rim NASA calls 1 or 2 is our assumption."),
    ("Nobile Rim 2", "Nobile", "rim_away",
     "Point on Nobile's rim facing away from the pole: Gazetteer centre moved one radius away from the pole. Which rim NASA calls 1 or 2 is our assumption."),
    ("de Gerlache Rim 2", "de Gerlache", "rim_pole",
     "Point on de Gerlache's rim facing the pole (toward the Shackleton–de Gerlache ridge): Gazetteer centre moved one radius toward the pole. Which part of the rim NASA means is our assumption."),
    ("Slater Plain", "Slater", "centre",
     "USGS Gazetteer centre of Slater crater; the window samples the crater, not a mapped plain."),
]

MARS = [
    ("Jezero", 18.38, 77.58, "Centre of Jezero crater; the window samples the crater floor. Perseverance landed about 8 km to the north-west."),
    ("Arcadia Planitia", 47.2, 184.3, "Buried-ice area studied by Bramson 2015; coordinates from our plan (section 5)."),
    ("Gale", -4.59, 137.44, "Curiosity's landing site on the crater floor, where its climate and radiation values were measured. The crater centre (5.4° S, 137.8° E) is the steep upper flank of Mount Sharp."),
    ("Deuteronilus Mensae", 43.9, 22.6, "Glacier area studied by Plaut 2009; coordinates from our plan (section 5)."),
    ("Arsia Mons caves", -5.5332, 241.3931,
     "Cave opening APC075, noted as 'Jeanne' (one of the seven openings in Cushing 2007), from the USGS Mars Global Cave Candidate Catalog; the summit (8.35° S, 239.91° E) is about 150 km away."),
]

COMBINED_STAT = "median of NASA's nine Artemis III candidate regions (10 km window each)"
COMBINED_NOTE = ("The nine regions are anchored on the USGS positions of the features they are named after "
                  "(NASA publishes no centre points), so this target is placed at the pole and stands for all nine.")

TERRAIN_STATS = {
    "slope_median_deg": "median slope over the 10 km window",
    "slope_p90_deg": "90th percentile slope over the 10 km window",
    "share_under_10": "share of the 10 km window with slope under 10°",
    "share_under_5": "share of the 10 km window with slope under 5°",
    "relief_m": "5th to 95th percentile height range over the 10 km window",
}


def kebab(name):
    return "-".join(name.lower().replace("–", " ").split())


def lon180(lon):
    return (lon + 180) % 360 - 180


def polar_xy(lat, lon, r=MOON_R):
    rho = 2 * r * math.tan(math.radians(90 + lat) / 2)
    return rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))


def polar_latlon(x, y, r=MOON_R):
    lat = -90 + 2 * math.degrees(math.atan(math.hypot(x, y) / (2 * r)))
    return lat, math.degrees(math.atan2(x, y))


def polar_scale(lat):
    return 2 / (1 + math.sin(math.radians(abs(lat))))


def moon_anchor(feature, rule):
    lat, lon, diameter_km, _ = GAZETTEER[feature]
    if rule == "centre":
        return lat, lon180(lon)
    if rule == "flank":
        return (lat + MONS_MOUTON_MIN_LAT) / 2, lon180(lon)
    x, y = polar_xy(lat, lon)
    rho = math.hypot(x, y)
    step = diameter_km * 500 * polar_scale(lat)
    f = (rho - step) / rho if rule == "rim_pole" else (rho + step) / rho
    lat, lon = polar_latlon(x * f, y * f)
    return lat, lon180(lon)


def geo_bounds(lat, lon, half_m, r):
    dlat = math.degrees(half_m / r)
    dlon = math.degrees(half_m / (r * math.cos(math.radians(lat))))
    return lon - dlon, lat - dlat, lon + dlon, lat + dlat


def read_window(ds, bounds):
    w = from_bounds(*bounds, transform=ds.transform).round_offsets().round_lengths()
    a = ds.read(1, window=w, masked=True, boundless=True).astype(float)
    return a.filled(np.nan) * ds.scales[0]


def polar_window(ds, lat, lon):
    x, y = polar_xy(lat, lon)
    h = HALF * polar_scale(lat)
    return read_window(ds, (x - h, y - h, x + h, y + h))


def grs_value(rows, lat, lon):
    blat = math.floor(lat / 5) * 5 + 2.5
    blon = math.floor((lon % 360) / 5) * 5 + 2.5
    for r in rows:
        if r[0] == blat and r[1] == blon:
            return None if r[2] > 9999 else r[2], None if r[3] > 9999 else r[3]
    return None, None


def dci_cell(lat, lon, ppd=DCI_PPD):
    return int((90 - lat) * ppd), int(((lon + 180) % 360) * ppd)


def tes_cell(lat, lon, ppd=TES_PPD):
    return int((90 - lat) * ppd), int(((lon + 180) % 360) * ppd)


def tes_slices(lat, lon, half_m=HALF, ppd=TES_PPD):
    w, s, e, n = geo_bounds(lat, lon, half_m, MARS_R)
    r0, r1 = math.ceil((90 - n) * ppd - 0.5), math.floor((90 - s) * ppd - 0.5)
    c0, c1 = math.ceil((w + 180) * ppd - 0.5), math.floor((e + 180) * ppd - 0.5)
    if r1 < r0 or c1 < c0:
        r, c = tes_cell(lat, lon, ppd)
        return slice(r - 1, r + 2), slice(c - 1, c + 2), True
    return slice(r0, r1 + 1), slice(c0, c1 + 1), False


def tes_value(ti, mask, lat, lon):
    rows, cols, small = tes_slices(lat, lon)
    a, m = ti[rows, cols], mask[rows, cols]
    keep = (m == 1) & (a > 0)
    if not keep.any():
        return None, 0, small
    return float(np.median(a[keep])), int(keep.sum()), small


def ground_strength(ti):
    if ti is None:
        return None, "No unmasked TES pixel in the window, so the ground-strength rule cannot be read."
    if ti >= 140:
        return "above", (f"TES night-time thermal inertia is {ti:.0f}, above NASA's 100–140 landing-site line, "
                         "so the ground reads as load-bearing rather than thick loose dust.")
    if ti >= 100:
        return "inside", (f"TES night-time thermal inertia is {ti:.0f}, inside NASA's 100–140 landing-site band, "
                          "so it is borderline between load-bearing ground and thick loose dust.")
    return "below", (f"TES night-time thermal inertia is {ti:.0f}, below NASA's 100–140 landing-site line, "
                     "so the ground may be thick loose dust rather than load-bearing.")


def haversine_km(lat1, lon1, lat2, lon2, r=MARS_R):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a)) / 1000


def cave_label(caves, lat, lon, radius_km=200):
    dist = sorted((haversine_km(lat, lon, c[1], c[2]), c[0]) for c in caves)
    return {"count_within_200km": sum(d <= radius_km for d, _ in dist),
            "nearest_id": dist[0][1], "nearest_km": round(dist[0][0], 1)}


COLD_NOTE = (" Below about 25 K, the coldest ground temperature the Diviner team reports for the south pole "
             "(https://www.diviner.ucla.edu/science); readings this low are at the limit of what the instrument can measure, "
             "so read it as 'colder than about 25 K'.")


def flag_cold(values):
    for k in ("t_min_k", "t_min_coldest_k"):
        v = values[k]
        if v["value"] is not None and v["value"] < 25:
            v["note"] = (v.get("note") or "") + COLD_NOTE
    return values


def val(value, ds, stat, kind, note=None, res=None):
    v = {"value": value, "stat": stat, "dataset": ds,
         "resolution": res or (DATASETS[ds]["resolution"] if ds else None), "kind": kind}
    if note:
        v["note"] = note
    return v


def median_value(vals):
    got = [v["value"] for v in vals if v["value"] is not None]
    return float(np.median(got)) if got else None


def combine(regions):
    out = {}
    for k, first in regions[0]["values"].items():
        vals = [r["values"][k] for r in regions]
        if first["kind"] == "published":
            out[k] = dict(first)
            continue
        m = median_value(vals)
        n = sum(v["value"] is not None for v in vals)
        note = f"Each region's value is the {first['stat']}. " + (first.get("note") or "").replace(COLD_NOTE, "")
        if n < len(vals):
            note += f" Median of the {n} regions that have a value; the other {len(vals) - n} have none."
        out[k] = dict(first, value=None if m is None else round(m, 3 if abs(m) < 1 else 2), stat=COMBINED_STAT, note=note.strip())
    return out


def rnd(x, n):
    return None if x is None or not np.isfinite(x) else round(float(x), n)


def fetch(url, name):
    path = RAW / name
    if path.exists() and path.stat().st_size > 0:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            with requests.get(url, stream=True, timeout=120) as r:
                r.raise_for_status()
                tmp = path.with_suffix(path.suffix + ".part")
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                tmp.replace(path)
                return path
        except requests.RequestException:
            time.sleep(5 * (attempt + 1))
    return None


def terrain_values(dem, spacing_m, px, ds, note):
    dem = resample(dem, spacing_m[0], spacing_m[1], px)
    return {k: val(v, ds, TERRAIN_STATS[k], "computed", note) for k, v in terrain_metrics(dem, px).items()}


def moon_region(name, feature, rule, anchor_note, files):
    lat, lon = moon_anchor(feature, rule)
    gaz = GAZETTEER_URL.format(GAZETTEER[feature][3])
    values = {}
    with rasterio.open(files["lola"]) as ds:
        dem = polar_window(ds, lat, lon)
        spacing = ds.res[0] / polar_scale(lat)
    values.update(terrain_values(
        dem, (spacing, spacing), 240, "lola-ldem-240m",
        "10 km window at the anchor, polar stereographic 240 m grid, slopes at 240 m."))
    with rasterio.open(files["winter"]) as ds:
        tmin = polar_window(ds, lat, lon)
    with rasterio.open(files["summer"]) as ds:
        tmax = polar_window(ds, lat, lon)
    dv = "diviner-polar-south"
    winter, summer = "polar_south_80_winter_min-float.tif", "polar_south_80_summer_max-float.tif"
    values["t_min_k"] = val(rnd(np.nanmedian(tmin), 1), dv, "median over the 10 km window of the winter-minimum map", "computed",
                            f"Median over the 10 km window of the winter minimum surface temperature ({winter}).")
    values["t_min_coldest_k"] = val(rnd(np.nanmin(tmin), 1), dv, "coldest pixel of the winter-minimum map in the 10 km window",
                                    "computed", "Coldest pixel in the 10 km window.")
    values["t_max_k"] = val(rnd(np.nanmedian(tmax), 1), dv, "median over the 10 km window of the summer-maximum map", "computed",
                            f"Median over the 10 km window of the summer maximum surface temperature ({summer}).")
    flag_cold(values)
    values["t_swing_k"] = val(rnd(np.nanmedian(tmax) - np.nanmedian(tmin), 1), dv,
                              "median of the summer-maximum map minus median of the winter-minimum map, 10 km window", "computed",
                              "Summer-to-winter range of surface temperature, not a day-to-night swing.")
    coolest_summer = np.nanmin(tmax)
    values["frozen_months"] = val(
        12 if coolest_summer < 273 else None, dv, "coolest pixel of the summer-maximum map in the 10 km window", "derived",
        f"The window's coolest spot peaks at {coolest_summer:.0f} K in summer, "
        + ("below 273 K, so it stays frozen all year." if coolest_summer < 273
           else "above 273 K; the maps give no month-by-month count."))
    with rasterio.open(files["lit"]) as ds:
        lit = polar_window(ds, lat, lon)
    values["lit_share"] = val(rnd(np.nanmax(lit), 3), "pgda-avgvisib", "best-lit pixel in the 10 km window", "computed",
                              "Best-lit 120 m pixel in the 10 km window, as a fraction of time (0–1), at the surface.")
    values["lit_share_median"] = val(rnd(np.nanmedian(lit), 3), "pgda-avgvisib", "median over the 10 km window", "computed",
                                     "Median over the 10 km window, fraction of time (0–1).")
    with rasterio.open(files["psr"]) as ds:
        psr = polar_window(ds, lat, lon)
    psr = psr[np.isfinite(psr)]
    values["psr_share"] = val(rnd(np.mean(psr > 0), 3) if psr.size else None, "pgda-psr", "share of 120 m pixels in the 10 km window flagged as permanent shadow",
                              "computed", "Pixel value +20000 means permanent shadow and -20000 means not; the meaning comes from the product label "
                              f"on the LOLA team's node ({PSR_LABEL_URL}). File: {PSR_URL}")
    values["noon_sun_deg"] = val(round(90 - abs(lat), 2), "nssdc-moon-fact", "90 − |latitude|", "derived",
                                 "Mean sun height at the anchor; the Moon's 1.54° tilt moves it about ±1.5° over the year.")
    values["sun_height_min_deg"] = val(2, "artemis-overview", "published range, lower end", "published", res="published range")
    values["sun_height_max_deg"] = val(7, "artemis-overview", "published range, upper end", "published", res="published range")
    values["thermal_inertia_moon_wide"] = val(
        55, "hayne-2017", "Moon-wide average at 273 K, 55 ± 2", "published",
        "Moon-wide average at 273 K, 55 +/- 2; not mapped at the pole (the Diviner map stops at 70 degrees latitude)")
    facts = [
        {"text": "South-pole highlands rock is noritic anorthosite (feldspar-rich)", "source": "Lemelin et al. 2022",
         "url": "https://doi.org/10.3847/PSJ/ac532c"},
        {"text": "Landing needs slopes under 10°; walking under 20°", "source": "NASA Artemis overview for Space Apps 2025",
         "url": ARTEMIS_URL},
        {"text": "One of NASA's nine Artemis III candidate landing regions", "source": "NASA, 28 Oct 2024",
         "url": REGIONS_URL},
    ]
    if feature == "Cabeus B":
        facts.insert(0, {"text": "LCROSS found 5.6 ± 2.9% water by weight in soil thrown up from nearby Cabeus crater",
                         "source": "Colaprete et al. 2010", "url": "https://doi.org/10.1126/science.1186986"})
    return {"id": "moon-" + kebab(name), "body": "moon", "name": name, "lat": round(lat, 4), "lon": round(lon, 4),
            "anchor_note": anchor_note + f" Gazetteer: {gaz}", "values": values, "facts": facts}


def moon_target(regions):
    first = regions[0]
    return {"id": "moon-south-pole", "body": "moon", "name": "Moon's south pole (Artemis III regions)",
            "default": True, "lat": -90, "lon": 0, "anchor_note": COMBINED_NOTE,
            "values": flag_cold(combine(regions)), "facts": first["facts"],
            "regions": [{k: r[k] for k in ("id", "name", "lat", "lon", "anchor_note", "values")} for r in regions]}


MARS_CLIMATE = {
    "Gale": {
        "daily_swing_c": val(70, "rems-gale-air", "daily high minus daily low, first ~200 sols", "derived",
                             "Daily highs about 0 °C and lows about −70 °C over Curiosity's first ~200 sols.", "one site"),
        "t_min_air_c": val(-70, "rems-gale-air", "typical pre-dawn low, first ~200 sols", "published",
                           "Typical pre-dawn low, first ~200 sols.", "one site"),
        "t_min_ground_c": val(-103, "gomez-elvira-2017", "lower end of the daily ground-minimum range over two Mars years", "published",
                              "Daily ground minima span about 170–210 K over two Mars years; 170 K is −103 °C.", "one site"),
        "daily_ground_swing_c": val(80, "gomez-elvira-2017", "gap between the middles of the daily maximum and minimum ranges", "derived",
                                    "Daily ground maxima span about 250–290 K and minima about 170–210 K over two "
                                    "Mars years; 80 K is the gap between the middles of the two ranges, not a published "
                                    "single swing. The paper says the swing depends on the ground type under the rover.", "one site"),
        "dust_tau": val(None, "lemmon-msl-tau", "typical optical depth (440 and 880 nm)", "published",
                        "The record says optical depth is lower and steadier in southern fall and winter and peaks in "
                        "southern spring and summer, but states no typical value in its text; the values are only in "
                        "the data files, which we have not processed yet.", "one site"),
    },
    "Jezero": {
        "daily_swing_c": val(52, "meda-2023", "twice the published half-amplitude of the daily air-temperature cycle", "derived",
                             "Twice the published 26 K half-amplitude of the daily air-temperature cycle (first 250 sols).", "one site"),
        "t_min_air_c": val(None, "meda-2023", "coldest air temperature", "published",
                           "No single coldest air temperature is stated in the text; not read off figures.", "one site"),
        "t_min_ground_c": val(-93, "zorzano-2024", "night-time minimum of the regolith over one Mars year", "published",
                              "Night-time minimum of the regolith on the crater floor, 'about 180 K' in the text "
                              "(−93 °C); frost is briefly stable when the ground is below 185 K.", "one site"),
        "daily_ground_swing_c": val(None, "zorzano-2024", "daily ground maximum minus minimum", "published",
                                    "The text gives the night minimum (about 180 K) but no daily ground maximum or "
                                    "swing; not read off figures.", "one site"),
        "dust_tau": val(0.4, "lemmon-2022", "visible column optical depth just after a January 2022 local storm", "published",
                        "Visible column optical depth (Mastcam-Z 880 nm channel; dust plus some ice) near 0.4 just "
                        "after a January 2022 local storm (Ls ~156°, northern late summer) and near 0.3 before it, close "
                        "to the seasonal minimum. The same paper says the 9 µm dust optical depth is about half the "
                        "visible value; we did not convert anything. Dusty-season values are higher (the storm peaked near 2).", "one site"),
    },
}

MARS_FACTS = {
    "Jezero": [
        {"text": "Crater floor rocks hold olivine, carbonates and sulfates altered by water", "source": "Farley et al. 2022",
         "url": "https://doi.org/10.1126/science.abo2196"},
        {"text": "Air pressure 650–761 Pa over the first 250 sols; gusts to 25 m/s", "source": "Rodríguez-Manfredi et al. 2023",
         "url": "https://www.nature.com/articles/s41561-022-01084-0"},
    ],
    "Arcadia Planitia": [
        {"text": "A buried ice slab tens of metres thick lies under the plains", "source": "Bramson et al. 2015",
         "url": "https://arxiv.org/pdf/1509.03210"},
    ],
    "Gale": [
        {"text": "Mudstone with clay minerals and calcium sulfates, from an ancient lake", "source": "Vaniman et al. 2014",
         "url": "https://doi.org/10.1126/science.1243480"},
        {"text": "The only place on Mars's surface where radiation has been measured (Curiosity RAD)",
         "source": "NASA Curiosity RAD", "url": "https://science.nasa.gov/photojournal/radiation-measurements-on-mars/"},
    ],
    "Deuteronilus Mensae": [
        {"text": "Debris aprons are mostly water ice under a thin rock cover", "source": "Plaut et al. 2009",
         "url": "https://doi.org/10.1029/2008GL036379"},
    ],
    "Arsia Mons caves": [
        {"text": "Seven cave openings 100–225 m wide on Arsia Mons", "source": "Cushing et al. 2007",
         "url": "https://doi.org/10.1029/2007GL030709"},
        {"text": "Opening APC075 ('Jeanne') is about 165 m across and about 345 m deep",
         "source": "USGS Mars Global Cave Candidate Catalog (Cushing)", "url": CAVES_URL},
    ],
}


def weh_meaning(lat):
    if abs(lat) >= 40:
        return ("This is hydrogen counted as if it were water. At this mid/high latitude it is likely buried ice "
                "(Arcadia and Deuteronilus have radar-detected ice).")
    return ("This is hydrogen counted as if it were water, not ice: near the equator ice is not stable in the top "
            "metre, so the hydrogen is likely bound in hydrated minerals.")


def mars_target(name, lat, lon, anchor_note, grs_rows, dci, tes):
    lon = lon180(lon)
    values = {}
    note = ("10 km window, slopes at 200 m. The blend is HRSC (~50–100 m) where HRSC exists, "
            "otherwise MOLA only (~463 m), so slopes there are smoothed.")
    try:
        with rasterio.open("/vsicurl/" + MARS_DEM_URL) as ds:
            dem = read_window(ds, geo_bounds(lat, lon, HALF, MARS_R))
            dy = math.radians(ds.res[1]) * MARS_R
        values.update(terrain_values(dem, (dy * math.cos(math.radians(lat)), dy), 200, "hrsc-mola-dem", note))
    except rasterio.errors.RasterioIOError as e:
        for k in TERRAIN_STATS:
            values[k] = val(None, "hrsc-mola-dem", TERRAIN_STATS[k], "computed", f"Read failed: {e}")
    weh, sigma = grs_value(grs_rows, lat, lon)
    values["weh_pct"] = val(weh, "ody-grs", "5° bin containing the site, smoothed over 10°", "computed",
                            (f"5° bin containing the site, smoothed over 10°; weight % of the top ~1 m; ± {sigma} (1σ). "
                             if weh is not None else "No GRS value for this bin. ") + weh_meaning(lat))
    if dci is None:
        values["dci"] = val(None, "tes-dci", "median of the 3×3 pixels at the site", "computed", "File not available.")
    else:
        r, c = dci_cell(lat, lon)
        block = dci[r - 1:r + 2, c - 1:c + 2]
        block = block[block > 0.85]
        values["dci"] = val(rnd(np.median(block), 3) if block.size else None, "tes-dci", "median of the 3×3 pixels at the site", "computed",
                            "Median of the 3×3 pixels (16 per degree) at the site; below ~0.94 means dusty, above ~0.96 dust-free.")
    ti, n, small = tes_value(*tes, lat, lon)
    where = "3×3 pixels at the site (the window is smaller than a pixel)" if small else "10 km window"
    values["thermal_inertia"] = val(
        None if ti is None else round(ti), "tes-ti", f"median of unmasked pixels in the {where}", "computed",
        f"Night-time TES thermal inertia in J m-2 K-1 s-1/2, from {n} pixels (20 per degree, about 3 km each) after dropping "
        "interpolated pixels (mask 0) and zero values; it describes the area, not the exact spot.")
    band, text = ground_strength(ti)
    values["ground_strength_note"] = val(band, "tes-ti", "median TES thermal inertia against NASA's 100–140 landing-site rule", "derived",
                                         text + f" Rule: Golombek et al. 2020, {GOLOMBEK_URL}")
    values["frozen_months"] = val(
        12, "nssdc-mars-fact", "months with mean ground temperature below 0 C", "derived",
        "NASA's Mars fact sheet gives an average temperature of about 214 K (−59 C) and a daily range of 184–242 K at the "
        "Viking 1 site, all below 273 K (0 C). This value rests on that planet-wide average"
        + (f" and this site's published night minimum ({MARS_CLIMATE[name]['t_min_ground_c']['value']} C ground)"
           if name in MARS_CLIMATE and MARS_CLIMATE[name]["t_min_ground_c"]["value"] is not None else "")
        + ", not on a month-by-month record at the site; mid-latitude summers can be warmer than the planet average.",
        "planet-wide average")
    climate = MARS_CLIMATE.get(name)
    for k in ("daily_swing_c", "t_min_air_c", "t_min_ground_c", "daily_ground_swing_c"):
        values[k] = climate[k] if climate else val(None, None, "none", "published", "No surface measurement at this site.", "none")
    values["dust_tau"] = climate["dust_tau"] if climate else val(
        None, None, "none", "published",
        "No surface measurement at this site, and we found no NASA orbital dust climatology (TES, THEMIS, MCS) "
        "that states a value for this region in its text or tables.", "none")
    values["noon_sun_deg"] = val(round(90 - abs(lat), 2), "nssdc-mars-fact", "90 − |latitude|", "derived",
                                 "Mean noon sun height; Mars's 25.2° tilt moves it up to ±25° over the year.")
    return {"id": "mars-" + kebab(name), "body": "mars", "name": name, "default": name == "Jezero",
            "lat": round(lat, 4), "lon": round(lon, 4),
            "anchor_note": anchor_note, "values": values, "facts": MARS_FACTS.get(name, [])}


def load_grs(path):
    rows = []
    for line in path.read_text().splitlines():
        parts = line.split()
        if len(parts) >= 4:
            rows.append(tuple(float(p) for p in parts[:4]))
    return rows


def load_dci(path):
    if path is None:
        return None
    return np.fromfile(path, dtype="<f4", offset=1024).reshape(2880, 5760)


def load_tes(night, mask):
    return (np.fromfile(night, dtype=">i2").reshape(3600, 7200),
            np.fromfile(mask, dtype="u1").reshape(3600, 7200))


def load_caves(zip_path):
    import io
    import zipfile
    with zipfile.ZipFile(zip_path) as z:
        text = z.read("data/Mars_Cave_Catalog.csv").decode("utf-8")
    rows = list(csv.reader(io.StringIO(text)))[1:]
    return [(r[0], float(r[2]), float(r[1])) for r in rows if len(r) >= 3]


def main():
    files = {
        "lola_img": fetch(LOLA_URL, "moon/ldem_75s_240m.img"),
        "lola": fetch(LOLA_URL.replace(".img", ".lbl"), "moon/ldem_75s_240m.lbl"),
        "winter": fetch(DIVINER_URL.format("winter_min"), "moon/polar_south_80_winter_min-float.tif"),
        "summer": fetch(DIVINER_URL.format("summer_max"), "moon/polar_south_80_summer_max-float.tif"),
        "lit": fetch(PGDA_URL, "moon/AVGVISIB_75S_120M_201608.TIF"),
        "psr": fetch(PSR_URL, "moon/LPSR_75S_120M_201608.TIF"),
    }
    fetch(PSR_LABEL_URL, "moon/LPSR_75S_120M_201608.LBL")
    grs = load_grs(fetch(GRS_URL, "mars/h2o_sr_5x5.tab"))
    dci = load_dci(fetch(DCI_URL, "mars/dci_lo_ice_dust_16ppd_shifted.pds"))
    tes = load_tes(fetch(TES_NIGHT_URL, "mars/global_ti_night_2007.img"), fetch(TES_MASK_URL, "mars/global_ti_msk_night_2007.img"))
    regions = [moon_region(*m, files) for m in MOON]
    targets = [moon_target(regions)] + regions
    targets += [mars_target(*m, grs, dci, tes) for m in MARS]
    for t in targets:
        t.setdefault("default", False)
    caves = load_caves(fetch(CAVES_ZIP_URL, "mars/mars_cave_catalog.zip"))
    labels = {
        "mars_caves": {t["id"]: val(cave_label(caves, t["lat"], t["lon"]), "mars-cave-catalog",
                                    "great-circle distance from the target to each catalogue entry", "computed",
                                    "Candidates only: none is verified as a real cave.")
                       for t in targets if t["body"] == "mars"},
        "lunar_pits": val(None, None, "not checked", "published",
                          "The LROC pit atlas is an interactive web page with no simple download, so we did not check it; "
                          "this is not a finding that none exist.", "none"),
    }
    used = {v["dataset"] for t in targets for v in t["values"].values()}
    used |= {v["dataset"] for t in targets for r in t.get("regions", []) for v in r["values"].values()}
    used |= {v["dataset"] for v in labels["mars_caves"].values()} | {"usgs-gazetteer"}
    datasets = [{"id": k, **{f: d[f] for f in ("name", "agency", "url", "licence", "used_for", "archive")}}
                for k, d in DATASETS.items() if k in used]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"generated": datetime.date.today().isoformat(), "datasets": datasets,
                               "targets": targets, "labels": labels}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for t in targets:
        v = t["values"]
        print(t["id"], t["lat"], t["lon"], v["slope_median_deg"]["value"], v["share_under_10"]["value"],
              v.get("t_min_k", v.get("thermal_inertia"))["value"], v.get("lit_share", v.get("dci"))["value"])


if __name__ == "__main__":
    main()

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
OUT = Path(__file__).resolve().parent / "derived" / "targets.json"

MOON_R = 1737400.0
MARS_R = 3396190.0
HALF = WINDOW_M / 2

LOLA_URL = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_75s_240m.img"
DIVINER_URL = "https://luna1.diviner.ucla.edu/~jpierre/diviner/level4_polar/additional_maps/polar_south_80_{}-float.tif"
PGDA_URL = "https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF"
GAZETTEER_URL = "https://planetarynames.wr.usgs.gov/Feature/{}"
MARS_DEM_URL = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
GRS_URL = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab"
DCI_URL = "https://www.mars.asu.edu/~ruff/DCI/dci_lo_ice_dust_16ppd_shifted.pds"
CAVES_URL = "https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing"
ARTEMIS_URL = "https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf"
REGIONS_URL = "https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/"

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
    ("Jezero", 18.38, 77.58, "Centre of Jezero crater (our plan, section 5); the window samples the crater floor. Perseverance landed about 8 km to the north-west."),
    ("Arcadia Planitia", 47.2, 184.3, "Buried-ice area studied by Bramson 2015; coordinates from our plan (section 5)."),
    ("Gale", -4.59, 137.44, "Curiosity's landing site on the crater floor, where its climate and radiation values were measured. The crater centre (5.4° S, 137.8° E) is the steep upper flank of Mount Sharp."),
    ("Deuteronilus Mensae", 43.9, 22.6, "Glacier area studied by Plaut 2009; coordinates from our plan (section 5)."),
    ("Arsia Mons caves", -5.5332, 241.3931,
     "Cave opening APC075, noted as 'Jeanne' (one of the seven openings in Cushing 2007), from the USGS Mars Global Cave Candidate Catalog; the summit (8.35° S, 239.91° E) is about 150 km away."),
]


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


def dci_cell(lat, lon, ppd=16):
    return int((90 - lat) * ppd), int(((lon + 180) % 360) * ppd)


def val(value, source, url, kind, note=None):
    v = {"value": value, "source": source, "url": url, "kind": kind}
    if note:
        v["note"] = note
    return v


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


def terrain_values(dem, spacing_m, px, source, url, note):
    dem = resample(dem, spacing_m[0], spacing_m[1], px)
    return {k: val(v, source, url, "computed", note) for k, v in terrain_metrics(dem, px).items()}


def moon_target(name, feature, rule, anchor_note, files):
    lat, lon = moon_anchor(feature, rule)
    gaz = GAZETTEER_URL.format(GAZETTEER[feature][3])
    values = {}
    with rasterio.open(files["lola"]) as ds:
        dem = polar_window(ds, lat, lon)
        spacing = ds.res[0] / polar_scale(lat)
    values.update(terrain_values(
        dem, (spacing, spacing), 240, "LRO LOLA LDEM_75S_240M", LOLA_URL,
        "10 km window at the anchor, polar stereographic 240 m grid, slopes at 240 m."))
    with rasterio.open(files["winter"]) as ds:
        tmin = polar_window(ds, lat, lon)
    with rasterio.open(files["summer"]) as ds:
        tmax = polar_window(ds, lat, lon)
    winter_url, summer_url = DIVINER_URL.format("winter_min"), DIVINER_URL.format("summer_max")
    values["t_min_k"] = val(rnd(np.nanmedian(tmin), 1), "LRO Diviner polar winter minimum", winter_url, "computed",
                            "Median over the 10 km window of the winter minimum surface temperature.")
    values["t_min_coldest_k"] = val(rnd(np.nanmin(tmin), 1), "LRO Diviner polar winter minimum", winter_url, "computed",
                                    "Coldest pixel in the 10 km window.")
    values["t_max_k"] = val(rnd(np.nanmedian(tmax), 1), "LRO Diviner polar summer maximum", summer_url, "computed",
                            "Median over the 10 km window of the summer maximum surface temperature.")
    coolest_summer = np.nanmin(tmax)
    values["frozen_months"] = val(
        12 if coolest_summer < 273 else None, "LRO Diviner polar summer maximum", summer_url, "derived",
        f"The window's coolest spot peaks at {coolest_summer:.0f} K in summer, "
        + ("below 273 K, so it stays frozen all year." if coolest_summer < 273
           else "above 273 K; the maps give no month-by-month count."))
    with rasterio.open(files["lit"]) as ds:
        lit = polar_window(ds, lat, lon)
    values["lit_share"] = val(rnd(np.nanmax(lit), 3), "LOLA/PGDA average visibility AVGVISIB_75S_120M", PGDA_URL, "computed",
                              "Best-lit 120 m pixel in the 10 km window, as a fraction of time (0–1), at the surface.")
    values["lit_share_median"] = val(rnd(np.nanmedian(lit), 3), "LOLA/PGDA average visibility AVGVISIB_75S_120M", PGDA_URL,
                                     "computed", "Median over the 10 km window, fraction of time (0–1).")
    values["noon_sun_deg"] = val(round(90 - abs(lat), 2), "90 − |latitude|", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html", "derived",
                                 "Mean sun height at the anchor; the Moon's 1.54° tilt moves it about ±1.5° over the year.")
    values["sun_height_min_deg"] = val(2, "NASA Artemis overview for Space Apps 2025", ARTEMIS_URL, "published")
    values["sun_height_max_deg"] = val(7, "NASA Artemis overview for Space Apps 2025", ARTEMIS_URL, "published")
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


MARS_CLIMATE = {
    "Gale": {
        "daily_swing_c": val(70, "NASA/JPL, REMS air temperature, Aug 2012–Feb 2013",
                             "https://science.nasa.gov/resource/steady-temperatures-at-mars-gale-crater", "derived",
                             "Daily highs about 0 °C and lows about −70 °C over Curiosity's first ~200 sols."),
        "t_min_air_c": val(-70, "NASA/JPL, REMS air temperature, Aug 2012–Feb 2013",
                           "https://science.nasa.gov/resource/steady-temperatures-at-mars-gale-crater", "published",
                           "Typical pre-dawn low, first ~200 sols."),
        "t_min_ground_c": val(-103, "Gómez-Elvira et al. 2017, REMS ground temperature",
                              "https://www-mars.lmd.jussieu.fr/granada2017/abstracts/gomez-elvira_granada2017.pdf",
                              "published", "Daily ground minima span about 170–210 K over two Mars years; 170 K is −103 °C."),
    },
    "Jezero": {
        "daily_swing_c": val(52, "Rodríguez-Manfredi et al. 2023, MEDA",
                             "https://www.nature.com/articles/s41561-022-01084-0", "derived",
                             "Twice the published 26 K half-amplitude of the daily air-temperature cycle (first 250 sols)."),
        "t_min_air_c": val(None, "Rodríguez-Manfredi et al. 2023, MEDA",
                           "https://www.nature.com/articles/s41561-022-01084-0", "published",
                           "No single coldest air temperature is stated in the text; not read off figures."),
        "t_min_ground_c": val(None, "Rodríguez-Manfredi et al. 2023, MEDA",
                              "https://www.nature.com/articles/s41561-022-01084-0", "published",
                              "No single coldest ground temperature is stated in the text; not read off figures."),
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


def mars_target(name, lat, lon, anchor_note, files, grs_rows, dci):
    lon = lon180(lon)
    values = {}
    note = ("10 km window, slopes at 200 m. The blend is HRSC (~50–100 m) where HRSC exists, "
            "otherwise MOLA only (~463 m), so slopes there are smoothed.")
    try:
        with rasterio.open("/vsicurl/" + MARS_DEM_URL) as ds:
            dem = read_window(ds, geo_bounds(lat, lon, HALF, MARS_R))
            dy = math.radians(ds.res[1]) * MARS_R
        values.update(terrain_values(dem, (dy * math.cos(math.radians(lat)), dy), 200,
                                     "USGS HRSC–MOLA blended DEM 200 m", MARS_DEM_URL, note))
    except rasterio.errors.RasterioIOError as e:
        for k in ("slope_median_deg", "slope_p90_deg", "share_under_10", "share_under_5", "relief_m"):
            values[k] = val(None, "USGS HRSC–MOLA blended DEM 200 m", MARS_DEM_URL, "computed", f"Read failed: {e}")
    weh, sigma = grs_value(grs_rows, lat, lon)
    values["weh_pct"] = val(weh, "Mars Odyssey GRS water-equivalent hydrogen (H2O_SR_5X5)", GRS_URL, "computed",
                            f"5° bin containing the site, smoothed over 10°; weight % of the top ~1 m; ± {sigma} (1σ)."
                            if weh is not None else "No GRS value for this bin.")
    if dci is None:
        values["dci"] = val(None, "TES dust cover index", DCI_URL, "computed", "File not available.")
    else:
        r, c = dci_cell(lat, lon)
        block = dci[r - 1:r + 2, c - 1:c + 2]
        block = block[block > 0.85]
        values["dci"] = val(rnd(np.median(block), 3) if block.size else None, "TES dust cover index, Ruff & Christensen 2002",
                            DCI_URL, "computed",
                            "Median of the 3×3 pixels (16 per degree) at the site; below ~0.94 means dusty, above ~0.96 dust-free.")
    climate = MARS_CLIMATE.get(name)
    for k in ("daily_swing_c", "t_min_air_c", "t_min_ground_c"):
        values[k] = climate[k] if climate else val(None, "none", None, "published",
                                                   "No surface measurement at this site.")
    values["noon_sun_deg"] = val(round(90 - abs(lat), 2), "90 − |latitude|", "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html", "derived",
                                 "Mean noon sun height; Mars's 25.2° tilt moves it up to ±25° over the year.")
    return {"id": "mars-" + kebab(name), "body": "mars", "name": name, "lat": round(lat, 4), "lon": round(lon, 4),
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


def main():
    files = {
        "lola_img": fetch(LOLA_URL, "ldem_75s_240m.img"),
        "lola": fetch(LOLA_URL.replace(".img", ".lbl"), "ldem_75s_240m.lbl"),
        "winter": fetch(DIVINER_URL.format("winter_min"), "polar_south_80_winter_min-float.tif"),
        "summer": fetch(DIVINER_URL.format("summer_max"), "polar_south_80_summer_max-float.tif"),
        "lit": fetch(PGDA_URL, "AVGVISIB_75S_120M_201608.TIF"),
    }
    grs = load_grs(fetch(GRS_URL, "h2o_sr_5x5.tab"))
    dci = load_dci(fetch(DCI_URL, "dci_lo_ice_dust_16ppd_shifted.pds"))
    targets = [moon_target(*m, files) for m in MOON]
    targets += [mars_target(*m, files, grs, dci) for m in MARS]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"generated": datetime.date.today().isoformat(), "targets": targets},
                              indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for t in targets:
        v = t["values"]
        print(t["id"], t["lat"], t["lon"], v["slope_median_deg"]["value"], v["share_under_10"]["value"],
              v.get("t_min_k", v.get("weh_pct"))["value"], v.get("lit_share", v.get("dci"))["value"])


if __name__ == "__main__":
    main()

import datetime
import hashlib
import json
import re
from itertools import product
from pathlib import Path

from pipeline.challenges import CANT_COPY, CHALLENGES, TERRAIN_SCALE, TRAITS
from pipeline.scoring import combine, earth_rank

HERE = Path(__file__).resolve().parent
DERIVED = HERE / "derived"
OUT = HERE.parent / "site" / "public" / "data" / "app.json"

SAMPLE_FALLBACK = {"cold": {"mars": (-110, -75)}, "day_swing": {"mars": (50, 85)}}
VALIDATION_GROUPS = {
    "moon": [
        ("moon-analog", "Polar and highland analogs"),
        ("moon-basalt", "Basalt and crater training sites"),
        ("ordinary", "Ordinary places"),
    ],
    "mars": [
        ("mars-analog", "Known Mars analogs"),
        ("desert", "Plain deserts"),
        ("ordinary", "Ordinary places"),
    ],
}

FIRST_RUN = {
    "moon": "First run (14 Nov, each trait counted once, air temperatures): known analog beat an ordinary place in 97% of pairs.",
    "mars": "First run (14 Nov, each trait counted once, air temperatures): 43% against ordinary places and 17% against plain deserts, so it failed.",
}

VALIDATION_NOTES = {
    "moon": "Not passed. Haughton crater ranks top, but after review we added four cold ordinary places (Yakutsk taiga, Central Finland forest, Saskatchewan prairie, West Siberian plain), and they score as high as Mistastin and Lofoten. Cold, frozen ground and a low sun don't tell a polar analog apart from a cold farm or forest. Rock would: the Moon's highlands are feldspar-rich, but our rock values are still samples, so they are left out of this check. Teide, Mauna Kea and Lanzarote rank low, as expected for warm volcanic sites that train for the Moon's dark plains.",
    "mars": "Close, not passed on all places. Adding NASA bare-ground and dust data and counting each challenge once lifted the known analogs from 43% to 79% against ordinary places (pass mark 80%) and from 17% to 54% against plain deserts (pass mark 60%). The held-out half of the analogs, which the change was not tuned on, passes both marks (82% and 65%). Cold forests (Yakutsk, West Siberia) still score high, and three sandy deserts (Rub' al Khali, Grand Erg Oriental, Thar) beat many analogs because they are dry, bare and dusty. Minerals (clays, sulfates) would separate them, and those are still samples.",
}


def sample_value(key, trait, side):
    lo, hi = TRAITS[trait]["sample"][side] if side in TRAITS[trait].get("sample", {}) else SAMPLE_FALLBACK[trait][side]
    h = int(hashlib.sha256(f"{key}|{trait}".encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return round(lo + (hi - lo) * h, 2)


def body_traits(body):
    seen = []
    for c in CHALLENGES[body]:
        for p in c["parts"]:
            seen += [t for t in p["traits"] if t not in seen]
    return seen


def earth_values(values, body):
    out = {}
    for t in body_traits(body):
        spec = TRAITS[t]
        if "earth" not in spec:
            continue
        keys = spec["earth"]
        if keys[0] == "terrain":
            out[t] = values[TERRAIN_SCALE[body][0]].get(keys[1])
        else:
            out[t] = next((values[k] for k in keys if values.get(k) is not None), None)
    return out


def with_samples(key, body, real):
    out = {}
    for t in body_traits(body):
        if "earth" not in TRAITS[t]:
            out[t] = {"value": sample_value(key, t, "earth"), "sample": True}
        elif real.get(t) is None:
            out[t] = {"value": None, "sample": False, "missing": True}
        else:
            out[t] = {"value": real[t], "sample": False}
    return out


MARS_FACTSHEET = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html"
DIVINER = "https://www.diviner.ucla.edu/science"


def normalize(target):
    v = dict(target["values"])
    if target["body"] == "moon":
        lo, hi = v.get("t_min_k"), v.get("t_max_k")
        if lo and lo.get("value") is not None:
            v["t_min_c"] = {**lo, "value": round(lo["value"] - 273.15, 1), "note": f"{lo['value']} K winter minimum, ground surface"}
        if lo and hi and lo.get("value") is not None and hi.get("value") is not None:
            v["season_swing_c"] = {**hi, "value": round(hi["value"] - lo["value"], 1), "kind": "derived", "note": "summer maximum minus winter minimum"}
        v["bare_share"] = {"value": 1, "source": "no plants: the surface is bare rock and dust", "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html", "kind": "derived"}
    else:
        v["t_min_c"] = v.get("t_min_ground_c") or {"value": None}
        v["daily_swing_c"] = v.get("daily_ground_swing_c") or {"value": None}
        v["bare_share"] = {"value": 1, "source": "no plants: the surface is bare rock and dust", "url": MARS_FACTSHEET, "kind": "derived"}
        v["precip_mm_day"] = {"value": 0, "source": "no liquid rain or snowfall reaches Mars's surface", "url": MARS_FACTSHEET, "kind": "derived"}
        v["frozen_months"] = {"value": 12, "source": "NASA Mars fact sheet: average temperature about −65 °C", "url": MARS_FACTSHEET, "kind": "derived"}
    return v


def target_values(target):
    body = target["body"]
    raw = normalize(target)
    out = {}
    for t in body_traits(body):
        spec = TRAITS[t]
        key = spec.get("target") or spec.get("target_real")
        entry = raw.get(key) if key else None
        if entry and entry.get("value") is not None:
            out[t] = {"value": entry["value"], "sample": False, **{k: entry[k] for k in ("source", "url", "kind", "note") if k in entry}}
        else:
            out[t] = {"value": sample_value(target["id"], t, body), "sample": True}
    return out


SOURCES = [
    {"name": "NASA POWER climatology (MERRA-2, CERES SYN1deg)", "url": "https://power.larc.nasa.gov/", "use": "Earth ground-surface temperatures, yearly and daily swings, frozen months, rain and snow, and haze (aerosol optical depth)", "kind": "real"},
    {"name": "NASA MODIS land cover (MCD12Q1, 2024) via NASA GIBS", "url": "https://nasa-gibs.github.io/gibs-api-docs/", "use": "Earth bare ground: share of each 10 km patch mapped as barren", "kind": "real"},
    {"name": "Copernicus DEM GLO-90 (ESA)", "url": "https://registry.opendata.aws/copernicus-dem/", "use": "Earth slopes and height range, resampled to the Moon's and Mars's map scales", "kind": "real", "partner": True},
    {"name": "LRO LOLA south-pole elevation, 240 m", "url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/", "use": "Moon slopes and height range", "kind": "real"},
    {"name": "LRO Diviner polar temperature maps", "url": "https://www.diviner.ucla.edu/science", "use": "Moon coldest and hottest ground temperatures", "kind": "real"},
    {"name": "NASA PGDA lunar south-pole illumination (LOLA)", "url": "https://pgda.gsfc.nasa.gov/products/69", "use": "Moon share of time in sunlight", "kind": "real"},
    {"name": "HRSC and MOLA blended Mars elevation, 200 m (USGS)", "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m", "use": "Mars slopes and height range", "kind": "real", "partner": True},
    {"name": "Mars Odyssey GRS water-equivalent hydrogen", "url": "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/", "use": "Mars water in the top metre (hydrogen, as ice or in minerals)", "kind": "real"},
    {"name": "MGS TES dust cover index", "url": "https://www.mars.asu.edu/~ruff/DCI/dci.html", "use": "Mars dust cover (shown, not scored)", "kind": "real"},
    {"name": "Curiosity REMS ground temperature (Gómez-Elvira 2017)", "url": "https://www-mars.lmd.jussieu.fr/granada2017/abstracts/gomez-elvira_granada2017.pdf", "use": "Gale coldest ground temperature and day-to-night swing (swing worked out from the published ranges)", "kind": "real"},
    {"name": "Perseverance MEDA and Mastcam-Z (Zorzano 2024, Lemmon 2022)", "url": "https://doi.org/10.1038/s41598-024-57458-4", "use": "Jezero coldest ground temperature and dust in the air", "kind": "real"},
    {"name": "USGS Gazetteer of Planetary Nomenclature", "url": "https://planetarynames.wr.usgs.gov/", "use": "where we place each Artemis region", "kind": "real"},
    {"name": "USGS Mars Global Cave Candidate Catalog", "url": "https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing", "use": "Arsia Mons cave opening", "kind": "real"},
    {"name": "NASA GIBS Blue Marble", "url": "https://nasa-gibs.github.io/gibs-api-docs/", "use": "map background", "kind": "real"},
    {"name": "Sample values", "url": "", "use": "ground strength, rock cover, water in the ground on Earth and the Moon, feldspar-rich rock, clays and sulfates, Mars ground temperatures at Arcadia, Deuteronilus and Arsia, Jezero's day-to-night swing, and dust in the air at every Mars site except Jezero. Placeholders until real data replaces them; never used in the validation check.", "kind": "sample"},
]


def anchor(note):
    if not note:
        return {}
    m = re.search(r"\s*Gazetteer: (https://\S+)", note)
    if not m:
        return {"anchorNote": note}
    return {"anchorNote": note[: m.start()] + note[m.end():], "anchorUrl": m.group(1).rstrip(".")}


def load():
    sites = json.loads((HERE / "sites.json").read_text(encoding="utf-8"))
    earth = {s["id"]: s["values"] for s in json.loads((DERIVED / "earth_sites.json").read_text(encoding="utf-8"))["sites"]}
    reference = json.loads((DERIVED / "earth_reference.json").read_text(encoding="utf-8"))["points"]
    targets = json.loads((DERIVED / "targets.json").read_text(encoding="utf-8"))["targets"]
    return sites, earth, reference, targets


def challenge_traits(challenge):
    return [t for p in challenge["parts"] for t in p["traits"]]


def challenge_targets(challenge, tvals):
    ideal = {t: {"value": v, "sample": False, "ideal": True} for t, v in challenge.get("ideal", {}).items()}
    return {**tvals, **ideal}


def score_challenge(challenge, svals, ref_vals, tvals, real_only=False):
    traits = challenge_traits(challenge)
    if real_only:
        traits = [t for t in traits if "earth" in TRAITS[t] and not tvals[t]["sample"]]
    if not traits:
        return None
    ranks = {t: earth_rank(svals[t]["value"], tvals[t]["value"], [r[t]["value"] for r in ref_vals]) for t in traits}
    score = combine(ranks, {t: 1 for t in traits})
    if score is None:
        return None
    sample = any(svals[t]["sample"] or tvals[t]["sample"] for t in traits)
    return {"score": round(score, 3), "sample": sample, "ranks": {t: None if r is None else round(r, 3) for t, r in ranks.items()}}


def is_preview(challenge, tvals):
    traits = challenge_traits(challenge)
    return bool(traits) and all("earth" not in TRAITS[t] or tvals[t]["sample"] for t in traits)


def held_out(site_id):
    return int(hashlib.sha256(f"holdout|{site_id}".encode()).hexdigest()[:8], 16) % 2 == 0


def validation(body, sites, site_vals, ref_vals, targets):
    real = [t for t in body_traits(body) if "earth" in TRAITS[t]]
    body_targets = [t for t in targets if t["body"] == body]
    scored = [c for c in CHALLENGES[body] if c["parts"] and "ideal" not in c]

    def overall(vals):
        best = 0
        for tg in body_targets:
            per = {}
            for c in scored:
                r = score_challenge(c, vals, ref_vals, tg["_values"], real_only=True)
                if r:
                    per[c["id"]] = r["score"]
            if per:
                best = max(best, combine(per, {k: 1 for k in per}) or 0)
        return best

    ref_scores = sorted(overall(r) for r in ref_vals)
    rows = []
    for s in sites:
        sc = overall(site_vals[s["id"]])
        pct = sum(r < sc for r in ref_scores) / len(ref_scores)
        rows.append({"site": s["id"], "groups": s["groups"], "rank": round(pct, 3), "heldOut": held_out(s["id"])})
    groups = []
    for gid, label in VALIDATION_GROUPS[body]:
        groups.append({"id": gid, "label": label, "points": [r for r in rows if gid in r["groups"]]})

    def wins(a, b, only_held_out=False):
        pa = [r["rank"] for r in rows if a in r["groups"] and (r["heldOut"] or not only_held_out)]
        pb = [r["rank"] for r in rows if b in r["groups"]]
        total = sum((x > y) + 0.5 * (x == y) for x, y in product(pa, pb))
        return round(total / (len(pa) * len(pb)), 3)

    analog = VALIDATION_GROUPS[body][0][0]
    pairs = [("ordinary", "an ordinary place", 0.8)] + ([("desert", "a plain desert", 0.6)] if body == "mars" else [])
    checks = []
    for other, words, mark in pairs:
        checks.append({"label": f"Known analog beats {words}", "value": wins(analog, other), "pass_mark": mark})
        checks.append({"label": f"Held-out half only: beats {words}", "value": wins(analog, other, True), "pass_mark": mark})
    for c in checks:
        c["passed"] = c["value"] >= c["pass_mark"]
    return {"traits": real, "challenges": [c["id"] for c in scored], "groups": groups, "checks": checks, "note": VALIDATION_NOTES[body], "firstRun": FIRST_RUN[body]}


def build():
    sites, earth, reference, targets = load()
    for tg in targets:
        tg["_values"] = target_values(tg)
    site_vals = {b: {s["id"]: with_samples(s["id"], b, earth_values(earth[s["id"]], b)) for s in sites} for b in CHALLENGES}
    ref_vals = {b: [with_samples(f"ref{i}", b, earth_values(p["values"], b)) for i, p in enumerate(reference)] for b in CHALLENGES}

    results = {}
    previews = {}
    for tg in targets:
        body = tg["body"]
        per = {}
        for c in CHALLENGES[body]:
            tv = challenge_targets(c, tg["_values"])
            rows = []
            for s in sites:
                r = score_challenge(c, site_vals[body][s["id"]], ref_vals[body], tv)
                if r:
                    rows.append({"site": s["id"], **r})
            rows.sort(key=lambda r: -r["score"])
            per[c["id"]] = rows
            if is_preview(c, tv):
                previews.setdefault(tg["id"], []).append(c["id"])
        results[tg["id"]] = per

    out_targets = [
        {k: tg[k] for k in ("id", "body", "name", "lat", "lon") if k in tg}
        | anchor(tg.get("anchor_note")) | {"facts": tg.get("facts", []), "values": tg["_values"], "extra": {k: tg["values"].get(k) for k in ("lit_share", "lit_share_median", "dci", "weh_pct", "t_min_coldest_k") if tg["values"].get(k)}}
        for tg in targets
    ]
    out_sites = [
        {
            "id": s["id"], "name": s["name"], "country": s["country"], "lat": s["lat"], "lon": s["lon"],
            "groups": s["groups"], "coordsEstimate": s["coords_estimate"], "coordSource": s.get("coord_source"), "coordNote": s.get("coord_note"),
            "values": {b: site_vals[b][s["id"]] for b in CHALLENGES},
            "context": {k: earth[s["id"]].get(k) for k in ("wind_ms", "elevation_m", "rh_pct", "sun_kwh_m2_day", "lit_share")},
        }
        for s in sites
    ]
    app = {
        "generated": datetime.date.today().isoformat(),
        "traits": TRAITS,
        "challenges": CHALLENGES,
        "cantCopy": CANT_COPY,
        "terrainScale": {b: v[1] for b, v in TERRAIN_SCALE.items()},
        "referenceSize": len(reference),
        "targets": out_targets,
        "sites": out_sites,
        "results": results,
        "previews": previews,
        "sources": SOURCES,
        "validation": {b: validation(b, sites, site_vals[b], ref_vals[b], targets) for b in CHALLENGES},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(app, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return app


if __name__ == "__main__":
    a = build()
    print(OUT, OUT.stat().st_size // 1024, "KB")
    for b, v in a["validation"].items():
        print(b, [(c["label"], c["value"], c["passed"]) for c in v["checks"]])

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

VALIDATION_NOTES = {
    "moon": "Haughton crater ranks highest. Mistastin sits lower because its listed point falls on the crater lake, which reads as flat ground; its coordinates are still an estimate. Teide, Mauna Kea and Lanzarote rank low, as expected: they are warm volcanic sites used to train for the Moon's dark plains, not its cold polar highlands.",
    "mars": "Not passed yet, and we show it rather than retune. The five Mars targets are flat landing sites, and three of the seven real traits measure flatness, so flat farmland (Ukraine, Iowa) scores well and rugged analogs like the Dry Valleys score low. Two fixes are planned: add a bare-ground trait from NASA MODIS vegetation data, and count each challenge once instead of each trait. Any change will be judged on a held-out half of the known analogs.",
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
        path = spec["earth"]
        v = values[TERRAIN_SCALE[body][0]] if path[0] == "terrain" else values
        out[t] = v.get(path[-1])
    return out


def with_samples(key, body, real):
    out = {}
    for t in body_traits(body):
        if t in real and real[t] is not None:
            out[t] = {"value": real[t], "sample": False}
        else:
            out[t] = {"value": sample_value(key, t, "earth"), "sample": True}
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
    else:
        v["t_min_c"] = v.get("t_min_air_c") or {"value": None}
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
    {"name": "NASA POWER climatology (MERRA-2, CERES SYN1deg)", "url": "https://power.larc.nasa.gov/", "use": "Earth temperature, swings, frozen months, rain and snow, wind", "kind": "real"},
    {"name": "Copernicus DEM GLO-90 (ESA)", "url": "https://registry.opendata.aws/copernicus-dem/", "use": "Earth slopes and height range, resampled to the Moon's and Mars's map scales", "kind": "real", "partner": True},
    {"name": "LRO LOLA south-pole elevation, 240 m", "url": "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/", "use": "Moon slopes and height range", "kind": "real"},
    {"name": "LRO Diviner polar temperature maps", "url": "https://www.diviner.ucla.edu/science", "use": "Moon coldest and hottest ground temperatures", "kind": "real"},
    {"name": "NASA PGDA lunar south-pole illumination (LOLA)", "url": "https://pgda.gsfc.nasa.gov/products/69", "use": "Moon share of time in sunlight", "kind": "real"},
    {"name": "HRSC and MOLA blended Mars elevation, 200 m (USGS)", "url": "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m", "use": "Mars slopes and height range", "kind": "real", "partner": True},
    {"name": "Mars Odyssey GRS water-equivalent hydrogen", "url": "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/", "use": "Mars ice in the ground", "kind": "real"},
    {"name": "MGS TES dust cover index", "url": "https://www.mars.asu.edu/~ruff/DCI/dci.html", "use": "Mars dust cover", "kind": "real"},
    {"name": "Curiosity REMS and Perseverance MEDA (published)", "url": "https://science.nasa.gov/resource/steady-temperatures-at-mars-gale-crater", "use": "Mars temperatures at Gale and Jezero", "kind": "real"},
    {"name": "USGS Gazetteer of Planetary Nomenclature", "url": "https://planetarynames.wr.usgs.gov/", "use": "where we place each Artemis region", "kind": "real"},
    {"name": "USGS Mars Global Cave Candidate Catalog", "url": "https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing", "use": "Arsia Mons cave opening", "kind": "real"},
    {"name": "NASA GIBS Blue Marble", "url": "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api", "use": "map background", "kind": "real"},
    {"name": "Sample values", "url": "", "use": "ground strength, rock cover, ice in the ground (Earth and Moon), feldspar-rich rock, clays and sulfates, dust-lifting days, and Mars temperatures at Arcadia, Deuteronilus and Arsia. Placeholders until real data replaces them.", "kind": "sample"},
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


def rank_all(site_vals, ref_vals, tvals, traits):
    ranks = {}
    for t in traits:
        ref = [r[t]["value"] for r in ref_vals]
        ranks[t] = earth_rank(site_vals[t]["value"], tvals[t]["value"], ref)
    return ranks


def score_challenge(challenge, ranks, svals, tvals):
    traits = [t for p in challenge["parts"] for t in p["traits"]]
    if not traits:
        return None
    score = combine({t: ranks[t] for t in traits}, {t: 1 for t in traits})
    sample = any(svals[t]["sample"] or tvals[t]["sample"] for t in traits)
    return {"score": round(score, 3), "sample": sample, "ranks": {t: round(ranks[t], 3) for t in traits}}


def validation(body, sites, site_vals, ref_vals, targets):
    real = [t for t in body_traits(body) if "earth" in TRAITS[t]]
    body_targets = [t for t in targets if t["body"] == body]

    def overall(vals):
        best = 0
        for tg in body_targets:
            tv = tg["_values"]
            use = [t for t in real if not tv[t]["sample"]]
            ranks = {t: earth_rank(vals[t]["value"], tv[t]["value"], [r[t]["value"] for r in ref_vals]) for t in use}
            best = max(best, combine(ranks, {t: 1 for t in use}))
        return best

    ref_scores = sorted(overall(r) for r in ref_vals)
    rows = []
    for s in sites:
        sc = overall(site_vals[s["id"]])
        pct = sum(r < sc for r in ref_scores) / len(ref_scores)
        rows.append({"site": s["id"], "groups": s["groups"], "rank": round(pct, 3)})
    groups = []
    for gid, label in VALIDATION_GROUPS[body]:
        groups.append({"id": gid, "label": label, "points": [r for r in rows if gid in r["groups"]]})

    def wins(a, b):
        pa = [r["rank"] for r in rows if a in r["groups"]]
        pb = [r["rank"] for r in rows if b in r["groups"]]
        total = sum((x > y) + 0.5 * (x == y) for x, y in product(pa, pb))
        return round(total / (len(pa) * len(pb)), 3)

    analog = VALIDATION_GROUPS[body][0][0]
    checks = [{"label": "Known analog beats an ordinary place", "value": wins(analog, "ordinary"), "pass_mark": 0.8}]
    if body == "mars":
        checks.append({"label": "Known analog beats a plain desert", "value": wins(analog, "desert"), "pass_mark": 0.6})
    for c in checks:
        c["passed"] = c["value"] >= c["pass_mark"]
    return {"traits": real, "groups": groups, "checks": checks, "note": VALIDATION_NOTES[body]}


def build():
    sites, earth, reference, targets = load()
    for tg in targets:
        tg["_values"] = target_values(tg)
    site_vals = {b: {s["id"]: with_samples(s["id"], b, earth_values(earth[s["id"]], b)) for s in sites} for b in CHALLENGES}
    ref_vals = {b: [with_samples(f"ref{i}", b, earth_values(p["values"], b)) for i, p in enumerate(reference)] for b in CHALLENGES}

    results = {}
    for tg in targets:
        body = tg["body"]
        traits = body_traits(body)
        per = {}
        for c in CHALLENGES[body]:
            rows = []
            for s in sites:
                sv = site_vals[body][s["id"]]
                ranks = rank_all(sv, ref_vals[body], tg["_values"], traits)
                r = score_challenge(c, ranks, sv, tg["_values"])
                if r:
                    rows.append({"site": s["id"], **r})
            rows.sort(key=lambda r: -r["score"])
            per[c["id"]] = rows
        results[tg["id"]] = per

    out_targets = [
        {k: tg[k] for k in ("id", "body", "name", "lat", "lon") if k in tg}
        | anchor(tg.get("anchor_note")) | {"facts": tg.get("facts", []), "values": tg["_values"], "extra": {k: tg["values"].get(k) for k in ("lit_share", "lit_share_median", "dci", "weh_pct", "t_min_coldest_k") if tg["values"].get(k)}}
        for tg in targets
    ]
    out_sites = [
        {
            "id": s["id"], "name": s["name"], "country": s["country"], "lat": s["lat"], "lon": s["lon"],
            "groups": s["groups"], "coordsEstimate": s["coords_estimate"],
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

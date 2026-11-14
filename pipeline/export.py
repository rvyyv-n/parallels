import argparse
import datetime
import json
import math
from pathlib import Path

import numpy as np
from scipy import ndimage

from pipeline import publish, validate
from pipeline.assemble import DERIVED, ROOT, SHAPE, build, grid_lat, grid_lon, known_analogs, load_config, load_points, load_stage, terrain_rules
from pipeline.score import RULE, score_target, target_value, yearround_rule
from pipeline.traits import BODIES, CANT_COPY, CHALLENGES, FILTERS, INPUTS, NOT_IN_VERSION, TERRAIN_TYPES, TRAITS

OUT = ROOT / "site" / "public" / "data"
TARGETS = ROOT / "pipeline" / "derived" / "targets_v1.json"
SITES = ROOT / "pipeline" / "sites.json"
CAVES = ROOT / "pipeline" / "caves.json"

RANGE = {"u8": (0, 255, np.uint8), "u16": (0, 65535, np.uint16), "i16": (-32768, 32767, np.int16), "f32": (None, None, np.float32)}
NODATA = {"u8": 255, "u16": 65535, "i16": -32768}

CELL_COLUMNS = [
    ("lat", "i16", 0.01, 0),
    ("lon", "i16", 0.01, 0),
    ("ts_coldest", "i16", 0.01, 0),
    ("swing_year", "i16", 0.01, 0),
    ("swing_day_ground", "i16", 0.01, 0),
    ("swing_day_air", "i16", 0.01, 0),
    ("frozen_months", "u8", 0.1, 0),
    ("usable", "u8", 0.1, 0),
    ("aridity", "u16", 0.001, 0),
    ("sun_height", "i16", 0.01, 0),
    ("aod", "u16", 0.001, 0),
    ("m_freeze", "u16", 1, 0),
    ("m_rain", "u16", 1, 0),
    ("m_best", "u16", 1, 0),
    ("region", "i16", 1, 0),
    ("slope_240", "u16", 0.01, 0),
    ("slope_200", "u16", 0.01, 0),
    ("safe10_240", "u8", 0.4, 0),
    ("safe10_200", "u8", 0.4, 0),
    ("flat5_240", "u8", 0.4, 0),
    ("relief_240", "u16", 1, 0),
    ("relief_200", "u16", 1, 0),
    ("rock_plutonic", "u8", 0.4, 0),
    ("rock_volcanic", "u8", 0.4, 0),
    ("bare_share", "u8", 0.4, 0),
    ("minerals_seen", "u8", 1, 0),
    ("terrain_type", "u8", 1, 0),
    ("ice", "u8", 0.4, 0),
    ("cluster", "u8", 1, 0),
    ("nearest_analog_km", "u16", 1, 0),
]

CONSTANT_DATASETS = [
    {"id": "computed", "name": "Computed by us from the datasets named on each value", "agency": "computed", "url": None, "licence": "Same as the source data", "used_for": "Ideal values, ranks and scores"},
    {"id": "nasa-fact-sheets", "name": "NASA planetary fact sheets (NSSDCA)", "agency": "NASA", "url": "https://nssdc.gsfc.nasa.gov/planetary/factsheet/", "licence": "Public domain (NASA)", "used_for": "Gravity, air and the plain facts behind the dryness and bare-ground targets", "archive": "NASA NSSDCA"},
    {"id": "nasa-moon-composition", "name": "NASA Science: the Moon's composition", "agency": "NASA", "url": "https://science.nasa.gov/moon/composition/", "licence": "Public domain (NASA)", "used_for": "The south pole's pale highland rock", "archive": "NASA Science"},
    {"id": "mars-jezero-minerals", "name": "Jezero crater minerals: Horgan et al. 2020 (Icarus) and Scheller et al. 2022 (Science)", "agency": "other", "url": "https://doi.org/10.1126/science.abo5204", "licence": "Cited published result", "archive": "published paper", "used_for": "Which mineral groups are reported at Jezero"},
    {"id": "farley-2022", "name": "Farley et al. 2022, aqueously altered igneous rocks sampled on the floor of Jezero crater (Science)", "agency": "other", "url": "https://doi.org/10.1126/science.abo2196", "licence": "Cited published result", "archive": "published paper", "used_for": "Mars's basalt crust and Jezero's igneous crater floor, the target for the volcanic rock trait"},
    {"id": "mars-gale-minerals", "name": "Gale crater minerals: Rampe et al. 2020 (Geochemistry)", "agency": "other", "url": "https://doi.org/10.1016/j.chemer.2020.125605", "licence": "Cited published result", "archive": "published paper", "used_for": "Which mineral groups are reported at Gale"},
    {"id": "golombek-2020", "name": "Golombek et al. 2020, Mars landing-site thermal inertia rule", "agency": "other", "url": "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2020JE006502", "licence": "Cited published result", "archive": "published paper", "used_for": "The ground-strength label on Mars"},
]


LAYOUT = (
    "Each target file holds rank:<trait> and ch:<challenge> as one byte (0-250 is 0-1, 255 is no data), "
    "cov:<challenge> as one byte (0-100, the percent of the challenge's trait weight with data; 0 when the challenge has no data), "
    "and score:<filter> and score:<filter>:yr as two bytes (0-10000 is 0-1, 65535 is not ranked). "
    "Hand-set weights use the same 70% gate: the sum of each challenge weight times its cov, over the sum of the challenge weights."
)

SHOWN_KEYS = {"moon": ["lit_share", "psr_share", "thermal_inertia_moon_wide", "t_min_k", "t_max_k", "t_min_coldest_k"], "mars": ["weh_pct", "dci", "thermal_inertia", "ground_strength_note"]}

RESOLUTION = {
    "power_merra2": "about 50 km (MERRA-2 0.5 x 0.625 degree, averaged onto our grid)",
    "hargreaves": "about 50 km (MERRA-2 0.5 x 0.625 degree, averaged onto our grid)",
    "power_syn1deg": "about 110 km (CERES SYN1deg 1 degree, averaged onto our grid)",
}


def clean(x):
    if isinstance(x, dict):
        return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if isinstance(x, (np.floating, float)):
        return None if not math.isfinite(float(x)) else float(x)
    if isinstance(x, np.integer):
        return int(x)
    if isinstance(x, np.bool_):
        return bool(x)
    return x


def write_json(path, data):
    path.write_text(json.dumps(clean(data), ensure_ascii=False, allow_nan=False, separators=(",", ":")), encoding="utf8")


def encode(values, dtype, scale, add):
    lo, hi, np_type = RANGE[dtype]
    v = np.asarray(values, float)
    if dtype == "f32":
        return v.astype("<f4")
    nod = NODATA[dtype]
    q = np.round((v - add) / scale)
    ok = np.isfinite(q)
    top = hi - 1 if nod == hi else hi
    bottom = lo + 1 if nod == lo else lo
    q = np.clip(np.where(ok, q, 0), bottom, top)
    return np.where(ok, q, nod).astype(np.dtype(np_type).newbyteorder("<"))


def decode(raw, col):
    v = raw.astype(float)
    if col["dtype"] != "f32":
        v[raw == col["nodata"]] = np.nan
    return v * col.get("scale", 1) + col.get("add", 0)


def write_bin(path, n, columns):
    parts, meta, offset = [], [], 0
    for cid, values, dtype, scale, add in columns:
        pad = (-offset) % 4
        if pad:
            parts.append(b"\0" * pad)
            offset += pad
        data = encode(values, dtype, scale, add).tobytes()
        col = {"id": cid, "dtype": dtype, "offset": offset}
        if dtype != "f32":
            col.update(scale=scale, add=add, nodata=NODATA[dtype])
        meta.append(col)
        parts.append(data)
        offset += len(data)
    path.write_bytes(b"".join(parts))
    return {"file": path.name, "n": n, "columns": meta}


def read_bin(path, binfile):
    buf = Path(path).read_bytes()
    out = {}
    for c in binfile["columns"]:
        dt = np.dtype({"u8": "u1", "u16": "<u2", "i16": "<i2", "f32": "<f4"}[c["dtype"]])
        raw = np.frombuffer(buf, dt, binfile["n"], c["offset"])
        out[c["id"]] = decode(raw, c)
    return out


def column_meta(metas, column):
    if column == "minerals_seen":
        cols = metas.get("surface", {}).get("columns", {})
        key = next((k for k in cols if k.startswith("emit_")), None)
        m = dict(cols.get(key, {}))
        m["stat"] = "mineral groups with any reported abundance in the cell"
        return m
    stage, key = INPUTS[column]
    return metas.get(stage, {}).get("columns", {}).get(key, {})


def trait_entries(metas):
    out = []
    for t in TRAITS:
        first = next(iter(t["column"].values()))
        m = column_meta(metas, first)
        e = {k: t[k] for k in ("id", "label", "unit", "digits", "plain", "column", "scored_by")}
        ds = m.get("dataset", "computed")
        e.update(earth_stat=t.get("earth_stat", m.get("stat", "")), earth_dataset=ds, earth_resolution=RESOLUTION.get(ds, m.get("resolution", "")))
        if t.get("note"):
            e["note"] = t["note"]
        out.append(e)
    return out


def challenge_entries(cfg):
    out = {}
    for body in BODIES:
        rows = []
        for c in CHALLENGES[body]:
            tw = cfg["trait_weights"][body].get(c["id"], {})
            e = {k: c[k] for k in ("id", "name", "question", "what_to_test")}
            if c.get("only"):
                e["only"] = c["only"]
            e["traits"] = [{"id": k, "weight": tw[k][0], "why": tw[k][1]} for k in c["traits"] if k in tw]
            e["labels"] = c["labels"]
            rows.append(e)
        out[body] = rows
    return out


def filter_entries(cfg):
    out = []
    for f in FILTERS:
        fw = cfg["filter_weights"][f["id"]]
        reasons = {f"{b}:{k}": v[1] for b in BODIES for k, v in fw[b].items()}
        if f.get("note"):
            reasons["note"] = f["note"]
        out.append({"id": f["id"], "name": f["name"], "plain": f["plain"], "weights": {b: {k: v[0] for k, v in fw[b].items()} for b in BODIES}, "reasons": reasons})
    return out


def shown_values(target):
    body = target["body"]
    vals = target["values"]
    out = {}
    for k in SHOWN_KEYS[body]:
        v = vals.get(k)
        if v is None:
            continue
        v = dict(v)
        if not isinstance(v.get("value"), (int, float)):
            v["note"] = f"{v.get('value')}: {v.get('note', '')}" if v.get("value") is not None else v.get("note", "")
            v["value"] = None
        out[k] = v
    return out


def target_entry(target, scored, binfile, default=True):
    e = {
        "id": target["id"],
        "body": target["body"],
        "name": target["name"],
        "short": target.get("short", target["name"]),
        "lat": target["lat"],
        "lon": target["lon"],
        "anchor_note": target.get("anchor_note", ""),
        "default": default,
        "bin": binfile,
        "values": scored["values"],
        "shown": shown_values(target),
        "facts": target.get("facts", []),
    }
    if target.get("regions"):
        e["regions"] = [
            {k: r.get(k, "") for k in ("id", "name", "lat", "lon", "anchor_note")} | {"values": score_values(r, target["body"], target["id"])}
            for r in target["regions"]
        ]
    return e


def score_values(region, body, tid):
    pseudo = {"id": tid, "values": region.get("values", {})}
    out = {}
    for t in TRAITS:
        if body in t["column"]:
            v = target_value(t, body, pseudo)
            if v is not None:
                out[t["id"]] = v
    return out


def target_bin(path, n, scored, extra=None):
    cols = [(f"rank:{k}", v, "u8", 0.004, 0) for k, v in scored["ranks"].items()]
    cols += [(f"ch:{k}", v, "u8", 0.004, 0) for k, v in scored["challenges"].items()]
    cols += [(f"cov:{k}", v * 100, "u8", 1, 0) for k, v in scored["coverage"].items()]
    cols += [(f"score:{k}", v, "u16", 0.0001, 0) for k, v in scored["scores"].items()]
    cols += [(k, v, "u8", 1, 0) for k, v in (extra or {}).items()]
    return write_bin(path, n, cols)


def merge_datasets(metas, extra):
    seen, out = set(), []
    for d in [d for m in metas.values() for d in m.get("datasets", [])] + extra + CONSTANT_DATASETS:
        if d["id"] not in seen:
            seen.add(d["id"])
            out.append(d)
    return out


def used_datasets(datasets, metas, entries):
    used = {column_meta(metas, t).get("dataset") for t in INPUTS} | {column_meta(metas, "minerals_seen").get("dataset")}
    for e in entries:
        groups = [e["values"], e["shown"]] + [r["values"] for r in e.get("regions", [])]
        used |= {v["dataset"] for g in groups for v in g.values()}
    return [d for d in datasets if d["id"] in used]


MAIN_ARCHIVES = [
    ("NASA PDS Geosciences Node", "Moon and Mars maps"),
    ("USGS Astrogeology", "the Mars height map"),
    ("NASA POWER on AWS Open Data", "Earth climate"),
    ("Copernicus Data Space / AWS Open Data", "Earth heights, ESA"),
    ("NASA PGDA (Goddard)", "Moon sunlight and shadow"),
]


def benchmarks(datasets, cfg):
    main = [a for a, _ in MAIN_ARCHIVES]
    seen = {d["archive"] for d in datasets if d.get("archive")}
    used = [f"{a} ({what})" for a, what in MAIN_ARCHIVES if a in seen]
    earthdata = "NASA Earthdata (LP DAAC)"
    if earthdata in seen:
        used = [u.replace("NASA POWER on AWS Open Data (Earth climate)", "NASA POWER and NASA Earthdata (Earth climate, land cover and minerals)") for u in used]
    others = sorted(seen - set(main) - {"computed", "published paper", earthdata})
    total = len(seen - {"computed", "published paper"})
    five = f"{total} open data archives are used. These feed the scores: " + ", ".join(used) + "."
    return [
        {"n": 1, "guide_words": "Cross-domain data: at least 3 distinct open data archives (e.g. NASA PDS, USGS, Landsat/Sentinel)", "how": five + (" Also used: " + ", ".join(others) + ", and values cited from published papers." if others else ""), "where": "The data list at the foot of the page names every dataset with a link."},
        {"n": 2, "guide_words": "Geographical scope: map and index at least 4 terrain types: arid basins, high-altitude volcanic fields, salt flats, caves", "how": "Every land cell is checked against rules worked out from the data for five terrain types: arid basin, high-altitude volcanic field, salt flat, frozen ground and cave. A cell that meets no rule has no type. Each type is shown with its rule and its number of cells.", "where": "The terrain-type filter on the map."},
        {"n": 3, "guide_words": "Useful output: web dashboard with similarity rankings, coordinates and data details on the map", "how": "A world map coloured by match, a ranked list with latitude and longitude, and a scorecard giving each value with its dataset and resolution.", "where": "The map, the ranked list and the scorecard."},
        {"n": 4, "guide_words": "Multi-variable scoring: weighting and clustering; thermal inertia, minerals, aridity", "how": "Weighted trait and challenge scores; k-means clusters checked against the terrain types; minerals (NASA EMIT) and aridity are scored. Thermal inertia is shown for Mars as a label (NASA TES map), not scored: Earth's side needs a checked conversion first.", "where": "The scorecard and the \"How we checked it\" section."},
        {"n": 5, "guide_words": "Seasons: monsoons and freeze-thaw cycles in the matching", "how": "Each place shows its best months, freeze-thaw months and rainy months. " + yearround_rule(cfg["scoring"]["yearround_share"]), "where": "The scorecard's seasons strip and the year-round switch."},
        {"n": 6, "guide_words": "Mission filters: filters for rover mobility, life support or habitat-structure testing", "how": "Three mission filters reweight the challenges, and the weights can also be set by hand.", "where": "The mission picker next to the target picker."},
    ]


QUESTIONS = [
    ("How do you handle sun angles and permanent darkness when matching Earth caves or polar canyons?", "Every land cell's noon sun height is worked out from its latitude and ranked against the low sun at the Moon's south pole, from NASA's lighting maps made with LOLA heights. Time in sunlight is shown, not scored, because every place on Earth is lit half the time over a year. Earth has no permanently dark ground outside caves, and the scorecard says so under \"where it breaks\"."),
    ("Which spectroscopy and neutron data link Earth's dry or frozen ground to lunar ice traps?", "Loaded as data: Earth minerals from NASA's EMIT spectrometer, used in the Mars mineral score, and Mars water from Mars Odyssey's neutron and gamma-ray instruments, shown but not scored because Earth has no matching map. The Moon's ice is cited from published LCROSS, LEND and Mini-RF results, not loaded. Earth's frozen ground comes from a NASA POWER temperature rule: yearly average ground temperature below 0 °C."),
    ("How do you compare coarse planetary data with sharp Earth images fairly?", "Everything on Earth goes onto one half-degree grid (about 50 km). Terrain is measured at the planet map's own scale: Earth heights are resampled to 240 m for the Moon and 200 m for Mars before slopes are worked out. Every value shows its real resolution, and climate values are model output at about 50 km, not satellite pixels."),
    ("Which distance measure or clustering scores the match?", "Each trait is ranked by how close a place gets to the target compared with all of Earth's land, counted by area. Challenge scores and the overall score are weighted geometric means, so one weak trait pulls the total down. Separately, k-means clustering groups places with similar values, and we check the groups against the terrain types."),
    ("Caves don't show in surface images: which height maps or LiDAR do you use?", "None can find them: no global cave map exists for Earth, the Moon or Mars. We list known caves and lava tubes with sourced positions, show them on the map and tag their cells, but never score them."),
    ("How do weights change for the hardware being tested?", "Pick a mission filter (rover mobility, life support or habitat structure) and the challenges are reweighted, or set the weights by hand. Dust abrasion stays a label, UV is not in this version, and day-to-night swing is part of Heat swing. We don't compute a weathering index: freeze-thaw months and aridity are our stand-ins for weathering."),
    ("How do you check the rankings against real field sites?", "Known analogs must beat ordinary places and plain deserts, with pass marks committed before the run. The result is shown on the site whether it passes or not, with a held-out half and blind sites that had never been scored."),
]


def uses_text(u):
    if isinstance(u, dict):
        return "; ".join(f"{b.capitalize()}: " + ", ".join(names(b, v)) for b, v in u.items())
    return ", ".join(names("mars", u) if u else [])


def names(body, ids):
    known = {c["id"]: c["name"] for b in BODIES for c in CHALLENGES[b]}
    return [known.get(i, i.capitalize()) for i in ids]


def analog_text(s):
    parts = []
    if s.get("analog_for"):
        parts.append("Analog for: " + s["analog_for"])
    if s.get("used_for"):
        parts.append("Used for: " + uses_text(s["used_for"]) + ".")
    if s.get("used_for_note"):
        parts.append(s["used_for_note"])
    if s.get("used_for_source") and s.get("analog_source") and s["used_for_source"] != s["analog_source"]:
        parts.append("Source for its use: " + s["used_for_source"])
    return " ".join(parts)


def label_points(sites, caves):
    kinds = {"ordinary": "ordinary", "desert": "plain_desert"}
    known = {s["id"] for s in known_analogs(sites)}
    out = []
    for s in sites:
        kind = "known_analog" if s["id"] in known else kinds.get(s["groups"][0], "ordinary")
        p = {"id": s["id"], "name": s["name"], "kind": kind, "lat": s["lat"], "lon": s["lon"], "country": s.get("country"), "groups": s["groups"], "source": s.get("coord_source", "")}
        notes = [analog_text(s), s.get("coord_note")] if kind == "known_analog" else [s.get("coord_note")]
        note = " ".join(x for x in notes if x)
        if note:
            p["note"] = note
        source = s.get("analog_source") or (s.get("used_for_source") if kind == "known_analog" else None)
        if source:
            p["analog_source"] = source
        out.append({k: v for k, v in p.items() if v is not None})
    for c in caves:
        if c.get("body", "earth") != "earth":
            continue
        p = {"id": c["id"], "name": c["name"], "kind": "cave", "lat": c["lat"], "lon": c["lon"], "country": c.get("country"), "note": c.get("note"), "source": c.get("source", c.get("coord_source", "")), "analog_source": c.get("analog_source")}
        out.append({k: v for k, v in p.items() if v is not None})
    return out


KNOWN_COMMITS = {"1.1": "7661981"}
CHANGES = {
    "1.1": "each part of a challenge counts equally, the traits inside a part share its weight, and Mars has a volcanic rock trait",
    "1.2": "it also ranks each trait by the share of land strictly further from the target, with no credit for ties",
}


def method_name(cfg):
    return cfg.get("version", "v1")[1:] if cfg.get("version", "v1") != "v1" else "1.0"


def method_note(name, runs):
    if not runs:
        return f"The map shows method version {name}."
    tried = [r["title"].split("version ")[-1] for r in runs]
    if name == "1.0":
        return "The map shows method version 1.0. Versions " + ", ".join(tried) + " were tried and not adopted, by rules fixed before each was run; see the validation runs."
    steps = [v for v in ("1.1", "1.2") if v <= name]
    text = f"The map shows method version {name}: " + "; ".join(CHANGES[v] for v in steps) + "."
    left = [v for v in tried if v not in steps]
    text += " Each version replaced the one before by a rule fixed before it was run; see the validation runs."
    if left:
        text += " Version " + ", ".join(left) + " was tried and not adopted."
    return text


def chain(method):
    out = []
    while method:
        out.insert(0, method)
        over = json.loads((ROOT / "pipeline" / "config" / f"v{method}.json").read_text(encoding="utf8"))
        parent = over["inherits"].split(":")[0].split(",")[0].strip()
        method = None if parent == "v1.json" else parent[1:-5]
    return out


def export(stages, metas, targets, extra_datasets, sites, caves, cfg, commit, sample, out=OUT, methods=()):
    out.mkdir(parents=True, exist_ok=True)
    cells, info = build(stages, metas, sites, caves, cfg)
    n = len(cells["lat"])
    grid = write_bin(out / "cells.bin", n, [(c, cells[c], d, s, a) for c, d, s, a in CELL_COLUMNS])
    by_id = {t["id"]: t for t in targets}
    scored = {tid: score_target(cells, by_id[tid], cfg) for tid in cfg["default_targets"]}
    val = validate.run(cells, scored, sites, cfg, commit)
    prev_val, prev_name, runs = val, "1.0", []
    for k, (name, mcfg, mcommit) in enumerate(methods):
        scored_new = {tid: score_target(cells, by_id[tid], mcfg) for tid in cfg["default_targets"]}
        val_new = validate.run(cells, scored_new, sites, mcfg, commit, with_misses=True)
        if k == 0:
            run = validate.third_run(prev_val, val_new, mcfg, mcommit)
            val["third_run"] = run
        else:
            run = validate.later_run(prev_val, val_new, mcfg, mcommit, k + 3, prev_name, name, method_name(cfg), CHANGES[name].replace("it also ranks", "ranking"))
            val.setdefault("more_runs", []).append(run)
        val["summary"] += " " + run["summary"]
        runs.append(run)
        if run["adopted"]:
            cfg, scored = mcfg, scored_new
        prev_val, prev_name = val_new, name
    regions = metas.get("climate", {}).get("regions", [])
    stab, sentences, heads = {}, [], {}
    for tid in cfg["default_targets"]:
        t = by_id[tid]
        stab[tid] = publish.stability(scored[tid], cfg, t["body"])
        sentences.append(publish.stability_sentence(t, stab[tid]))
        heads[tid] = publish.headline(cells, scored[tid], cfg, t, regions, FILTERS[0]["id"], cfg["rare_km"])
    val["stability"] = " ".join(sentences)
    entries = []
    for t in targets:
        tid = t["id"]
        if tid in cfg["default_targets"]:
            extra = {f"stable:{f}": publish.stable_column(n, r) for f, r in stab[tid].items()}
            binfile = target_bin(out / f"target-{tid}.bin", n, scored[tid], extra)
            e = target_entry(t, scored[tid], binfile, True)
            if heads[tid][0]:
                e["headline"] = heads[tid][0]
            entries.append(e)
        elif t["body"] == "mars":
            s = score_target(cells, t, cfg)
            entries.append(target_entry(t, s, target_bin(out / f"target-{tid}.bin", n, s), False))
    datasets = used_datasets(merge_datasets(metas, extra_datasets), metas, entries)
    rules = terrain_rules(cfg)
    manifest = {
        "version": 1,
        "method_version": method_name(cfg),
        "method_note": method_note(method_name(cfg), runs),
        "generated": datetime.date.today().isoformat(),
        "sample": sample,
        "grid": grid | {"res_deg": 0.5, "land_rule": cfg["land_rule"]["plain"]},
        "regions": metas.get("climate", {}).get("regions", []),
        "datasets": datasets,
        "traits": trait_entries(metas),
        "challenges": challenge_entries(cfg),
        "filters": filter_entries(cfg),
        "scoring": {"floor": cfg["scoring"]["floor"], "missing_rank": cfg["scoring"]["missing_rank"], "min_weight_with_data": cfg["scoring"]["min_weight_with_data"], "rule": RULE, "layout": LAYOUT, "yearround_rule": yearround_rule(cfg["scoring"]["yearround_share"])},
        "terrain_types": [{"id": i, "key": k, "name": name, "rule": rules[k], "cells": int((cells["terrain_type"] == i).sum())} for i, k, name in TERRAIN_TYPES],
        "clustering": {"k": cfg["clustering"]["k"], "method": f"k-means on standardised trait values (seed {cfg['clustering']['seed']}); cells missing any input are left out", "inputs": cfg["clustering"]["inputs"], "agreement": info["agreement"], "summary": info["summary"]},
        "targets": entries,
        "cant_copy": CANT_COPY,
        "not_in_version": [{"item": i, "reason": r} for i, r in NOT_IN_VERSION],
        "benchmarks": benchmarks(datasets, cfg),
        "questions": [{"n": i + 1, "question": q, "answer": a} for i, (q, a) in enumerate(QUESTIONS)],
    }
    write_json(out / "manifest.json", manifest)
    write_json(out / "labels.json", label_points(sites, caves))
    write_json(out / "validation.json", val)
    return cells, scored, info, heads


def smooth(rng, sigma):
    z = ndimage.gaussian_filter(rng.normal(size=SHAPE), sigma, mode=("nearest", "wrap"))
    return z / z.std()


def synthetic(seed=7):
    rng = np.random.default_rng(seed)
    lat = np.repeat(grid_lat()[:, None], SHAPE[1], axis=1)
    lon = np.repeat(grid_lon()[None, :], SHAPE[0], axis=0)
    blobs = [(50, -100, 22, 35), (25, -102, 10, 12), (-15, -60, 22, 14), (-40, -68, 14, 7), (52, 15, 12, 25), (8, 20, 25, 22), (-20, 25, 14, 12), (50, 90, 22, 55), (25, 78, 10, 12), (25, 45, 10, 12), (15, 105, 10, 8), (-25, 134, 11, 18), (72, -42, 10, 14), (-2, 115, 4, 12), (65, 100, 10, 60)]
    shape = smooth(rng, 3) * 0.15
    inside = np.zeros(SHAPE)
    for la, lo, rla, rlo in blobs:
        inside = np.maximum(inside, 1 - ((lat - la) / rla) ** 2 - ((lon - lo) / rlo) ** 2)
    inside = np.maximum(inside + shape - 0.35, np.where(lat < -72, 1, -1))
    land_frac = np.clip(inside * 8, 0, 1)
    a = np.abs(lat)
    ts_annual = 28 - 0.75 * np.maximum(a - 15, 0) + 4 * smooth(rng, 5) - 25 * (lat < -65)
    swing = np.clip(4 + 0.55 * a + 6 * smooth(rng, 5), 1, None)
    wet = smooth(rng, 6)
    aridity = np.clip(np.exp(wet - 0.6 - 0.8 * (np.abs(a - 25) < 10)), 0, 20)
    pet = 1600 - 12 * a
    def mask(p):
        bits = rng.random((12,) + SHAPE) < p[None]
        return sum(bits[i] * (1 << i) for i in range(12)).astype(float)
    m_freeze = mask(np.clip((swing / 2 - ts_annual) / 20, 0, 0.6))
    m_rain = mask(np.clip(aridity / 4, 0, 0.5))
    pop = lambda m: sum(((m.astype(int) >> i) & 1) for i in range(12))
    usable = 12 - pop(m_freeze.astype(int) | m_rain.astype(int))
    m_best = (4095 & ~(m_freeze.astype(int) | m_rain.astype(int))).astype(float)
    rough = np.exp(0.8 * smooth(rng, 2))
    elev = np.clip(600 + 900 * smooth(rng, 4), -50, 6000)
    slope = 1.5 * rough
    climate = {
        "ts_coldest": ts_annual - swing / 2, "ts_hottest": ts_annual + swing / 2, "ts_annual": ts_annual, "swing_year": swing,
        "swing_day_ground": np.clip(10 + 12 / (1 + aridity) + 3 * smooth(rng, 5), 2, None),
        "swing_day_air": np.clip(6 + 8 / (1 + aridity) + 2 * smooth(rng, 5), 1, None),
        "frozen_months": np.clip(np.round(6 - ts_annual / 3), 0, 12), "precip_mm_yr": aridity * pet, "pet_mm_yr": pet, "aridity": aridity,
        "sun_height": 90 - a, "aod": np.clip(0.15 + 0.1 * smooth(rng, 6) + 0.2 / (1 + 4 * aridity), 0.02, None),
        "m_freeze": m_freeze, "m_rain": m_rain, "m_best": m_best, "usable": usable.astype(float), "land_frac": land_frac,
        "region_id": np.full(SHAPE, -1.0), "uv_index": np.clip(12 - a / 8, 0, None),
    }
    terrain = {"elev_mean": elev}
    for s in ("240", "200"):
        terrain[f"slope_{s}"] = slope
        terrain[f"safe10_{s}"] = np.clip(1.05 - slope / 12, 0, 1)
        terrain[f"flat5_{s}"] = np.clip(1.0 - slope / 6, 0, 1)
        terrain[f"relief_{s}"] = 40 * rough ** 1.5
    dry = aridity < 0.2
    band = np.abs(lat) < 55
    surface = {
        "rock_plutonic": np.clip(0.3 * smooth(rng, 3), 0, 1),
        "rock_volcanic": np.clip(0.4 * smooth(rng, 3), 0, 1),
        "rock_evaporite": np.clip(0.3 * smooth(rng, 2) - 0.2, 0, 1),
        "bare_share": np.clip(1 - aridity * 1.5, 0, 1),
        "ice_share": (ts_annual < -15).astype(float),
        "veg_share": np.clip(aridity, 0, 1),
    }
    for name in ("calcite", "dolomite", "gypsum", "kaolinite", "montmorillonite", "illite_muscovite", "hematite", "goethite", "chlorite", "vermiculite"):
        surface[f"emit_{name}"] = np.where(dry & band, np.clip(0.05 * smooth(rng, 2), 0, None), np.nan)
    for g in (climate, terrain, surface):
        for k in g:
            g[k] = np.where(land_frac > 0, g[k], np.nan) if k != "land_frac" else g[k]
    sample = {"id": "sample", "name": "Sample data, made up so the site can be built before the real data is ready", "agency": "other", "url": None, "licence": "None: not real data", "used_for": "Every Earth value while the banner says sample data"}
    col = {"unit": "", "stat": "sample", "dataset": "sample", "resolution": "0.5°", "note": "Made-up sample value."}
    metas = {k: {"columns": {c: dict(col) for c in g}, "datasets": [sample]} for k, g in (("climate", climate), ("terrain", terrain), ("surface", surface))}
    metas["climate"]["regions"] = []
    return {"climate": climate, "terrain": terrain, "surface": surface}, metas


def load_targets(path=TARGETS):
    data = json.loads(Path(path).read_text(encoding="utf8"))
    targets = data["targets"] if isinstance(data, dict) else data
    return targets, (data.get("datasets", []) if isinstance(data, dict) else [])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stub", action="store_true")
    ap.add_argument("--weights-commit", default="uncommitted")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--method", help="also run newer method versions up to this one (e.g. 1.2 runs 1.1 then 1.2) as further validation runs")
    ap.add_argument("--method-commit", default="uncommitted", help="commit that fixed the config of the last method version")
    args = ap.parse_args()
    cfg = load_config()
    names = chain(args.method) if args.method else []
    methods = [(m, load_config(method=m), args.method_commit if m == args.method else KNOWN_COMMITS[m]) for m in names]
    sites = json.loads(SITES.read_text(encoding="utf8"))
    caves = load_points(CAVES)
    out = Path(args.out)
    if args.stub:
        stages, metas = synthetic()
        targets, extra = load_targets()
        commit = "sample"
    else:
        stages, metas = {}, {}
        for name in ("climate", "terrain", "surface"):
            stages[name], metas[name] = load_stage(name, DERIVED)
        targets, extra = load_targets()
        commit = args.weights_commit
    cells, scored, info, heads = export(stages, metas, targets, extra, sites, caves, cfg, commit, args.stub, out, methods)
    if info["missing"]:
        print("missing input columns:", ", ".join(info["missing"]))
    for f in sorted(out.iterdir()):
        print(f"{f.name}: {f.stat().st_size:,} bytes")
    print(validate.summary(json.loads((out / "validation.json").read_text(encoding="utf8"))))
    for tid, (h, runners) in heads.items():
        print(f"headline {tid}: " + (f"{h['title']} | {h['why']}" if h else "no cell clears the bar"))
        for r in runners:
            print(f"   runner-up: {r['title']} | {r['why'][:160]}")


if __name__ == "__main__":
    main()

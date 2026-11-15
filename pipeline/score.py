import numpy as np

from pipeline.traits import CHALLENGES, FILTERS, MARS_MINERALS, MINERAL_GROUPS, PUBLISHED, TRAITS

FLOOR = 0.01
MISSING = 0.5
MIN_SHARE = 0.7

RULE = (
    "Each trait is ranked against all of Earth's land: a rank of 0.9 means 90% of land, counted by area, "
    "is further from the target than this place. A challenge combines its trait ranks with a weighted "
    "geometric mean, and a mission filter combines the challenge scores the same way. Ranks are floored at "
    "0.01 so one trait can't zero the total. A trait with no data counts as 0.5 for ranking only. A place is "
    "ranked only if at least 70% of the filter's weight, followed down to each trait, has data: each "
    "challenge's weight times the share of its trait weight with data, added up, over the sum of the "
    "challenge weights."
)


def yearround_rule(share):
    return (
        f"For year-round testing, {round(share * 100)}% of the score comes from how many months a year the place "
        "is usable (no freeze-thaw, no heavy rain), ranked against all land, so a place usable only part of the year scores lower."
    )


def earth_rank(values, target, area, ties="half"):
    v = np.asarray(values, float)
    out = np.full(v.shape, np.nan)
    ok = np.isfinite(v)
    if target is None or not np.isfinite(target) or not ok.any():
        return out
    gap = np.abs(v[ok] - target)
    u, inv = np.unique(gap, return_inverse=True)
    a = np.bincount(inv, weights=np.asarray(area, float)[ok], minlength=len(u))
    total = a.sum()
    further = total - np.cumsum(a)
    out[ok] = (further[inv] + (0.5 * a[inv] if ties == "half" else 0.0)) / total
    return out


def coverage(ranks, weights):
    total = sum(weights.values())
    return sum(w * np.isfinite(np.asarray(ranks[k], float)) for k, w in weights.items()) / total


def combine(ranks, weights, floor=FLOOR, missing=MISSING):
    total = sum(weights.values())
    logs = 0.0
    for k, w in weights.items():
        r = np.asarray(ranks[k], float)
        logs = logs + w * np.log(np.where(np.isfinite(r), np.maximum(r, floor), missing))
    return np.exp(logs / total)


def challenge(ranks, weights, floor=FLOOR, missing=MISSING):
    cov = coverage(ranks, weights)
    return np.where(cov > 0, combine(ranks, weights, floor, missing), np.nan), cov


def overall(ch, cov, weights, floor=FLOOR, missing=MISSING, min_share=MIN_SHARE):
    total = sum(weights.values())
    share = sum(w * cov[k] for k, w in weights.items()) / total
    s = combine({k: ch[k] for k in weights}, weights, floor, missing)
    return np.where(share >= min_share - 1e-9, s, np.nan)


def yearround(score, usable_rank, share, floor=FLOOR, missing=MISSING):
    r = np.where(np.isfinite(usable_rank), np.maximum(usable_rank, floor), missing)
    s = np.asarray(score, float)
    return np.exp((1 - share) * np.log(np.maximum(s, floor)) + share * np.log(r))


def target_value(t, body, target):
    spec = t["target"].get(body)
    if spec is None:
        return None
    key = spec[0]
    if key in PUBLISHED:
        return dict(PUBLISHED[key])
    if key == "ideal":
        return {"value": spec[1], "stat": "ideal value", "dataset": "computed", "resolution": "not applicable", "kind": "derived", "note": t.get("note", "")}
    if key == "minerals":
        m = MARS_MINERALS.get(target["id"])
        if m is None:
            return None
        return {
            "value": float(len(m["groups"])),
            "stat": "mineral groups reported: " + ", ".join(g.replace("_", " ") for g in m["groups"]),
            "dataset": m["dataset"],
            "resolution": "site",
            "kind": "published",
            "note": m["note"],
        }
    vals = target["values"]
    add, mul = (spec[1] if len(spec) > 1 else 0.0), (spec[2] if len(spec) > 2 else 1.0)
    src = vals.get(key)
    if key == "t_swing_k" and (src is None or src.get("value") is None):
        hi, lo = vals.get("t_max_k"), vals.get("t_min_k")
        if hi and lo and hi.get("value") is not None and lo.get("value") is not None:
            src = dict(hi, value=hi["value"] - lo["value"], stat="summer maximum minus winter minimum", kind="derived")
    if src is None or src.get("value") is None:
        return None
    return dict(src, value=round(src["value"] * mul + add, 3))


def mineral_share(bits, groups):
    ok = np.isfinite(bits)
    b = np.where(ok, bits, 0).astype(int)
    names = list(MINERAL_GROUPS)
    hit = sum((b >> names.index(g)) & 1 for g in groups)
    return np.where(ok, hit / len(groups), np.nan)


def earth_values(cells, t, body, target):
    if t["id"] == "minerals":
        return mineral_share(cells["mineral_groups"], MARS_MINERALS[target["id"]]["groups"])
    return cells[t["column"][body]]


def part_weights(parts):
    out = {}
    for ch, ps in parts.items():
        out[ch] = {}
        for p in ps:
            for t in p["traits"]:
                out[ch][t] = out[ch].get(t, 0.0) + round(1.0 / len(p["traits"]), 4)
    return out


def score_target(cells, target, cfg):
    body = target["body"]
    sc = cfg["scoring"]
    opts = dict(floor=sc["floor"], missing=sc["missing_rank"])
    tw = cfg["trait_weights"][body]
    ties = sc.get("ties", "half")
    used = {k for c in tw.values() for k in c}
    unweighted = {k for c in CHALLENGES[body] for k in c["traits"]} - used
    values, ranks = {}, {}
    for t in TRAITS:
        if body not in t["column"] or t["id"] in unweighted:
            continue
        tv = target_value(t, body, target)
        if tv is None:
            continue
        values[t["id"]] = tv
        goal = 1.0 if t["id"] == "minerals" else tv["value"]
        ranks[t["id"]] = earth_rank(earth_values(cells, t, body, target), goal, cells["area"], ties)
    ch, cov = {}, {}
    for c in CHALLENGES[body]:
        w = {k: tw[c["id"]][k][0] for k in c["traits"] if k in ranks and k in tw.get(c["id"], {})}
        if w:
            ch[c["id"]], cov[c["id"]] = challenge({k: ranks[k] for k in w}, w, **opts)
    usable_rank = earth_rank(cells["usable"], 12.0, cells["area"], ties)
    scores = {}
    for f in FILTERS:
        if f["id"] not in cfg["filter_weights"]:
            continue
        w = {k: v[0] for k, v in cfg["filter_weights"][f["id"]][body].items() if k in ch}
        s = overall(ch, cov, w, min_share=sc["min_weight_with_data"], **opts) if w else np.full(len(cells["area"]), np.nan)
        scores[f["id"]] = s
        scores[f["id"] + ":yr"] = yearround(s, usable_rank, sc["yearround_share"], sc["floor"], sc["missing_rank"])
    equal = overall(ch, cov, {k: 1.0 for k in ch}, min_share=sc["min_weight_with_data"], **opts) if ch else np.full(len(cells["area"]), np.nan)
    return {"values": values, "ranks": ranks, "challenges": ch, "coverage": cov, "scores": scores, "equal": equal, "usable_rank": usable_rank}

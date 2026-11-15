import numpy as np

from pipeline.traits import CHALLENGES, FILTERS, TERRAIN_TYPES, TRAITS

RUNS = 1000
SEED = 2026
TOP = 20
KEEP = 0.9


def filter_groups(cfg):
    groups = {}
    for f in FILTERS:
        if f["id"] in cfg["filter_weights"]:
            groups.setdefault(f.get("since"), []).append(f)
    return list(groups.values())


def weight_tables(cfg, body, ranks, filters=None):
    filters = filters or filter_groups(cfg)[0]
    tw = cfg["trait_weights"][body]
    traits = sorted({k for c in CHALLENGES[body] for k in c["traits"] if k in ranks and k in tw.get(c["id"], {})})
    chs = [c["id"] for c in CHALLENGES[body] if any(k in traits for k in c["traits"] if k in tw.get(c["id"], {}))]
    wc = np.zeros((len(chs), len(traits)))
    for i, c in enumerate(chs):
        for k, (w, _) in tw[c].items():
            if k in traits:
                wc[i, traits.index(k)] = w
    wf = np.zeros((len(filters), len(chs)))
    for i, f in enumerate(filters):
        for c, (w, _) in cfg["filter_weights"][f["id"]][body].items():
            if c in chs:
                wf[i, chs.index(c)] = w
    return traits, chs, wc, wf


def filter_scores(logs, have, wc, wf, sc):
    wc = wc / wc.sum(axis=1, keepdims=True)
    chl = wc @ logs
    cov = wc @ have
    chl = np.where(cov > 0, chl, np.log(sc["missing_rank"]))
    tot = wf.sum(axis=1, keepdims=True)
    wf = np.divide(wf, tot, out=np.zeros_like(wf), where=tot > 0)
    s = np.exp(wf @ chl)
    s[(wf @ cov) < sc["min_weight_with_data"] - 1e-9] = np.nan
    return s


def inputs(scored, traits, sc):
    r = np.stack([np.asarray(scored["ranks"][k], float) for k in traits])
    have = np.isfinite(r).astype(float)
    logs = np.log(np.where(np.isfinite(r), np.maximum(r, sc["floor"]), sc["missing_rank"]))
    return logs, have


def top(s, k=TOP):
    v = np.nan_to_num(s, nan=-1.0)
    return np.argsort(-v, kind="stable")[:k]


def stability(scored, cfg, body, runs=RUNS, seed=SEED):
    out = {}
    for filters in filter_groups(cfg):
        out |= draws(scored, cfg, body, filters, runs, seed)
    return out


def draws(scored, cfg, body, filters, runs, seed):
    sc = cfg["scoring"]
    traits, chs, wc, wf = weight_tables(cfg, body, scored["ranks"], filters)
    logs, have = inputs(scored, traits, sc)
    base = filter_scores(logs, have, wc, wf, sc)
    tops = [top(base[i]) for i in range(len(filters))]
    hits = [np.zeros(TOP) for _ in filters]
    rng = np.random.default_rng(seed)
    for _ in range(runs):
        s = filter_scores(logs, have, wc * rng.uniform(0.5, 1.5, wc.shape), wf * rng.uniform(0.5, 1.5, wf.shape), sc)
        for i in range(len(filters)):
            hits[i] += np.isin(tops[i], np.argpartition(-np.nan_to_num(s[i], nan=-1.0), TOP)[:TOP])
    out = {}
    for i, f in enumerate(filters):
        stable = tops[i][hits[i] / runs >= KEEP]
        out[f["id"]] = {"top": tops[i], "share": hits[i] / runs, "stable": stable}
    return out


def stable_column(n, result):
    col = np.zeros(n)
    col[result["stable"]] = 1
    return col


def keep_column(n, result):
    col = np.full(n, np.nan)
    col[result["top"]] = result["share"]
    return col


def stability_sentence(target, result):
    parts = [f"{f['name'].lower()} {len(result[f['id']]['stable'])} of {TOP}" for f in FILTERS if not f.get("since")]
    return (
        f"{target.get('short') or target['name']}: we changed every challenge and trait weight by up to 50% either way, 1,000 times. "
        f"Top-20 places that stayed in the top 20 in at least 90% of runs: " + ", ".join(parts) + "."
    )


def fmt(v, t):
    if not np.isfinite(v):
        return "no data"
    unit = t["unit"]
    num = f"{v:.{t['digits']}f}"
    if num.startswith("-") and float(num) == 0:
        num = num[1:]
    if unit == "%":
        return num + "%"
    if unit in ("°", "°C"):
        return num + unit
    return f"{num} {unit}".strip()


def headline(cells, scored, cfg, target, regions, filter_id, rare_km):
    s = scored["scores"][filter_id]
    out_ant = (cells["lat"] > -60) & np.isfinite(s)
    a = cells["area"]
    order = np.argsort(-np.where(out_ant, s, -1.0), kind="stable")
    total = a[out_ant].sum()
    picks = []
    for i in order:
        if not out_ant[i]:
            break
        pct = a[out_ant & (s < s[i])].sum() / total
        if pct < 0.99:
            break
        if cells["nearest_analog_km"][i] > rare_km and not cells["ice"][i] >= 50:
            picks.append((int(i), pct))
        if len(picks) == 5:
            break
    if not picks:
        return None, []
    return describe(cells, scored, cfg, target, regions, filter_id, *picks[0]), [describe(cells, scored, cfg, target, regions, filter_id, *p) for p in picks[1:]]


def describe(cells, scored, cfg, target, regions, filter_id, i, pct):
    body = target["body"]
    fil = next(f for f in FILTERS if f["id"] == filter_id)
    chs = [c for c in CHALLENGES[body] if c["id"] in cfg["filter_weights"][filter_id][body]]
    tw = cfg["trait_weights"][body]
    keys = [k for c in chs for k in c["traits"] if k in scored["ranks"] and k in tw.get(c["id"], {})]
    keys = list(dict.fromkeys(keys))
    tr = {t["id"]: t for t in TRAITS}
    rows = sorted(((float(scored["ranks"][k][i]), k) for k in keys if np.isfinite(scored["ranks"][k][i])), reverse=True)
    r = int(cells["region"][i]) if np.isfinite(cells["region"][i]) else -1
    place = regions[r] if 0 <= r < len(regions) else f"{cells['lat'][i]:.2f}, {cells['lon'][i]:.2f}"
    ttype = {tid: name for tid, _, name in TERRAIN_TYPES}[int(cells["terrain_type"][i])]

    def line(rank, k):
        t = tr[k]
        v = float(cells[t["column"][body]][i])
        goal = scored["values"][k]["value"]
        return f"{t['label'].lower()} {fmt(v, t)} against {fmt(goal, t)} (closer than {round(rank * 100)}% of land)"

    def gap(k):
        t = tr[k]
        return k == "minerals" or fmt(float(cells[t["column"][body]][i]), t) != fmt(scored["values"][k]["value"], t)

    every = {k for ws in tw.values() for k in ws if k in scored["ranks"]}
    weak = sorted((float(scored["ranks"][k][i]), k) for k in every if np.isfinite(scored["ranks"][k][i]) and gap(k))
    good = [line(rk, k) for rk, k in rows[:3]]
    bad = [line(rk, k) for rk, k in weak[:2] if rk < 0.5]
    why = (
        f"Scores in the top {max(1, round((1 - pct) * 100))}% of land outside Antarctica for {fil['name'].lower()} (target: {target.get('short') or target['name']}), "
        f"and lies {round(float(cells['nearest_analog_km'][i]))} km from the nearest known analog in our list. "
        f"Closest matches: {'; '.join(good)}."
        + (f" Where it breaks: {'; '.join(bad)}." if bad else " No scored trait ranks in the bottom half.")
        + " Like everywhere on Earth, it cannot copy the gravity, air or radiation."
    )
    return {
        "cell": i,
        "title": f"{place}" + (f": {ttype.lower()}" if ttype != "No type" else "") + f" ({cells['lat'][i]:.2f}°, {cells['lon'][i]:.2f}°)",
        "why": why,
        "what_to_test": " ".join(c["what_to_test"] for c in chs),
    }

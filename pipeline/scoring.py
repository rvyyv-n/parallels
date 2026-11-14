import math

FLOOR = 0.01
MIN_WEIGHT_WITH_DATA = 0.7


def earth_rank(value, target, reference):
    if value is None:
        return None
    gap = abs(value - target)
    gaps = [abs(r - target) for r in reference if r is not None]
    further = sum(g > gap for g in gaps) + 0.5 * sum(g == gap for g in gaps)
    return further / len(gaps)


def combine(ranks, weights):
    total = sum(weights.values())
    with_data = sum(w for k, w in weights.items() if ranks.get(k) is not None)
    if with_data / total < MIN_WEIGHT_WITH_DATA:
        return None
    log_sum = 0.0
    for k, w in weights.items():
        r = ranks.get(k)
        r = 0.5 if r is None else max(r, FLOOR)
        log_sum += w * math.log(r)
    return math.exp(log_sum / total)

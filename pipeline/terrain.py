import numpy as np
from scipy import ndimage

WINDOW_M = 10_000


def slope_deg(dem, px):
    dy, dx = np.gradient(dem, px)
    return np.degrees(np.arctan(np.hypot(dx, dy)))


def resample(dem, dx_m, dy_m, px):
    rows = round(dem.shape[0] * dy_m / px)
    cols = round(dem.shape[1] * dx_m / px)
    size = (max(1, round(px / dy_m)), max(1, round(px / dx_m)))
    smooth = ndimage.uniform_filter(dem, size=size, mode="nearest")
    return ndimage.zoom(smooth, (rows / dem.shape[0], cols / dem.shape[1]), order=1)


def terrain_metrics(dem, px):
    s = slope_deg(dem, px)
    s = s[np.isfinite(s)]
    z = dem[np.isfinite(dem)]
    return {
        "slope_median_deg": round(float(np.median(s)), 2),
        "slope_p90_deg": round(float(np.percentile(s, 90)), 2),
        "share_under_10": round(float(np.mean(s < 10)), 3),
        "share_under_5": round(float(np.mean(s < 5)), 3),
        "relief_m": round(float(np.percentile(z, 95) - np.percentile(z, 5)), 1),
    }

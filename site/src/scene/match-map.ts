import type { Raw } from "../data/bin";
import { MATCH_H, MATCH_W } from "./scene";

const NOT_RANKED = 65535;
export const SHOWN_FROM = 0.9;

export function matchPixels(score: Raw, lat: Raw, lon: Raw, kept?: (cell: number) => boolean): Uint8Array {
  const ranked = (score as Uint16Array).filter((s) => s !== NOT_RANKED).sort();
  const below = (s: number) => {
    let lo = 0;
    let hi = ranked.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ranked[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    return lo / ranked.length;
  };

  const px = new Uint8Array(MATCH_W * MATCH_H * 4);
  for (let i = 0; i < score.length; i++) {
    const x = Math.min(MATCH_W - 1, Math.floor((lon[i] / 100 + 180) * 2));
    const y = Math.min(MATCH_H - 1, Math.floor((lat[i] / 100 + 90) * 2));
    const o = (y * MATCH_W + x) * 4;
    px[o + 3] = 255;
    if (score[i] === NOT_RANKED || (kept && !kept(i))) continue;
    const t = Math.max(0, (below(score[i]) - SHOWN_FROM) / (1 - SHOWN_FROM));
    px[o] = Math.round(255 * t ** 1.5);
  }
  return px;
}

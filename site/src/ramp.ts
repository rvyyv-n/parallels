const STOPS = ["#1b0c41", "#420a68", "#6a176e", "#932667", "#bc3754", "#dd513a", "#f37819", "#fca50a", "#f6d746", "#fcffa4"];

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const LUT = (() => {
  const out = new Uint8Array(256 * 3);
  const s = STOPS.map(rgb);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (s.length - 1);
    const k = Math.min(s.length - 2, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(s[k][c] + (s[k + 1][c] - s[k][c]) * f);
  }
  return out;
})();

export function colour(v: number): string {
  const i = Math.max(0, Math.min(255, Math.round(v * 255))) * 3;
  return `rgb(${LUT[i]},${LUT[i + 1]},${LUT[i + 2]})`;
}

export const gradient = () => `linear-gradient(90deg, ${STOPS.join(", ")})`;

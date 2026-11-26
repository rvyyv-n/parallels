export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const NAME_PARTICLES = new Set(["de", "da", "del", "della", "di", "du", "van", "von"]);

export function targetName(name: string): string {
  return name.replace(/(^|[\s(/\-–—])([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’]*)/g, (full, pre: string, word: string) => {
    if (NAME_PARTICLES.has(word)) return full;
    if (/^(?:[IVX]{2,}|[A-Z]{2,})$/.test(word)) return full;
    return `${pre}${word[0].toUpperCase()}${word.slice(1)}`;
  });
}

const SUP_MAP: Record<string, string> = {
  "⁻": "−",
  "⁺": "+",
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

export function fmtSup(text: string): string {
  return esc(text).replace(/[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (seq) => `<sup>${[...seq].map((ch) => SUP_MAP[ch] ?? ch).join("")}</sup>`);
}

export function num(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "no data";
  const s = v.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s.replace(/^-/, "−");
}

export const score100 = (v: number) => (Number.isFinite(v) ? num(v * 100, 0) : "—");

export function deg(v: number, pos: string, neg: string, digits = 2): string {
  return `${num(Math.abs(v), digits)}° ${v < 0 ? neg : pos}`;
}

export const latlon = (lat: number, lon: number, digits = 2) => `${deg(lat, "N", "S", digits)}, ${deg(lon, "E", "W", digits)}`;

export const unit = (u: string) => (!u ? "" : /^[°%]/.test(u) ? u : ` ${u}`);

export const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function bits(mask: number): boolean[] {
  const m = Number.isFinite(mask) ? mask : 0;
  return Array.from({ length: 12 }, (_, i) => (m >> i) & 1).map(Boolean);
}

export function monthList(mask: number): string {
  if (!Number.isFinite(mask)) return "no data";
  const on = bits(mask);
  const names = MONTH_NAMES.filter((_, i) => on[i]);
  if (!names.length) return "none";
  if (names.length === 12) return "all year";
  return names.join(", ");
}

export function monthRanges(on: boolean[]): string {
  const runs: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    if (!on[i]) continue;
    const prev = runs[runs.length - 1];
    if (prev && prev[1] === i - 1) prev[1] = i;
    else runs.push([i, i]);
  }
  if (!runs.length) return "None";
  if (runs.length === 1 && runs[0][0] === 0 && runs[0][1] === 11) return "All year";
  if (runs.length >= 2 && runs[0][0] === 0 && runs[runs.length - 1][1] === 11) {
    const first = runs.shift()!;
    const last = runs.pop()!;
    runs.unshift([last[0], first[1]]);
  }
  return runs.map(([a, b]) => (a === b ? MONTH_NAMES[a] : `${MONTH_NAMES[a]}–${MONTH_NAMES[b]}`)).join(", ");
}

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function webgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

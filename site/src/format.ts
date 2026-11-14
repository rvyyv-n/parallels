export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function num(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return "no data";
  return v.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/^-/, "−");
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

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function webgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

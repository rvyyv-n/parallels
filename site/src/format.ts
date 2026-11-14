import type { Trait } from "./types";

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function pct(x: number): number {
  return Math.round(x * 100);
}

export function num(x: number, digits: number): string {
  const s = Math.abs(x).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return x < 0 && s.replace(/[0.,]/g, "") !== "" ? `−${s}` : s;
}

export function fmt(t: Trait, v: number): string {
  const x = v * (t.scale ?? 1);
  const unit = t.unit === "%" || t.unit === "°" ? t.unit : ` ${t.unit}`;
  return `${num(x, t.digits)}${unit}`;
}

export function link(text: string, url?: string | null): string {
  return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
}

const GROUPS: Record<string, string> = {
  "moon-analog": "known Moon analog",
  "moon-basalt": "basalt training site",
  "mars-analog": "known Mars analog",
  ordinary: "ordinary place (control)",
  desert: "plain desert (control)",
  candidate: "rarely used candidate",
};

export function groupLabel(groups: string[]): string {
  return groups.map((g) => GROUPS[g] ?? g).join(", ");
}

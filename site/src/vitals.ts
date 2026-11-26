import type { Body, CantCopy, Manifest } from "./contract";
import { num } from "./format";

export type VitalId = "gravity" | "air" | "radiation" | "other";

export const VITAL_ICONS: Record<VitalId, string> = {
  gravity:
    '<svg class="vt-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v8M5 7.5 8 10.5l3-3M3 13.5h10"/></svg>',
  air: '<svg class="vt-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 5.5h8.5a2 2 0 1 0-1.9-2.6M2 8.5h11a1.75 1.75 0 1 1-1.65 2.35M2 11.5h5.5"/></svg>',
  radiation:
    '<svg class="vt-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v2.2M8 12v2.2M1.8 8H4M12 8h2.2M3.6 3.6l1.55 1.55M10.85 10.85l1.55 1.55M12.4 3.6l-1.55 1.55M5.15 10.85 3.6 12.4"/></svg>',
  other:
    '<svg class="vt-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="m4.2 4.2 7.6 7.6"/></svg>',
};

export interface Vital {
  id: VitalId;
  label: string;
  worldValue: string;
  worldSub: string;
  earthLabel: string;
  pill: string;
  worldPct: number;
  earthPct: number;
  trace: boolean;
  alert: boolean;
  note: string;
  source: string;
  url: string;
}

export const cleanSource = (s: string) => s.replace(/;\s*/g, " / ");
export const firstNumber = (s: string) => Number(s.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0] ?? NaN);
const fmtCompact = (x: number) => (Number.isInteger(x) ? num(x) : num(x, 1));

export function parseVital(r: CantCopy, w: Body): Vital {
  const rawW = r[w];
  const rawE = r.earth;

  if (r.name === "Gravity") {
    const e = firstNumber(rawE);
    const v = firstNumber(rawW);
    if (Number.isFinite(e) && Number.isFinite(v) && e > 0) {
      const ratio = v / e;
      return {
        id: "gravity",
        label: "Gravity",
        worldValue: `${num(v, 2)} m/s²`,
        worldSub: "",
        earthLabel: `${num(e, 2)} m/s²`,
        pill: `${num(ratio, 2)}× Earth`,
        worldPct: Math.max(0, Math.min(100, ratio * 100)),
        earthPct: 100,
        trace: false,
        alert: false,
        note: "",
        source: r.source,
        url: r.url,
      };
    }
  }

  if (r.name === "Air") {
    const e = firstNumber(rawE);
    if (Number.isFinite(e) && e > 0) {
      const isVacuum = /^none\b/i.test(rawW) || /×10⁻/.test(rawW);
      if (isVacuum) {
        const sci = rawW.match(/\d+(?:\.\d+)?\s*×\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+\s*bar/i)?.[0] ?? "";
        return {
          id: "air",
          label: "Air",
          worldValue: "Vacuum",
          worldSub: sci,
          earthLabel: `${num(e)} mbar`,
          pill: "~0% Earth",
          worldPct: 0,
          earthPct: 100,
          trace: true,
          alert: false,
          note: "",
          source: r.source,
          url: r.url,
        };
      }
      const v = firstNumber(rawW);
      if (Number.isFinite(v)) {
        const pct = (v / e) * 100;
        return {
          id: "air",
          label: "Air",
          worldValue: `${num(v, 2)} mbar`,
          worldSub: "",
          earthLabel: `${num(e)} mbar`,
          pill: `${num(pct, 1)}% Earth`,
          worldPct: Math.max(0, Math.min(100, pct)),
          earthPct: 100,
          trace: false,
          alert: false,
          note: "",
          source: r.source,
          url: r.url,
        };
      }
    }
  }

  if (r.name === "Radiation on the surface") {
    const e = firstNumber(rawE);
    const v = firstNumber(rawW);
    if (Number.isFinite(e) && Number.isFinite(v) && e > 0 && v > 0) {
      const eApprox = /^about\b/i.test(rawE) ? "~" : "";
      const vApprox = /^about\b/i.test(rawW) ? "~" : "";
      const ratio = Math.round(v / e);
      const note = (rawW.match(/\(([^)]+)\)/)?.[1] ?? "").replace(/;\s*/g, " · ");
      return {
        id: "radiation",
        label: "Radiation",
        worldValue: `${vApprox}${fmtCompact(v)} µSv/day`,
        worldSub: "",
        earthLabel: `${eApprox}${fmtCompact(e)} µSv/day`,
        pill: `~${num(ratio)}× Earth`,
        worldPct: 100,
        earthPct: Math.max(0, Math.min(100, (e / v) * 100)),
        trace: false,
        alert: true,
        note,
        source: r.source,
        url: r.url,
      };
    }
  }

  return {
    id: "other",
    label: r.name,
    worldValue: rawW,
    worldSub: "",
    earthLabel: rawE,
    pill: "",
    worldPct: 0,
    earthPct: 100,
    trace: false,
    alert: false,
    note: "",
    source: r.source,
    url: r.url,
  };
}

export function parseVitals(m: Manifest, w: Body): Vital[] {
  return m.cant_copy.map((r) => parseVital(r, w));
}

export function dedupeVitalSources(rows: Vital[], w: Body): { source: string; url: string }[] {
  const byLabel = new Map<string, { source: string; url: string }>();
  for (const r of rows) {
    const prev = byLabel.get(r.source);
    if (!prev || (!prev.url.includes(w) && r.url.includes(w))) {
      byLabel.set(r.source, { source: cleanSource(r.source), url: r.url });
    }
  }
  return [...byLabel.values()];
}

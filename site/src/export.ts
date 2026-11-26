import type { Body, Manifest, Target } from "./contract";
import type { Cols } from "./data";
import { monthList, targetName } from "./format";
import { bandOf } from "./rank";
import { coverage } from "./score";
import type { Row, TraitInput } from "./traits";

const BODY_LABEL: Record<Body, string> = { moon: "Moon", mars: "Mars" };
const MOON_RADIUS_M = 1_737_400;
const DEG = Math.PI / 180;
const WORLDVIEW_LAYERS = "Coastlines_15m,VIIRS_NOAA20_CorrectedReflectance_TrueColor";

function traitRow(x: TraitInput, id: string): Row | null {
  const tr = x.m.traits.find((t) => t.id === id);
  if (!tr) return null;
  const col = tr.column[x.body];
  const ev = col && x.cells[col] ? x.cells[col][x.i] : NaN;
  const [lo, hi] = (col && x.ranges.get(col)) || [NaN, NaN];
  return { tr, ev, tv: x.target.values[id], rank: x.t[`rank:${id}`]?.[x.i] ?? NaN, lo, hi };
}

export interface PlaceCsvInput extends TraitInput {
  placeName: string;
  terrainName: string;
  score: Float32Array;
  place: number;
  ranked: number;
  weightsName: string;
  yr: boolean;
  shareUrl: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const cleanNum = (v: number, digits: number) => {
  if (!Number.isFinite(v)) return "";
  const s = v.toFixed(digits);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
};

const cleanCoord = (v: number) => String(Number(v.toFixed(4)));

export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export function worldviewUrl(lat: number, lon: number, generated?: string): string {
  const parsed = Number((generated ?? "").slice(0, 4));
  const year = Number.isFinite(parsed) && parsed > 1900 ? parsed - 1 : 2025;
  const month = lat >= 0 ? "07" : "01";
  const date = `${year}-${month}-15`;
  const w = cleanCoord(clamp(lon - 1.5, -180, 180));
  const s = cleanCoord(clamp(lat - 1.5, -90, 90));
  const e = cleanCoord(clamp(lon + 1.5, -180, 180));
  const n = cleanCoord(clamp(lat + 1.5, -90, 90));
  return `https://worldview.earthdata.nasa.gov/?v=${w},${s},${e},${n}&t=${date}&l=${WORLDVIEW_LAYERS}`;
}

export function trekUrl(target: Pick<Target, "body" | "lat" | "lon">): string {
  if (target.body === "moon" && target.lat <= -60) {
    const phi = target.lat * DEG;
    const lam = target.lon * DEG;
    const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + phi / 2);
    const x = rho * Math.sin(lam);
    const y = rho * Math.cos(lam);
    const fmt = (v: number) => (Math.abs(v) < 0.05 ? "0.0" : v.toFixed(1));
    return `https://trek.nasa.gov/moon/#v=0.1&x=${fmt(x)}&y=${fmt(y)}&z=4&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120`;
  }
  const crs = target.body === "moon" ? "EPSG%3A%3A104903" : "EPSG%3A%3A104905";
  return `https://trek.nasa.gov/${target.body}/#v=0.1&x=${target.lon.toFixed(4)}&y=${target.lat.toFixed(4)}&z=8&p=urn%3Aogc%3Adef%3Acrs%3A${crs}`;
}

export function csvFilename(placeName: string, targetId: string, filterId: string): string {
  const slug = placeName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `parallels-${slug || "place"}-${targetId}-${filterId}.csv`;
}

function seasonalRows(cells: Cols, i: number): [string, string][] {
  const best = cells.m_best?.[i];
  const frz = cells.m_freeze?.[i];
  const rain = cells.m_rain?.[i];
  const usable = cells.usable?.[i];
  if (![best, frz, rain].some(Number.isFinite)) {
    return [["Seasonal climate data", "No monthly climate data"]];
  }
  const avoidMask =
    Number.isFinite(frz) || Number.isFinite(rain)
      ? (Number.isFinite(frz) ? frz : 0) | (Number.isFinite(rain) ? rain : 0)
      : NaN;
  const noDataMonths = [best, frz, rain].every(Number.isFinite) ? "none" : "partial";
  return [
    ["Usable months", Number.isFinite(usable) ? `${cleanNum(usable, 0)} of 12` : "no data"],
    ["Seasonal best months", monthList(best)],
    ["Seasonal avoid months (freeze-thaw or rainy)", monthList(avoidMask)],
    ["Seasonal freeze-thaw months", monthList(frz)],
    ["Seasonal rainy months", monthList(rain)],
    ["Seasonal no-data months", noDataMonths],
  ];
}

function datasetOf(m: Manifest, id: string | undefined) {
  return id ? m.datasets.find((d) => d.id === id) : undefined;
}

export function placeCsv(x: PlaceCsvInput): string {
  const { m, i, cells, target, body } = x;
  const chs = m.challenges[body];
  const s = x.score[i];
  const overall = Number.isFinite(s) ? `${Math.round(s * 100)} / 100` : "Not ranked";
  const far = cells.nearest_analog_km?.[i];
  const methodVersion = m.method_version ? `${m.method_version} (schema v${m.version})` : String(m.version);

  const lines: string[] = [];
  const push = (...values: unknown[]) => lines.push(csvRow(values));

  push("Section", "Field", "Value");
  const meta: [string, string][] = [
    ["Place", x.placeName],
    ["Latitude", cleanNum(cells.lat[i], 4)],
    ["Longitude", cleanNum(cells.lon[i], 4)],
    ["Cell ID", String(i)],
    ["Base site", targetName(target.name)],
    ["Base site ID", target.id],
    ["World", BODY_LABEL[body]],
    ["Preset / weights", x.weightsName],
    ["Year-round", x.yr ? "Yes" : "No"],
    ["Overall match score", overall],
    ["Rank", Number.isFinite(x.place) ? `${x.place} of ${x.ranked}` : "Not ranked"],
    ["Ranked land cells", String(x.ranked)],
    ["Terrain type", x.terrainName],
    ["Nearest known analog distance (km)", Number.isFinite(far) ? cleanNum(far, 1) : "No data"],
    ...seasonalRows(cells, i),
    ["Method version", methodVersion],
    ["Generated", m.generated],
    ["Share URL", x.shareUrl],
  ];
  for (const [field, value] of meta) push("Metadata", field, value);

  lines.push("");
  push("Challenges");
  push("Challenge", "Challenge ID", "Score (/ 100)", "Band", "Weight", "Weight share (%)", "Data coverage (%)");

  const activeWeight = chs.reduce((sum, c) => sum + Math.max(0, x.weights[c.id] ?? 0), 0);
  for (const c of chs) {
    const v = x.t[`ch:${c.id}`]?.[i] ?? NaN;
    const b = bandOf(v);
    const w = x.weights[c.id] ?? 0;
    const cov = coverage(x.t[`cov:${c.id}`], v, i);
    const share = activeWeight > 0 && w > 0 ? ((w / activeWeight) * 100).toFixed(1) : "0.0";
    push(
      c.name,
      c.id,
      Number.isFinite(v) ? Math.round(v * 100) : "",
      b ? b.word : !c.traits.length ? "not scored" : "no data",
      cleanNum(w, w % 1 ? 2 : 0),
      share,
      c.traits.length ? Math.round(cov * 100) : "",
    );
  }

  lines.push("");
  push("Traits");
  push(
    "Challenge",
    "Trait",
    "Earth value",
    "Base-site value",
    "Unit",
    "Trait score (/ 100)",
    "Earth min",
    "Earth max",
    "Earth dataset",
    "Earth dataset URL",
    "Earth resolution",
    "Base-site dataset",
    "Base-site dataset URL",
    "Base-site resolution",
    "Notes",
  );

  for (const c of chs) {
    for (const tw of c.traits) {
      const r = traitRow(x, tw.id);
      if (!r) continue;
      const eDs = datasetOf(m, r.tr.earth_dataset);
      const ideal = r.tr.scored_by === "ideal";
      const tDs = ideal ? undefined : datasetOf(m, r.tv?.dataset);
      const noteParts = [tw.why, r.tr.note, r.tv?.note].filter((p): p is string => !!p && p.trim().length > 0);
      push(
        c.name,
        r.tr.label,
        cleanNum(r.ev, r.tr.digits),
        r.tv?.value != null ? cleanNum(r.tv.value, r.tr.digits) : "",
        r.tr.unit,
        Number.isFinite(r.rank) ? Math.round(r.rank * 100) : "",
        cleanNum(r.lo, r.tr.digits),
        cleanNum(r.hi, r.tr.digits),
        eDs?.name ?? r.tr.earth_dataset,
        eDs?.url ?? "",
        r.tr.earth_resolution,
        ideal ? "Ideal goal" : (tDs?.name ?? r.tv?.dataset ?? ""),
        ideal ? "" : (tDs?.url ?? ""),
        r.tv?.resolution ?? "",
        noteParts.join(" | "),
      );
    }
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { Body };

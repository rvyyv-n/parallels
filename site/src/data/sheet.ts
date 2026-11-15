import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "./load";
import { fixed, monthsOf, percent, type Match } from "./match";

export interface SheetRow {
  trait: string;
  earth: string;
  site: string;
  unit: string;
  closerThan: string;
  inFilter: string;
  usedBy: string;
  earthStat: string;
  earthDataset: string;
  earthLink: string;
  earthResolution: string;
  siteStat: string;
  siteKind: string;
  siteDataset: string;
  siteLink: string;
  siteResolution: string;
}

const COLUMNS: [keyof SheetRow, string][] = [
  ["trait", "Trait"],
  ["earth", "Earth value"],
  ["site", "Base site value"],
  ["unit", "Unit"],
  ["closerThan", "Closer than this share of land"],
  ["inFilter", "In mission filter"],
  ["usedBy", "Challenges using it"],
  ["earthStat", "Earth statistic"],
  ["earthDataset", "Earth dataset"],
  ["earthLink", "Earth dataset link"],
  ["earthResolution", "Earth resolution"],
  ["siteStat", "Base site statistic"],
  ["siteKind", "Base site value kind"],
  ["siteDataset", "Base site dataset"],
  ["siteLink", "Base site dataset link"],
  ["siteResolution", "Base site resolution"],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const num = (value: number | null, digits: number) => (value === null ? "" : fixed(value, digits));

const months = (mask: number) =>
  monthsOf(mask)
    .flatMap((on, m) => (on ? [MONTHS[m]] : []))
    .join(" ");

export function sheetRows(match: Match): SheetRow[] {
  return match.rows.map((r) => ({
    trait: r.trait.label,
    earth: num(r.earth, r.trait.digits),
    site: num(r.target.value, r.trait.digits),
    unit: r.trait.unit,
    closerThan: r.rank === null ? "" : percent(r.rank),
    inFilter: r.inFilter ? "yes" : "no",
    usedBy: r.usedBy.join("; "),
    earthStat: r.trait.earth_stat,
    earthDataset: r.earthDataset?.name ?? "",
    earthLink: r.earthDataset?.url ?? "",
    earthResolution: r.trait.earth_resolution,
    siteStat: r.target.stat,
    siteKind: r.target.kind,
    siteDataset: r.targetDataset?.name ?? "",
    siteLink: r.targetDataset?.url ?? "",
    siteResolution: r.target.resolution,
  }));
}

export function sheetName(target: Target, filter: MissionFilter, match: Match) {
  return `parallels-${target.id}-${filter.id}-${match.cell}.csv`;
}

export function sheet(manifest: Manifest, target: Target, filter: MissionFilter, place: PlaceInfo, match: Match, address: string): string {
  const head: string[][] = [
    ["Parallels: every value for one place"],
    ["Place", place.region ?? "Unnamed land"],
    ["Latitude", num(match.lat, 2)],
    ["Longitude", num(match.lon, 2)],
    ["Cell", String(match.cell)],
    ["Area", "the middle of a square about 50 km wide"],
    ["Base site", target.name],
    ["Base site latitude", String(target.lat)],
    ["Base site longitude", String(target.lon)],
    ["Mission filter", filter.name],
    ["Score for this filter", num(match.score, 3)],
    ...(match.scoreYearRound === null ? [] : [["Year-round score", num(match.scoreYearRound, 3)]]),
    ["Terrain type", match.terrain],
    ["Nearest known analog (km)", num(match.nearestAnalogKm, 0)],
    ["Best months", months(match.months.best)],
    ["Freeze-thaw months", months(match.months.freeze)],
    ["Rainy months", months(match.months.rain)],
    ["Method version", manifest.method_version ?? ""],
    ["Data built", manifest.generated],
    ["This view", address],
  ];
  const challenges = [
    ["Challenge", "Weight", "Score", "Share of its weight with data (%)"],
    ...match.challenges.map((c) => [c.challenge.name, String(c.weight), num(c.score, 3), num(c.coverage, 0)]),
  ];
  const traits = [COLUMNS.map(([, title]) => title), ...sheetRows(match).map((r) => COLUMNS.map(([key]) => r[key]))];
  return "﻿" + toCsv([...head, [], ...challenges, [], ...traits]);
}

const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function worldviewUrl(lat: number, lon: number, generated: string) {
  const date = `${Number(generated.slice(0, 4)) - 1}-${lat >= 0 ? "07" : "01"}-15`;
  const half = 1.5;
  const box = [lon - half, Math.max(lat - half, -90), lon + half, Math.min(lat + half, 90)].map((v) => v.toFixed(2));
  return `https://worldview.earthdata.nasa.gov/?v=${box.join(",")}&l=Coastlines_15m,VIIRS_NOAA20_CorrectedReflectance_TrueColor&t=${date}`;
}

const MOON_RADIUS_M = 1737400;

export function trekUrl(target: Target) {
  if (target.body === "moon" && target.lat <= -60) {
    const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + (target.lat * Math.PI) / 360);
    const lon = (target.lon * Math.PI) / 180;
    const x = Math.round(rho * Math.sin(lon));
    const y = Math.round(rho * Math.cos(lon));
    return `https://trek.nasa.gov/moon/#v=0.1&x=${x}&y=${y}&z=4&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120&b=moon`;
  }
  const crs = target.body === "moon" ? "104903" : "104905";
  return `https://trek.nasa.gov/${target.body}/#v=0.1&x=${target.lon}&y=${target.lat}&z=8&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A${crs}&b=${target.body}`;
}

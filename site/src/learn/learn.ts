import type { CantCopy, Dataset, LabelPoint, Manifest, Target } from "../../../dataset/contract";
import { formatValue, monthsOf, SIMILAR_FROM, type Match, type TraitRow } from "../data/match";
import { DEFAULT_VIEW } from "../state";

export type World = "moon" | "mars";
export type Body = "earth" | World;

export const BODIES: Body[] = ["earth", "moon", "mars"];
export const BODY_NAME: Record<Body, string> = { earth: "Earth", moon: "Moon", mars: "Mars" };
export const WORLD_NAME: Record<World, string> = { moon: "the Moon", mars: "Mars" };

export const worldOf = (search: string): World => (new URLSearchParams(search).get("world") === "mars" ? "mars" : "moon");

export const baseTarget = (manifest: Manifest, world: World) => manifest.targets.find((t) => t.body === world && t.default)!;

export const findHref = (target: Target) => (target.id === DEFAULT_VIEW.target ? "./" : `./#t=${target.id}`);

export const cantCopy = (manifest: Manifest, name: string): CantCopy => manifest.cant_copy.find((r) => r.name === name)!;

const firstNumber = (text: string) => Number(text.replace(/,/g, "").match(/\d+(\.\d+)?/)![0]);

export function gravity(manifest: Manifest): Record<Body, number> {
  const row = cantCopy(manifest, "Gravity");
  return { earth: firstNumber(row.earth), moon: firstNumber(row.moon), mars: firstNumber(row.mars) };
}

export const weight = (massKg: number, g: number) => massKg * g;

export const analogsOf = (labels: LabelPoint[], world: World) =>
  labels.filter((l) => l.kind === "known_analog" && l.groups?.some((g) => g.startsWith(`${world}-`)));

export const mapPosition = (lat: number, lon: number) => ({ x: (lon + 180) / 360, y: (90 - lat) / 180 });

export function testedThere(note: string | undefined): string {
  const text = (note ?? "").replace(/^Used for:[^.]*\.\s*/, "");
  return text.split(/(?<=\.)\s+(?=[A-Z])/)[0];
}

export interface MonthState {
  best: boolean;
  freeze: boolean;
  rain: boolean;
}

export const MONTH_COLUMNS = ["m_best", "m_freeze", "m_rain", "usable"];

export const placeMonths = (cell: Record<string, number | null>): Match["months"] => ({
  best: cell.m_best ?? 0,
  freeze: cell.m_freeze ?? 0,
  rain: cell.m_rain ?? 0,
  usable: cell.usable,
});

export const monthState = (months: Match["months"], month: number): MonthState => ({
  best: monthsOf(months.best)[month],
  freeze: monthsOf(months.freeze)[month],
  rain: monthsOf(months.rain)[month],
});

export const kelvinToC = (k: number) => k - 273.15;

export const tempText = (side: TempSide, row: TraitRow) =>
  formatValue(side.value, { ...row.trait, digits: 1 }) + (side.kelvin === null ? "" : ` (${side.kelvin} K)`);

export interface TempSide {
  value: number | null;
  kelvin: number | null;
  dataset: Dataset | undefined;
  resolution: string;
}

export interface TempPair {
  row: TraitRow;
  world: TempSide;
  earth: TempSide;
  close: boolean;
}

const TEMP_TRAITS = ["cold", "season_swing", "day_swing_air", "day_swing_ground"];
const KELVIN: Record<string, string> = { cold: "t_min_k" };

export function tempPairs(manifest: Manifest, target: Target, match: Match): TempPair[] {
  const dataset = (id: string) => manifest.datasets.find((d) => d.id === id);
  return match.rows
    .filter((row) => TEMP_TRAITS.includes(row.trait.id))
    .map((row) => {
      const k = target.shown[KELVIN[row.trait.id]];
      const world: TempSide =
        k && k.value !== null
          ? { value: kelvinToC(k.value), kelvin: k.value, dataset: dataset(k.dataset), resolution: k.resolution }
          : { value: row.target.value, kelvin: null, dataset: row.targetDataset, resolution: row.target.resolution };
      const earth: TempSide = { value: row.earth, kelvin: null, dataset: row.earthDataset, resolution: row.trait.earth_resolution };
      return { row, world, earth, close: row.rank !== null && row.rank >= SIMILAR_FROM };
    });
}

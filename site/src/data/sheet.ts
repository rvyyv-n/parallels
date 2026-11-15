import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "./load";
import type { Match } from "./match";

export interface SheetRow {
  trait: string;
  earth: string;
  site: string;
  unit: string;
  earthDataset: string;
  siteDataset: string;
  earthResolution: string;
  siteResolution: string;
}

export function sheetRows(_manifest: Manifest, _target: Target, _filter: MissionFilter, _place: PlaceInfo, _match: Match): SheetRow[] {
  return [];
}

export function toCsv(_rows: SheetRow[]): string {
  return "";
}

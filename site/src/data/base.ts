import type { Challenge, Manifest, Target, TargetValue, TerrainType, Trait } from "../../../dataset/contract";
import type { Store } from "./store";

export interface BaseTrait {
  trait: Trait;
  earth: number;
  target: TargetValue;
  rank: number;
}

export interface BasePart {
  challenge: Challenge;
  score: number;
  best: BaseTrait | undefined;
}

export interface BasePlace {
  n: number;
  cell: number;
  lat: number;
  lon: number;
  region: string | null;
  terrain: TerrainType;
  parts: BasePart[];
}

export interface BasePlan {
  target: string;
  places: BasePlace[];
  unscored: Challenge[];
}

export async function bestPerChallenge(_store: Store, _manifest: Manifest, target: Target): Promise<BasePlan> {
  return { target: target.id, places: [], unscored: [] };
}

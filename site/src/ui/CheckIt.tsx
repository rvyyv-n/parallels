import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";
import type { Match } from "../data/match";

export interface CheckItProps {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  place: PlaceInfo;
  match: Match | undefined;
}

export function CheckIt(_: CheckItProps) {
  return <div class="checkit" data-testid="checkit" />;
}

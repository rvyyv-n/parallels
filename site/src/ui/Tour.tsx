import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { BasePlan } from "../data/base";
import type { PlaceInfo } from "../data/load";
import type { View } from "../state";

export interface TourProps {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  places: PlaceInfo[];
  selected: PlaceInfo | undefined;
  plan: BasePlan | undefined;
  chrome: boolean;
  setView: (patch: Partial<View>) => void;
  onExit: () => void;
}

export function Tour({ onExit }: TourProps) {
  return (
    <div class="tour" data-testid="tour">
      <button data-testid="tour-exit" onClick={onExit}>
        Exit the tour
      </button>
    </div>
  );
}

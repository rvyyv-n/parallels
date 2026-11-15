import type { Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";

export interface TerrainProps {
  place: PlaceInfo;
  target: Target;
  onClose: () => void;
}

export default function Terrain({ onClose }: TerrainProps) {
  return (
    <div class="terrain" role="dialog" aria-modal="true" aria-label="Terrain close-up" data-testid="terrain">
      <button data-testid="terrain-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

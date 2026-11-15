import type { Manifest, Target } from "../../../dataset/contract";
import type { BasePlan } from "../data/base";

interface Props {
  manifest: Manifest;
  target: Target;
  plan: BasePlan | undefined;
  selected: number | undefined;
  onOpen: (cell: number) => void;
}

export function Base(_: Props) {
  return (
    <section class="chapter" data-chapter="base" id="base" aria-labelledby="base-h">
      <div class="copy side">
        <h2 id="base-h">Build the whole base</h2>
      </div>
    </section>
  );
}

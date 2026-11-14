import type { Manifest, Target } from "../../../dataset/contract";
import type { View } from "../state";

interface Props {
  manifest: Manifest;
  view: View;
  onChange: (patch: Partial<View>) => void;
}

export const shortName = (t: Target) => t.name.split(" (")[0];
export const isChecked = (t: Target) => t.default;

export function Picker({ manifest, view, onChange }: Props) {
  const checked = manifest.targets.filter(isChecked);
  const unchecked = manifest.targets.filter((t) => !isChecked(t));
  const pick = (t: Target) => (
    <button key={t.id} class="chip" aria-pressed={view.target === t.id} onClick={() => onChange({ target: t.id, place: null })}>
      {shortName(t)}
    </button>
  );

  return (
    <div class="picker">
      <div class="pick-row" role="group" aria-label="Base site">
        <span class="pick-label">Base site</span>
        <div class="chips main">{checked.map(pick)}</div>
        <span class="pick-label minor">Scored, not checked</span>
        <div class="chips minor">{unchecked.map(pick)}</div>
      </div>
      <div class="pick-row" role="group" aria-label="What to practise">
        <span class="pick-label">Practise</span>
        <div class="chips main">
          {manifest.filters.map((f) => (
            <button
              key={f.id}
              class="chip"
              title={f.plain}
              aria-pressed={view.filter === f.id}
              onClick={() => onChange({ filter: f.id, place: null })}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

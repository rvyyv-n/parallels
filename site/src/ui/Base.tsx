import type { Challenge, Manifest, Target } from "../../../dataset/contract";
import { TIE_RULE, type BasePlan } from "../data/base";
import { formatValue } from "../data/match";
import { placeName } from "./Feature";
import { shortName } from "./Picker";
import "./base.css";

interface Props {
  manifest: Manifest;
  target: Target;
  plan: BasePlan | undefined;
  selected: number | undefined;
  onOpen: (cell: number) => void;
  onPeek: (cell: number | undefined) => void;
}

const plain = (reason: string) => reason.replace(/^Not scored: /, "").replace(/^./, (c) => c.toUpperCase());

function why(manifest: Manifest, target: Target, challenge: Challenge) {
  if (challenge.traits.length === 0) return challenge.labels.map((l) => plain(l.reason)).join(" ");
  const labels = challenge.traits.map((t) => manifest.traits.find((x) => x.id === t.id)!.label.toLowerCase());
  return `We have no ${shortName(target)} value for ${labels.join(", ")}.`;
}

export function Base({ manifest, target, plan, selected, onOpen, onPeek }: Props) {
  const parts = target.bin.columns.filter((c) => c.id.startsWith("ch:")).length;
  return (
    <section class="chapter" data-chapter="base" id="base" aria-labelledby="base-h">
      <div class="copy side">
        <h2 id="base-h">Build the whole base</h2>
        <p class="base-lede">Each part of the base has its own best place on Earth to practise.</p>
        {plan ? (
          <ol class="base-list" aria-label={`Best place on Earth for each part of a base at ${shortName(target)}`}>
            {plan.places.map((place) => {
              const { name, country } = placeName(place.region);
              return (
                <li key={place.cell}>
                  <button
                    class="base-place"
                    aria-pressed={place.cell === selected}
                    onClick={() => onOpen(place.cell)}
                    onPointerEnter={() => onPeek(place.cell)}
                    onPointerLeave={() => onPeek(undefined)}
                    onFocus={() => onPeek(place.cell)}
                    onBlur={() => onPeek(undefined)}
                  >
                    <span class="base-n">{place.n}</span>
                    <span class="base-body">
                      <span class="base-where">
                        <span class="base-name">{name}</span>
                        {country && country !== name && <span class="base-country">{country}</span>}
                      </span>
                      {place.parts.map(({ challenge, best }) => (
                        <span class="base-part" key={challenge.id} data-testid="base-part" data-part={challenge.id} data-cell={place.cell}>
                          <span class="base-part-name">{challenge.name}</span>
                          {best && (
                            <span class="base-pair">
                              <span class="base-trait">{best.trait.label}</span>
                              <span class="base-v">
                                {formatValue(best.earth, best.trait)}
                                <i>=</i>
                                {formatValue(best.target.value, best.trait)}
                              </span>
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div class="base-list base-wait" style={{ "--parts": parts }} aria-busy="true" />
        )}
        <details class="base-more" data-testid="base-unscored">
          <summary>Parts we could not score ({plan?.unscored.length ?? "…"}), and ties</summary>
          <ul>
            {plan?.unscored.map((c) => (
              <li key={c.id}>
                <b>{c.name}.</b> {why(manifest, target, c)}
              </li>
            ))}
            <li>
              <b>Ties.</b> {TIE_RULE}
            </li>
          </ul>
        </details>
      </div>
    </section>
  );
}

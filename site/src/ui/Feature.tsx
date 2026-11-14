import type { MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";
import { formatCoords, formatValue, type Match, type TraitRow } from "../data/match";
import { MIN_KM_APART } from "../data/places";

export const NEW_FROM_KM = MIN_KM_APART;

export const bodyName = (t: Target) => (t.body === "moon" ? "Moon" : "Mars");

export function placeName(region: string | null) {
  if (!region) return { name: "Unnamed land", country: "" };
  const cut = region.lastIndexOf(", ");
  return cut < 0 ? { name: region, country: "" } : { name: region.slice(0, cut), country: region.slice(cut + 2) };
}

export function Pairs({ rows, there }: { rows: { row: TraitRow; kind: "match" | "break" }[]; there: string }) {
  return (
    <table class="pairs">
      <thead>
        <tr>
          <td />
          <th scope="col">Earth</th>
          <th scope="col">{there}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ row, kind }) => (
          <tr key={row.trait.id} class={kind}>
            <th scope="row">
              <span class="sign" aria-hidden="true">
                {kind === "match" ? "=" : "≠"}
              </span>
              <span class="sr">{kind === "match" ? "Matches: " : "Breaks: "}</span>
              {row.trait.label}
            </th>
            <td>{formatValue(row.earth, row.trait)}</td>
            <td>{formatValue(row.target.value, row.trait)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Distance({ km }: { km: number | null }) {
  if (km === null) return null;
  return (
    <span class="distance">
      {km.toLocaleString("en")} km from the nearest known analog
      {km >= NEW_FROM_KM && <em class="new">new</em>}
    </span>
  );
}

interface Props {
  target: Target;
  filter: MissionFilter;
  place: PlaceInfo;
  match: Match | undefined;
  onOpen: () => void;
}

export function Feature({ target, filter, place, match, onOpen }: Props) {
  const { name, country } = placeName(place.region);
  const pairs = [
    match?.bestMatch && { row: match.bestMatch, kind: "match" as const },
    match?.worstBreak && { row: match.worstBreak, kind: "break" as const },
  ].filter((p) => !!p);
  return (
    <article class="feature" data-testid="feature">
      <p class="kicker">Best place on Earth to practise {filter.name.toLowerCase()}</p>
      <h2 class="place-name">{name}</h2>
      <p class="meta">
        <span class="coords">
          {country && country + " · "}
          {formatCoords(place.lat, place.lon)}
        </span>
        <Distance km={place.nearestAnalogKm} />
      </p>
      <div class="pairs-box" aria-busy={!match}>
        {pairs.length > 0 && <Pairs rows={pairs} there={bodyName(target)} />}
      </div>
      <button class="cta" onClick={onOpen}>
        See the full match
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

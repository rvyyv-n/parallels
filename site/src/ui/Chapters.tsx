import { useState } from "preact/hooks";
import type { Dataset, Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";
import { formatCoords, formatValue, monthsOf, percent, type Match, type TraitRow } from "../data/match";
import { scrollToId } from "../state";
import { bodyName, Distance, placeName } from "./Feature";
import { shortName } from "./Picker";

const ROWS_SHOWN = 4;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Source({ dataset }: { dataset: Dataset | undefined }) {
  if (!dataset) return <>no dataset named</>;
  return dataset.url ? (
    <a href={dataset.url} target="_blank" rel="noreferrer">
      {dataset.name}
    </a>
  ) : (
    <>{dataset.name}</>
  );
}

function Row({ row, kind, there }: { row: TraitRow; kind: "match" | "break"; there: string }) {
  return (
    <details class={`row ${kind}`}>
      <summary>
        <b class="v">{formatValue(row.earth, row.trait)}</b>
        <span class="what">
          <span class="tie" aria-hidden="true" />
          <span class="label">
            <span class="sr">{kind === "match" ? "matches: " : "breaks: "}</span>
            {row.trait.label}
          </span>
          <small>
            {row.usedBy.join(", ")} · {row.trait.scored_by === "ideal" && "against the ideal, not the base site · "}closer than{" "}
            {percent(row.rank ?? 0)} of land
          </small>
        </span>
        <b class="v">{formatValue(row.target.value, row.trait)}</b>
      </summary>
      <div class="source">
        <p>{row.trait.plain}</p>
        <p>
          <b>Earth:</b> {row.trait.earth_stat}. <Source dataset={row.earthDataset} />, {row.trait.earth_resolution}.
        </p>
        <p>
          <b>{there}:</b> {row.target.stat}. <Source dataset={row.targetDataset} />, {row.target.resolution}; a {row.target.kind}{" "}
          value.
        </p>
        {row.trait.note && <p>{row.trait.note}</p>}
      </div>
    </details>
  );
}

function Rows({ rows, kind, target, place }: { rows: TraitRow[]; kind: "match" | "break"; target: Target; place: PlaceInfo }) {
  const [all, setAll] = useState(false);
  const there = bodyName(target);
  const shown = all ? rows : rows.slice(0, ROWS_SHOWN);
  return (
    <div class="rows">
      <div class="rows-head">
        <span>{placeName(place.region).name}</span>
        <span>{shortName(target)}</span>
      </div>
      {shown.map((row) => (
        <Row key={row.trait.id} row={row} kind={kind} there={there} />
      ))}
      <p class="rows-foot">
        Open a row to see its datasets.
        {rows.length > ROWS_SHOWN && (
          <button class="more" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </button>
        )}
      </p>
    </div>
  );
}

interface Props {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  place: PlaceInfo;
  match: Match | undefined;
}

export function MatchChapter({ target, place, match }: Props) {
  return (
    <section class="chapter" data-chapter="match" id="match" aria-labelledby="match-h">
      <div class="copy mid">
        <h2 id="match-h">
          <span class="sign match" aria-hidden="true">
            =
          </span>
          Where it matches
        </h2>
        {match && match.similar.length > 0 && <Rows rows={match.similar} kind="match" target={target} place={place} />}
        {match && match.similar.length === 0 && <p class="none">Nothing here is closer to the base site than most of Earth's land.</p>}
      </div>
    </section>
  );
}

export function BreaksChapter({ manifest, target, place, match }: Props) {
  const there = bodyName(target);
  const missing = match?.rows.filter((r) => r.earth === null || r.rank === null) ?? [];
  return (
    <section class="chapter" data-chapter="breaks" id="breaks" aria-labelledby="breaks-h">
      <div class="copy mid">
        <h2 id="breaks-h">
          <span class="sign break" aria-hidden="true">
            ≠
          </span>
          Where it breaks
        </h2>
        {match && match.different.length > 0 && <Rows rows={match.different} kind="break" target={target} place={place} />}
        {missing.length > 0 && (
          <p class="missing">
            <b>No data here:</b> {missing.map((r) => r.trait.label).join(", ")}. We count that as missing, not as a match.
          </p>
        )}
        <div class="cant">
          <h3>No place on Earth can copy</h3>
          <table>
            <thead>
              <tr>
                <td />
                <th scope="col">Earth</th>
                <th scope="col">{there}</th>
              </tr>
            </thead>
            <tbody>
              {manifest.cant_copy.map((c) => (
                <tr key={c.name}>
                  <th scope="row">
                    <a href={c.url} target="_blank" rel="noreferrer" title={c.source}>
                      {c.name}
                    </a>
                  </th>
                  <td>{c.earth}</td>
                  <td>{c[target.body]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function monthRanges(mask: number): string {
  const on = monthsOf(mask);
  if (on.every(Boolean)) return "all year";
  if (!on.some(Boolean)) return "none";
  const runs: string[] = [];
  for (let m = 0; m < 12; m++) {
    if (!on[m]) continue;
    let end = m;
    while (end < 11 && on[end + 1]) end++;
    runs.push(end > m ? `${MONTHS[m]}–${MONTHS[end]}` : MONTHS[m]);
    m = end;
  }
  return runs.join(", ");
}

function Months({ match }: { match: Match }) {
  const lines: [string, number, string][] = [
    ["Best months", match.months.best, "best"],
    ["Freeze–thaw", match.months.freeze, "avoid"],
    ["Rainy", match.months.rain, "avoid"],
  ];
  return (
    <div class="months">
      {lines.map(([label, mask, cls]) => (
        <div class="month-line" key={label}>
          <span class="month-label">{label}</span>
          <span class={`month-cells ${cls}`} aria-hidden="true">
            {monthsOf(mask).map((on, m) => (
              <i key={m} data-on={on || undefined} data-m={MONTHS[m][0]} />
            ))}
          </span>
          <span class="month-text">{monthRanges(mask)}</span>
        </div>
      ))}
    </div>
  );
}

export function TestChapter({ manifest, target, filter, place, match }: Props) {
  const none = manifest.terrain_types.find((t) => t.key === "none");
  const type = manifest.terrain_types.find((t) => t.name === match?.terrain);
  return (
    <section class="chapter" data-chapter="test" id="test" aria-labelledby="test-h">
      <div class="copy side">
        <h2 id="test-h">What to test here</h2>
        <dl class="plan">
          <dt>Hardware</dt>
          <dd>{filter.plain}</dd>
          <dt>Tests</dt>
          <dd>{match?.challenges.map((c) => c.challenge.what_to_test).join(" ")}</dd>
          <dt>Why</dt>
          <dd>
            {match?.challenges
              .map((c) => c.reason)
              .filter(Boolean)
              .join(" ")}
          </dd>
          <dt>When</dt>
          <dd>{match && <Months match={match} />}</dd>
        </dl>
        <ul class="facts">
          <li>
            <b>{formatCoords(place.lat, place.lon)}</b> marks the middle of a square about 50 km wide.
          </li>
          <li>
            <Distance km={place.nearestAnalogKm} />
          </li>
          {match && type && (
            <li>
              <b>Terrain type: {type.name}.</b>{" "}
              {type.key === "none" && none
                ? `It meets none of our terrain rules, like ${percent(none.cells / manifest.grid.n)} of land.`
                : type.rule}
            </li>
          )}
          {match?.stable !== null && match?.stable !== undefined && (
            <li>
              {match.stable ? "It keeps its place when we change the weights." : "It loses its place when we change the weights."}{" "}
              <button class="text-link" onClick={() => scrollToId("checked")}>
                How we checked it
              </button>
            </li>
          )}
        </ul>
        {match && match.labels.length > 0 && (
          <details class="unscored">
            <summary>What we could not score ({match.labels.length})</summary>
            <ul>
              {match.labels.map(({ challenge, label, shown }) => (
                <li key={challenge.id + label.name}>
                  <b>{label.name}</b> ({challenge.name}). {label.reason}
                  {shown?.value !== null && shown?.value !== undefined && ` ${bodyName(target)}: ${shown.value}.`}
                  {label.earth_text && ` Earth: ${label.earth_text}.`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

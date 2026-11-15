import { useState } from "preact/hooks";
import type { LabelPoint, Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";
import { monthsOf, type Match } from "../data/match";
import { placeName } from "../ui/Feature";
import {
  analogsOf,
  BODIES,
  BODY_NAME,
  cantCopy,
  gravity,
  mapPosition,
  monthState,
  tempPairs,
  tempText,
  testedThere,
  weight,
  WORLD_NAME,
  type TempSide,
  type World,
} from "./learn";
import loads from "./loads.json";
import photos from "./photos.json";

const IMG = import.meta.env.BASE_URL + "img/";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_NAME: Record<string, string> = { Gravity: "Gravity", Air: "Air", "Radiation on the surface": "Radiation" };
const TEMP_LABEL: Record<string, string> = {
  cold: "Coldest",
  season_swing: "Summer to winter",
  day_swing_air: "Day to night",
  day_swing_ground: "Day to night",
};
const TEMP_TEXT: Record<string, string> = {
  cold: "The coldest the ground gets.",
  season_swing: "How far the ground's temperature swings over a year.",
  day_swing_air: "How far the air's temperature swings between day and night.",
  day_swing_ground: "How far the ground's temperature swings between day and night.",
};
const LEDE: Record<World, string> = {
  moon: "A base at the Moon's south pole must live with weak gravity, no air, deep cold and strong radiation. Earth can practise some of this, not all.",
  mars: "A base in Jezero crater must live with weak gravity, thin air, cold nights, dust and radiation. Earth can practise some of this, not all.",
};

const kg = (n: number) => n.toLocaleString("en");
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const short = (text: string) => text.split(" (")[0];

function Heading({ id, n, children }: { id: string; n: number; children: string }) {
  return (
    <h2 id={id} class="learn-h">
      <span class="learn-n" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      {children}
    </h2>
  );
}

export function Meet({ manifest, target, world }: { manifest: Manifest; target: Target; world: World }) {
  const rows = ["Gravity", "Air", "Radiation on the surface"].map((name) => cantCopy(manifest, name));
  return (
    <section class="learn-sec learn-meet" data-testid="learn-meet" aria-labelledby="meet-h">
      <div class="learn-globe" role="img" aria-label={`${BODY_NAME[world]}, turning: a NASA photo map`} style={{ "--map": `url(${IMG}${world}-1024.jpg)` }} />
      <div class="learn-copy">
        <p class="learn-kicker">New to {WORLD_NAME[world]}?</p>
        <h1 id="meet-h">Meet {WORLD_NAME[world]}</h1>
        <p class="learn-lede">{LEDE[world]}</p>
        <dl class="learn-stats">
          {rows.map((r) => (
            <div key={r.name}>
              <dt>{SHORT_NAME[r.name]}</dt>
              <dd class="learn-stat">{r[world]}</dd>
              <dd class="learn-src">
                <a href={r.url}>{r.source}</a>
              </dd>
            </div>
          ))}
        </dl>
        <details class="learn-more">
          <summary>About the base site: {target.short}</summary>
          <ul class="learn-facts">
            {target.facts.map((f) => (
              <li key={f.text}>
                {f.text}. <a href={f.url}>{f.source}</a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

function SourceLine({ side }: { side: TempSide }) {
  const name = side.dataset ? short(side.dataset.name) : "no dataset";
  return (
    <span class="learn-src">
      {side.dataset?.url ? <a href={side.dataset.url}>{name}</a> : name} · {short(side.resolution)}
    </span>
  );
}

interface TempsProps {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  places: PlaceInfo[] | undefined;
  match: Match | undefined;
}

export function Temps({ manifest, target, filter, places, match }: TempsProps) {
  const [shown, setShown] = useState(0);
  const ready = places && match;
  const pairs = ready ? tempPairs(manifest, target, match) : [];
  const pair = pairs[shown];
  const best = places && placeName(places[0].region);
  const max = pair ? Math.max(Math.abs(pair.world.value ?? 0), Math.abs(pair.earth.value ?? 0)) : 1;
  return (
    <section class="learn-sec learn-temps" data-testid="learn-temps" aria-labelledby="temps-h" aria-busy={!ready}>
      <Heading id="temps-h" n={1}>
        Hot and cold
      </Heading>
      {pair && best && (
        <>
          <p class="learn-lede">
            The base site against its best place on Earth ({filter.name.toLowerCase()} filter): {best.name}
            {best.country && `, ${best.country}`}.
          </p>
          <div class="chips learn-switch" role="group" aria-label="Temperature to show">
            {pairs.map((p, k) => (
              <button key={p.row.trait.id} class="chip" aria-pressed={k === shown} onClick={() => setShown(k)}>
                {TEMP_LABEL[p.row.trait.id]}
              </button>
            ))}
          </div>
          <p class="learn-note">{TEMP_TEXT[pair.row.trait.id]}</p>
          <ul class="learn-temp-rows">
            {(
              [
                ["world", target.short, pair.world],
                ["earth", best.name, pair.earth],
              ] as const
            ).map(([kind, who, side]) => (
              <li key={kind} class="learn-temp" data-kind={kind}>
                <span class="learn-who">{who}</span>
                <span class="learn-bar" aria-hidden="true">
                  <i style={{ transform: `scaleX(${side.value === null ? 0 : Math.abs(side.value) / max})` }} />
                </span>
                <span class="learn-num" data-testid={`temp-${kind}`}>
                  {tempText(side, pair.row)}
                </span>
                <SourceLine side={side} />
              </li>
            ))}
          </ul>
          <p class={`learn-verdict ${pair.close ? "is-match" : "is-break"}`}>
            <span aria-hidden="true">{pair.close ? "=" : "≠"}</span>
            {pair.close ? "Close: Earth can practise this." : "Far apart: Earth can't copy this."}
          </p>
        </>
      )}
    </section>
  );
}

interface YearProps {
  places: PlaceInfo[] | undefined;
  months: Match["months"][] | undefined;
  filter: MissionFilter;
}

export function Year({ places, months, filter }: YearProps) {
  const [month, setMonth] = useState(() => new Date().getMonth());
  const ready = places && months;
  return (
    <section class="learn-sec learn-year" data-testid="learn-year" aria-labelledby="year-h" aria-busy={!ready}>
      <Heading id="year-h" n={2}>
        A year on Earth
      </Heading>
      <p class="learn-lede">Seasons decide when a test can run. Slide through the year for the five best places ({filter.name.toLowerCase()}).</p>
      <div class="learn-month">
        <label for="learn-month" class="sr">
          Month
        </label>
        <input
          id="learn-month"
          class="learn-slider"
          type="range"
          min={0}
          max={11}
          step={1}
          value={month}
          aria-valuetext={MONTHS[month]}
          onInput={(e) => setMonth(Number(e.currentTarget.value))}
        />
        <output for="learn-month" class="learn-month-name" data-testid="month-name">
          {MONTHS[month]}
        </output>
      </div>
      {ready && (
        <ol class="learn-places">
          {places.map((p, k) => {
            const m = months[k];
            const state = monthState(m, month);
            const tags = [state.best && "Best month", state.freeze && "Freeze–thaw", state.rain && "Rainy"].filter((t) => !!t);
            const { name, country } = placeName(p.region);
            const best = monthsOf(m.best);
            const avoid = monthsOf(m.freeze | m.rain);
            return (
              <li key={p.cell} data-testid="year-place" data-best={state.best} data-freeze={state.freeze} data-rain={state.rain}>
                <span class="learn-place">
                  {name}
                  {country && <small>{country}</small>}
                </span>
                <span class="learn-cells" aria-hidden="true">
                  {best.map((on, i) => (
                    <i key={i} data-best={on || undefined} data-avoid={avoid[i] || undefined} data-now={i === month || undefined} />
                  ))}
                </span>
                <span class="learn-tags">
                  {tags.length ? tags.map((t) => <b key={t} class={t === "Best month" ? "is-match" : "is-break"}>{t}</b>) : <b>Neither</b>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function CantCopy({ manifest, world }: { manifest: Manifest; world: World }) {
  const [id, setId] = useState(loads[0].id);
  const load = loads.find((l) => l.id === id)!;
  const g = gravity(manifest);
  const grav = cantCopy(manifest, "Gravity");
  const weights = BODIES.map((b) => weight(load.mass_kg, g[b]));
  const max = Math.max(...weights);
  return (
    <section class="learn-sec learn-cant" data-testid="learn-cant" aria-labelledby="cant-h">
      <Heading id="cant-h" n={3}>
        What Earth can't copy
      </Heading>
      <p class="learn-lede">Weight is how hard gravity pulls: mass × gravity, in newtons (N). Pick a load.</p>
      <div class="chips learn-switch" role="group" aria-label="Load">
        {loads.map((l) => (
          <button key={l.id} class="chip" aria-pressed={l.id === id} onClick={() => setId(l.id)}>
            {l.short}
          </button>
        ))}
      </div>
      <p class="learn-load">
        {load.name}: <b class="learn-mono">{kg(load.mass_kg)} kg</b>. <a href={load.url}>{load.source}</a>
      </p>
      <ul class="learn-weights">
        {BODIES.map((b, k) => (
          <li key={b} data-body={b} data-here={b === world || undefined}>
            <span class="learn-who">{BODY_NAME[b]}</span>
            <span class="learn-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${weights[k] / max})` }} />
            </span>
            <span class="learn-num" data-testid={`weight-${b}`}>
              {kg(load.mass_kg)} kg × {g[b]} m/s² = <b>{kg(Math.round(weights[k]))} N</b>
            </span>
          </li>
        ))}
      </ul>
      <p class="learn-src">
        Gravity: <a href={grav.url}>{grav.source}</a>
      </p>
      <dl class="learn-pairs">
        {["Air", "Radiation on the surface"].map((name) => {
          const r = cantCopy(manifest, name);
          return (
            <div key={name}>
              <dt>{SHORT_NAME[name]}</dt>
              <dd>
                <span>Earth: {r.earth}</span>
                <span class="learn-ne" aria-label="is not">
                  ≠
                </span>
                <span>
                  {BODY_NAME[world]}: {r[world]}
                </span>
                <a class="learn-src" href={r.url}>
                  {r.source}
                </a>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function Analogs({ labels, world }: { labels: LabelPoint[] | undefined; world: World }) {
  const points = labels ? analogsOf(labels, world).sort((a, b) => a.lon - b.lon) : [];
  const [chosen, setChosen] = useState("haughton-crater-devon-island");
  const point = points.find((p) => p.id === chosen) ?? points[0];
  const link = point && (point.analog_source ?? point.source);
  return (
    <section class="learn-sec learn-analogs" data-testid="learn-analogs" aria-labelledby="analogs-h">
      <Heading id="analogs-h" n={4}>
        Tested on Earth first
      </Heading>
      <p class="learn-lede">
        Teams already practise for {WORLD_NAME[world]} at these {points.length} places. Choose one.
      </p>
      <div class="learn-map">
        <img src={`${IMG}earth-1024.jpg`} alt="" width={1024} height={512} loading="lazy" />
        {points.map((p) => {
          const { x, y } = mapPosition(p.lat, p.lon);
          return (
            <button
              key={p.id}
              class="learn-pin"
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              aria-label={`${p.name}, ${p.country}`}
              aria-pressed={p.id === point?.id}
              data-id={p.id}
              onClick={() => setChosen(p.id)}
            />
          );
        })}
      </div>
      {point && (
        <div class="learn-analog" data-testid="analog-card" aria-live="polite">
          <h3>{point.name}</h3>
          <p class="learn-country">{point.country}</p>
          <p>{testedThere(point.note)}</p>
          <a class="learn-src" href={link}>
            Source: {host(link)}
          </a>
        </div>
      )}
    </section>
  );
}

export function Photos() {
  return (
    <section class="learn-sec learn-photos" data-testid="learn-photos" aria-labelledby="photos-h">
      <Heading id="photos-h" n={5}>
        Same process, two worlds
      </Heading>
      {photos.map((pair) => (
        <figure key={pair.pair} class="learn-pair">
          <div class="learn-pair-imgs">
            {pair.photos.map((p) => (
              <div key={p.file} class="learn-photo">
                <img src={`${IMG}learn/${p.file}`} alt={p.alt} loading="lazy" />
                <span class="learn-tag">{p.world}</span>
              </div>
            ))}
          </div>
          <figcaption>
            {pair.line}
            <small>{pair.photos.map((p) => p.credit).join(" · ")}</small>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

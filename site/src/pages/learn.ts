import "./learn.css";
import { placeName } from "../card";
import type { Body, LabelPoint, Manifest, Target, Trait } from "../contract";
import type { Cols } from "../data";
import { bits, esc, num, reduced, unit } from "../format";
import type { Page } from "../router";
import { top } from "../score";
import { home, type Ctx } from "./ctx";
import { LOADS, PHOTOS } from "./learn-data";

const IMG = `${import.meta.env.BASE_URL}img/`;
const WORLD = { moon: "the Moon", mars: "Mars" };
const NAME = { earth: "Earth", moon: "Moon", mars: "Mars" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CLOSE = 0.8;
const TEMPS: Record<string, [string, string]> = {
  cold: ["Coldest", "The coldest the ground gets."],
  season_swing: ["Summer to winter", "How far the ground's temperature swings over a year."],
  day_swing_air: ["Day to night", "How far the air's temperature swings between day and night."],
  day_swing_ground: ["Day to night, ground", "How far the ground's temperature swings between day and night."],
};
const KELVIN: Record<string, string> = { cold: "t_min_k" };
const LEDE: Record<Body, (t: Target) => string> = {
  moon: () => "A base at the Moon's south pole must live with weak gravity, no air, deep cold and strong radiation. Earth can practise some of this, not all.",
  mars: (t) => `A base at ${t.short} must live with weak gravity, thin air, cold nights, dust and radiation. Earth can practise some of this, not all.`,
};
const STATS = [
  ["Gravity", "Gravity"],
  ["Air", "Air"],
  ["Radiation on the surface", "Radiation"],
] as const;

interface Side {
  value: number;
  kelvin: number | null;
  source: string;
  url: string;
  res: string;
}

interface Pair {
  trait: Trait;
  world: Side;
  earth: Side;
  close: boolean;
}

const ext = (url: string, text: string, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const short = (s: string) => s.split(" (")[0];
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const firstNumber = (s: string) => Number(s.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0] ?? NaN);
const heading = (id: string, n: number, text: string) =>
  `<h2 id="${id}" class="ln-h"><span class="ln-n" aria-hidden="true">${String(n).padStart(2, "0")}</span>${esc(text)}</h2>`;

function split(name: string) {
  const i = name.lastIndexOf(", ");
  return i < 0 ? { name, country: "" } : { name: name.slice(0, i), country: name.slice(i + 2) };
}

function dataset(m: Manifest, id: string) {
  const d = m.datasets.find((x) => x.id === id);
  return { source: d ? short(d.name) : id, url: d?.url ?? "" };
}

function gravity(m: Manifest) {
  const g = m.cant_copy.find((r) => r.name === "Gravity");
  if (!g) return null;
  const v = { earth: firstNumber(g.earth), moon: firstNumber(g.moon), mars: firstNumber(g.mars) };
  return Object.values(v).every(Number.isFinite) ? { row: g, v } : null;
}

function testedThere(note: string | undefined) {
  const text = (note ?? "").replace(/^Used for:[^.]*\.\s*/, "");
  return text.split(/(?<=\.)\s+(?=[A-Z])/)[0];
}

function usedFor(note: string | undefined, w: Body) {
  const m = (note ?? "").match(/^Used for:\s*([^.]*)\./);
  if (!m) return "";
  const parts = m[1].split(";").map((s) => s.trim());
  if (parts.length === 1 && !/^(Moon|Mars):/.test(parts[0])) return parts[0];
  return parts.find((p) => p.startsWith(`${NAME[w]}:`))?.replace(/^\w+:\s*/, "") ?? "";
}

function pairs(m: Manifest, t: Target, cells: Cols, cols: Cols, i: number): Pair[] {
  const out: Pair[] = [];
  for (const tr of m.traits) {
    const col = tr.column[t.body];
    const tv = t.values[tr.id];
    if (!TEMPS[tr.id] || !col || !tv || tv.value == null || !cells[col]) continue;
    const earth = cells[col][i];
    if (!Number.isFinite(earth)) continue;
    const k = KELVIN[tr.id] ? t.shown[KELVIN[tr.id]] : undefined;
    const kv = k?.value ?? null;
    const w = kv != null && k ? { value: kv - 273.15, kelvin: kv, ...dataset(m, k.dataset), res: k.resolution } : { value: tv.value, kelvin: null, ...dataset(m, tv.dataset), res: tv.resolution };
    const rank = cols[`rank:${tr.id}`]?.[i];
    out.push({
      trait: tr,
      world: w,
      earth: { value: earth, kelvin: null, ...dataset(m, tr.earth_dataset), res: tr.earth_resolution },
      close: Number.isFinite(rank) && rank >= CLOSE,
    });
  }
  return out;
}

const temp = (s: Side, tr: Trait) => `${num(s.value, 1)}${unit(tr.unit)}${s.kelvin == null ? "" : ` <small>(${num(s.kelvin, 1)} K)</small>`}`;
const srcLine = (s: Side) => `<span class="ln-src">${s.url ? ext(s.url, s.source) : esc(s.source)} · ${esc(short(s.res))}</span>`;

function meet(m: Manifest, t: Target, w: Body) {
  const rows = STATS.map(([n, label]) => ({ r: m.cant_copy.find((x) => x.name === n), label })).filter((x) => x.r);
  return `<section class="ln-sec ln-meet" data-testid="learn-meet" aria-labelledby="meet-h">
    <div class="ln-globe" role="img" aria-label="${esc(`${NAME[w]}, turning: a NASA photo map`)}" style="--map:url('${IMG}${w}.jpg')"></div>
    <div class="ln-copy">
      <p class="ln-k">New to ${esc(WORLD[w])}?</p>
      <h1 id="meet-h" tabindex="-1">Meet ${esc(WORLD[w])}</h1>
      <p class="ln-lede">${esc(LEDE[w](t))}</p>
      <dl class="ln-stats">${rows
        .map(({ r, label }) => `<div><dt>${esc(label)}</dt><dd class="ln-stat">${esc(r![w])}</dd><dd class="ln-src">${ext(r!.url, r!.source)}</dd></div>`)
        .join("")}</dl>
      ${
        t.facts.length
          ? `<details class="ln-more"><summary>About the base site: ${esc(t.short)}</summary><ul class="ln-facts">${t.facts
              .map((f) => `<li>${esc(f.text)}. ${ext(f.url, f.source)}</li>`)
              .join("")}</ul></details>`
          : ""
      }
    </div>
  </section>`;
}

function cant(m: Manifest, w: Body) {
  const g = gravity(m);
  const others = STATS.slice(1)
    .map(([n, label]) => ({ r: m.cant_copy.find((x) => x.name === n), label }))
    .filter((x) => x.r);
  return `<section class="ln-sec ln-cant" data-testid="learn-cant" aria-labelledby="cant-h">
    ${heading("cant-h", 3, "What Earth can't copy")}
    ${
      g
        ? `<p class="ln-lede">Weight is how hard gravity pulls: mass × gravity, in newtons (N). Pick a load.</p>
      <div class="chips ln-switch" role="group" aria-label="Load">${LOADS.map(
        (l, k) => `<button type="button" class="chip" data-load="${esc(l.id)}" aria-pressed="${k === 0}">${esc(l.short)}</button>`,
      ).join("")}</div>
      <p class="ln-load" id="ln-load"></p>
      <ul class="ln-weights" id="ln-weights"></ul>
      <p class="ln-src">Gravity: ${ext(g.row.url, g.row.source)}</p>`
        : ""
    }
    <dl class="ln-pairs">${others
      .map(
        ({ r, label }) => `<div><dt>${esc(label)}</dt><dd><span>Earth: ${esc(r!.earth)}</span><span class="ln-ne" aria-label="is not">≠</span><span>${esc(NAME[w])}: ${esc(
          r![w],
        )}</span>${ext(r!.url, r!.source, "ln-src")}</dd></div>`,
      )
      .join("")}</dl>
  </section>`;
}

function weights(m: Manifest, w: Body, id: string) {
  const g = gravity(m)!;
  const l = LOADS.find((x) => x.id === id) ?? LOADS[0];
  const bodies = ["earth", "moon", "mars"] as const;
  const n = bodies.map((b) => l.kg * g.v[b]);
  const max = Math.max(...n);
  return {
    load: `${esc(l.name)}: <b>${num(l.kg)} kg</b>. ${ext(l.url, l.source)}`,
    rows: bodies
      .map(
        (b, k) => `<li data-body="${b}"${b === w ? " data-here" : ""}><span class="ln-who">${esc(NAME[b])}</span><span class="ln-bar" aria-hidden="true"><i style="transform:scaleX(${(
          n[k] / max
        ).toFixed(4)})"></i></span><span class="ln-num" data-testid="weight-${b}">${num(l.kg)} kg × ${num(g.v[b], 2)} m/s² = <b>${num(Math.round(n[k]))} N</b></span></li>`,
      )
      .join(""),
  };
}

function photos() {
  return `<section class="ln-sec ln-photos" data-testid="learn-photos" aria-labelledby="photos-h">
    ${heading("photos-h", 5, "Same process, two worlds")}
    <p class="ln-lede">The same forces shape Earth and its neighbours. NASA photos, one pair per process.</p>
    <div class="ln-pairs-grid">${PHOTOS.map(
      (p) => `<figure class="ln-pair" data-pair="${esc(p.pair)}"><div class="ln-pair-imgs">${p.photos
        .map(
          (x) =>
            `<div class="ln-photo"><img src="${IMG}learn/${esc(x.file)}" alt="${esc(x.alt)}" loading="lazy" decoding="async"><span class="ln-tag">${esc(x.world)}</span></div>`,
        )
        .join("")}</div><figcaption>${esc(p.line)}<small>${p.photos.map((x) => `${esc(x.credit)} (${esc(x.id)})`).join(" · ")}</small></figcaption></figure>`,
    ).join("")}</div>
  </section>`;
}

export function learnPage(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let world: Body | null = null;
  let seq = 0;
  let month = new Date().getMonth();
  let masks: { name: string; best: number; freeze: number; rain: number }[] = [];
  let tempPairs: Pair[] = [];
  let bestName = "";
  let target: Target;
  let points: LabelPoint[] = [];

  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q);

  const drawLoad = (id: string) => {
    if (!gravity(m) || !world) return;
    const r = weights(m, world, id);
    $("#ln-load")!.innerHTML = r.load;
    $("#ln-weights")!.innerHTML = r.rows;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-load]")) b.setAttribute("aria-pressed", String(b.dataset.load === id));
  };

  const drawTemp = (k: number) => {
    const box = $("#ln-temp");
    const p = tempPairs[k];
    if (!box || !p) return;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-temp]")) b.setAttribute("aria-pressed", String(Number(b.dataset.temp) === k));
    const max = Math.max(Math.abs(p.world.value), Math.abs(p.earth.value)) || 1;
    const row = (kind: string, who: string, s: Side) =>
      `<li class="ln-temp" data-kind="${kind}"><span class="ln-who">${esc(who)}</span><span class="ln-bar" aria-hidden="true"><i style="transform:scaleX(${(Math.abs(s.value) / max).toFixed(
        4,
      )})"></i></span><span class="ln-num" data-testid="temp-${kind}">${temp(s, p.trait)}</span>${srcLine(s)}</li>`;
    box.innerHTML = `<p class="ln-note">${esc(TEMPS[p.trait.id][1])}</p>
      <ul class="ln-rows">${row("world", target.short, p.world)}${row("earth", bestName, p.earth)}</ul>
      <p class="ln-verdict ${p.close ? "is-match" : "is-break"}"><span aria-hidden="true">${p.close ? "=" : "≠"}</span>${
        p.close ? "Close: Earth can practise this." : "Far apart: Earth can't copy this."
      }</p>`;
  };

  const drawYear = () => {
    const out = $("#ln-month-name");
    if (out) out.textContent = MONTHS[month];
    const list = $("#ln-places");
    if (!list) return;
    list.innerHTML = masks
      .map((p) => {
        const best = bits(p.best);
        const frz = bits(p.freeze);
        const rain = bits(p.rain);
        const tags = best[month]
          ? [["Best month", "is-match"]]
          : [frz[month] && ["Freeze–thaw", "is-break"], rain[month] && ["Rainy", "is-break"]].filter((x): x is string[] => !!x);
        if (!tags.length) tags.push(["Frozen", "is-break"]);
        const { name, country } = split(p.name);
        return `<li data-testid="year-place" data-best="${best[month]}" data-freeze="${frz[month]}" data-rain="${rain[month]}">
          <span class="ln-place">${esc(name)}${country ? `<small>${esc(country)}</small>` : ""}</span>
          <span class="ln-cells" aria-hidden="true">${best.map((on, i) => `<i${on ? " data-best" : " data-avoid"}${i === month ? " data-now" : ""}></i>`).join("")}</span>
          <span class="ln-tags">${tags.map(([t, c]) => `<b class="${c}">${esc(t)}</b>`).join("")}</span>
        </li>`;
      })
      .join("");
  };

  const drawAnalog = (id: string) => {
    const p = points.find((x) => x.id === id) ?? points[0];
    const card = $("#ln-analog");
    if (!p || !card || !world) return;
    for (const b of el.querySelectorAll<HTMLButtonElement>(".ln-pin")) b.setAttribute("aria-pressed", String(b.dataset.id === p.id));
    const link = p.analog_source ?? p.source;
    const used = usedFor(p.note, world);
    card.innerHTML = `<h3>${esc(p.name)}</h3>${p.country ? `<p class="ln-country">${esc(p.country)}</p>` : ""}${
      used ? `<p class="ln-used">Practised here: <b>${esc(used)}</b></p>` : ""
    }<p>${esc(testedThere(p.note))}</p>${link ? `<p>${ext(link, `Source: ${host(link)}`, "ln-src")}</p>` : ""}`;
  };

  async function fill(w: Body, mine: number) {
    const t = target;
    const filter = m.filters[0];
    const [d, cols, labels] = await Promise.all([ctx.data(), ctx.cols(t), ctx.labels()]);
    if (mine !== seq) return;
    const cells = d.cells;
    const score = cols[`score:${filter.id}`];
    const ids = score ? top(score, 5, cells).ids : [];

    const tempsBox = $("#ln-temps-body")!;
    if (ids.length) {
      const i = ids[0];
      bestName = placeName(m, cells, i);
      tempPairs = pairs(m, t, cells, cols, i);
      const { name, country } = split(bestName);
      tempsBox.innerHTML = tempPairs.length
        ? `<p class="ln-lede">The base site against its best place on Earth for the ${esc(filter.name.toLowerCase())} test: <b>${esc(name)}</b>${country ? `, ${esc(country)}` : ""}.</p>
          <div class="chips ln-switch" role="group" aria-label="Temperature to show">${tempPairs
            .map((p, k) => `<button type="button" class="chip" data-temp="${k}" aria-pressed="${k === 0}">${esc(TEMPS[p.trait.id][0])}</button>`)
            .join("")}</div><div id="ln-temp"></div>`
        : `<p class="ln-lede">No measured temperatures for this base site.</p>`;
      drawTemp(0);
    } else tempsBox.innerHTML = `<p class="ln-lede">No ranked land for this base site.</p>`;
    $("#ln-temps")!.setAttribute("aria-busy", "false");

    const yr = $("#ln-year")!;
    masks = ids.map((i) => ({ name: placeName(m, cells, i), best: cells.m_best?.[i] ?? NaN, freeze: cells.m_freeze?.[i] ?? NaN, rain: cells.m_rain?.[i] ?? NaN }));
    $("#ln-year-lede")!.textContent = `Seasons decide when a test can run. Slide through the year for the five best places for ${t.short} (${filter.name.toLowerCase()} test).`;
    drawYear();
    yr.setAttribute("aria-busy", "false");

    points = labels.filter((l) => l.kind === "known_analog" && l.groups?.some((g) => g.startsWith(`${w}-`))).sort((a, b) => a.lon - b.lon);
    $("#ln-analog-lede")!.textContent = `Teams already practise for ${WORLD[w]} at these ${points.length} places. Choose one.`;
    $("#ln-pins")!.innerHTML = points
      .map(
        (p) =>
          `<button type="button" class="ln-pin" data-id="${esc(p.id)}" style="left:${(((p.lon + 180) / 360) * 100).toFixed(3)}%;top:${(((90 - p.lat) / 180) * 100).toFixed(3)}%" aria-label="${esc(
            p.country ? `${p.name}, ${p.country}` : p.name,
          )}" aria-pressed="false"></button>`,
      )
      .join("");
    drawAnalog(points.some((p) => p.id === "haughton-crater-devon-island") ? "haughton-crater-devon-island" : (points[0]?.id ?? ""));
    $("#ln-analogs")!.setAttribute("aria-busy", "false");
  }

  function render(w: Body) {
    target = home(m, w)!;
    const filter = m.filters[0];
    el.dataset.world = w;
    el.innerHTML = `<div class="ln" data-testid="learn" data-world="${w}">
      <nav class="ln-worlds" aria-label="World">${(["moon", "mars"] as const)
        .map((b) => `<a href="#/learn?world=${b}" data-world="${b}"${b === w ? ' aria-current="page"' : ""}>Explore ${esc(WORLD[b])}</a>`)
        .join("")}</nav>
      ${meet(m, target, w)}
      <section class="ln-sec" id="ln-temps" data-testid="learn-temps" aria-labelledby="temps-h" aria-busy="true">
        ${heading("temps-h", 1, "Hot and cold")}
        <div id="ln-temps-body"><p class="ln-wait">Loading the measured temperatures…</p></div>
      </section>
      <section class="ln-sec" id="ln-year" data-testid="learn-year" aria-labelledby="year-h" aria-busy="true">
        ${heading("year-h", 2, "A year on Earth")}
        <p class="ln-lede" id="ln-year-lede">Seasons decide when a test can run.</p>
        <div class="ln-month">
          <label for="ln-month" class="sr">Month</label>
          <input id="ln-month" class="ln-slider" type="range" min="0" max="11" step="1" value="${month}" aria-valuetext="${MONTHS[month]}">
          <output for="ln-month" class="ln-month-name" id="ln-month-name" data-testid="month-name">${MONTHS[month]}</output>
        </div>
        <p class="ln-key"><span><i data-best></i>Best month: no freeze–thaw, rain or frost</span><span><i data-avoid></i>Freeze–thaw, rainy or frozen</span></p>
        <ol class="ln-places" id="ln-places"></ol>
        <p class="ln-src">Months from ${ext(m.datasets.find((x) => x.id === "power_merra2")?.url ?? "https://power.larc.nasa.gov/", "NASA POWER climatology (MERRA-2)")}, per patch of about 50 km. Places ranked with the ${esc(
          filter.name.toLowerCase(),
        )} test, as in the Finder.</p>
      </section>
      ${cant(m, w)}
      <section class="ln-sec" id="ln-analogs" data-testid="learn-analogs" aria-labelledby="analogs-h" aria-busy="true">
        ${heading("analogs-h", 4, "Tested on Earth first")}
        <p class="ln-lede" id="ln-analog-lede">Teams already practise at these places.</p>
        <div class="ln-map-wrap">
          <div class="ln-map"><img src="${IMG}blue-marble-4k.jpg" alt="" width="4096" height="2048" loading="lazy" decoding="async"><div class="ln-pins" id="ln-pins"></div></div>
          <div class="ln-analog" id="ln-analog" data-testid="analog-card" aria-live="polite"></div>
        </div>
      </section>
      ${photos()}
      <section class="ln-sec ln-end" aria-labelledby="end-h">
        <h2 id="end-h" class="ln-h">Your turn</h2>
        <p class="ln-lede">See where Earth matches ${esc(target.short)}, and where it breaks.</p>
        <a class="ln-cta" data-testid="learn-find" href="#/find?t=${encodeURIComponent(target.id)}">Find Earth's matches <span aria-hidden="true">→</span></a>
      </section>
    </div>`;
    drawLoad(LOADS[0].id);
    const mine = ++seq;
    fill(w, mine).catch(() => {
      if (mine !== seq) return;
      for (const id of ["ln-temps-body", "ln-places"]) {
        const box = $(`#${id}`);
        if (box) box.innerHTML = `<p class="ln-wait">The data files could not be loaded. Please reload the page.</p>`;
      }
    });
  }

  return {
    title: () => "Learn",
    mount(e) {
      el = e;
      el.addEventListener("click", (ev) => {
        const b = (ev.target as Element).closest<HTMLElement>("[data-load],[data-temp],.ln-pin");
        if (!b) return;
        if (b.dataset.load) drawLoad(b.dataset.load);
        else if (b.dataset.temp) drawTemp(Number(b.dataset.temp));
        else if (b.dataset.id) drawAnalog(b.dataset.id);
      });
      el.addEventListener("input", (ev) => {
        const s = ev.target as HTMLInputElement;
        if (s.id !== "ln-month") return;
        month = Number(s.value);
        s.setAttribute("aria-valuetext", MONTHS[month]);
        drawYear();
      });
      el.classList.toggle("ln-still", reduced());
    },
    show(q) {
      const w: Body = q.get("world") === "mars" ? "mars" : "moon";
      if (w === world) return;
      world = w;
      render(w);
      $("h1")?.focus({ preventScroll: true });
    },
  };
}

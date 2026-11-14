import "@fontsource-variable/archivo/wdth.css";
import "./style.css";
import "./intro.css";
import "./work.css";
import type { Manifest, Target } from "./contract";
import { BASE, load, loadLabels, loadValidation, manifest, targetCols, type Cols, type Data } from "./data";
import { handScore, rankOf, top } from "./score";
import type { Earth } from "./earth";
import { BODY, card, isIce, placeName, terrainOf, wireCard } from "./card";
import { NAV, sections, wire } from "./sections";
import { esc, latlon, num, reduced, score100, webgl } from "./format";
import { colour, gradient } from "./ramp";
import { logo } from "./logo";
import { icon } from "./icons";
import { fillAnalogs, headline, wireWorlds, worlds } from "./worlds";
import type { Intro } from "./intro";

interface State {
  target: string;
  filter: string;
  yr: boolean;
  type: number | null;
  hand: Record<string, number> | null;
  cell: number;
}

const TEXTURE = { moon: "img/moon.jpg", mars: "img/mars.jpg" };
const AI_NOTE =
  "How we used AI: the idea and the key design decisions are our team's. Claude (Anthropic) helped research the challenge, write our planning documents, and write and test the code and data pipeline. Our logo was drawn with AI. We check its work at each checkpoint.";

const WHY = `<a class="why" href="#card">Why it matches<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>`;

const CHAPTERS = [
  { id: "ch-hero", name: "Start" },
  { id: "ch-count", name: "All of Earth's land" },
  { id: "ch-moon", name: "The Moon" },
  { id: "ch-mars", name: "Mars" },
  { id: "ch-test", name: "The test" },
  { id: "ch-answer", name: "Earth's answer" },
];

const next = (id: string, label: string) =>
  `<a class="chap-next" href="#${id}"><span>${label}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>`;

function facts(m: Manifest, body: "moon" | "mars") {
  return `<div class="facts"><p class="facts-k">${icon("cant")}Earth can't copy</p><dl>${m.cant_copy
    .map((c) => {
      const [big, rest] = headline(c[body]);
      return `<div><dt>${esc(c.name)}</dt><dd><b>${esc(big)}</b>${rest ? `<span>${esc(rest)}</span>` : ""}<small>${esc(c.source)}</small></dd></div>`;
    })
    .join("")}</dl></div>`;
}

const TEST_ICON: Record<string, string> = { rover: "surface", life_support: "resources", habitat: "shelter" };

function thumb(cv: HTMLCanvasElement, t: Target) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const mark = () => {
    ctx.strokeStyle = "#4fd8ff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(44, 44, 9, 0, Math.PI * 2);
    ctx.stroke();
  };
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const span = w / 9;
    if (Math.abs(t.lat) > 75) {
      const cap = h / 6;
      ctx.drawImage(img, 0, t.lat < 0 ? h - cap : 0, w, cap, 0, 0, 88, 88);
    } else ctx.drawImage(img, ((t.lon + 180) / 360) * w - span / 2, ((90 - t.lat) / 180) * h - span / 2, span, span, 0, 0, 88, 88);
    mark();
  };
  img.src = `${import.meta.env.BASE_URL}${TEXTURE[t.body]}`;
}

const GIBS_BM = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8";

function groundThumb(lat: number, lon: number) {
  const bx = ((lon + 180) / 360) * 100;
  const by = ((90 - lat) / 180) * 100;
  const base = `<span class="r-thumb" aria-hidden="true" style="background-position:${bx.toFixed(2)}% ${by.toFixed(2)}%">`;
  if (Math.abs(lat) > 84) return `${base}</span>`;
  const n = 32;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const at = (f: number) => Math.max(-46, Math.min(0, 23 - f * 92));
  return `${base}<img src="${GIBS_BM}/5/${ty}/${tx}.jpeg" alt="" loading="lazy" decoding="async" style="left:${at(x - tx).toFixed(1)}px;top:${at(y - ty).toFixed(1)}px" onerror="this.remove()"></span>`;
}

const app = document.getElementById("app")!;
const $ = <T extends HTMLElement>(s: string) => app.querySelector<T>(s)!;

function readUrl(m: Manifest): State {
  const q = new URLSearchParams(location.search);
  const target = m.targets.find((t) => t.id === q.get("t"))?.id ?? (m.targets.find((t) => t.default) ?? m.targets[0]).id;
  const filter = m.filters.find((f) => f.id === q.get("f"))?.id ?? m.filters[0].id;
  const type = q.get("type") != null && m.terrain_types.some((t) => String(t.id) === q.get("type")) ? Number(q.get("type")) : null;
  const w = q.get("w");
  const hand = w
    ? Object.fromEntries(
        w.split(",").map((p) => {
          const [k, v] = p.split(":");
          return [k, Math.max(0, Math.min(5, Number(v) || 0))];
        }),
      )
    : null;
  const c = Number(q.get("c"));
  return { target, filter, yr: q.get("yr") === "1", type, hand, cell: q.has("c") && c >= 0 && c < m.grid.n ? c : -1 };
}

function writeUrl(s: State) {
  const q = new URLSearchParams();
  q.set("t", s.target);
  q.set("f", s.filter);
  if (s.yr) q.set("yr", "1");
  if (s.type != null) q.set("type", String(s.type));
  if (s.hand) q.set("w", Object.entries(s.hand).map(([k, v]) => `${k}:${v}`).join(","));
  if (s.cell >= 0) q.set("c", String(s.cell));
  history.replaceState(null, "", `${location.pathname}?${q}${location.hash}`);
}

function ranges(d: Data) {
  const out = new Map<string, [number, number]>();
  for (const t of d.m.traits)
    for (const col of Object.values(t.column)) {
      if (!col || out.has(col) || !d.cells[col]) continue;
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of d.cells[col]) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      out.set(col, [lo, hi]);
    }
  return out;
}

function shell(m: Manifest, body: "moon" | "mars") {
  app.innerHTML = `
    ${m.sample ? `<p class="sample" role="note"><b>Sample data.</b> Every number on this page is a made-up test value while the real data is processed. Nothing here is a result yet.</p>` : ""}
    <header class="top">
      <a class="skip" href="#ledger-h">Skip to results</a>
      <a class="brand" href="#intro" aria-label="Parallels, back to the top">${logo()}<span class="wordmark">Parallels</span></a>
      <p class="tagline">Earth's closest parallels to every part of a Moon or Mars base.</p>
      <nav aria-label="Sections"><ul>${NAV.map(([id, name]) => `<li><a href="#${id}">${esc(name)}</a></li>`).join("")}</ul></nav>
    </header>
    <main>
      <section id="intro" class="intro" aria-labelledby="intro-h">
        <div class="intro-stage">
          <div class="intro-view" id="intro-view" aria-hidden="true"><div class="intro-still">${logo()}</div></div>
          <a class="skip-intro" id="skip-intro" href="#explore">Skip intro</a>
          <nav class="intro-dots" aria-label="Opening chapters">${CHAPTERS.map((c, i) => `<a href="#${c.id}" data-dot="${i}"><span>${c.name}</span></a>`).join("")}</nav>
        </div>
        <div class="chapters">
          <section class="chap chap-hero" id="ch-hero" data-chap="0">
            <div class="copy">
              <p class="intro-k">NASA Space Apps Challenge 2026</p>
              <h1 id="intro-h">No place on Earth is <span class="w-moon">the Moon.</span> <span class="w-mars">Or Mars.</span></h1>
              <p class="intro-lede">But every patch of land copies a part of them. Parallels identifies the Earth locations that analog a permanent Moon base and Mars, part by part.</p>
              ${next("ch-count", "Scroll to begin")}
            </div>
          </section>
          <section class="chap chap-count" id="ch-count" data-chap="1" aria-labelledby="count-h">
            <div class="copy">
              <p class="intro-k">All of Earth's land</p>
              <h2 id="count-h">Every patch, scored. Not just the famous ones.</h2>
              <dl class="counts">
                <div><dt data-count="${m.grid.n}">${num(m.grid.n)}</dt><dd>patches of land, each about 50 km across</dd></div>
                <div><dt id="count-ranked">—</dt><dd id="count-ranked-k">ranked for this base site</dd></div>
                <div><dt id="count-known">—</dt><dd>places already used as analogs, drawn in amber</dd></div>
              </dl>
              ${next("ch-moon", "The Moon")}
            </div>
          </section>
          <section class="chap chap-moon" id="ch-moon" data-chap="2" aria-labelledby="moon-h">
            <div class="copy">
              <p class="intro-k"><i>1</i>Where is the base?</p>
              <h2 id="moon-h" class="w-moon">The Moon</h2>
              ${facts(m, "moon")}
              <p class="pick-k" id="st-moon">Choose a base site</p>
              <div class="chips sites" data-chips="target-moon" role="group" aria-labelledby="st-moon"></div>
              ${next("ch-mars", "Mars")}
            </div>
          </section>
          <section class="chap chap-mars" id="ch-mars" data-chap="3" aria-labelledby="mars-h">
            <div class="copy">
              <p class="intro-k"><i>1</i>Where is the base?</p>
              <h2 id="mars-h" class="w-mars">Mars</h2>
              ${facts(m, "mars")}
              <p class="pick-k" id="st-mars">Choose a base site</p>
              <div class="chips sites" data-chips="target-mars" role="group" aria-labelledby="st-mars"></div>
              ${next("ch-test", "The test")}
            </div>
          </section>
          <section class="chap chap-test" id="ch-test" data-chap="4" aria-labelledby="st-f">
            <div class="copy">
              <p class="intro-k"><i>2</i>What are you testing?</p>
              <h2 id="st-f"><span class="ln">A rover.</span> <span class="ln">A crew.</span> <span class="ln">A habitat.</span></h2>
              <p class="intro-lede">Each test weighs the parts of base-building differently, so each has its own best places on Earth.</p>
              <div class="chips tests" data-chips="filter-rich" role="group" aria-labelledby="st-f"></div>
              ${next("ch-answer", "Earth's answer")}
            </div>
          </section>
          <section class="chap chap-answer" id="ch-answer" data-chap="5" aria-labelledby="answer-h">
            <div class="copy">
              <p class="intro-k">Earth answers</p>
              <h2 id="answer-h" aria-live="polite"></h2>
              <p class="intro-best" id="intro-best" aria-live="polite"></p>
              <div class="intro-go">
                <a class="go" id="go" href="#explore">See Earth's top 10<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.500" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>
              </div>
            </div>
          </section>
        </div>
      </section>
      <section id="explore" class="explore" aria-label="Explore matches">
        <div class="bar">
          <p class="now" id="now" aria-live="polite"></p>
          <div class="pickrow"><span class="pk" id="pk-t">Base site</span><div class="chips" data-chips="target" role="group" aria-labelledby="pk-t"></div></div>
          <div class="pickrow"><span class="pk" id="pk-f">Testing</span><div class="chips" data-chips="filter" role="group" aria-labelledby="pk-f"></div></div>
        </div>
        <div class="stage">
          <aside class="ledger-col" aria-labelledby="ledger-h">
            <div class="col-head"><h2 id="ledger-h" tabindex="-1">Top 10 on Earth</h2><span class="muted small" id="ledger-note" aria-live="polite"></span></div>
            <ol class="ledger" id="ledger"><li class="empty" role="status">Ranking Earth's land…</li></ol>
            <div class="controls">
              <label class="ctl"><span>Terrain type</span><select id="pick-type"><option value="">All land</option>${m.terrain_types
                .filter((t) => t.key !== "none")
                .map((t) => `<option value="${t.id}">${esc(t.name)} (${num(t.cells)} cells)</option>`)
                .join("")}</select></label>
              <label class="ctl switch"><input type="checkbox" id="pick-yr" role="switch"><span>Year-round testing</span></label>
              <p class="small muted" id="yr-note"></p>
              <details class="hand" id="hand"><summary>Set weights by hand</summary><div id="sliders"></div>
                <button type="button" class="btn" id="hand-reset">Back to the mission filter</button>
                <p class="small muted">${esc(m.scoring.rule)}</p>
              </details>
            </div>
          </aside>
          <div class="earth-col">
            <div class="earth" id="earth" role="region" aria-label="Map of Earth's land coloured by match. Use the top 10 list for keyboard access."></div>
            <button type="button" class="back" id="back" hidden>Back to selected</button>
            <div class="status" id="status"><span class="st-scale" id="st-scale"></span><span class="st-at" id="st-at" aria-hidden="true"></span></div>
            <div class="legend" id="legend">
              <p class="lg-title">Match, 0–100</p>
              <div class="lg-scale"><div class="lg-bar" style="background:${gradient()}"></div><div class="lg-ticks"><span>0</span><span>50</span><span>100</span></div></div>
              <label class="lg-range"><span>Match layer</span><input type="range" id="pick-strength" min="0" max="100" step="5" value="100"><output id="strength-out">100%</output></label>
              <details class="lg-more"><summary>${icon("info")}About the colours</summary><div class="lg-pop">
                <p class="lg-text">A weighted mix of the challenge scores. Each comes from how the place's traits rank against all of Earth's land. Grey: not ranked.</p>
                <p class="lg-faint">Weak matches are drawn faint so the ground shows.</p>
                <p class="lg-pole">The map layer stops at 85° N and S; the list still ranks land beyond it.</p>
              </div></details>
            </div>
            <div class="lg-keys">
              <label><input type="checkbox" id="pick-labels" checked> <i class="k-analog"></i>Known analogs <i class="k-cave"></i>caves</label>
              <label><input type="checkbox" id="pick-flat"> Flat map</label>
            </div>
          </div>
        </div>
        <div class="match" id="match">
          <div class="match-head">
            <p class="tcap" id="tcap"></p>
            <details class="ask-note"><summary>About this filter and target</summary><p class="ask-sub" id="ask-sub"></p></details>
          </div>
          <div class="card-wrap" id="card" tabindex="-1" aria-live="polite"></div>
        </div>
      </section>
      ${worlds(m, body)}
      <div id="sections"></div>
    </main>
    <footer class="foot">
      <p class="brand">${logo()}<span class="wordmark small">Parallels</span></p>
      <p>NASA Space Apps Challenge 2026 entry: Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars. Data generated ${esc(m.generated)}.</p>
      <p class="ai">${esc(AI_NOTE)}</p>
      <p class="small muted">No NASA logos or insignia are used. Imagery credits are in the Data section.</p>
    </footer>`;
}

async function main() {
  let d: Data;
  let s: State;
  let shared = false;
  const fail = (e: unknown) => {
    app.innerHTML = `<div class="boot"><img src="${import.meta.env.BASE_URL}favicon.svg" width="28" height="28" alt=""><b>PARALLELS</b></div><p class="fatal" role="alert">The data files could not be loaded (${esc((e as Error).message)}). Please check your connection and reload the page.</p>`;
  };
  try {
    const mf = await manifest();
    s = readUrl(mf);
    shared = new URLSearchParams(location.search).has("c") && !location.hash;
    void targetCols(BASE, mf.targets.find((t) => t.id === s.target)!).catch(() => {});
    shell(mf, mf.targets.find((t) => t.id === s.target)!.body);
    d = await load(mf);
  } catch (e) {
    fail(e);
    return;
  }
  const m = d.m;
  const rng = ranges(d);
  const terr = terrainOf(d.cells);
  const keep = (i: number) => s.type == null || terr?.[i] === s.type;
  const target = () => m.targets.find((t) => t.id === s.target)!;
  const filter = () => m.filters.find((f) => f.id === s.filter)!;
  const weights = () => s.hand ?? filter().weights[target().body] ?? {};
  let cols: Cols = {};
  let score: Float32Array = new Float32Array(d.n).fill(NaN);
  let ids: number[] = [];
  let near: number[] = [];
  let ranked = 0;

  const earthEl = $("#earth");
  let earth: Earth | null = null;

  const bar = $(".bar");
  new ResizeObserver(() => $("#explore").style.setProperty("--bar", `${Math.ceil(bar.offsetHeight)}px`)).observe(bar);
  const typeSel = $<HTMLSelectElement>("#pick-type");
  let intro: Intro | null = null;
  for (const el of app.querySelectorAll<HTMLElement>('[data-chips="target"]'))
    el.innerHTML = (["moon", "mars"] as const)
      .map((b) => {
        const ts = m.targets.filter((t) => t.body === b);
        return ts.length
          ? `<span class="chip-group"><span class="chip-k k-${b}">${BODY[b]}</span>${ts
              .map((t) => `<button type="button" class="chip" data-target="${esc(t.id)}" aria-pressed="false">${esc(t.short)}</button>`)
              .join("")}</span>`
          : "";
      })
      .join("");
  for (const b of ["moon", "mars"] as const)
    $(`[data-chips="target-${b}"]`).innerHTML = m.targets
      .filter((t) => t.body === b)
      .map(
        (t) =>
          `<button type="button" class="chip site" data-target="${esc(t.id)}" aria-pressed="false"><canvas class="site-thumb" width="88" height="88" data-thumb="${esc(t.id)}" aria-hidden="true"></canvas><span class="site-n">${esc(t.short)}</span><span class="site-at">${latlon(t.lat, t.lon, 1)}${t.regions?.length ? ` · ${t.regions.length} candidate regions` : ""}</span></button>`,
      )
      .join("");
  for (const t of m.targets) thumb($<HTMLCanvasElement>(`[data-thumb="${t.id}"]`), t);
  for (const el of app.querySelectorAll<HTMLElement>('[data-chips="filter"]'))
    el.innerHTML =
      m.filters.map((f) => `<button type="button" class="chip" data-filter="${esc(f.id)}" aria-pressed="false" title="${esc(f.plain)}">${esc(f.name)}</button>`).join("") +
      `<button type="button" class="chip" data-filter="__hand" aria-pressed="true" hidden>Your own weights</button>`;
  let richBody = "";
  const richTests = () => {
    const body = target().body;
    if (body === richBody) return;
    richBody = body;
    const names = new Map(m.challenges[body].map((c) => [c.id, c.name]));
    $('[data-chips="filter-rich"]').innerHTML =
      m.filters
        .map((f) => {
          const w = Object.entries(f.weights[body] ?? {})
            .filter(([id, v]) => v > 0 && names.has(id))
            .sort((x, y) => y[1] - x[1]);
          const most = Math.max(1, ...w.map(([, v]) => v));
          return `<button type="button" class="chip test" data-filter="${esc(f.id)}" aria-pressed="false">${icon(TEST_ICON[f.id] ?? "test")}<span class="test-n">${esc(f.name)}</span><span class="test-p">${esc(f.plain)}</span><span class="test-w">${w
            .map(([id, v]) => `<span><i style="--w:${(v / most) * 100}%"></i>${esc(names.get(id))}</span>`)
            .join("")}</span></button>`;
        })
        .join("") + `<button type="button" class="chip test" data-filter="__hand" aria-pressed="true" hidden>${icon("test")}<span class="test-n">Your own weights</span><span class="test-p">You set how much each challenge counts.</span></button>`;
  };
  const yr = $<HTMLInputElement>("#pick-yr");

  const named = (i: number) => Number.isFinite(d.cells.region?.[i]) && !!m.regions[d.cells.region[i]];

  const renderFilters = () => {
    richTests();
    for (const b of app.querySelectorAll<HTMLButtonElement>("[data-target]")) b.setAttribute("aria-pressed", String(b.dataset.target === s.target));
    for (const b of app.querySelectorAll<HTMLButtonElement>("[data-filter]")) {
      const hand = b.dataset.filter === "__hand";
      if (hand) b.hidden = !s.hand;
      b.setAttribute("aria-pressed", String(s.hand ? hand : b.dataset.filter === s.filter));
    }
    typeSel.value = s.type == null ? "" : String(s.type);
    yr.checked = s.yr && !s.hand;
    yr.disabled = !!s.hand;
    $("#yr-note").textContent = s.hand
      ? "Year-round scores are worked out ahead for the mission filters only, so this switch is off with hand-set weights."
      : m.scoring.yearround_rule;
    const f = filter();
    const t = target();
    $("#ask-sub").innerHTML = `<b>${esc(s.hand ? "Your own weights" : f.name)}:</b> ${esc(s.hand ? "you set how much each challenge counts." : f.plain)} <span class="muted">${esc(t.name)}: ${esc(t.anchor_note)}</span>`;
    $("#now").innerHTML = `Earth's best places to test <b>${esc(s.hand ? "your own weights" : f.name.toLowerCase())}</b> for <b>${esc(t.name)}</b> <a class="now-change" href="#intro">Change</a>`;
  };

  const renderSliders = () => {
    const w = weights();
    $("#sliders").innerHTML = m.challenges[target().body]
      .map(
        (c) => `<label class="slider"><span>${esc(c.name)}</span><input type="range" min="0" max="5" step="1" value="${w[c.id] ?? 0}" data-ch="${esc(c.id)}" aria-label="Weight for ${esc(
          c.name,
        )}"><output>${num(w[c.id] ?? 0)}</output></label>`,
      )
      .join("");
  };

  const ledger = () => {
    const el = $("#ledger");
    const before = new Map([...el.querySelectorAll<HTMLElement>("li")].map((li) => [li.dataset.i!, li.getBoundingClientRect().top]));
    const t = target();
    el.innerHTML = ids.length
      ? ids
          .map((i, r) => {
            const tt = m.terrain_types.find((x) => x.id === terr?.[i]);
            const far = d.cells.nearest_analog_km?.[i];
            return `<li data-i="${i}"><button type="button" class="row${i === s.cell ? " on" : ""}" aria-pressed="${i === s.cell}">
              <span class="r-n">${r + 1}</span>
              ${groundThumb(d.cells.lat[i], d.cells.lon[i])}
              <span class="r-name">${esc(placeName(m, d.cells, i))}${Number.isFinite(far) && far > 100 ? ` <span class="rare" title="${num(far)} km from the nearest known analog">rarely used</span>` : ""}${isIce(d.cells, i) ? ` <span class="tag ice">ice sheet</span>` : ""}</span>
              <span class="r-meta">${[
                named(i) ? latlon(d.cells.lat[i], d.cells.lon[i], 2) : "",
                tt && tt.key !== "none" ? esc(tt.name) : "",
                near[r] ? `<span class="r-near" title="${num(near[r])} more ${near[r] === 1 ? "cell" : "cells"} within 150 km of this one ${near[r] === 1 ? "scores" : "score"} high enough for this list. The map shows them all.">+${num(near[r])} ${near[r] === 1 ? "cell" : "cells"} next to it</span>` : "",
              ]
                .filter(Boolean)
                .join(" · ")}</span>
              <span class="r-score" style="--w:${score[i] * 100}%;--c:${colour(score[i])}"><b>${score100(score[i])}</b></span>
            </button>${i === s.cell ? WHY : ""}</li>`;
          })
          .join("")
      : `<li class="empty">No ranked land for this choice. ${s.type != null ? "Try all land in the terrain filter." : ""}</li>`;
    $("#ledger-note").textContent = `${num(ranked)} cells ranked for ${t.short}`;
    if (reduced()) return;
    for (const li of el.querySelectorAll<HTMLElement>("li[data-i]")) {
      const old = before.get(li.dataset.i!);
      const now = li.getBoundingClientRect().top;
      const dy = old == null ? 12 : old - now;
      if (!dy) continue;
      li.animate([{ transform: `translateY(${dy}px)`, opacity: old == null ? 0 : 1 }, { transform: "none", opacity: 1 }], {
        duration: 360,
        easing: "cubic-bezier(.2,.7,.2,1)",
      });
    }
  };

  const caption = () => {
    const t = target();
    $("#tcap").innerHTML = `<span class="tc-body">${BODY[t.body]}</span><b>${esc(t.name)}</b><span>${latlon(t.lat, t.lon, 2)}</span>${
      t.regions?.length ? `<span class="muted">+ ${t.regions.length} candidate regions</span>` : ""
    }`;
  };

  const showCard = () => {
    const el = $("#card");
    if (s.cell < 0) {
      el.innerHTML = `<p class="muted pad">Pick a place in the list or on the map.</p>`;
      return;
    }
    const t = target();
    el.innerHTML = card({
      m,
      body: t.body,
      target: t,
      cells: d.cells,
      t: cols,
      i: s.cell,
      score,
      place: rankOf(score, s.cell),
      ranked,
      weights: weights(),
      weightsName: s.hand ? "Your own weights" : filter().name,
      yr: s.yr && !s.hand,
      ranges: rng,
    });
    wireCard(el);
  };

  const recompute = () => {
    const t = target();
    score = s.hand ? handScore(m, cols, s.hand, d.n) : (cols[`score:${s.filter}${s.yr ? ":yr" : ""}`] ?? new Float32Array(d.n).fill(NaN));
    ranked = 0;
    for (const v of score) if (!Number.isNaN(v)) ranked++;
    ({ ids, near } = top(score, 10, d.cells, keep));
    earth?.paint(score, keep);
    earth?.top(ids);
    intro?.matches(ids.map((i) => ({ lat: d.cells.lat[i], lon: d.cells.lon[i] })));
    const far = ids.length ? d.cells.nearest_analog_km?.[ids[0]] : NaN;
    $("#answer-h").innerHTML = ids.length
      ? `<span class="ans-score"><b>${score100(score[ids[0]])}</b> of 100</span><span class="ans-name">${esc(placeName(m, d.cells, ids[0]))}</span>`
      : "No ranked land for this choice.";
    $("#intro-best").innerHTML = ids.length
      ? `Best match now: <b>${esc(placeName(m, d.cells, ids[0]))}</b>, ${score100(score[ids[0]])} of 100 for ${esc(s.hand ? "your own weights" : filter().name.toLowerCase())} at ${esc(t.name)}.${
          Number.isFinite(far) && far > 100 ? ` <span class="rare">Rarely used: ${num(far)} km from any known analog</span>` : ""
        }`
      : "No ranked land for this choice.";
    $("#count-ranked").textContent = num(ranked);
    $("#count-ranked-k").textContent = `ranked for ${t.name}`;
    ledger();
  };

  const pick = (i: number, fly: boolean) => {
    s.cell = i;
    writeUrl(s);
    for (const b of app.querySelectorAll<HTMLButtonElement>("#ledger .row")) {
      const on = b.closest("li")!.dataset.i === String(i);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    }
    app.querySelector("#ledger .why")?.remove();
    app.querySelector(`#ledger li[data-i="${i}"]`)?.insertAdjacentHTML("beforeend", WHY);
    earth?.select(i, fly);
    showCard();
  };

  const setTarget = async (first: boolean) => {
    const t: Target = target();
    cols = await targetCols(d.base, t);
    if (s.hand) s.hand = Object.fromEntries(m.challenges[t.body].map((c) => [c.id, s.hand![c.id] ?? 0]));
    for (const el of app.querySelectorAll<SVGElement>(".logo")) el.dataset.body = t.body;
    intro?.target(t.body, t);
    renderFilters();
    renderSliders();
    caption();
    recompute();
    const head = t.headline?.cell;
    if (!first || s.cell < 0) s.cell = head != null && head >= 0 ? head : (ids[0] ?? -1);
    if (s.cell >= 0) pick(s.cell, !first);
    else showCard();
    writeUrl(s);
  };

  const changed = () => {
    writeUrl(s);
    renderFilters();
    recompute();
    if (s.cell >= 0) showCard();
  };

  app.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-target], [data-filter]");
    if (!b) return;
    if (b.dataset.target) {
      if (b.dataset.target === s.target) return;
      s.target = b.dataset.target;
      s.cell = -1;
      void setTarget(false);
      return;
    }
    if (b.dataset.filter === "__hand" || (!s.hand && b.dataset.filter === s.filter)) return;
    s.filter = b.dataset.filter!;
    s.hand = null;
    renderSliders();
    changed();
    if (ids[0] != null) pick(ids[0], true);
  });
  const chaps = [...app.querySelectorAll<HTMLElement>(".chap")];
  const dots = [...app.querySelectorAll<HTMLElement>(".intro-dots a")];
  const topBar = $(".top");
  new ResizeObserver(() => document.documentElement.style.setProperty("--top-h", `${Math.ceil(topBar.offsetHeight)}px`)).observe(topBar);
  let ticking = false;
  const place = () => {
    ticking = false;
    const mid = topBar.offsetHeight + (innerHeight - topBar.offsetHeight) / 2;
    const cs = chaps.map((c) => {
      const r = c.getBoundingClientRect();
      return r.top + Math.min(r.height, innerHeight) / 2;
    });
    let at = 0;
    for (let i = 0; i < cs.length - 1; i++) if (mid >= cs[i]) at = i + Math.min(1, (mid - cs[i]) / Math.max(1, cs[i + 1] - cs[i]));
    intro?.chapter(at);
    const on = Math.round(at);
    chaps.forEach((c, i) => c.classList.toggle("in", c.classList.contains("in") || Math.abs(at - i) < 0.62));
    dots.forEach((a, i) => (i === on ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(place);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  place();
  const go = async () => {
    await intro?.enter();
    $("#explore").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
  };
  $("#skip-intro").addEventListener("click", (e) => {
    e.preventDefault();
    intro?.finish();
    $("#explore").scrollIntoView({ behavior: "instant" });
  });
  $("#go").addEventListener("click", (e) => {
    e.preventDefault();
    void go();
  });
  typeSel.addEventListener("change", () => {
    s.type = typeSel.value === "" ? null : Number(typeSel.value);
    changed();
    if (ids[0] != null && !ids.includes(s.cell)) pick(ids[0], true);
  });
  yr.addEventListener("change", () => {
    s.yr = yr.checked;
    changed();
  });
  $("#sliders").addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.dataset.ch) return;
    s.hand = { ...weights(), [el.dataset.ch]: Number(el.value) };
    el.nextElementSibling!.textContent = el.value;
    changed();
  });
  $("#hand-reset").addEventListener("click", () => {
    s.hand = null;
    renderSliders();
    changed();
  });
  $("#ledger").addEventListener("click", (e) => {
    const why = (e.target as HTMLElement).closest(".why");
    if (why) {
      e.preventDefault();
      const c = $("#card");
      c.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
      c.focus({ preventScroll: true });
      return;
    }
    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-i]");
    if (li) pick(Number(li.dataset.i), true);
  });
  const hot = (i: number | null) => {
    for (const b of app.querySelectorAll<HTMLElement>("#ledger li[data-i]")) b.classList.toggle("hot", i != null && b.dataset.i === String(i));
  };
  const rowOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("#ledger li[data-i]");
  $("#ledger").addEventListener("mouseover", (e) => {
    const li = rowOf(e);
    earth?.hover(li ? Number(li.dataset.i) : null);
  });
  $("#ledger").addEventListener("mouseleave", () => earth?.hover(null));
  $("#ledger").addEventListener("focusin", (e) => {
    const li = rowOf(e);
    if (li) earth?.hover(Number(li.dataset.i));
  });
  $("#ledger").addEventListener("focusout", () => earth?.hover(null));
  $("#back").addEventListener("click", () => earth?.back());
  $<HTMLInputElement>("#pick-labels").addEventListener("change", (e) => earth?.labels((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>("#pick-strength").addEventListener("input", (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    $("#strength-out").textContent = `${v}%`;
    earth?.strength(v / 100);
  });
  $<HTMLInputElement>("#pick-flat").addEventListener("change", (e) => earth?.flat((e.target as HTMLInputElement).checked));

  try {
    await setTarget(true);
    if (shared) $("#explore").scrollIntoView();
  } catch (e) {
    $("#ledger").innerHTML = `<li class="empty" role="alert">The target file could not be loaded (${esc((e as Error).message)}). Please reload the page.</li>`;
    return;
  }

  loadValidation()
    .then((v) => {
      $("#sections").outerHTML = sections(m, v);
      wire();
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    })
    .catch(() => {
      $("#sections").outerHTML = sections(m, null);
      wire();
    });

  let known: { lat: number; lon: number }[] = [];
  const labelsReady = loadLabels().catch(() => []);
  void labelsReady.then((ls) => {
    known = ls.filter((l) => l.kind === "known_analog");
    $("#count-known").textContent = known.length ? num(known.length) : "no data";
    intro?.known(known);
    fillAnalogs(app, ls);
  });
  wireWorlds($("#worlds"));
  $("#worlds").addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".w-go")) $("#explore").scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
  });
  if (webgl())
    Promise.all([import("./earth"), labelsReady])
      .then(([mod, labels]) => {
        const at = $("#st-at");
        earth = mod.createEarth(earthEl, { lat: d.cells.lat, lon: d.cells.lon, n: d.n }, labels, {
          pick: (i) => pick(i, true),
          pin: hot,
          away: (on) => ($("#back").hidden = !on),
          pointer: (p) => (at.textContent = p ? latlon(p.lat, p.lon, 2) : ""),
          scale: $("#st-scale"),
        });
        earth.paint(score, keep);
        earth.top(ids);
        if (s.cell >= 0) earth.select(s.cell, false);
        earth.labels($<HTMLInputElement>("#pick-labels").checked);
        earth.flat($<HTMLInputElement>("#pick-flat").checked);
        earth.strength(Number($<HTMLInputElement>("#pick-strength").value) / 100);
      })
      .catch(() => (earthEl.innerHTML = `<p class="nogl">The map could not be loaded. The ranked list and scorecards still work.</p>`));
  else earthEl.innerHTML = `<p class="nogl">This browser can't draw the 3D map (WebGL is off). The ranked list and scorecards still work.</p>`;

  const weak = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
  if (webgl() && !weak)
    import("./intro")
      .then(({ createIntro }) => {
        const view = $("#intro-view");
        const home = (b: "moon" | "mars") => m.targets.find((t) => t.body === b && t.default) ?? m.targets.find((t) => t.body === b) ?? { lat: 0, lon: 0 };
        intro = createIntro(
          view,
          { earth: `${import.meta.env.BASE_URL}img/blue-marble.jpg`, moon: TEXTURE.moon, mars: TEXTURE.mars },
          { moon: home("moon"), mars: home("mars") },
          {
            world: (w) => {
              if (target().body === w) return;
              s.target = (m.targets.find((t) => t.body === w && t.default) ?? m.targets.find((t) => t.body === w))!.id;
              s.cell = -1;
              void setTarget(false);
            },
            earth: () => void go(),
          },
        );
        view.classList.add("live");
        const t = target();
        intro.target(t.body, t);
        intro.matches(ids.map((i) => ({ lat: d.cells.lat[i], lon: d.cells.lon[i] })));
        intro.known(known);
        place();
      })
      .catch(() => {});
}

main();

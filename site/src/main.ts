import "@fontsource-variable/archivo/wdth.css";
import "./style.css";
import "./intro.css";
import type { Manifest, Target } from "./contract";
import { BASE, load, loadLabels, loadValidation, manifest, targetCols, type Cols, type Data } from "./data";
import { handScore, rankOf, top } from "./score";
import type { Earth } from "./earth";
import { BODY, card, isIce, placeName, terrainOf, wireCard } from "./card";
import { NAV, sections, wire } from "./sections";
import { esc, latlon, num, reduced, score100, webgl } from "./format";
import { colour, gradient } from "./ramp";
import { logo } from "./logo";
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

function shell(m: Manifest) {
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
        <a class="skip-intro" id="skip-intro" href="#explore">Skip intro</a>
        <div class="intro-view" id="intro-view" aria-hidden="true"><div class="intro-still">${logo()}</div></div>
        <div class="intro-copy">
          <p class="intro-k">NASA Space Apps Challenge 2026</p>
          <h1 id="intro-h">Where on Earth can you rehearse a <span class="w-moon">Moon</span> or <span class="w-mars">Mars</span> base?</h1>
          <p class="intro-lede">Every patch of land on Earth, in squares about 50 km across, is scored from 0 to 100 for how closely it matches the base site. Each match says why it fits and where it falls short.</p>
          <div class="step"><h2 id="st-t"><i>1</i>Where is the base?</h2><div class="chips" data-chips="target" role="group" aria-labelledby="st-t"></div></div>
          <div class="step"><h2 id="st-f"><i>2</i>What are you testing?</h2><div class="chips" data-chips="filter" role="group" aria-labelledby="st-f"></div></div>
          <div class="intro-go">
            <a class="go" id="go" href="#explore">See Earth's top 10<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.500" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>
            <p class="intro-best" id="intro-best" aria-live="polite"></p>
          </div>
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
              <div class="lg-bar" style="background:${gradient()}"></div>
              <div class="lg-ticks"><span>0</span><span>50</span><span>100</span></div>
              <p class="lg-text">A weighted mix of the challenge scores. Each comes from how the place's traits rank against all of Earth's land. Grey: not ranked.</p>
              <p class="lg-faint">Weak matches are drawn faint so the ground shows.</p>
              <p class="lg-pole">The map layer stops at 85° N and S; the list still ranks land beyond it.</p>
              <label class="lg-range"><span>Match layer</span><input type="range" id="pick-strength" min="0" max="100" step="5" value="100"><output id="strength-out">100%</output></label>
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
    shell(mf);
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
  for (const el of app.querySelectorAll<HTMLElement>('[data-chips="filter"]'))
    el.innerHTML =
      m.filters.map((f) => `<button type="button" class="chip" data-filter="${esc(f.id)}" aria-pressed="false" title="${esc(f.plain)}">${esc(f.name)}</button>`).join("") +
      `<button type="button" class="chip" data-filter="__hand" aria-pressed="true" hidden>Your own weights</button>`;
  const yr = $<HTMLInputElement>("#pick-yr");

  const named = (i: number) => Number.isFinite(d.cells.region?.[i]) && !!m.regions[d.cells.region[i]];

  const renderFilters = () => {
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
              <span class="r-name">${esc(placeName(m, d.cells, i))}${Number.isFinite(far) && far > 100 ? ` <span class="rare" title="${num(far)} km from the nearest known analog">rarely used</span>` : ""}${isIce(d.cells, i) ? ` <span class="tag ice">ice sheet</span>` : ""}</span>
              <span class="r-meta">${[
                named(i) ? latlon(d.cells.lat[i], d.cells.lon[i], 2) : "",
                tt && tt.key !== "none" ? esc(tt.name) : "",
                near[r] ? `<span class="r-near" title="${num(near[r])} more ${near[r] === 1 ? "cell" : "cells"} within 150 km of this one ${near[r] === 1 ? "scores" : "score"} high enough for this list. The map shows them all.">+${num(near[r])} ${near[r] === 1 ? "cell" : "cells"} next to it</span>` : "",
              ]
                .filter(Boolean)
                .join(" · ")}</span>
              <span class="r-score"><b>${score100(score[i])}</b><i style="--w:${score[i] * 100}%;--c:${colour(score[i])}"></i></span>
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
    $("#intro-best").innerHTML = ids.length
      ? `Best match now: <b>${esc(placeName(m, d.cells, ids[0]))}</b>, ${score100(score[ids[0]])} of 100`
      : "No ranked land for this choice.";
    ledger();
    void t;
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

  if (webgl())
    Promise.all([import("./earth"), loadLabels().catch(() => [])])
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
        intro = createIntro(
          view,
          { earth: `${import.meta.env.BASE_URL}img/blue-marble.jpg`, moon: TEXTURE.moon, mars: TEXTURE.mars },
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
      })
      .catch(() => {});
}

main();

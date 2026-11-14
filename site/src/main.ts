import "@fontsource-variable/archivo/wdth.css";
import "./style.css";
import type { Manifest, Target } from "./contract";
import { BASE, load, loadLabels, loadValidation, manifest, targetCols, type Cols, type Data } from "./data";
import { handScore, rankOf, top } from "./score";
import type { Earth } from "./earth";
import { BODY, card, isIce, placeName, terrainOf } from "./card";
import { NAV, sections, wire } from "./sections";
import { esc, latlon, num, reduced, score100, webgl } from "./format";
import { colour, gradient } from "./ramp";
import { logo } from "./logo";
import type { TargetGlobe } from "./globe3d";

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
      <a class="brand" href="#explore" aria-label="Parallels, back to the top">${logo()}<span class="wordmark">Parallels</span></a>
      <p class="tagline">Earth's closest parallels to every part of a Moon or Mars base.</p>
      <nav aria-label="Sections"><ul>${NAV.map(([id, name]) => `<li><a href="#${id}">${esc(name)}</a></li>`).join("")}</ul></nav>
    </header>
    <main>
      <section id="explore" class="explore" aria-label="Explore matches">
        <div class="ask">
          <h1 class="sentence">Earth's best places to test
            <span class="pick"><select id="pick-filter" aria-label="Mission filter: what you are testing"></select></span>
            for <span class="pick"><select id="pick-target" aria-label="Target: where the base would be">${m.targets
              .map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`)
              .join("")}</select></span></h1>
          <p class="ask-how">Every patch of land on Earth, in squares about 50 km across, is scored from 0 to 100 for how closely it matches the target. Pick a place in the top 10 or on the map to see why it matches and where it falls short.</p>
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
          <div class="target-col">
            <figure class="tglobe">
              <div class="tglobe-view" id="tglobe"></div>
              <figcaption id="tcap"></figcaption>
              <details class="ask-note"><summary>About this filter and target</summary><p class="ask-sub" id="ask-sub"></p></details>
            </figure>
            <div class="card-wrap" id="card" aria-live="polite"></div>
          </div>
        </div>
      </section>
      <div id="sections"></div>
    </main>
    <footer class="foot">
      <p class="brand">${logo()}<span class="wordmark small">Parallels</span></p>
      <p>NASA Space Apps Challenge 2026 entry: Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars. Data generated ${esc(m.generated)}.</p>
      <p class="ai">${esc(AI_NOTE)}</p>
      <p class="small muted">No NASA logos or insignia are used. Imagery credits are in the Data section.</p>
    </footer>
    <svg class="link" id="link" aria-hidden="true"><path id="link-path"/><circle id="link-a" r="3"/><circle id="link-b" r="3"/></svg>`;
}

async function main() {
  let d: Data;
  let s: State;
  const fail = (e: unknown) => {
    app.innerHTML = `<div class="boot"><img src="${import.meta.env.BASE_URL}favicon.svg" width="28" height="28" alt=""><b>PARALLELS</b></div><p class="fatal" role="alert">The data files could not be loaded (${esc((e as Error).message)}). Please check your connection and reload the page.</p>`;
  };
  try {
    const mf = await manifest();
    s = readUrl(mf);
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
  let globe: TargetGlobe | null = null;

  const earthEl = $("#earth");
  let earth: Earth | null = null;

  const fSel = $<HTMLSelectElement>("#pick-filter");
  const tSel = $<HTMLSelectElement>("#pick-target");
  const typeSel = $<HTMLSelectElement>("#pick-type");
  const yr = $<HTMLInputElement>("#pick-yr");

  const named = (i: number) => Number.isFinite(d.cells.region?.[i]) && !!m.regions[d.cells.region[i]];
  const ruler = document.createElement("span");
  ruler.className = "fit-ruler";
  ruler.setAttribute("aria-hidden", "true");
  $(".sentence").append(ruler);
  const fit = (sel: HTMLSelectElement) => {
    ruler.textContent = sel.selectedOptions[0]?.textContent ?? "";
    sel.style.width = `${Math.ceil(ruler.getBoundingClientRect().width) + 4}px`;
    sel.style.width = `calc(${sel.style.width} + 1.5em)`;
  };
  document.fonts?.ready.then(() => {
    fit(fSel);
    fit(tSel);
  });
  addEventListener("resize", () => {
    fit(fSel);
    fit(tSel);
  });

  const renderFilters = () => {
    fSel.innerHTML =
      m.filters.map((f) => `<option value="${esc(f.id)}">${esc(f.name.toLowerCase())}</option>`).join("") +
      (s.hand ? `<option value="__hand">your own weights</option>` : "");
    fSel.value = s.hand ? "__hand" : s.filter;
    tSel.value = s.target;
    typeSel.value = s.type == null ? "" : String(s.type);
    yr.checked = s.yr && !s.hand;
    yr.disabled = !!s.hand;
    $("#yr-note").textContent = s.hand
      ? "Year-round scores are worked out ahead for the mission filters only, so this switch is off with hand-set weights."
      : m.scoring.yearround_rule;
    const f = filter();
    const t = target();
    $("#ask-sub").innerHTML = `<b>${esc(s.hand ? "Your own weights" : f.name)}:</b> ${esc(s.hand ? "you set how much each challenge counts." : f.plain)} <span class="muted">${esc(t.name)}: ${esc(t.anchor_note)}</span>`;
    fit(fSel);
    fit(tSel);
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
            </button></li>`;
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
    el.scrollTop = 0;
  };

  const recompute = () => {
    const t = target();
    score = s.hand ? handScore(m, cols, s.hand, d.n) : (cols[`score:${s.filter}${s.yr ? ":yr" : ""}`] ?? new Float32Array(d.n).fill(NaN));
    ranked = 0;
    for (const v of score) if (!Number.isNaN(v)) ranked++;
    ({ ids, near } = top(score, 10, d.cells, keep));
    earth?.paint(score, keep);
    earth?.top(ids);
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
    earth?.select(i, fly);
    showCard();
    drawLink(true);
  };

  const setTarget = async (first: boolean) => {
    const t: Target = target();
    cols = await targetCols(d.base, t);
    if (s.hand) s.hand = Object.fromEntries(m.challenges[t.body].map((c) => [c.id, s.hand![c.id] ?? 0]));
    for (const el of app.querySelectorAll<SVGElement>(".logo")) el.dataset.body = t.body;
    renderFilters();
    renderSliders();
    caption();
    recompute();
    const head = t.headline?.cell;
    if (!first || s.cell < 0) s.cell = head != null && head >= 0 ? head : (ids[0] ?? -1);
    if (s.cell >= 0) pick(s.cell, !first);
    else showCard();
    if (globe) globe.show(TEXTURE[t.body], t, t.regions ?? []);
    else staticTarget();
    writeUrl(s);
  };

  const staticTarget = () => {
    const t = target();
    if (globe) return;
    $("#tglobe").innerHTML = `<div class="flat-target"><img src="${TEXTURE[t.body]}" alt="${BODY[t.body]} surface map (equirectangular) with the target marked"><i style="left:${((t.lon + 180) / 360) * 100}%;top:${((90 - t.lat) / 180) * 100}%"></i></div>`;
  };

  const changed = () => {
    writeUrl(s);
    renderFilters();
    recompute();
    if (s.cell >= 0) showCard();
  };

  fSel.addEventListener("change", () => {
    if (fSel.value === "__hand") return;
    s.filter = fSel.value;
    s.hand = null;
    renderSliders();
    changed();
    if (ids[0] != null) pick(ids[0], true);
  });
  tSel.addEventListener("change", () => {
    s.target = tSel.value;
    s.cell = -1;
    setTarget(false);
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
    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-i]");
    if (li) pick(Number(li.dataset.i), true);
  });
  $<HTMLInputElement>("#pick-labels").addEventListener("change", (e) => earth?.labels((e.target as HTMLInputElement).checked));
  $<HTMLInputElement>("#pick-strength").addEventListener("input", (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    $("#strength-out").textContent = `${v}%`;
    earth?.strength(v / 100);
  });
  $<HTMLInputElement>("#pick-flat").addEventListener("change", (e) => {
    earth?.flat((e.target as HTMLInputElement).checked);
    drawLink(false);
  });

  const link = $<SVGSVGElement & HTMLElement>("#link");
  const path = link.querySelector("path")!;
  const wide = matchMedia("(min-width: 1100px)");
  let raf = 0;
  function drawLink(fresh: boolean) {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const a = wide.matches ? earth?.point() : null;
      const b = wide.matches ? globe?.point() : null;
      const stage = $(".stage").getBoundingClientRect();
      const inside = (p: { x: number; y: number }) => p.y > stage.top && p.y < stage.bottom;
      if (!a || !b || !inside(a) || !inside(b)) {
        link.classList.remove("on");
        return;
      }
      const mx = (a.x + b.x) / 2;
      path.setAttribute("d", `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`);
      link.querySelector("#link-a")!.setAttribute("transform", `translate(${a.x},${a.y})`);
      link.querySelector("#link-b")!.setAttribute("transform", `translate(${b.x},${b.y})`);
      link.classList.add("on");
      if (fresh && !reduced()) {
        const len = path.getTotalLength();
        path.animate([{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: "0" }], { duration: 700, easing: "ease-out" });
      }
    });
  }
  addEventListener("scroll", () => drawLink(false), { passive: true });
  addEventListener("resize", () => drawLink(false));

  try {
    await setTarget(true);
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
        earth = mod.createEarth(earthEl, { lat: d.cells.lat, lon: d.cells.lon, n: d.n }, labels, (i) => pick(i, true));
        earth.paint(score, keep);
        earth.top(ids);
        if (s.cell >= 0) earth.select(s.cell, false);
        earth.labels($<HTMLInputElement>("#pick-labels").checked);
        earth.flat($<HTMLInputElement>("#pick-flat").checked);
        earth.strength(Number($<HTMLInputElement>("#pick-strength").value) / 100);
        earth.onMove(() => drawLink(false));
      })
      .catch(() => (earthEl.innerHTML = `<p class="nogl">The map could not be loaded. The ranked list and scorecards still work.</p>`));
  else earthEl.innerHTML = `<p class="nogl">This browser can't draw the 3D map (WebGL is off). The ranked list and scorecards still work.</p>`;

  const weak = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
  const idle = (f: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  if (webgl() && !weak)
    idle(async () => {
      try {
        const { createTargetGlobe } = await import("./globe3d");
        $("#tglobe").innerHTML = "";
        globe = createTargetGlobe($("#tglobe"), () => drawLink(false));
        const t = target();
        globe.show(TEXTURE[t.body], t, t.regions ?? []);
        drawLink(true);
      } catch {
        staticTarget();
      }
    });
}

main();

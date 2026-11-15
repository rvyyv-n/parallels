import type { Manifest } from "../contract";
import type { Cols, Data } from "../data";
import type { Earth, Top } from "../earth";
import { BODY, isIce, placeName, terrainOf } from "../card";
import { esc, latlon, num, reduced, score100, webgl } from "../format";
import { colour, gradient } from "../ramp";
import { icon } from "../icons";
import { rankOf, top } from "../score";
import { focus, type Zones } from "../zones";
import { createHoverCard, createPopup, type HoverCard, type Popup } from "../hovercard";
import { tour } from "../tour";
import { go, setQuery, type Page } from "../router";
import { filterOf, query, rankedOf, readState, scoreOf, targetOf, weightsOf, type Ctx, type State } from "./ctx";

const SHARES: [number, string][] = [
  [0.01, "1%"],
  [0.02, "2%"],
  [0.05, "5%"],
  [0.1, "10%"],
  [1, "All land"],
];
const shareTitle = (v: number) => (v >= 1 ? "All ranked land" : `Best ${SHARES.find(([x]) => x === v)?.[1] ?? `${v * 100}%`} of land`);

const TEST_ICON: Record<string, string> = { rover: "surface", life_support: "resources", habitat: "shelter" };
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

const html = (m: Manifest) => `<section id="explore" class="explore" aria-labelledby="find-h">
  <div class="bar">
    <h1 class="now" id="find-h" tabindex="-1" aria-live="polite">Earth's best places for this base site</h1>
    <a class="now-change" id="now-change" href="#ch-moon">Change the base site</a>
    <button type="button" class="tour-btn" id="tour"><i aria-hidden="true"></i>Guided tour</button>
    <div class="pickrow"><span class="pk" id="pk-t">Base site</span><div class="chips" data-chips="target" role="group" aria-labelledby="pk-t">${(["moon", "mars"] as const)
      .map((b) => {
        const ts = m.targets.filter((t) => t.body === b);
        return ts.length
          ? `<span class="chip-group"><span class="chip-k k-${b}">${BODY[b]}</span>${ts
              .map((t) => `<button type="button" class="chip" data-target="${esc(t.id)}" aria-pressed="false">${esc(t.short)}</button>`)
              .join("")}</span>`
          : "";
      })
      .join("")}</div></div>
    <div class="presets"><p class="pk" id="pk-f">What are you testing?</p><div class="chips tests" data-chips="filter-rich" role="group" aria-labelledby="pk-f"></div></div>
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
        <p class="lg-title" id="lg-title">${shareTitle(0.02)}</p>
        <div class="lg-share" role="group" aria-labelledby="lg-title">${SHARES.map(
          ([v, t]) => `<button type="button" data-share="${v}" aria-pressed="${v === 0.02}">${t}</button>`,
        ).join("")}</div>
        <div class="lg-scale"><div class="lg-bar" style="background:${gradient()}"></div><div class="lg-ticks"><span>0</span><span>50</span><span>100</span></div></div>
        <label class="lg-range"><span>Match layer</span><input type="range" id="pick-strength" min="0" max="100" step="5" value="100"><output id="strength-out">100%</output></label>
        <details class="lg-more"><summary>${icon("info")}About the colours</summary><div class="lg-pop">
          <p class="lg-text">Only the best places are coloured: the share of ranked land you pick above, with a glowing line around each zone. Pick "All land" to colour every ranked cell.</p>
          <p class="lg-text">The colour is the match score: a weighted mix of the challenge scores, each from how the place's traits rank against all of Earth's land.</p>
          <p class="lg-faint">With all land shown, weak matches are drawn faint so the ground shows, and grey means not ranked.</p>
          <p class="lg-pole">The map layer stops at 85° N and S; the list still ranks land beyond it.</p>
        </div></details>
      </div>
      <div class="lg-keys">
        <label><input type="checkbox" id="pick-labels" checked> <i class="k-analog"></i>Known analogs <i class="k-cave"></i>caves</label>
        <label><input type="checkbox" id="pick-flat"> Flat map</label>
      </div>
    </div>
  </div>
</section>`;

export function finder(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let d: Data | null = null;
  let s: State = readState(m, new URLSearchParams());
  let applied = "";
  let cols: Cols = {};
  let score: Float32Array = new Float32Array(0);
  let ids: number[] = [];
  let near: number[] = [];
  let ranked = 0;
  let earth: Earth | null = null;
  let share = 0.02;
  let zones: Zones = { keep: new Uint8Array(0), outline: [] };
  let mask: Uint8Array = new Uint8Array(0);
  let card: HoverCard | null = null;
  let pop: Popup | null = null;
  const hovers = matchMedia("(hover: hover)");
  let terr: Float32Array | undefined;
  let picking = 0;
  let richBody = "";

  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q)!;
  const target = () => targetOf(m, s);
  const keep = (i: number) => s.type == null || terr?.[i] === s.type;
  const save = () => {
    applied = query(s, -1);
    setQuery("find", applied);
  };
  const open = (i: number) => go(`#/place?${query(s, i)}`);
  const href = (i: number) => `#/place?${esc(query(s, i))}`;
  const info = (i: number) => {
    if (!d || !Number.isFinite(score[i])) return null;
    const far = d.cells.nearest_analog_km?.[i];
    return {
      list: ids.indexOf(i) + 1,
      rank: rankOf(score, i),
      of: ranked,
      name: placeName(m, d.cells, i),
      lat: d.cells.lat[i],
      lon: d.cells.lon[i],
      score: score[i],
      fresh: Number.isFinite(far) && far > (m.scoring.rare_km ?? 100),
    };
  };
  const paint = () => {
    const focused = share < 1;
    mask = new Uint8Array(score.length);
    let painted = 0;
    for (let i = 0; i < score.length; i++) {
      if (!keep(i) || (focused && !zones.keep[i])) continue;
      mask[i] = 1;
      if (!Number.isNaN(score[i])) painted++;
    }
    const lg = $("#legend");
    lg.dataset.painted = String(painted);
    lg.dataset.ranked = String(ranked);
    lg.dataset.edges = String(zones.outline.length / 4);
    $("#lg-title").textContent = shareTitle(share);
    for (const b of lg.querySelectorAll<HTMLButtonElement>("[data-share]")) b.setAttribute("aria-pressed", String(Number(b.dataset.share) === share));
    earth?.paint(score, mask, focused, zones.outline);
  };
  const tops = (): Top[] => ids.map((i) => ({ i, name: placeName(m, d!.cells, i), score: `${score100(score[i])} / 100` }));
  const popAt = (i: number) => {
    const p = earth?.at(i);
    if (!p) return;
    card?.hide();
    s.cell = i;
    select(false);
    pop?.show(i, p.x, p.y);
  };
  const named = (i: number) => Number.isFinite(d!.cells.region?.[i]) && !!m.regions[d!.cells.region[i]];

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
          return `<button type="button" class="chip test" data-filter="${esc(f.id)}" aria-pressed="false" title="${esc(f.plain)}">${icon(TEST_ICON[f.id] ?? "test")}<span class="test-n">${esc(f.name)}</span><span class="test-p">${esc(f.plain)}</span><span class="test-w">${w
            .map(([id, v]) => `<span><i style="--w:${(v / most) * 100}%"></i>${esc(names.get(id))}</span>`)
            .join("")}</span></button>`;
        })
        .join("") + `<button type="button" class="chip test" data-filter="__hand" aria-pressed="true" hidden>${icon("test")}<span class="test-n">Your own weights</span><span class="test-p">You set how much each challenge counts.</span></button>`;
  };

  const renderFilters = () => {
    richTests();
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-target]")) b.setAttribute("aria-pressed", String(b.dataset.target === s.target));
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-filter]")) {
      const hand = b.dataset.filter === "__hand";
      if (hand) b.hidden = !s.hand;
      b.setAttribute("aria-pressed", String(s.hand ? hand : b.dataset.filter === s.filter));
    }
    const yr = $<HTMLInputElement>("#pick-yr");
    $<HTMLSelectElement>("#pick-type").value = s.type == null ? "" : String(s.type);
    yr.checked = s.yr && !s.hand;
    yr.disabled = !!s.hand;
    $("#yr-note").textContent = s.hand
      ? "Year-round scores are worked out ahead for the mission filters only, so this switch is off with hand-set weights."
      : m.scoring.yearround_rule;
    const t = target();
    $("#find-h").innerHTML = `Earth's best places for <b>${esc(t.name)}</b> <span class="now-f">· ${esc(s.hand ? "Your own weights" : filterOf(m, s).name)}</span>`;
    $<HTMLAnchorElement>("#now-change").href = `#ch-${t.body}`;
  };

  const renderSliders = () => {
    const w = weightsOf(m, s);
    $("#sliders").innerHTML = m.challenges[target().body]
      .map(
        (c) => `<label class="slider"><span>${esc(c.name)}</span><input type="range" min="0" max="5" step="1" value="${w[c.id] ?? 0}" data-ch="${esc(c.id)}" aria-label="Weight for ${esc(
          c.name,
        )}"><output>${num(w[c.id] ?? 0)}</output></label>`,
      )
      .join("");
  };

  const ledger = () => {
    const list = $("#ledger");
    const before = new Map([...list.querySelectorAll<HTMLElement>("li")].map((li) => [li.dataset.i!, li.getBoundingClientRect().top]));
    const cells = d!.cells;
    list.innerHTML = ids.length
      ? ids
          .map((i, r) => {
            const tt = m.terrain_types.find((x) => x.id === terr?.[i]);
            const far = cells.nearest_analog_km?.[i];
            return `<li data-i="${i}"><a class="row${i === s.cell ? " on" : ""}" href="${href(i)}"${i === s.cell ? ' aria-current="true"' : ""}>
              <span class="r-n">${r + 1}</span>
              ${groundThumb(cells.lat[i], cells.lon[i])}
              <span class="r-name">${esc(placeName(m, cells, i))}${Number.isFinite(far) && far > 100 ? ` <span class="rare" title="${num(far)} km from the nearest known analog">rarely used</span>` : ""}${isIce(cells, i) ? ` <span class="tag ice">ice sheet</span>` : ""}</span>
              <span class="r-meta">${[
                named(i) ? latlon(cells.lat[i], cells.lon[i], 2) : "",
                tt && tt.key !== "none" ? esc(tt.name) : "",
                near[r] ? `<span class="r-near" title="${num(near[r])} more ${near[r] === 1 ? "cell" : "cells"} within 150 km of this one ${near[r] === 1 ? "scores" : "score"} high enough for this list. The map shows them all.">+${num(near[r])} ${near[r] === 1 ? "cell" : "cells"} next to it</span>` : "",
              ]
                .filter(Boolean)
                .join(" · ")}</span>
              <span class="r-score" style="--w:${score[i] * 100}%;--c:${colour(score[i])}"><b>${score100(score[i])}</b></span>
            </a></li>`;
          })
          .join("")
      : `<li class="empty">No ranked land for this choice. ${s.type != null ? "Try all land in the terrain filter." : ""}</li>`;
    $("#ledger-note").textContent = `${num(ranked)} cells ranked for ${target().short}`;
    if (reduced()) return;
    for (const li of list.querySelectorAll<HTMLElement>("li[data-i]")) {
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

  const recompute = () => {
    score = scoreOf(m, cols, s, d!.n);
    ranked = rankedOf(score);
    ({ ids, near } = top(score, 10, d!.cells, keep));
    zones = focus(score, share, { lat: d!.cells.lat, lon: d!.cells.lon });
    pop?.hide(false);
    card?.hide();
    paint();
    earth?.top(tops());
    ledger();
  };

  const select = (fly: boolean) => {
    if (s.cell < 0) s.cell = ids[0] ?? -1;
    for (const a of el.querySelectorAll<HTMLElement>("#ledger .row")) {
      const on = a.closest("li")!.dataset.i === String(s.cell);
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    if (s.cell >= 0) earth?.select(s.cell, fly);
  };

  const apply = async (first: boolean) => {
    const t = target();
    const mine = ++picking;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-target]")) {
      const on = b.dataset.target === s.target;
      b.setAttribute("aria-pressed", String(on));
      if (on) b.setAttribute("aria-busy", "true");
      else b.removeAttribute("aria-busy");
    }
    ctx.site(t);
    const next = await ctx.cols(t).catch(() => null);
    if (mine !== picking) return;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[aria-busy]")) b.removeAttribute("aria-busy");
    if (!next) {
      $("#ledger").innerHTML = `<li class="empty" role="alert">The target file could not be loaded. Please reload the page.</li>`;
      return;
    }
    cols = next;
    if (s.hand) s.hand = Object.fromEntries(m.challenges[t.body].map((c) => [c.id, s.hand![c.id] ?? 0]));
    renderFilters();
    renderSliders();
    recompute();
    if (s.cell < 0) s.cell = t.headline?.cell ?? -1;
    select(!first);
  };

  const changed = (keepCell = true) => {
    save();
    renderFilters();
    recompute();
    if (!keepCell && !ids.includes(s.cell)) s.cell = -1;
    select(true);
  };

  const wire = () => {
    const warm = (e: Event) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>("[data-target]")?.dataset.target;
      const t = id ? m.targets.find((x) => x.id === id) : undefined;
      if (t) void ctx.cols(t).catch(() => {});
    };
    el.addEventListener("pointerover", warm, { passive: true });
    el.addEventListener("focusin", warm);
    el.addEventListener("click", (e) => {
      if (!d) return;
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-target], [data-filter]");
      if (!b) return;
      if (b.dataset.target) {
        if (b.dataset.target === s.target) return;
        s.target = b.dataset.target;
        s.cell = -1;
        save();
        void apply(false);
        return;
      }
      if (b.dataset.filter === "__hand" || (!s.hand && b.dataset.filter === s.filter)) return;
      s.filter = b.dataset.filter!;
      s.hand = null;
      s.cell = -1;
      renderSliders();
      changed();
    });
    $<HTMLSelectElement>("#pick-type").addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      s.type = v === "" ? null : Number(v);
      changed(false);
    });
    $<HTMLInputElement>("#pick-yr").addEventListener("change", (e) => {
      s.yr = (e.target as HTMLInputElement).checked;
      changed();
    });
    $("#sliders").addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.ch) return;
      s.hand = { ...weightsOf(m, s), [t.dataset.ch]: Number(t.value) };
      t.nextElementSibling!.textContent = t.value;
      changed();
    });
    $("#hand-reset").addEventListener("click", () => {
      s.hand = null;
      renderSliders();
      changed();
    });
    const ledgerEl = $("#ledger");
    const rowOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("#ledger li[data-i]");
    ledgerEl.addEventListener("mouseover", (e) => {
      const li = rowOf(e);
      const i = li ? Number(li.dataset.i) : null;
      earth?.hover(i);
      const p = i != null && hovers.matches && (!pop || pop.open < 0) ? earth?.at(i) : null;
      if (i != null && p) card?.show(i, p.x, p.y);
      else card?.hide();
    });
    card = createHoverCard($(".earth-col"), { info, open });
    pop = createPopup($(".earth-col"), { info, open, closed: () => {} });
    $("#legend").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-share]");
      if (!b || !d || Number(b.dataset.share) === share) return;
      share = Number(b.dataset.share);
      zones = focus(score, share, { lat: d.cells.lat, lon: d.cells.lon });
      pop?.hide(false);
      paint();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || el.closest("[hidden]") || el.hidden) return;
      card?.hide();
      pop?.hide();
    });
    document.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (pop && pop.open >= 0 && t.isConnected && !t.closest(".mpop, #earth")) pop.hide(false);
    });
    ledgerEl.addEventListener("mouseleave", () => {
      earth?.hover(null);
      card?.hide();
    });
    ledgerEl.addEventListener("focusin", (e) => {
      const li = rowOf(e);
      if (li) earth?.hover(Number(li.dataset.i));
    });
    ledgerEl.addEventListener("focusout", () => earth?.hover(null));
    $("#back").addEventListener("click", () => earth?.back());
    $<HTMLInputElement>("#pick-labels").addEventListener("change", (e) => earth?.labels((e.target as HTMLInputElement).checked));
    $<HTMLInputElement>("#pick-strength").addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      $("#strength-out").textContent = `${v}%`;
      earth?.strength(v / 100);
    });
    $<HTMLInputElement>("#pick-flat").addEventListener("change", (e) => earth?.flat((e.target as HTMLInputElement).checked));
    const bar = $(".bar");
    new ResizeObserver(() => $("#explore").style.setProperty("--bar", `${Math.ceil(bar.offsetHeight)}px`)).observe(bar);
    tour($("#tour"));
  };

  const map = (data: Data) => {
    const earthEl = $("#earth");
    if (!webgl()) {
      earthEl.innerHTML = `<p class="nogl">This browser can't draw the 3D map (WebGL is off). The ranked list and scorecards still work.</p>`;
      return;
    }
    const hot = (i: number | null) => {
      for (const b of el.querySelectorAll<HTMLElement>("#ledger li[data-i]")) b.classList.toggle("hot", i != null && b.dataset.i === String(i));
    };
    Promise.all([import("../earth"), ctx.labels()])
      .then(([mod, labels]) => {
        const at = $("#st-at");
        earth = mod.createEarth(earthEl, { lat: data.cells.lat, lon: data.cells.lon, n: data.n }, labels, {
          pick: (i) => (i >= 0 ? popAt(i) : pop?.hide(false)),
          pin: hot,
          over: (i, x, y) => {
            if (i == null || !hovers.matches || (pop && pop.open >= 0)) card?.hide();
            else card?.show(i, x, y);
          },
          moved: () => {
            card?.hide();
            if (pop && pop.open >= 0) pop.move(earth!.at(pop.open));
          },
          away: (on) => ($("#back").hidden = !on),
          pointer: (p) => (at.textContent = p ? latlon(p.lat, p.lon, 2) : ""),
          scale: $("#st-scale"),
        });
        if (score.length) {
          paint();
          earth.top(tops());
        }
        if (s.cell >= 0) earth.select(s.cell, false);
        earth.labels($<HTMLInputElement>("#pick-labels").checked);
        earth.flat($<HTMLInputElement>("#pick-flat").checked);
        earth.strength(Number($<HTMLInputElement>("#pick-strength").value) / 100);
      })
      .catch(() => (earthEl.innerHTML = `<p class="nogl">The map could not be loaded. The ranked list and scorecards still work.</p>`));
  };

  let ready: Promise<Data | null> = Promise.resolve(null);
  return {
    title: () => "Finder",
    hide() {
      card?.hide();
      pop?.hide(false);
    },
    mount(root) {
      el = root;
      el.innerHTML = html(m);
      wire();
      ready = ctx
        .data()
        .then((data) => {
          d = data;
          terr = terrainOf(data.cells);
          map(data);
          return data;
        })
        .catch((e) => {
          $("#ledger").innerHTML = `<li class="empty" role="alert">The data files could not be loaded (${esc((e as Error).message)}). Please check your connection and reload the page.</li>`;
          return null;
        });
    },
    async show(q) {
      const next = readState(m, q);
      ctx.site(targetOf(m, next));
      earth?.resize();
      if (!(await ready)) return;
      const key = query(next, -1);
      if (key === applied && (next.cell < 0 || next.cell === s.cell)) return;
      const first = !applied;
      const same = next.target === s.target && !first;
      s = next;
      applied = key;
      if (same) {
        renderFilters();
        renderSliders();
        recompute();
        if (s.cell < 0) s.cell = target().headline?.cell ?? -1;
        select(true);
      } else await apply(first);
    },
  };
}

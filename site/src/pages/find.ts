import type { Body, LabelPoint, Manifest } from "../contract";
import type { Cols, Data } from "../data";
import type { Earth, Top } from "../earth";
import { BODY, placeName, terrainOf } from "../card";
import { bindPillRange, bindSegmented, syncPillRange } from "../controls";
import { esc, latlon, num, reduced, score100, webgl } from "../format";
import { gradient } from "../ramp";
import { icon } from "../icons";
import { rankOf } from "../score";
import { cut, focus, type Zones } from "../zones";
import { createAnalogTip, createHoverCard, createPopup, type AnalogTip, type HoverCard, type Popup } from "../hovercard";
import { createSearch, createStarfield, createTargetTwin, renderHistogram, type SearchBox, type Starfield, type TargetTwin } from "../finder-hud";
import { isNew, spread } from "../rank";
import { compare, fmtMul, key, list, rules, sliders, sortBar, summary, type View } from "../ranklist";
import { tourButton } from "../tour";
import { go, setQuery, type Page } from "../router";
import { filterOf, query, rankedOf, readState, scoreOf, targetOf, type Ctx, type State } from "./ctx";

const SHARES: [number, string][] = [
  [0.01, "1%"],
  [0.02, "2%"],
  [0.05, "5%"],
  [0.1, "10%"],
  [1, "All land"],
];
const shareLabel = (v: number) => SHARES.find(([x]) => x === v)?.[1] ?? `${v * 100}%`;
const shareTitle = (v: number) => (v >= 1 ? "All ranked land" : `Best ${shareLabel(v)} of land`);
const shareShort = (v: number) => `best ${shareLabel(v)}`;

const presets = (m: Manifest) => [...m.filters].sort((a, b) => Number(b.id === "balanced") - Number(a.id === "balanced"));

const html = (m: Manifest) => `<section id="explore" class="fd" aria-labelledby="find-h">
  <aside class="fd-side" id="fd-side" aria-label="Ranked places and controls">
    <button type="button" class="fd-grip" id="fd-grip" aria-label="Toggle map and list height" aria-expanded="false"><span aria-hidden="true"></span></button>
    <header class="fd-head">
      <h1 id="find-h" tabindex="-1">Earth's best places for this base site</h1>
      <div class="fd-site">
        <label class="fd-pick"><span class="sr">Base site</span><i class="fd-dot" aria-hidden="true"></i><select id="pick-target">${(["moon", "mars"] as const)
          .map((b) => `<optgroup label="${BODY[b]}">${m.targets.filter((t) => t.body === b).map((t) => `<option value="${esc(t.id)}">${esc(t.short)}</option>`).join("")}</optgroup>`)
          .join("")}</select>${icon("chevron")}</label>
        <a class="fd-change" id="now-change" href="#ch-moon">${icon("site")}<span>All sites</span></a>
      </div>
    </header>
    <div class="fd-block fd-sum" id="summary" aria-live="polite"><p class="sum-k">The list is loading…</p></div>
    <p class="fd-rules" id="rules"></p>
    <div class="presets" role="group" aria-label="Rank by">${presets(m)
      .map((f) => `<button type="button" data-filter="${esc(f.id)}" aria-pressed="false" title="${esc(f.plain)}">${esc(f.name)}</button>`)
      .join("")}</div>
    <details class="fd-block fd-w" id="weights">
      <summary><span>Filters and weights</span><span class="w-mine" id="w-mine" hidden>your weights</span>${icon("chevron")}</summary>
      <div class="fd-w-in">
        <label class="ctl"><span>Terrain type</span><select id="pick-type"><option value="">All land</option>${m.terrain_types
          .filter((t) => t.key !== "none")
          .map((t) => `<option value="${t.id}">${esc(t.name)} (${num(t.cells)} cells)</option>`)
          .join("")}</select></label>
        <label class="ctl switch"><input type="checkbox" id="pick-yr" role="switch"><span>Year-round testing</span></label>
        <p class="w-note" id="yr-note"></p>
        <div class="w-head"><h2>Weights</h2><button type="button" class="sum-link" id="w-reset">Reset</button></div>
        <p class="w-note">Each slider multiplies the weight that the preset gives to that challenge.</p>
        <div id="sliders"></div>
      </div>
    </details>
    <div class="fd-key" id="key">${key()}</div>
    <div class="rk-sort" id="rk-sort" role="group" aria-labelledby="rk-sort-k">${sortBar(false)}</div>
    <div class="fd-rank" id="rank"><p class="rk-empty" role="status">The list is loading…</p></div>
    <div class="fd-cmp" id="compare" hidden></div>
  </aside>
  <div class="earth-col">
    <button type="button" class="fd-fold" id="fold" aria-controls="fd-side" aria-expanded="true" title="Hide the list"><span class="sr">Hide the list</span>${icon("chevron")}</button>
    <div class="earth-stage" id="earth-stage">
      <canvas class="fd-stars" id="fd-stars" aria-hidden="true"></canvas>
      <div class="fd-progress" id="fd-progress" hidden aria-hidden="true"></div>
      <div class="earth" id="earth" role="region" aria-label="Map of the land on Earth. The colour shows the match score. Use the ranked list with the keyboard."></div>
      <div class="map-bar">
        <div class="fd-search" id="fd-search-wrap"></div>
        <div class="seg" id="view-seg" role="group" aria-label="Map view"><button type="button" data-view="globe" aria-pressed="true">Globe</button><button type="button" data-view="flat" aria-pressed="false">Flat<span class="long"> map</span></button></div>
        <label class="tog"><input type="checkbox" id="pick-labels" checked><span class="tog-box">${icon("check")}</span><i class="k-analog" aria-hidden="true"></i><span class="tog-lbl">Known analogs</span><span class="tog-state" id="tog-state">Shown</span><span class="tog-more"><i class="k-cave" aria-hidden="true"></i>caves</span></label>
        <label class="hud-range"><span class="hud-range-k">Overlay</span><input type="range" id="pick-strength" min="0" max="100" step="5" value="100"><output id="strength-out">100%</output></label>
        <button type="button" class="tour-btn" id="tour" title="Guided tour"><i aria-hidden="true"></i><span class="tour-lbl long"><span class="tour-name">Guided tour</span><small class="tour-sub">9 STEPS</small></span></button>
      </div>
      <button type="button" class="back" id="back" hidden>Go back to the selected place</button>
      <div class="status" id="status"><span class="st-scale" id="st-scale"></span><span class="st-at" id="st-at" aria-hidden="true"></span></div>
    </div>
    <div class="legend" id="legend">
      <div class="lg-head">
        <p class="lg-title" id="lg-title">${shareTitle(0.02)}</p>
        <button type="button" class="lg-fold" id="lg-fold" aria-expanded="true" aria-controls="lg-body" title="Collapse legend" aria-label="Collapse legend">${icon("chevron")}</button>
      </div>
      <div class="lg-body" id="lg-body">
        <div class="lg-share" id="lg-share" role="group" aria-labelledby="lg-title">${SHARES.map(
          ([v, t]) => `<button type="button" data-share="${v}" aria-pressed="${v === 0.02}">${t}</button>`,
        ).join("")}</div>
        <div class="lg-hist-wrap">
          <div class="lg-hist" id="lg-hist" role="img" aria-label="Score distribution"></div>
          <div class="lg-scale"><div class="lg-bar" style="background:${gradient()}"></div><div class="lg-ticks"><span>0</span><span>50</span><span>100</span></div></div>
        </div>
        <div class="lg-marks" aria-hidden="true">
          <span><i class="mk-zone"></i>analog zone</span>
          <span><i class="mk-top">1</i>top 10</span>
          <span><i class="mk-minor"></i>#11–20</span>
          <span><i class="k-analog"></i>analog</span>
          <span><i class="k-cave"></i>cave</span>
        </div>
        <div class="lg-foot">
          <details class="lg-more"><summary>${icon("info")}About the colours</summary><div class="lg-pop">
            <p class="lg-text">The map colours only the best places. You select the share of ranked land above. A bright line goes around each zone. Select "All land" to colour all ranked cells.</p>
            <p class="lg-text">The colour shows the match score. The match score combines the challenge scores. Each challenge score comes from how the traits of the place rank against all land on Earth.</p>
            <p class="lg-faint">When the map shows all land, weak matches are pale so that you can see the ground. Grey land has no rank.</p>
            <p class="lg-pole">The map layer stops at 85° N and 85° S. The list also ranks the land past this limit.</p>
          </div></details>
          <a class="lg-credit" href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener noreferrer">NASA GIBS Blue Marble</a>
        </div>
      </div>
    </div>
    <div class="fd-twin" id="fd-twin"></div>
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
  let pool = 0;
  let ranked = 0;
  let earth: Earth | null = null;
  let share = 0.02;
  let threshold = -Infinity;
  let zones: Zones = { keep: new Uint8Array(0), outline: [] };
  let mask: Uint8Array = new Uint8Array(0);
  let card: HoverCard | null = null;
  let analogTip: AnalogTip | null = null;
  let pop: Popup | null = null;
  let stars: Starfield | null = null;
  let twin: TargetTwin | null = null;
  let search: SearchBox | null = null;
  const hovers = matchMedia("(hover: hover)");
  let terr: Float32Array | undefined;
  let picking = 0;
  const shut = new Set<string>();
  let moved = new Map<number, number>();
  let fade = 0;
  let sliderRaf = 0;
  let sliderDirty = false;
  let flat = false;
  let sliderCleanups: (() => void)[] = [];

  const cancelSliderRaf = () => {
    if (sliderRaf) {
      cancelAnimationFrame(sliderRaf);
      sliderRaf = 0;
    }
    sliderDirty = false;
  };

  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q)!;
  const target = () => targetOf(m, s);
  const chs = () => m.challenges[target().body];
  const base = () => filterOf(m, s).weights[target().body] ?? {};
  const has = (id: string) => !!cols[`ch:${id}`];
  const mulOf = (id: string) => {
    const b = base()[id] ?? 0;
    return b ? (s.hand?.[id] ?? (s.hand ? 0 : b)) / b : 0;
  };
  const keep = (i: number) => s.type == null || terr?.[i] === s.type;
  const save = () => {
    applied = query(s, -1);
    setQuery("find", applied);
  };
  const open = (i: number) => go(`#/place?${query({ ...s, cmp: [] }, i)}`);
  const href = (i: number) => `#/place?${esc(query({ ...s, cmp: [] }, i))}`;

  const info = (i: number) => {
    if (!d || i < 0 || !Number.isFinite(score[i])) return null;
    const focused = share < 1;
    return {
      list: ids.indexOf(i) + 1,
      rank: rankOf(score, i),
      of: ranked,
      name: placeName(m, d.cells, i),
      lat: d.cells.lat[i],
      lon: d.cells.lon[i],
      score: score[i],
      fresh: isNew(m, d.cells, i),
      outsideZone: focused && !mask[i],
      shareShort: shareShort(share),
    };
  };

  const view = (): View => ({
    m,
    cells: d!.cells,
    t: cols,
    chs: chs(),
    score,
    ids,
    pool,
    known: s.known,
    robust: s.hand || s.yr ? null : s.filter,
    cell: s.cell,
    cmp: s.cmp,
    href,
  });

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
    renderHistogram($("#lg-hist"), score, keep, threshold, focused);
    earth?.paint(score, mask, focused, zones.outline);
  };

  const tops = (): Top[] => ids.map((i) => ({ i, name: placeName(m, d!.cells, i), score: `${score100(score[i])} / 100` }));

  const popAt = (i: number) => {
    if (!d || i < 0 || !Number.isFinite(score[i])) {
      pop?.hide(false);
      return;
    }
    const p = earth?.at(i);
    if (!p) return;
    card?.hide();
    analogTip?.hide();
    s.cell = i;
    select(false);
    pop?.show(i, p.x, p.y);
  };

  const showAnalogPop = (ap: LabelPoint, cell: number, x: number, y: number) => {
    card?.hide();
    analogTip?.hide();
    const cellHref = cell >= 0 ? href(cell) : null;
    const cellScore = cell >= 0 && Number.isFinite(score[cell]) ? `${score100(score[cell])} / 100` : null;
    pop?.showAnalog(ap, cell, x, y, cellHref, cellScore);
  };

  const syncSearchRegions = () => {
    if (!d || !search) return;
    const best = new Int32Array(m.regions.length).fill(-1);
    const regionCol = d.cells.region;
    if (regionCol) {
      for (let i = 0; i < score.length; i++) {
        const sc = score[i];
        if (!Number.isFinite(sc)) continue;
        const r = regionCol[i];
        if (r < 0 || r >= best.length) continue;
        const prev = best[r];
        if (prev < 0 || sc > score[prev]) best[r] = i;
      }
    }
    search.setRegions(m.regions, best);
  };

  const setFlatView = (nextFlat: boolean) => {
    if (nextFlat === flat) return;
    flat = nextFlat;
    for (const x of el.querySelectorAll<HTMLElement>("[data-view]")) x.setAttribute("aria-pressed", String((x.dataset.view === "flat") === flat));
    earth?.flat(flat);
  };

  const renderControls = () => {
    const t = target();
    $<HTMLSelectElement>("#pick-target").value = s.target;
    $(".fd-dot").dataset.body = t.body;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-filter]")) b.setAttribute("aria-pressed", String(b.dataset.filter === s.filter));
    const yr = $<HTMLInputElement>("#pick-yr");
    $<HTMLSelectElement>("#pick-type").value = s.type == null ? "" : String(s.type);
    yr.checked = s.yr && !s.hand;
    yr.disabled = !!s.hand;
    $("#yr-note").textContent = s.hand
      ? "We calculated year-round scores only for the presets. This switch is off when you set the weights."
      : m.scoring.yearround_rule;
    $("#w-mine").hidden = !s.hand;
    $("#find-h").innerHTML = `<span>Earth's best places for</span> <b>${esc(t.name)}</b>`;
    siteLink(t.body);
    twin?.update(t);
  };

  const siteLink = (b: Body) => {
    $<HTMLAnchorElement>("#now-change").href = `#ch-${b}`;
    $<HTMLAnchorElement>("#now-change").setAttribute("aria-label", `Select a different base site in the ${BODY[b]} part of Home`);
  };

  const renderSliders = () => {
    for (const fn of sliderCleanups.splice(0)) fn();
    const b = base();
    const host = $("#sliders");
    host.innerHTML = sliders(chs().map((c) => ({ c, base: b[c.id] ?? 0, mul: mulOf(c.id), has: has(c.id) })));
    for (const inp of host.querySelectorAll<HTMLInputElement>('input[type="range"]')) {
      sliderCleanups.push(bindPillRange(inp));
    }
  };

  const renderCompare = () => {
    const box = $("#compare");
    box.hidden = !s.cmp.length;
    box.innerHTML = d ? compare(view()) : "";
  };

  const renderList = (animate: boolean) => {
    const box = $("#rank");
    const before = new Map([...box.querySelectorAll<HTMLElement>("li[data-i]")].map((li) => [li.dataset.i!, li.getBoundingClientRect().top]));
    const v = view();
    $("#summary").innerHTML = summary(v);
    $("#rules").textContent = rules(v);
    box.innerHTML = list(v, shut, moved, s.byRegion);
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-sort]")) b.setAttribute("aria-pressed", String((b.dataset.sort === "region") === s.byRegion));
    renderCompare();
    if (!animate || reduced()) return;
    for (const li of box.querySelectorAll<HTMLElement>("li[data-i]")) {
      const old = before.get(li.dataset.i!);
      const now = li.getBoundingClientRect().top;
      if (!now && !li.offsetHeight) continue;
      const dy = old == null || !old ? 12 : old - now;
      if (!dy) continue;
      li.animate([{ transform: `translateY(${dy}px)`, opacity: old == null ? 0 : 1 }, { transform: "none", opacity: 1 }], {
        duration: 420,
        easing: "cubic-bezier(.2,.7,.2,1)",
      });
    }
  };

  const recompute = (track = false) => {
    const prev = new Map(ids.map((i, r) => [i, r]));
    score = scoreOf(m, cols, s, d!.n);
    ranked = rankedOf(score);
    ({ ids, pool } = spread(m, score, d!.cells, keep, s.known));
    moved = new Map();
    if (track)
      ids.forEach((i, r) => {
        const p = prev.get(i);
        if (p != null && p !== r) moved.set(i, p - r);
      });
    clearTimeout(fade);
    if (moved.size)
      fade = window.setTimeout(() => {
        moved = new Map();
        for (const x of el.querySelectorAll(".rk-move")) x.remove();
      }, 4000);
    threshold = cut(score, share);
    zones = focus(score, share, { lat: d!.cells.lat, lon: d!.cells.lon });
    pop?.hide(false);
    card?.hide();
    analogTip?.hide();
    syncSearchRegions();
    paint();
    earth?.top(tops());
    renderList(track);
  };

  const select = (fly: boolean) => {
    if (s.cell < 0) s.cell = ids[0] ?? -1;
    for (const a of el.querySelectorAll<HTMLElement>("#rank .rk-row")) {
      const on = a.closest("li")!.dataset.i === String(s.cell);
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    if (s.cell >= 0) earth?.select(s.cell, fly);
  };

  const apply = async (first: boolean) => {
    cancelSliderRaf();
    const t = target();
    const mine = ++picking;
    const pick = $<HTMLSelectElement>("#pick-target");
    const prog = $("#fd-progress");
    pick.value = s.target;
    pick.setAttribute("aria-busy", "true");
    prog.hidden = false;
    ctx.site(t);
    twin?.update(t);
    const next = await ctx.cols(t).catch(() => null);
    if (mine !== picking) return;
    pick.removeAttribute("aria-busy");
    prog.hidden = true;
    if (!next) {
      $("#rank").innerHTML = `<p class="rk-empty" role="alert">The data for this base site did not load. Reload the page.</p>`;
      return;
    }
    cols = next;
    renderControls();
    renderSliders();
    recompute();
    if (s.cell < 0) s.cell = t.headline?.cell ?? -1;
    select(!first);
  };

  const changed = (track = true) => {
    save();
    renderControls();
    recompute(track);
    select(true);
  };

  const weigh = (id: string, v: number) => {
    const b = base();
    const muls = Object.fromEntries(chs().map((c) => [c.id, mulOf(c.id)]));
    muls[id] = v;
    const live = chs().filter((c) => b[c.id] && has(c.id));
    s.hand = live.every((c) => Math.abs(muls[c.id] - 1) < 1e-6) ? null : Object.fromEntries(live.map((c) => [c.id, Math.round(b[c.id] * muls[c.id] * 100) / 100]));
  };

  const syncCompareCheckboxes = () => {
    const full = s.cmp.length >= 3;
    for (const x of el.querySelectorAll<HTMLInputElement>("#rank input[data-cmp]")) {
      const i = Number(x.dataset.cmp);
      x.checked = s.cmp.includes(i);
      x.disabled = full && !x.checked;
    }
  };

  const wire = () => {
    const explore = $("#explore");
    const earthCol = $(".earth-col");
    const earthStage = $("#earth-stage");

    stars = createStarfield($<HTMLCanvasElement>("#fd-stars"), earthStage);
    twin = createTargetTwin($("#fd-twin"));

    bindSegmented($("#view-seg"));
    bindSegmented($("#lg-share"));
    bindSegmented($(".rk-sort-seg"));
    bindPillRange($<HTMLInputElement>("#pick-strength"), { gradient: true });

    search = createSearch($("#fd-search-wrap"), {
      cellIndex: (lat, lon) => earth?.cellIndex(lat, lon) ?? -1,
      placeName: (i) => (d ? placeName(m, d.cells, i) : ""),
      scoreOf: (i) => (i >= 0 && i < score.length ? score[i] : NaN),
      pickCell: (i, lat, lon) => {
        if (!d || i < 0) return;
        const tLat = Number.isFinite(lat) ? lat : d.cells.lat[i];
        const tLon = Number.isFinite(lon) ? lon : d.cells.lon[i];
        s.cell = i;
        select(false);
        pop?.hide(false);
        if (earth) {
          earth.flyTo(tLat, tLon, {
            onArrived: () => {
              const p = earth?.at(i) ?? earth?.project(tLat, tLon) ?? { x: earthStage.clientWidth / 2, y: earthStage.clientHeight / 2 };
              pop?.show(i, p.x, p.y);
            },
          });
        }
      },
      pickAnalog: (ap, cell) => {
        pop?.hide(false);
        if (earth) {
          earth.flyTo(ap.lat, ap.lon, {
            onArrived: () => {
              const p = earth?.project(ap.lat, ap.lon) ?? { x: earthStage.clientWidth / 2, y: earthStage.clientHeight / 2 };
              showAnalogPop(ap, cell, p.x, p.y);
            },
          });
        }
      },
    });

    el.addEventListener("click", (e) => {
      if (!d) return;
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLButtonElement>("[data-filter]");
      if (b) {
        if (!s.hand && b.dataset.filter === s.filter) return;
        cancelSliderRaf();
        s.filter = b.dataset.filter!;
        s.hand = null;
        renderSliders();
        changed();
        return;
      }
      const sb = t.closest<HTMLButtonElement>("[data-sort]");
      if (sb) {
        if ((sb.dataset.sort === "region") === s.byRegion) return;
        s.byRegion = !s.byRegion;
        save();
        renderList(true);
        select(false);
        return;
      }
      if (t.closest("#known")) {
        s.known = !s.known;
        changed(false);
        return;
      }
      if (t.closest("#cmp-clear")) {
        s.cmp = [];
        save();
        syncCompareCheckboxes();
        renderCompare();
        return;
      }
      const rm = t.closest<HTMLButtonElement>("[data-cmp-rm]");
      if (rm) {
        const id = Number(rm.dataset.cmpRm);
        s.cmp = s.cmp.filter((x) => x !== id);
        save();
        syncCompareCheckboxes();
        renderCompare();
      }
    });

    $<HTMLSelectElement>("#pick-target").addEventListener("change", (e) => {
      const id = (e.target as HTMLSelectElement).value;
      if (id === s.target) return;
      const was = Object.fromEntries(chs().map((c) => [c.id, mulOf(c.id)]));
      const hand = s.hand;
      s.target = id;
      s.cell = -1;
      s.cmp = [];
      if (hand) {
        const b = base();
        const live = chs().filter((c) => b[c.id]);
        s.hand = live.every((c) => (was[c.id] ?? 1) === 1) ? null : Object.fromEntries(live.map((c) => [c.id, Math.round(b[c.id] * (was[c.id] ?? 1) * 100) / 100]));
      }
      save();
      void apply(false);
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

    const slidersEl = $("#sliders");
    const applySliderUi = (t: HTMLInputElement) => {
      const v = Number(t.value);
      weigh(t.dataset.ch!, v);
      const out = (t.closest(".w-row") ?? t.parentElement!).querySelector("output");
      if (out) out.textContent = fmtMul(v);
      syncPillRange(t);
    };
    slidersEl.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.ch || !d) return;
      applySliderUi(t);
      sliderDirty = true;
      if (!sliderRaf) {
        sliderRaf = requestAnimationFrame(() => {
          sliderRaf = 0;
          if (!sliderDirty) return;
          sliderDirty = false;
          changed();
        });
      }
    });
    slidersEl.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.ch || !d) return;
      const before = s.hand ? JSON.stringify(s.hand) : "";
      applySliderUi(t);
      const after = s.hand ? JSON.stringify(s.hand) : "";
      if (sliderDirty || before !== after) {
        cancelSliderRaf();
        changed();
      }
    });
    $("#w-reset").addEventListener("click", () => {
      if (!s.hand || !d) return;
      cancelSliderRaf();
      s.hand = null;
      renderSliders();
      changed();
    });

    const rank = $("#rank");
    rank.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.cmp) return;
      const i = Number(t.dataset.cmp);
      s.cmp = t.checked ? [...s.cmp.filter((x) => x !== i), i].slice(-3) : s.cmp.filter((x) => x !== i);
      save();
      syncCompareCheckboxes();
      renderCompare();
    });
    rank.addEventListener(
      "toggle",
      (e) => {
        const g = e.target as HTMLDetailsElement;
        if (!g.dataset.group) return;
        if (g.open) shut.delete(g.dataset.group);
        else shut.add(g.dataset.group);
      },
      true,
    );
    const rowOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("#rank li[data-i]");
    rank.addEventListener("mouseover", (e) => {
      const li = rowOf(e);
      const i = li ? Number(li.dataset.i) : null;
      earth?.hover(i);
      const p = i != null && hovers.matches && !pop?.isOpen ? earth?.at(i) : null;
      if (i != null && p) card?.show(i, p.x, p.y);
      else card?.hide();
    });
    rank.addEventListener("mouseleave", () => {
      earth?.hover(null);
      card?.hide();
    });
    rank.addEventListener("focusin", (e) => {
      const li = rowOf(e);
      if (li) earth?.hover(Number(li.dataset.i));
    });
    rank.addEventListener("focusout", () => earth?.hover(null));

    card = createHoverCard(earthCol, { info, open });
    analogTip = createAnalogTip(earthCol);
    // Mount popup on #explore so mobile fixed positioning escapes .earth-col's sticky stacking context.
    pop = createPopup(earthCol, { info, open, closed: () => {} }, explore);

    $("#legend").addEventListener("click", (e) => {
      const foldBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("#lg-fold");
      if (foldBtn) {
        const collapsed = $("#legend").classList.toggle("is-collapsed");
        earthCol.classList.toggle("lg-collapsed", collapsed);
        const expanded = !collapsed;
        foldBtn.setAttribute("aria-expanded", String(expanded));
        const word = expanded ? "Collapse legend" : "Expand legend";
        foldBtn.title = word;
        foldBtn.setAttribute("aria-label", word);
        return;
      }
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-share]");
      if (!b || !d || Number(b.dataset.share) === share) return;
      share = Number(b.dataset.share);
      threshold = cut(score, share);
      zones = focus(score, share, { lat: d.cells.lat, lon: d.cells.lon });
      pop?.hide(false);
      paint();
    });

    document.addEventListener("keydown", (e) => {
      if (el.hidden) return;
      if (e.key === "Escape") {
        card?.hide();
        analogTip?.hide();
        pop?.hide();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && tgt.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (e.key === "/") {
        e.preventDefault();
        search?.focus();
      } else if (e.key === "g" || e.key === "G") {
        setFlatView(false);
      } else if (e.key === "m" || e.key === "M") {
        setFlatView(true);
      } else if (e.key === "+" || e.key === "=") {
        earth?.zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        earth?.zoomOut();
      } else if (e.key === "0") {
        earth?.resetView();
      }
    });

    document.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (pop?.isOpen && t.isConnected && !t.closest(".mpop, #earth, .fd-search")) pop.hide(false);
    });

    $("#back").addEventListener("click", () => earth?.back());
    $<HTMLInputElement>("#pick-labels").addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      $("#tog-state").textContent = on ? "Shown" : "Hidden";
      if (!on) analogTip?.hide();
      earth?.labels(on);
    });
    $<HTMLInputElement>("#pick-strength").addEventListener("input", (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      $("#strength-out").textContent = `${v}%`;
      earth?.strength(v / 100);
    });
    $("#view-seg").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-view]");
      if (!b) return;
      setFlatView(b.dataset.view === "flat");
    });

    $("#fold").addEventListener("click", () => {
      const openSide = !explore.classList.toggle("wide");
      $<HTMLElement>("#fd-side").inert = !openSide;
      const b = $("#fold");
      const word = openSide ? "Hide the list" : "Show the list";
      b.setAttribute("aria-expanded", String(openSide));
      b.title = word;
      b.querySelector(".sr")!.textContent = word;
      card?.hide();
      analogTip?.hide();
      pop?.hide(false);
    });
    explore.addEventListener("transitionend", (e) => {
      if (e.target === e.currentTarget) {
        earth?.resize();
        stars?.resize();
      }
    });

    // Mobile sheet handle (.fd-grip): tap or vertical drag snaps between Map peek and List focus.
    const grip = $<HTMLButtonElement>("#fd-grip");
    let sheetMode: "mid" | "list" | "map" = "mid";
    const setSheetMode = (next: "list" | "map") => {
      sheetMode = next;
      explore.classList.toggle("sheet-list", next === "list");
      explore.classList.toggle("sheet-map", next === "map");
      grip.setAttribute("aria-expanded", String(next === "list"));
      if (next === "map") window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
      setTimeout(() => {
        earth?.resize();
        stars?.resize();
      }, 340);
    };

    let dragStartY: number | null = null;
    let swiped = false;
    grip.addEventListener("pointerdown", (e) => {
      dragStartY = e.clientY;
      swiped = false;
      try {
        grip.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failures on synthetic pointer events.
      }
    });
    grip.addEventListener("pointermove", (e) => {
      if (dragStartY == null) return;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dy) >= 28) {
        swiped = true;
        dragStartY = null;
        setSheetMode(dy > 0 ? "map" : "list");
      }
    });
    const endDrag = () => {
      dragStartY = null;
    };
    grip.addEventListener("pointerup", endDrag);
    grip.addEventListener("pointercancel", endDrag);
    grip.addEventListener("click", () => {
      if (swiped) {
        swiped = false;
        return;
      }
      setSheetMode(sheetMode === "list" ? "map" : "list");
    });
    earthStage.addEventListener("transitionend", (e) => {
      if (e.target === earthStage) {
        earth?.resize();
        stars?.resize();
      }
    });

    tourButton($("#tour"), "find");
  };

  const map = (data: Data) => {
    const earthEl = $("#earth");
    if (!webgl()) {
      earthEl.innerHTML = `<p class="nogl">This browser cannot show the 3D map because WebGL is off. The ranked list and the match pages work.</p>`;
      return;
    }
    const hot = (i: number | null) => {
      for (const b of el.querySelectorAll<HTMLElement>("#rank li[data-i]")) b.classList.toggle("hot", i != null && b.dataset.i === String(i));
    };
    Promise.all([import("../earth"), ctx.labels()])
      .then(([mod, labels]) => {
        search?.setLabels(labels);
        const at = $("#st-at");
        earth = mod.createEarth(earthEl, { lat: data.cells.lat, lon: data.cells.lon, n: data.n }, labels, {
          pick: (i) => (i >= 0 ? popAt(i) : pop?.hide(false)),
          analogPick: (ap, cell, x, y) => showAnalogPop(ap, cell, x, y),
          analogOver: (ap, x, y) => {
            if (!ap || !hovers.matches || pop?.isOpen) analogTip?.hide();
            else analogTip?.show(ap, x, y);
          },
          pin: hot,
          over: (i, x, y) => {
            if (i == null || !hovers.matches || pop?.isOpen) card?.hide();
            else card?.show(i, x, y);
          },
          moved: () => {
            card?.hide();
            analogTip?.hide();
            if (pop?.isOpen && pop.coords) pop.move(earth!.project(pop.coords.lat, pop.coords.lon));
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
        earth.flat(flat);
        earth.strength(Number($<HTMLInputElement>("#pick-strength").value) / 100);
      })
      .catch(() => (earthEl.innerHTML = `<p class="nogl">The map did not load. The ranked list and the match pages work.</p>`));
  };

  let ready: Promise<Data | null> = Promise.resolve(null);
  return {
    title: () => "Finder",
    hide() {
      cancelSliderRaf();
      stars?.stop();
      search?.close();
      card?.hide();
      analogTip?.hide();
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
          $("#rank").innerHTML = `<p class="rk-empty" role="alert">The data files did not load (${esc((e as Error).message)}). Make sure that you are online, then reload the page.</p>`;
          return null;
        });
    },
    async show(q) {
      const next = readState(m, q);
      ctx.site(targetOf(m, next));
      siteLink(targetOf(m, next).body);
      stars?.start();
      earth?.resize();
      if (!(await ready)) return;
      const keyStr = query(next, -1);
      if (keyStr === applied && (next.cell < 0 || next.cell === s.cell)) return;
      const first = !applied;
      const same = next.target === s.target && !first;
      s = next;
      applied = keyStr;
      if (same) {
        renderControls();
        renderSliders();
        recompute();
        if (s.cell < 0) s.cell = target().headline?.cell ?? -1;
        select(true);
      } else await apply(first);
    },
  };
}

import type { LabelPoint, Target } from "./contract";
import { esc, latlon, num, reduced, score100 } from "./format";
import { icon } from "./icons";
import { thumb } from "./worlds";

/* ---------- Orbital Starfield Backdrop ---------- */

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  amp: number;
  speed: number;
  phase: number;
  depth: number;
  rgb: string;
}

export interface Starfield {
  start(): void;
  stop(): void;
  resize(): void;
}

function makeStars(count: number): Star[] {
  // Deterministic Mulberry32 seed keeps the starfield identical across renders.
  let seed = 0x51a7f1ed;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tints = ["244,241,235", "236,228,214", "252,238,214", "222,224,230"];
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const big = rnd() > 0.86;
    stars.push({
      x: rnd(),
      y: rnd(),
      r: big ? 1.05 + rnd() * 0.55 : 0.45 + rnd() * 0.55,
      base: big ? 0.48 + rnd() * 0.38 : 0.2 + rnd() * 0.42,
      amp: 0.12 + rnd() * 0.28,
      speed: 0.0007 + rnd() * 0.0018,
      phase: rnd() * Math.PI * 2,
      depth: 0.35 + rnd() * 0.65,
      rgb: tints[Math.floor(rnd() * tints.length)],
    });
  }
  return stars;
}

export function createStarfield(canvas: HTMLCanvasElement, host: HTMLElement): Starfield {
  const ctx = canvas.getContext("2d");
  const stars = makeStars(150);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let active = false;
  let targetX = 0;
  let targetY = 0;
  let px = 0;
  let py = 0;

  const draw = (now: number) => {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const staticMode = reduced();
    if (!staticMode) {
      px += (targetX - px) * 0.08;
      py += (targetY - py) * 0.08;
    } else {
      px = 0;
      py = 0;
    }
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const sx = s.x * width + px * s.depth;
      const sy = s.y * height + py * s.depth;
      const a = staticMode ? s.base : Math.max(0.06, Math.min(0.95, s.base + Math.sin(now * s.speed + s.phase) * s.amp));
      ctx.fillStyle = `rgba(${s.rgb},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const size = () => {
    const r = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === width && h === height && nextDpr === dpr) return;
    width = w;
    height = h;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  };

  let lastDraw = 0;

  const loop = (now: number) => {
    raf = 0;
    if (!active || document.hidden || reduced()) return;
    if (now - lastDraw >= 50) {
      lastDraw = now;
      draw(now);
    }
    raf = requestAnimationFrame(loop);
  };

  const schedule = () => {
    if (!active || document.hidden) return;
    size();
    draw(performance.now());
    if (!reduced() && !raf) raf = requestAnimationFrame(loop);
  };

  host.addEventListener(
    "pointermove",
    (e) => {
      if (!active || reduced() || e.pointerType === "touch") return;
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      targetX = ((e.clientX - r.left) / r.width - 0.5) * -12;
      targetY = ((e.clientY - r.top) / r.height - 0.5) * -10;
    },
    { passive: true },
  );
  host.addEventListener("pointerleave", () => {
    targetX = 0;
    targetY = 0;
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (active) {
      schedule();
    }
  });

  new ResizeObserver(() => {
    if (active) size();
  }).observe(host);

  return {
    start() {
      active = true;
      schedule();
    },
    stop() {
      active = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    resize: size,
  };
}

/* ---------- Live 36-Bin Score Histogram ---------- */

export const HIST_BINS = 36;

export function renderHistogram(
  host: HTMLElement,
  score: Float32Array,
  keep: (i: number) => boolean,
  cutVal: number,
  focused: boolean,
): void {
  let bars = host.querySelectorAll<HTMLElement>(".lg-bin");
  if (bars.length !== HIST_BINS) {
    host.innerHTML = Array.from({ length: HIST_BINS }, (_, b) => `<span class="lg-bin" data-bin="${b}"></span>`).join("");
    bars = host.querySelectorAll<HTMLElement>(".lg-bin");
  }
  const counts = new Uint32Array(HIST_BINS);
  let total = 0;
  let max = 0;
  for (let i = 0; i < score.length; i++) {
    if (!keep(i)) continue;
    const v = score[i];
    if (!Number.isFinite(v)) continue;
    const b = Math.max(0, Math.min(HIST_BINS - 1, Math.floor(v * HIST_BINS)));
    const next = ++counts[b];
    if (next > max) max = next;
    total++;
  }
  const denom = Math.sqrt(Math.max(1, max));
  for (let b = 0; b < HIST_BINS; b++) {
    const bar = bars[b];
    const c = counts[b];
    const pct = c > 0 ? Math.max(10, Math.round((Math.sqrt(c) / denom) * 100)) : 4;
    const mid = (b + 0.5) / HIST_BINS;
    const active = !focused ? c > 0 : mid >= cutVal && c > 0;
    bar.style.height = `${pct}%`;
    bar.classList.toggle("is-active", active);
    bar.classList.toggle("is-empty", c === 0);
    bar.dataset.active = String(active);
  }
  host.setAttribute(
    "aria-label",
    total ? `Score distribution across ${num(total)} ranked land cells` : "Score distribution: no ranked land cells",
  );
}

/* ---------- Collapsible Bottom-Right Target Preview Card (.fd-twin) ---------- */

export interface TargetTwin {
  update(t: Target): void;
}

export function createTargetTwin(host: HTMLElement): TargetTwin {
  host.innerHTML = `
    <div class="fd-twin-head">
      <span class="fd-twin-tag"><i class="fd-twin-dot" aria-hidden="true"></i><span class="fd-twin-name">Target</span></span>
      <button type="button" class="fd-twin-fold" aria-expanded="true" aria-controls="fd-twin-body" title="Collapse target preview" aria-label="Collapse target preview">${icon("chevron")}</button>
    </div>
    <div class="fd-twin-body" id="fd-twin-body">
      <div class="fd-twin-orb"><canvas class="fd-twin-cv" width="160" height="160" aria-hidden="true"></canvas></div>
      <p class="fd-twin-ll"></p>
    </div>`;

  const btn = host.querySelector<HTMLButtonElement>(".fd-twin-fold")!;
  const nameEl = host.querySelector<HTMLElement>(".fd-twin-name")!;
  const llEl = host.querySelector<HTMLElement>(".fd-twin-ll")!;
  const canvas = host.querySelector<HTMLCanvasElement>(".fd-twin-cv")!;

  btn.addEventListener("click", () => {
    const collapsed = host.classList.toggle("is-collapsed");
    const expanded = !collapsed;
    btn.setAttribute("aria-expanded", String(expanded));
    const lbl = expanded ? "Collapse target preview" : "Expand target preview";
    btn.title = lbl;
    btn.setAttribute("aria-label", lbl);
  });

  let currentId = "";
  let token = 0;

  return {
    update(t: Target) {
      host.dataset.body = t.body;
      nameEl.textContent = t.short;
      llEl.textContent = latlon(t.lat, t.lon, 1);
      if (t.id === currentId) return;
      currentId = t.id;
      const mine = ++token;
      void thumb(canvas, t).catch(() => {
        if (mine === token) currentId = "";
      });
    },
  };
}

/* ---------- Direct Coordinate Parser & Local Search Combobox ---------- */

export type SearchHit =
  | { kind: "coord"; label: string; sub: string; lat: number; lon: number; cell: number }
  | { kind: "label"; label: string; sub: string; point: LabelPoint; cell: number }
  | { kind: "region"; label: string; sub: string; cell: number };

export interface SearchHooks {
  cellIndex(lat: number, lon: number): number;
  placeName(i: number): string;
  scoreOf(i: number): number;
  pickCell(i: number, lat: number, lon: number): void;
  pickAnalog(p: LabelPoint, cell: number): void;
}

export interface SearchBox {
  setLabels(labels: LabelPoint[]): void;
  setRegions(regions: string[], bestByRegion: Int32Array): void;
  focus(): void;
  close(): void;
}

const COORD_PLAIN = /^\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*(?:,\s*|\s+)([+-]?\d+(?:\.\d+)?)\s*°?\s*$/;
const COORD_HEMI =
  /^\s*([NS])?\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*(?:,\s*|\s+)([EW])?\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i;

export function parseCoords(raw: string): { lat: number; lon: number } | null {
  const s = raw.trim();
  if (!s) return null;
  let lat: number;
  let lon: number;
  const plain = s.match(COORD_PLAIN);
  if (plain) {
    lat = Number(plain[1]);
    lon = Number(plain[2]);
  } else {
    const hemi = s.match(COORD_HEMI);
    if (!hemi) return null;
    const ns = (hemi[1] || hemi[3] || "").toUpperCase();
    const ew = (hemi[4] || hemi[6] || "").toUpperCase();
    if (!ns && !ew) return null;
    lat = Number(hemi[2]);
    lon = Number(hemi[5]);
    if (ns === "S") lat = -Math.abs(lat);
    else if (ns === "N") lat = Math.abs(lat);
    if (ew === "W") lon = -Math.abs(lon);
    else if (ew === "E") lon = Math.abs(lon);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

const KIND_TAG: Record<LabelPoint["kind"], string> = {
  known_analog: "Known analog",
  cave: "Cave / lava tube",
  ordinary: "Control site",
  plain_desert: "Desert control",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function createSearch(host: HTMLElement, hooks: SearchHooks): SearchBox {
  host.innerHTML = `
    <div class="fd-search-field">
      <svg class="ic fd-search-ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input
        type="search"
        id="fd-search"
        class="fd-search-in"
        placeholder="Search a place or lat, lon"
        aria-label="Search a place, region, or latitude and longitude"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded="false"
        aria-controls="fd-search-list"
      >
      <kbd class="fd-search-kbd" aria-hidden="true">/</kbd>
      <button type="button" class="fd-search-clear" aria-label="Clear search" hidden>${icon("x")}</button>
    </div>
    <ul class="fd-search-list" id="fd-search-list" role="listbox" aria-label="Search results" hidden></ul>`;

  const input = host.querySelector<HTMLInputElement>("#fd-search")!;
  const clearBtn = host.querySelector<HTMLButtonElement>(".fd-search-clear")!;
  const listEl = host.querySelector<HTMLUListElement>("#fd-search-list")!;

  let labels: { p: LabelPoint; hay: string; nameLow: string }[] = [];
  let regions: { name: string; low: string; idx: number }[] = [];
  let bestByRegion: Int32Array = new Int32Array(0);
  let hits: SearchHit[] = [];
  let active = -1;

  const close = () => {
    listEl.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };

  const highlight = (idx: number) => {
    active = idx;
    const opts = listEl.querySelectorAll<HTMLElement>('[role="option"]');
    opts.forEach((opt, k) => {
      const on = k === idx;
      opt.setAttribute("aria-selected", String(on));
      opt.classList.toggle("is-active", on);
      if (on) {
        input.setAttribute("aria-activedescendant", opt.id);
        opt.scrollIntoView({ block: "nearest" });
      }
    });
    if (idx < 0) input.removeAttribute("aria-activedescendant");
  };

  const choose = (hit: SearchHit) => {
    close();
    input.value = hit.label;
    clearBtn.hidden = false;
    if (hit.kind === "coord") {
      if (hit.cell >= 0) hooks.pickCell(hit.cell, hit.lat, hit.lon);
    } else if (hit.kind === "label") {
      if (hit.point.kind === "known_analog" || hit.point.kind === "cave") {
        hooks.pickAnalog(hit.point, hit.cell);
      } else if (hit.cell >= 0) {
        hooks.pickCell(hit.cell, hit.point.lat, hit.point.lon);
      }
    } else {
      hooks.pickCell(hit.cell, NaN, NaN);
    }
  };

  const queryHits = (raw: string): SearchHit[] => {
    const q = raw.trim();
    if (!q) return [];
    const out: SearchHit[] = [];

    const coords = parseCoords(q);
    if (coords) {
      const cell = hooks.cellIndex(coords.lat, coords.lon);
      if (cell >= 0) {
        const sc = hooks.scoreOf(cell);
        const name = hooks.placeName(cell);
        out.push({
          kind: "coord",
          label: latlon(coords.lat, coords.lon, 2),
          sub: `${name}${Number.isFinite(sc) ? ` · ${score100(sc)} / 100` : " · unranked"}`,
          lat: coords.lat,
          lon: coords.lon,
          cell,
        });
      } else {
        out.push({
          kind: "coord",
          label: latlon(coords.lat, coords.lon, 2),
          sub: "Ocean or outside land grid",
          lat: coords.lat,
          lon: coords.lon,
          cell: -1,
        });
      }
      return out;
    }

    const needle = norm(q);
    const labelMatches: { score: number; hit: SearchHit }[] = [];
    for (const item of labels) {
      if (!item.hay.includes(needle)) continue;
      const prefix = item.nameLow.startsWith(needle) ? 3 : item.nameLow.includes(needle) ? 2 : 1;
      const analogBoost = item.p.kind === "known_analog" || item.p.kind === "cave" ? 0.5 : 0;
      const cell = hooks.cellIndex(item.p.lat, item.p.lon);
      const tag = KIND_TAG[item.p.kind];
      labelMatches.push({
        score: prefix + analogBoost,
        hit: {
          kind: "label",
          label: item.p.name,
          sub: item.p.country ? `${item.p.country} · ${tag}` : tag,
          point: item.p,
          cell,
        },
      });
    }
    labelMatches.sort((a, b) => b.score - a.score || a.hit.label.localeCompare(b.hit.label));
    for (const m of labelMatches.slice(0, 5)) out.push(m.hit);

    const regMatches: { rank: number; sc: number; hit: SearchHit }[] = [];
    for (const r of regions) {
      if (!r.low.includes(needle)) continue;
      const cell = bestByRegion[r.idx] ?? -1;
      if (cell < 0) continue;
      const sc = hooks.scoreOf(cell);
      regMatches.push({
        rank: r.low.startsWith(needle) ? 2 : 1,
        sc: Number.isFinite(sc) ? sc : -1,
        hit: {
          kind: "region",
          label: r.name,
          sub: Number.isFinite(sc) ? `Best cell in region · ${score100(sc)} / 100` : "Region",
          cell,
        },
      });
    }
    regMatches.sort((a, b) => b.rank - a.rank || b.sc - a.sc || a.hit.label.localeCompare(b.hit.label));
    for (const r of regMatches.slice(0, Math.max(2, 8 - out.length))) out.push(r.hit);

    return out.slice(0, 8);
  };

  const render = () => {
    const raw = input.value;
    clearBtn.hidden = !raw.length;
    hits = queryHits(raw);
    if (!raw.trim()) {
      close();
      return;
    }
    if (!hits.length) {
      listEl.innerHTML = `<li class="fd-search-empty" role="status">No matching place or coordinates</li>`;
      listEl.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
      return;
    }
    listEl.innerHTML = hits
      .map(
        (h, idx) =>
          `<li id="fd-opt-${idx}" role="option" aria-selected="${idx === 0}" class="fd-search-opt${idx === 0 ? " is-active" : ""}${
            h.kind === "coord" && h.cell < 0 ? " is-disabled" : ""
          }" data-idx="${idx}"><span class="fd-opt-n">${esc(h.label)}</span><span class="fd-opt-s">${esc(h.sub)}</span></li>`,
      )
      .join("");
    listEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
    highlight(0);
  };

  input.addEventListener("input", render);
  input.addEventListener("focus", () => {
    if (input.value.trim()) render();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      if (listEl.hidden) render();
      if (!hits.length) return;
      e.preventDefault();
      highlight((active + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      if (!hits.length) return;
      e.preventDefault();
      highlight((active - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      if (listEl.hidden && input.value.trim()) render();
      if (!hits.length) return;
      e.preventDefault();
      const target = hits[active >= 0 ? active : 0];
      if (target && !(target.kind === "coord" && target.cell < 0)) choose(target);
    } else if (e.key === "Escape") {
      if (!listEl.hidden) {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (input.value) {
        e.preventDefault();
        e.stopPropagation();
        input.value = "";
        clearBtn.hidden = true;
      }
    }
  });

  listEl.addEventListener("mousedown", (e) => {
    // Keep input focus long enough for click to complete cleanly.
    e.preventDefault();
  });
  listEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const li = (e.target as HTMLElement).closest<HTMLElement>("[data-idx]");
    if (!li) return;
    const hit = hits[Number(li.dataset.idx)];
    if (hit && !(hit.kind === "coord" && hit.cell < 0)) choose(hit);
  });

  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    input.value = "";
    clearBtn.hidden = true;
    close();
    input.focus();
  });

  document.addEventListener("click", (e) => {
    if (!host.contains(e.target as Node)) close();
  });

  return {
    setLabels(ls) {
      labels = ls.map((p) => ({
        p,
        nameLow: norm(p.name),
        hay: norm(`${p.name} ${p.country ?? ""} ${KIND_TAG[p.kind]}`),
      }));
      if (!listEl.hidden) render();
    },
    setRegions(rs, best) {
      bestByRegion = best;
      if (regions.length !== rs.length) {
        regions = rs.map((name, idx) => ({ name, low: norm(name), idx })).filter((r) => !!r.name);
      }
      if (!listEl.hidden) render();
    },
    focus() {
      input.focus();
      input.select();
    },
    close,
  };
}

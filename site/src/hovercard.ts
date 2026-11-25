import "./map.css";
import type { LabelPoint } from "./contract";
import { esc, latlon, num, score100 } from "./format";
import { colour } from "./ramp";
import { icon } from "./icons";

export interface HoverInfo {
  list: number;
  rank: number;
  of: number;
  name: string;
  lat: number;
  lon: number;
  score: number;
  fresh: boolean;
  outsideZone?: boolean;
  shareShort?: string;
}

export interface HoverHooks {
  info(i: number): HoverInfo | null;
  open(i: number): void;
}

export interface HoverCard {
  show(i: number, x: number, y: number): void;
  hide(): void;
}

export interface AnalogTip {
  show(p: LabelPoint, x: number, y: number): void;
  hide(): void;
}

export interface Popup {
  readonly open: number;
  readonly isOpen: boolean;
  readonly coords: { lat: number; lon: number } | null;
  show(i: number, x: number, y: number): void;
  showAnalog(p: LabelPoint, cell: number, x: number, y: number, href: string | null, scoreText: string | null): void;
  move(at: { x: number; y: number } | null): void;
  hide(restore?: boolean): void;
}

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8";
const Z = 8;
const WORLD = 256 * 2 ** Z;
const CREDIT = "NASA Blue Marble, via NASA GIBS";

const mx = (lon: number) => ((lon + 180) / 360) * WORLD;
const my = (lat: number) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * WORLD;

function ground(lat: number, lon: number, size: number) {
  if (Math.abs(lat) > 84) return "";
  const span = (2 / 360) * WORLD;
  const k = size / span;
  const x0 = mx(lon) - span / 2;
  const y0 = my(lat) - span / 2;
  const n = 2 ** Z;
  let tiles = "";
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + span) / 256); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + span) / 256); tx++)
      tiles += `<img src="${GIBS}/${Z}/${ty}/${((tx % n) + n) % n}.jpeg" alt="" decoding="async" style="left:${((tx * 256 - x0) * k).toFixed(1)}px;top:${((ty * 256 - y0) * k).toFixed(1)}px;width:${(256 * k).toFixed(1)}px">`;
  }
  const w = size / 4;
  const h = (my(lat - 0.25) - my(lat + 0.25)) * k;
  return `<span class="gv" style="width:${size}px;height:${size}px">${tiles}<i class="gv-sq" style="width:${w.toFixed(1)}px;height:${h.toFixed(1)}px"></i></span>`;
}

const badge = (p: HoverInfo) => (p.fresh ? `<span class="newc" title="Not in our list of known analog sites"><i></i>New candidate</span>` : "");

function blank(box: HTMLElement) {
  box.addEventListener(
    "error",
    (e) => {
      if ((e.target as HTMLElement).tagName === "IMG") box.classList.add("noimg");
    },
    true,
  );
}

function place(box: HTMLElement, host: HTMLElement, x: number, y: number, gap: number, offsetX = 0, offsetY = 0) {
  const W = host.clientWidth;
  const H = host.clientHeight;
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const fits = ([l, t]: number[]) => l >= 4 && t >= 4 && l + w <= W - 4 && t + h <= H - 4;
  const right = x + gap;
  const left = x - gap - w;
  const spots = [
    [right, y + gap],
    [left, y + gap],
    [right, y - gap - h],
    [left, y - gap - h],
    [right, y - h / 2],
    [left, y - h / 2],
  ];
  let at = spots.find(fits);
  if (!at) {
    const clampY = (t: number) => Math.max(4, Math.min(H - h - 4, t));
    const clampX = (l: number) => Math.max(4, Math.min(W - w - 4, l));
    if (right + w <= W - 4 || left >= 4) at = [right + w <= W - 4 ? right : left, clampY(y - h / 2)];
    else at = [clampX(x - w / 2), y + gap + h <= H - 4 || y - gap - h < 4 ? y + gap : y - gap - h];
  }
  box.style.left = `${Math.round(at[0] + offsetX)}px`;
  box.style.top = `${Math.round(at[1] + offsetY)}px`;
}

export function topShare(rank: number, of: number) {
  const p = Math.max(0.1, (rank / of) * 100);
  return p < 10 ? `${num(Math.ceil(p * 10) / 10, 1)}%` : `${num(Math.ceil(p))}%`;
}

export function createHoverCard(el: HTMLElement, hooks: HoverHooks): HoverCard {
  const card = document.createElement("div");
  card.className = "hovercard";
  card.hidden = true;
  card.setAttribute("aria-hidden", "true");
  blank(card);
  el.append(card);
  let now = -1;
  return {
    show(i, x, y) {
      if (i !== now) {
        const p = hooks.info(i);
        if (!p) return;
        now = i;
        const img = ground(p.lat, p.lon, 248);
        card.classList.toggle("noimg", !img);
        card.innerHTML = `${img ? `<span class="hc-fig">${img}<span class="hc-credit">${CREDIT}</span></span>` : ""}
          <span class="hc-name">${p.list ? `<b>#${p.list}</b> ` : ""}${esc(p.name)}</span>
          <span class="hc-ll">${latlon(p.lat, p.lon, 2)}${badge(p)}</span>
          ${p.list ? "" : `<span class="hc-rank">Rank ${num(p.rank)} of ${num(p.of)} ranked land cells</span>`}
          <span class="hc-foot"><span class="hc-score"><b>${score100(p.score)}</b> / 100 match score</span><span class="hc-open">Click to open</span></span>`;
      }
      card.hidden = false;
      place(card, el, x, y, 18);
    },
    hide() {
      now = -1;
      card.hidden = true;
    },
  };
}

export function createAnalogTip(el: HTMLElement): AnalogTip {
  const tip = document.createElement("div");
  tip.className = "analog-tip";
  tip.hidden = true;
  tip.setAttribute("aria-hidden", "true");
  el.append(tip);
  let nowId = "";
  return {
    show(p, x, y) {
      if (p.id !== nowId) {
        nowId = p.id;
        const kind = p.kind === "cave" ? "Cave / lava tube" : "Known analog";
        tip.innerHTML = `<span class="at-kind ${p.kind === "cave" ? "is-cave" : ""}">${kind}</span>
          <span class="at-name">${esc(p.name)}</span>
          ${p.country ? `<span class="at-sub">${esc(p.country)} · Click for details</span>` : `<span class="at-sub">Click for details</span>`}`;
      }
      tip.hidden = false;
      place(tip, el, x, y, 14);
    },
    hide() {
      nowId = "";
      tip.hidden = true;
    },
  };
}

export function createPopup(el: HTMLElement, hooks: HoverHooks & { closed(): void }, mountEl: HTMLElement = el): Popup {
  const box = document.createElement("div");
  box.className = "mpop";
  box.hidden = true;
  box.tabIndex = -1;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-labelledby", "mpop-h");
  blank(box);
  mountEl.append(box);
  let open = -1;
  let shown = false;
  let coords: { lat: number; lon: number } | null = null;
  let back: HTMLElement | null = null;
  let anchor = { x: 0, y: 0 };
  const R = 30;
  const C = 2 * Math.PI * R;
  box.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".mpop-x")) api.hide();
    else if (t.closest("button.mpop-go") && open >= 0) hooks.open(open);
  });

  const position = (at: { x: number; y: number } | null) => {
    if (!shown) return;
    const phone = matchMedia("(max-width: 759px)").matches;
    if (phone) {
      box.style.visibility = "";
      box.style.left = box.style.top = "";
      return;
    }
    box.style.visibility = at ? "" : "hidden";
    if (!at) return;
    anchor = at;
    const ox = mountEl === el ? 0 : el.offsetLeft;
    const oy = mountEl === el ? 0 : el.offsetTop;
    place(box, el, anchor.x, anchor.y, 16, ox, oy);
  };

  const api: Popup = {
    get open() {
      return open;
    },
    get isOpen() {
      return shown;
    },
    get coords() {
      return coords;
    },
    show(i, x, y) {
      const p = hooks.info(i);
      if (!p) return;
      if (!shown) back = document.activeElement as HTMLElement | null;
      open = i;
      shown = true;
      coords = { lat: p.lat, lon: p.lon };
      const img = ground(p.lat, p.lon, 104);
      const v = Math.max(0, Math.min(1, p.score));
      box.classList.remove("is-analog");
      box.classList.toggle("noimg", !img);
      const outside = p.outsideZone && p.shareShort ? `<span class="mpop-out">Outside the ${esc(p.shareShort)}</span>` : "";
      box.innerHTML = `<button type="button" class="mpop-x" aria-label="Close">${icon("x")}</button>
        <div class="mpop-top">${img ? `<span class="mpop-fig" title="${CREDIT}">${img}</span>` : ""}<div>
          <h3 id="mpop-h">${p.list ? `<span class="mpop-n">#${p.list}</span> ` : ""}${esc(p.name)}</h3>
          <p class="mpop-ll">${latlon(p.lat, p.lon, 2)}</p>
          <div class="mpop-badges">${badge(p)}${outside}</div>
        </div></div>
        <div class="mpop-mid">
          <span class="mpop-ring" role="img" aria-label="${score100(p.score)} / 100 match score"><svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="${R}" class="trk"/><circle cx="36" cy="36" r="${R}" class="val" style="stroke:${colour(v)};stroke-dasharray:${(v * C).toFixed(1)} ${C.toFixed(1)}"/></svg><b>${score100(p.score)}</b><span>/ 100</span></span>
          <p class="mpop-txt">match score, in the top <b class="mpop-top-share">${topShare(p.rank, p.of)}</b> of land</p>
        </div>
        ${img ? `<p class="mpop-credit">Image: ${CREDIT}</p>` : ""}
        <button type="button" class="btn mpop-go">Details ${icon("chevron")}</button>`;
      box.hidden = false;
      position({ x, y });
      box.focus({ preventScroll: true });
    },
    showAnalog(p, cell, x, y, href, scoreText) {
      if (!shown) back = document.activeElement as HTMLElement | null;
      open = -1;
      shown = true;
      coords = { lat: p.lat, lon: p.lon };
      const kindLabel = p.kind === "cave" ? "Cave / lava tube" : "Known analog";
      const src = p.analog_source ?? p.source;
      box.classList.add("is-analog");
      box.classList.remove("noimg");
      box.innerHTML = `<button type="button" class="mpop-x" aria-label="Close">${icon("x")}</button>
        <div class="mpop-analog-head">
          <span class="mpop-kind ${p.kind === "cave" ? "is-cave" : ""}">${kindLabel}</span>
          <h3 id="mpop-h">${esc(p.name)}</h3>
          <p class="mpop-ll">${p.country ? `${esc(p.country)} · ` : ""}${latlon(p.lat, p.lon, 2)}</p>
        </div>
        ${p.note ? `<p class="mpop-note">${esc(p.note)}</p>` : ""}
        <div class="mpop-analog-meta">
          ${scoreText ? `<span class="mpop-cell-score">Cell score: <b>${esc(scoreText)}</b></span>` : ""}
          ${src ? `<a class="mpop-src" href="${esc(src)}" target="_blank" rel="noopener noreferrer">Source ↗</a>` : ""}
        </div>
        ${
          cell >= 0 && href
            ? `<a class="btn mpop-go" href="${href}">See this cell's score ${icon("chevron")}</a>`
            : `<p class="mpop-unranked">Outside the 0.5° ranked land grid.</p>`
        }`;
      box.hidden = false;
      position({ x, y });
      box.focus({ preventScroll: true });
    },
    move: position,
    hide(restore = true) {
      if (!shown) return;
      open = -1;
      shown = false;
      coords = null;
      const had = box.contains(document.activeElement);
      box.hidden = true;
      box.classList.remove("is-analog");
      if (restore && had && back?.isConnected) back.focus({ preventScroll: true });
      back = null;
      hooks.closed();
    },
  };
  return api;
}

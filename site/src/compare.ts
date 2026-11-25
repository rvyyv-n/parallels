import "./compare.css";
import type { Body, Target } from "./contract";
import { bindSegmented } from "./controls";
import { esc, latlon, num } from "./format";
import { icon } from "./icons";

export const VIEW_KM = 140;
const BAR_KM = 50;
const RADIUS: Record<Body | "earth", number> = { earth: 6371, moon: 1737.4, mars: 3389.5 };
const D = Math.PI / 180;
const BASE = import.meta.env.BASE_URL;
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const BM = `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8`;
const WELD = `${GIBS}/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-12-01/GoogleMapsCompatible_Level12`;
const TREK = "https://trek.nasa.gov/tiles";
const LOLA = `${TREK}/Moon/SP/LRO_LOLA_Shade_SPole875_5mp_v04/1.0.0/default/default028mm`;
const WAC = `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm`;
const VIKING = `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm`;
const SP_ORIGIN = 1095930;
const SP_RES0 = (2 * SP_ORIGIN) / 256;
const SP_EDGE_KM = 75.84;
const FALLBACK = { earth: `${BASE}img/blue-marble.jpg`, moon: `${BASE}img/moon.jpg`, mars: `${BASE}img/mars.jpg` };
const FALLBACK_PX = { earth: 1024, moon: 2048, mars: 2048 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pc = (v: number) => `${v.toFixed(3)}%`;
const metres = (km: number) => (km >= 1 ? `${num(km, km < 10 ? 1 : 0)} km` : `${num(Math.round((km * 1000) / 5) * 5)} m`);

interface View {
  tiles: string;
  kmPerPx: number;
  marks: string;
}

function want() {
  if (typeof window === "undefined") return 640;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  return (window.innerWidth >= 700 ? 560 : 300) * dpr;
}

function tile(src: string, l: number, t: number, w: number, h: number, cls: string, onerror: string) {
  return `<img class="${cls}" src="${src}" alt="" loading="lazy" decoding="async"${cls.includes("hi") ? ' crossorigin="anonymous"' : ""} style="left:${pc(l)};top:${pc(t)};width:${pc(w)};height:${pc(h)}" onerror="${onerror}">`;
}

function merc(lat: number, lon: number, n: number) {
  return [((lon + 180) / 360) * n * 256, ((1 - Math.asinh(Math.tan(lat * D)) / Math.PI) / 2) * n * 256];
}

function mercTiles(lat: number, lon: number, z: number, url: string, cls: string, onerror: string) {
  const n = 2 ** z;
  const kmPerPx = (2 * Math.PI * RADIUS.earth * Math.cos(lat * D)) / (256 * n);
  const span = VIEW_KM / kmPerPx;
  const [cx, cy] = merc(lat, lon, n);
  const x0 = cx - span / 2;
  const y0 = cy - span / 2;
  const out: string[] = [];
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + span) / 256); ty++)
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + span) / 256); tx++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      out.push(tile(`${url}/${z}/${ty}/${wx}.jpeg`, ((tx * 256 - x0) / span) * 100, ((ty * 256 - y0) / span) * 100, (256 / span) * 100, (256 / span) * 100, cls, onerror));
    }
  return { html: out.join(""), kmPerPx, x0, y0, span, n };
}

function earthView(lat: number, lon: number) {
  if (Math.abs(lat) > 84.3) return null;
  const circ = 2 * Math.PI * RADIUS.earth * Math.cos(lat * D);
  const z = clamp(Math.round(Math.log2((want() * circ) / (256 * VIEW_KM))), 3, 12);
  const bz = Math.min(z, 8);
  const err = "this.closest('.eimg').classList.add('fb')";
  const low = mercTiles(lat, lon, bz, BM, "t lo", err);
  const high = z > 8 ? mercTiles(lat, lon, z, WELD, "t hi", "this.remove()") : null;
  const ref = high ?? low;
  const [ax, ay] = merc(lat + 0.25, lon - 0.25, ref.n);
  const [bx, by] = merc(lat - 0.25, lon + 0.25, ref.n);
  const box = `<i class="cmp-cell" style="left:${pc(((ax - ref.x0) / ref.span) * 100)};top:${pc(((ay - ref.y0) / ref.span) * 100)};width:${pc(((bx - ax) / ref.span) * 100)};height:${pc(((by - ay) / ref.span) * 100)}"></i>`;
  return { tiles: low.html + (high?.html ?? ""), kmPerPx: ref.kmPerPx, lowKm: low.kmPerPx, high: !!high, marks: box };
}

function spXY(lat: number, lon: number) {
  const rho = 2 * RADIUS.moon * Math.tan(((90 + lat) * D) / 2);
  return [rho * Math.sin(lon * D), rho * Math.cos(lon * D)];
}

function polarView(t: Target): View {
  const z = clamp(Math.round(Math.log2((want() * SP_RES0) / (VIEW_KM * 1000))), 0, 9);
  const res = SP_RES0 / 2 ** z;
  const span = (VIEW_KM * 1000) / res;
  const [cx, cy] = spXY(t.lat, t.lon);
  const px0 = (cx * 1000 + SP_ORIGIN) / res - span / 2;
  const py0 = (SP_ORIGIN - cy * 1000) / res - span / 2;
  const out: string[] = [];
  const err = "this.closest('.cmp-p').classList.add('fb')";
  for (let ty = Math.floor(py0 / 256); ty <= Math.floor((py0 + span) / 256); ty++)
    for (let tx = Math.floor(px0 / 256); tx <= Math.floor((px0 + span) / 256); tx++) {
      if (ty < 0 || ty >= 2 ** z || tx < 0 || tx >= 2 ** (z + 1)) continue;
      out.push(tile(`${LOLA}/${z}/${ty}/${tx}.png`, ((tx * 256 - px0) / span) * 100, ((ty * 256 - py0) / span) * 100, (256 / span) * 100, (256 / span) * 100, "t", err));
    }
  const marks = (t.regions ?? [])
    .map((r) => {
      const [x, y] = spXY(r.lat, r.lon);
      const u = ((x - cx) / VIEW_KM + 0.5) * 100;
      const v = (0.5 - (y - cy) / VIEW_KM) * 100;
      if (u < 4 || u > 96 || v < 4 || v > 96) return "";
      return `<span class="cmp-mark${u < 50 ? " left" : ""}" style="left:${pc(u)};top:${pc(v)}"><b></b>${esc(r.name)}</span>`;
    })
    .join("");
  return { tiles: out.join(""), kmPerPx: res / 1000, marks };
}

function eqView(body: Body, lat: number, lon: number, url: string, maxZ: number): View {
  const k = (Math.PI * RADIUS[body]) / 180;
  const z = clamp(Math.round(Math.log2((want() * 180 * k) / (256 * VIEW_KM))), 0, maxZ);
  const d = 180 / (256 * 2 ** z);
  const spanLat = VIEW_KM / k / d;
  const spanLon = spanLat / Math.max(0.05, Math.cos(lat * D));
  const px0 = (lon + 180) / d - spanLon / 2;
  const py0 = (90 - lat) / d - spanLat / 2;
  const cols = 2 ** (z + 1);
  const out: string[] = [];
  const err = "this.closest('.cmp-p').classList.add('fb')";
  for (let ty = Math.floor(py0 / 256); ty <= Math.floor((py0 + spanLat) / 256); ty++)
    for (let tx = Math.floor(px0 / 256); tx <= Math.floor((px0 + spanLon) / 256); tx++) {
      if (ty < 0 || ty >= 2 ** z) continue;
      const wx = ((tx % cols) + cols) % cols;
      out.push(tile(`${url}/${z}/${ty}/${wx}.jpg`, ((tx * 256 - px0) / spanLon) * 100, ((ty * 256 - py0) / spanLat) * 100, (256 / spanLon) * 100, (256 / spanLat) * 100, "t", err));
    }
  return { tiles: out.join(""), kmPerPx: d * k, marks: "" };
}

function fbNote(body: Body | "earth") {
  const km = ((360 / FALLBACK_PX[body]) * Math.PI * RADIUS[body]) / 180;
  return `<span class="fb-note">Live tiles did not load: low-resolution copy, about ${num(km, 0)} km per pixel, same scale.</span>`;
}

export interface CompareInput {
  body: Body;
  target: Target;
  lat: number;
  lon: number;
  place: string;
}

export function compareHtml(x: CompareInput): string {
  const bodyName = x.body === "moon" ? "Moon" : "Mars";
  const e = earthView(x.lat, x.lon);
  const polar = x.body === "moon" && x.target.lat <= -90 + (SP_EDGE_KM - VIEW_KM / 2) / ((Math.PI * RADIUS.moon) / 180);
  const tv = polar ? polarView(x.target) : x.body === "moon" ? eqView("moon", x.target.lat, x.target.lon, WAC, 8) : eqView("mars", x.target.lat, x.target.lon, VIKING, 7);
  const tLayer = polar
    ? `LRO LOLA shaded relief of the south pole (87.5° S to the pole), NASA Moon Trek, at approximately ${metres(tv.kmPerPx)} for each pixel. This is not a photo. It comes from laser altimetry and shows the shape of the ground with light from a computer sun. The dots show the Artemis III regions. The cross shows the pole.`
    : x.body === "moon"
      ? `LRO WAC global mosaic, NASA Moon Trek, at approximately ${metres(tv.kmPerPx)} for each pixel.`
      : `Viking MDIM 2.1 colour mosaic (NASA/USGS), NASA Mars Trek, at approximately ${metres(tv.kmPerPx)} for each pixel from north to south. The cross shows the target point.`;
  const eLayer = !e
    ? ""
    : e.high
      ? `Landsat true colour, yearly composite for 2000 (Landsat/WELD through NASA GIBS), at approximately ${metres(e.kmPerPx)} for each pixel. Where Landsat has no data, NASA Blue Marble shows (approximately ${metres(e.lowKm)} for each pixel). The square shows this 0.5° cell.`
      : `NASA Blue Marble shaded relief (GIBS), at approximately ${metres(e.kmPerPx)} for each pixel. The square shows this 0.5° cell.`;
  const frac = (BAR_KM / VIEW_KM) * 100;
  const earthPanel = e
    ? `<div class="cmp-p eimg loading" data-body="earth" data-lat="${x.lat}" data-lon="${x.lon}" role="img" aria-label="Earth around ${esc(x.place)}, ${VIEW_KM} km across, with the 0.5 degree cell outlined">
        <div class="cmp-tiles">${e.tiles}</div><canvas class="cmp-fb" width="256" height="256"></canvas>${e.marks}<span class="cmp-tag">Earth</span></div>`
    : `<div class="cmp-p eimg none" role="img" aria-label="No Earth image this near the pole"><p>There is no live map image this near the pole.</p><span class="cmp-tag">Earth</span></div>`;
  const targetPanel = `<div class="cmp-p timg loading" data-body="${x.body}" data-proj="${polar ? "sp" : "eq"}" data-lat="${x.target.lat}" data-lon="${x.target.lon}" role="img" aria-label="${esc(bodyName)} at ${esc(x.target.name)}, ${VIEW_KM} km across">
      <div class="cmp-tiles">${tv.tiles}</div><canvas class="cmp-fb" width="256" height="256"></canvas><i class="cmp-x" style="left:50%;top:50%"></i>${tv.marks}<span class="cmp-tag">${esc(bodyName)}</span></div>`;
  return `<figure class="cmp" data-mode="split" style="--wipe:50%;--bar:${frac.toFixed(3)}%">
    <div class="cmp-bar">
      <div class="cmp-seg" role="group" aria-label="How to compare the two images">
        <button type="button" class="cmp-btn" data-cmp-mode="split" aria-pressed="true">${icon("split")}Side by side</button>
        <button type="button" class="cmp-btn" data-cmp-mode="wipe" aria-pressed="false">${icon("wipe")}Wipe</button>
      </div>
      <button type="button" class="cmp-ov" aria-pressed="true" title="Show or hide cell box and markers"><span class="cmp-ov-dot" aria-hidden="true"></span>Overlays</button>
    </div>
    <div class="cmp-stage">
      ${earthPanel}
      ${targetPanel}
      <span class="cmp-knob" aria-hidden="true"><span class="cmp-puck"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 6 3.5 10l4 4"/><path d="m12.5 6 4 4-4 4"/></svg></span></span>
      <input class="cmp-range" type="range" min="0" max="100" value="50" step="1" aria-label="Wipe divider: Earth on the left, ${esc(bodyName)} on the right" aria-valuetext="Divider at 50%">
    </div>
    <div class="cmp-scale"><span class="cmp-sb" aria-hidden="true"><i></i></span><span><b>${BAR_KM} km</b> · both images ${VIEW_KM} km wide, same ground scale</span></div>
    <figcaption class="cmp-caps">
      <p class="eimg-cap"><b>Earth</b> ${esc(x.place)} <span class="muted">${latlon(x.lat, x.lon)}</span>${e ? fbNote("earth") : ""}</p>
      <p class="timg-cap"><b>${esc(bodyName)}</b> ${esc(x.target.name)} <span class="muted">${latlon(x.target.lat, x.target.lon)}</span>${fbNote(x.body)}</p>
    </figcaption>
    <details class="cmp-about"><summary>About these images</summary>
      <p><b>Earth:</b> ${e ? eLayer : "Mercator map tiles stop at 85° latitude, so there is no live image this near the pole."}</p>
      <p><b>${esc(bodyName)}:</b> ${tLayer}</p>
      <p>We calculate both scales from the radius of each body (Earth ${num(RADIUS.earth)} km, ${esc(bodyName)} ${num(RADIUS[x.body], 1)} km) and from the map projection at the centre.</p>
    </details>
  </figure>`;
}

const cache = new Map<string, Promise<ImageData>>();

function pixels(src: string): Promise<ImageData> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((ok, bad) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement("canvas");
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(im, 0, 0);
        ok(g.getImageData(0, 0, c.width, c.height));
      };
      im.onerror = bad;
      im.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

function drawFallback(panel: HTMLElement) {
  if (panel.dataset.drawn) return;
  panel.dataset.drawn = "1";
  const body = (panel.dataset.body ?? "earth") as Body | "earth";
  const cv = panel.querySelector<HTMLCanvasElement>("canvas.cmp-fb");
  if (!cv) return;
  const lat0 = Number(panel.dataset.lat);
  const lon0 = Number(panel.dataset.lon);
  const R = RADIUS[body];
  const sp = panel.dataset.proj === "sp";
  const [cx, cy] = sp ? spXY(lat0, lon0) : [0, 0];
  pixels(FALLBACK[body])
    .then((img) => {
      const g = cv.getContext("2d")!;
      const S = cv.width;
      const out = g.createImageData(S, S);
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const u = ((i + 0.5) / S - 0.5) * VIEW_KM;
          const v = (0.5 - (j + 0.5) / S) * VIEW_KM;
          let lat: number;
          let lon: number;
          if (sp) {
            const X = cx + u;
            const Y = cy + v;
            lat = -90 + (2 * Math.atan(Math.hypot(X, Y) / (2 * R))) / D;
            lon = Math.atan2(X, Y) / D;
          } else {
            lat = lat0 + v / R / D;
            lon = lon0 + u / (R * Math.cos(lat0 * D)) / D;
          }
          const fx = ((((lon + 180) / 360) % 1) + 1) % 1 * img.width - 0.5;
          const fy = clamp(((90 - lat) / 180) * img.height - 0.5, 0, img.height - 1);
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const ax = fx - x0;
          const ay = fy - y0;
          const xa = ((x0 % img.width) + img.width) % img.width;
          const xb = (xa + 1) % img.width;
          const ya = y0;
          const yb = Math.min(img.height - 1, y0 + 1);
          const b = (j * S + i) * 4;
          for (let ch = 0; ch < 3; ch++) {
            const p = (yy: number, xx: number) => img.data[(yy * img.width + xx) * 4 + ch];
            out.data[b + ch] = (p(ya, xa) * (1 - ax) + p(ya, xb) * ax) * (1 - ay) + (p(yb, xa) * (1 - ax) + p(yb, xb) * ax) * ay;
          }
          out.data[b + 3] = 255;
        }
      g.putImageData(out, 0, 0);
      panel.dataset.fbReady = "1";
      panel.classList.remove("loading");
    })
    .catch(() => {
      panel.dataset.fbReady = "1";
      panel.classList.remove("loading");
    });
}

function checkLoaded(panel: HTMLElement) {
  if (!panel.classList.contains("loading")) return;
  if (panel.classList.contains("fb")) {
    if (panel.dataset.fbReady === "1") panel.classList.remove("loading");
    return;
  }
  const base = [...panel.querySelectorAll<HTMLImageElement>("img.t:not(.hi)")];
  if (!base.length || base.every((im) => im.complete && im.naturalWidth > 0)) {
    panel.classList.remove("loading");
  }
}

function blank(img: HTMLImageElement) {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data;
    let max = 0;
    for (let k = 0; k < d.length; k++) if (k % 4 !== 3 && d[k] > max) max = d[k];
    if (max < 12) img.classList.add("blank");
  } catch {
    return;
  }
}

function setMode(fig: HTMLElement, mode: string) {
  fig.dataset.mode = mode;
  fig.querySelectorAll<HTMLButtonElement>("[data-cmp-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cmpMode === mode)));
}

function setWipe(fig: HTMLElement, input: HTMLInputElement) {
  fig.style.setProperty("--wipe", `${input.value}%`);
  input.setAttribute("aria-valuetext", `Divider at ${input.value}%: Earth on the left, the other world on the right`);
}

let installed = false;

function install() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "error",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLImageElement)) return;
      const p = t.closest<HTMLElement>(".cmp-p");
      if (!p) return;
      if (t.classList.contains("hi")) return t.remove();
      p.classList.add("fb");
      drawFallback(p);
    },
    true,
  );
  document.addEventListener(
    "load",
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLImageElement)) return;
      const p = t.closest<HTMLElement>(".cmp-p");
      if (!p) return;
      if (t.classList.contains("hi")) blank(t);
      else if (t.classList.contains("t")) checkLoaded(p);
    },
    true,
  );
  document.addEventListener("click", (e) => {
    const target = e.target as Element | null;
    const b = target?.closest?.<HTMLButtonElement>("[data-cmp-mode]");
    if (b) {
      const fig = b.closest<HTMLElement>(".cmp");
      if (fig) setMode(fig, b.dataset.cmpMode ?? "split");
      return;
    }
    const ov = target?.closest?.<HTMLButtonElement>(".cmp-ov");
    if (ov) {
      const fig = ov.closest<HTMLElement>(".cmp");
      if (fig) {
        const clean = fig.classList.toggle("cmp-clean");
        ov.setAttribute("aria-pressed", String(!clean));
      }
    }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.classList.contains("cmp-range")) return;
    const fig = t.closest<HTMLElement>(".cmp");
    if (fig) setWipe(fig, t);
  });
}

install();

const WAIT_MS = 10000;

function giveUp(p: HTMLElement) {
  if (!p.isConnected || p.classList.contains("fb")) return;
  const slow = [...p.querySelectorAll<HTMLImageElement>("img.t")].filter((im) => !im.complete);
  for (const im of slow) if (im.classList.contains("hi")) im.remove();
  if (!slow.some((im) => !im.classList.contains("hi"))) return;
  p.classList.add("fb");
  drawFallback(p);
}

export function wireCompare(el: HTMLElement): () => void {
  install();
  const cleanups: (() => void)[] = [];
  el.querySelectorAll<HTMLElement>(".cmp-seg").forEach((seg) => cleanups.push(bindSegmented(seg)));
  const timers: number[] = [];
  const seen = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      timers.push(window.setTimeout(() => giveUp(e.target as HTMLElement), WAIT_MS));
    }
  });
  el.querySelectorAll<HTMLElement>(".cmp-p").forEach((p) => {
    seen.observe(p);
    if (p.classList.contains("fb")) drawFallback(p);
    p.querySelectorAll<HTMLImageElement>("img.t").forEach((im) => {
      if (!im.complete) return;
      if (im.naturalWidth === 0) {
        if (im.classList.contains("hi")) im.remove();
        else {
          p.classList.add("fb");
          drawFallback(p);
        }
      } else if (im.classList.contains("hi")) blank(im);
    });
    checkLoaded(p);
  });
  return () => {
    seen.disconnect();
    for (const id of timers) clearTimeout(id);
    for (const fn of cleanups) fn();
  };
}

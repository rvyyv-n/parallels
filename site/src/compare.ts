import "./compare.css";
import type { Body, Target } from "./contract";
import { bindSegmented } from "./controls";
import { esc, latlon, num, targetName } from "./format";
import { icon } from "./icons";

export type ScaleKm = 70 | 140;
export type EarthLayer = "relief" | "satellite";

const VIEW_KM: ScaleKm = 70;
const BAR_KM: Record<ScaleKm, number> = { 70: 25, 140: 50 };
const TARGET_WIN_KM = 10;
const RADIUS: Record<Body | "earth", number> = { earth: 6371, moon: 1737.4, mars: 3389.5 };
const D = Math.PI / 180;
const BASE = import.meta.env.BASE_URL;
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const BM = `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8`;
const ASTER = `${GIBS}/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12`;
const S2 = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g";
const TREK = "https://trek.nasa.gov/tiles";
const LOLA = `${TREK}/Moon/SP/LRO_LOLA_Shade_SPole875_5mp_v04/1.0.0/default/default028mm`;
const WAC = `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm`;
const VIKING = `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm`;
const SP_ORIGIN = 1095930;
const SP_RES0 = (2 * SP_ORIGIN) / 256;
const SP_EDGE_KM = 75.84;
const ASTER_MAX_LAT = 83;
const FALLBACK = { earth: `${BASE}img/blue-marble.jpg`, moon: `${BASE}img/moon.jpg`, mars: `${BASE}img/mars.jpg` };
const FALLBACK_PX = { earth: 1024, moon: 2048, mars: 2048 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pc = (v: number) => `${v.toFixed(3)}%`;
const metres = (km: number) => (km >= 1 ? `${num(km, km < 10 ? 1 : 0)} km` : `${num(Math.round((km * 1000) / 5) * 5)} m`);

interface RegionMark {
  name: string;
  lat: number;
  lon: number;
}

interface View {
  tiles: string;
  kmPerPx: number;
  marks: string;
}

interface EarthView extends View {
  lowKm: number;
  high: boolean;
  layer: EarthLayer;
}

function want() {
  if (typeof window === "undefined") return 640;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  return (window.innerWidth >= 700 ? 560 : 300) * dpr;
}

function tile(src: string, l: number, t: number, w: number, h: number, cls: string, onerror: string, attrs = "") {
  return `<img class="${cls}" src="${src}" alt="" loading="lazy" decoding="async"${cls.includes("hi") ? ' crossorigin="anonymous"' : ""}${attrs} style="left:${pc(l)};top:${pc(t)};width:${pc(w)};height:${pc(h)}" onerror="${onerror}">`;
}

function merc(lat: number, lon: number, n: number) {
  return [((lon + 180) / 360) * n * 256, ((1 - Math.asinh(Math.tan(lat * D)) / Math.PI) / 2) * n * 256];
}

function tileLat(ty: number, n: number) {
  return Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) / D;
}

function mercTiles(
  lat: number,
  lon: number,
  viewKm: ScaleKm,
  z: number,
  url: string,
  ext: "jpeg" | "jpg",
  cls: string,
  onerror: string,
  opts?: { layer?: EarthLayer; maxLat?: number },
) {
  const n = 2 ** z;
  const kmPerPx = (2 * Math.PI * RADIUS.earth * Math.cos(lat * D)) / (256 * n);
  const span = viewKm / kmPerPx;
  const [cx, cy] = merc(lat, lon, n);
  const x0 = cx - span / 2;
  const y0 = cy - span / 2;
  const out: string[] = [];
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + span) / 256); ty++)
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + span) / 256); tx++) {
      if (ty < 0 || ty >= n) continue;
      let attrs = opts?.layer ? ` data-layer="${opts.layer}"` : "";
      if (opts?.maxLat != null) {
        const north = tileLat(ty, n);
        const south = tileLat(ty + 1, n);
        // ASTER GDEM stops at ±83°; skip wholly out-of-range tiles so Blue Marble shows seamlessly underneath.
        if (north < -opts.maxLat || south > opts.maxLat) continue;
        if (north > opts.maxLat - 0.6 || south < -(opts.maxLat - 0.6)) attrs += ' data-polar-edge="1"';
      }
      const wx = ((tx % n) + n) % n;
      out.push(
        tile(
          `${url}/${z}/${ty}/${wx}.${ext}`,
          ((tx * 256 - x0) / span) * 100,
          ((ty * 256 - y0) / span) * 100,
          (256 / span) * 100,
          (256 / span) * 100,
          cls,
          onerror,
          attrs,
        ),
      );
    }
  return { html: out.join(""), count: out.length, kmPerPx, x0, y0, span, n };
}

function earthView(lat: number, lon: number, viewKm: ScaleKm, layer: EarthLayer): EarthView | null {
  if (Math.abs(lat) > 84.3) return null;
  const circ = 2 * Math.PI * RADIUS.earth * Math.cos(lat * D);
  const maxZ = layer === "relief" ? 12 : 13;
  const z = clamp(Math.round(Math.log2((want() * circ) / (256 * viewKm))), 3, maxZ);
  const bz = Math.min(z, 8);
  const err = "this.closest('.eimg').classList.add('fb')";
  const low = mercTiles(lat, lon, viewKm, bz, BM, "jpeg", "t lo", err);
  const high =
    layer === "relief"
      ? mercTiles(lat, lon, viewKm, z, ASTER, "jpeg", "t hi", "this.remove()", { layer: "relief", maxLat: ASTER_MAX_LAT })
      : mercTiles(lat, lon, viewKm, z, S2, "jpg", "t hi", "this.remove()", { layer: "satellite" });
  const hasHigh = high.count > 0;
  const ref = hasHigh ? high : low;
  const [ax, ay] = merc(lat + 0.25, lon - 0.25, ref.n);
  const [bx, by] = merc(lat - 0.25, lon + 0.25, ref.n);
  const box = `<i class="cmp-cell" style="left:${pc(((ax - ref.x0) / ref.span) * 100)};top:${pc(((ay - ref.y0) / ref.span) * 100)};width:${pc(((bx - ax) / ref.span) * 100)};height:${pc(((by - ay) / ref.span) * 100)}"></i>`;
  return {
    tiles: low.html + (hasHigh ? high.html : ""),
    kmPerPx: ref.kmPerPx,
    lowKm: low.kmPerPx,
    high: hasHigh,
    layer,
    marks: box,
  };
}

function spXY(lat: number, lon: number) {
  const rho = 2 * RADIUS.moon * Math.tan(((90 + lat) * D) / 2);
  return [rho * Math.sin(lon * D), rho * Math.cos(lon * D)];
}

function isPolarTarget(body: Body, lat: number, viewKm: ScaleKm): boolean {
  return body === "moon" && lat <= -90 + (SP_EDGE_KM - viewKm / 2) / ((Math.PI * RADIUS.moon) / 180);
}

function defaultEarthLayer(body: Body, target: Pick<Target, "lat">): EarthLayer {
  return isPolarTarget(body, target.lat, VIEW_KM) ? "relief" : "satellite";
}

function targetWindowMark(viewKm: ScaleKm): string {
  const pct = (TARGET_WIN_KM / viewKm) * 100;
  return `<i class="cmp-win" style="left:${pc(50 - pct / 2)};top:${pc(50 - pct / 2)};width:${pc(pct)};height:${pc(pct)}"></i>`;
}

function polarView(tLat: number, tLon: number, regions: RegionMark[], viewKm: ScaleKm): View {
  const z = clamp(Math.round(Math.log2((want() * SP_RES0) / (viewKm * 1000))), 0, 9);
  const res = SP_RES0 / 2 ** z;
  const span = (viewKm * 1000) / res;
  const [cx, cy] = spXY(tLat, tLon);
  const px0 = (cx * 1000 + SP_ORIGIN) / res - span / 2;
  const py0 = (SP_ORIGIN - cy * 1000) / res - span / 2;
  const out: string[] = [];
  const err = "this.closest('.cmp-p').classList.add('fb')";
  for (let ty = Math.floor(py0 / 256); ty <= Math.floor((py0 + span) / 256); ty++)
    for (let tx = Math.floor(px0 / 256); tx <= Math.floor((px0 + span) / 256); tx++) {
      if (ty < 0 || ty >= 2 ** z || tx < 0 || tx >= 2 ** (z + 1)) continue;
      out.push(
        tile(
          `${LOLA}/${z}/${ty}/${tx}.png`,
          ((tx * 256 - px0) / span) * 100,
          ((ty * 256 - py0) / span) * 100,
          (256 / span) * 100,
          (256 / span) * 100,
          "t",
          err,
        ),
      );
    }
  const regionMarks = regions
    .map((r) => {
      const [x, y] = spXY(r.lat, r.lon);
      const u = ((x - cx) / viewKm + 0.5) * 100;
      const v = (0.5 - (y - cy) / viewKm) * 100;
      // Keep lunar landmark labels comfortably inside the square frame so names never slice off the border.
      if (u < 10 || u > 90 || v < 10 || v > 90) return "";
      return `<span class="cmp-mark${u > 55 ? " left" : ""}" style="left:${pc(u)};top:${pc(v)}"><b></b>${esc(r.name)}</span>`;
    })
    .join("");
  const win = regions.length ? "" : targetWindowMark(viewKm);
  return { tiles: out.join(""), kmPerPx: res / 1000, marks: `${win}<i class="cmp-x" style="left:50%;top:50%"></i>${regionMarks}` };
}

function eqView(body: Body, lat: number, lon: number, url: string, maxZ: number, viewKm: ScaleKm): View {
  const k = (Math.PI * RADIUS[body]) / 180;
  const z = clamp(Math.round(Math.log2((want() * 180 * k) / (256 * viewKm))), 0, maxZ);
  const d = 180 / (256 * 2 ** z);
  const spanLat = viewKm / k / d;
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
      out.push(
        tile(
          `${url}/${z}/${ty}/${wx}.jpg`,
          ((tx * 256 - px0) / spanLon) * 100,
          ((ty * 256 - py0) / spanLat) * 100,
          (256 / spanLon) * 100,
          (256 / spanLat) * 100,
          "t",
          err,
        ),
      );
    }
  return { tiles: out.join(""), kmPerPx: d * k, marks: `${targetWindowMark(viewKm)}<i class="cmp-x" style="left:50%;top:50%"></i>` };
}

function targetView(body: Body, tLat: number, tLon: number, regions: RegionMark[], viewKm: ScaleKm): { polar: boolean; view: View } {
  const polar = isPolarTarget(body, tLat, viewKm);
  const view = polar
    ? polarView(tLat, tLon, regions, viewKm)
    : body === "moon"
      ? eqView("moon", tLat, tLon, WAC, 8, viewKm)
      : eqView("mars", tLat, tLon, VIKING, 7, viewKm);
  return { polar, view };
}

function earthCredit(e: EarthView | null): string {
  if (!e) return "No live tiles above 85°";
  if (e.layer === "relief") return e.high ? "NASA ASTER GDEM relief" : "NASA Blue Marble relief";
  return "ESA Copernicus Sentinel-2 (EOX)";
}

function targetCredit(body: Body, polar: boolean): string {
  if (polar) return "NASA LRO LOLA relief";
  return body === "moon" ? "NASA LRO WAC mosaic" : "NASA/USGS Viking MDIM 2.1";
}

function earthAbout(e: EarthView | null): string {
  if (!e) return "Mercator map tiles stop at 85° latitude, so there is no live image this near the pole.";
  if (e.layer === "relief") {
    return e.high
      ? `NASA ASTER GDEM Greyscale Shaded Relief (30 m source, via NASA GIBS), at approximately ${metres(e.kmPerPx)} for each pixel. Like Moon Trek's LOLA view, this is shaded relief from elevation data rather than a photo, so terrain form compares directly. Where ASTER has no coverage (beyond 83° latitude), NASA Blue Marble: Shaded Relief and Bathymetry shows (approximately ${metres(e.lowKm)} for each pixel). The square shows this 0.5° cell (~50 km).`
      : `NASA Blue Marble: Shaded Relief and Bathymetry (via NASA GIBS), at approximately ${metres(e.kmPerPx)} for each pixel, because ASTER GDEM stops at 83° latitude. The square shows this 0.5° cell (~50 km).`;
  }
  return `ESA Copernicus Sentinel-2 Cloudless 2024 (10 m source, via EOX, CC BY 4.0), at approximately ${metres(e.kmPerPx)} for each pixel. Where Sentinel-2 has no coverage (high Antarctic latitudes), NASA Blue Marble: Shaded Relief and Bathymetry shows (approximately ${metres(e.lowKm)} for each pixel). The square shows this 0.5° cell (~50 km).`;
}

function targetAbout(body: Body, polar: boolean, hasRegions: boolean, kmPerPx: number): string {
  if (polar) {
    return `LRO LOLA shaded relief of the south pole (87.5° S to the pole), NASA Moon Trek, at approximately ${metres(kmPerPx)} for each pixel. This is not a photo. It comes from laser altimetry and shows the shape of the ground with light from a computer sun. ${
      hasRegions ? "The dots show the Artemis III regions. The cross shows the pole." : "The cross and 10 km box show the target sampling window."
    }`;
  }
  if (body === "moon") {
    return `LRO WAC global mosaic, NASA Moon Trek, at approximately ${metres(kmPerPx)} for each pixel. The cross and 10 km box show the target sampling window.`;
  }
  return `Viking MDIM 2.1 colour mosaic (NASA/USGS), NASA Mars Trek, at approximately ${metres(kmPerPx)} for each pixel from north to south. The cross and 10 km box show the target sampling window.`;
}

function fbNote(body: Body | "earth") {
  const km = ((360 / FALLBACK_PX[body]) * Math.PI * RADIUS[body]) / 180;
  return `<span class="fb-note">Live tiles did not load: low-resolution copy, about ${num(km, 0)} km per pixel, same scale.</span>`;
}

function earthAria(place: string, viewKm: ScaleKm, layer: EarthLayer): string {
  return `Earth around ${place} (${layer === "relief" ? "shaded relief" : "satellite"}), ${viewKm} km across, with the 0.5 degree cell outlined`;
}

function targetAria(bodyName: string, targetName: string, viewKm: ScaleKm): string {
  return `${bodyName} at ${targetName}, ${viewKm} km across`;
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
  const viewKm: ScaleKm = VIEW_KM;
  const barKm = BAR_KM[viewKm];
  const layer = defaultEarthLayer(x.body, x.target);
  const regions: RegionMark[] = (x.target.regions ?? []).map((r) => ({ name: r.name, lat: r.lat, lon: r.lon }));
  const e = earthView(x.lat, x.lon, viewKm, layer);
  const { polar, view: tv } = targetView(x.body, x.target.lat, x.target.lon, regions, viewKm);
  const frac = (barKm / viewKm) * 100;
  const earthPanel = e
    ? `<div class="cmp-p eimg loading" data-body="earth" data-lat="${x.lat}" data-lon="${x.lon}" data-km="${viewKm}" data-layer="${layer}" role="img" aria-label="${esc(earthAria(x.place, viewKm, layer))}">
        <div class="cmp-tiles">${e.tiles}</div><canvas class="cmp-fb" width="256" height="256"></canvas>${e.marks}<span class="cmp-tag">Earth <span class="cmp-tag-m">${layer === "relief" ? "Relief" : "Satellite"}</span></span></div>`
    : `<div class="cmp-p eimg none" role="img" aria-label="No Earth image this near the pole"><p>There is no live map image this near the pole.</p><span class="cmp-tag">Earth</span></div>`;
  const tDisplay = targetName(x.target.name);
  const targetPanel = `<div class="cmp-p timg loading" data-body="${x.body}" data-proj="${polar ? "sp" : "eq"}" data-lat="${x.target.lat}" data-lon="${x.target.lon}" data-km="${viewKm}" role="img" aria-label="${esc(targetAria(bodyName, tDisplay, viewKm))}">
      <div class="cmp-tiles">${tv.tiles}</div><canvas class="cmp-fb" width="256" height="256"></canvas>${tv.marks}<span class="cmp-tag">${esc(bodyName)}</span></div>`;
  const regionsAttr = regions.length ? ` data-regions="${esc(JSON.stringify(regions))}"` : "";
  const noEarth = !e ? ' disabled title="No live Earth tiles this near the pole"' : "";
  return `<figure class="cmp" data-mode="split" data-layer="${layer}" data-km="${viewKm}" data-body="${x.body}" data-lat="${x.lat}" data-lon="${x.lon}" data-place="${esc(x.place)}" data-tname="${esc(tDisplay)}" data-tlat="${x.target.lat}" data-tlon="${x.target.lon}"${regionsAttr} style="--wipe:50%;--bar:${frac.toFixed(3)}%">
    <div class="cmp-bar">
      <div class="cmp-seg" data-cmp-seg="mode" role="group" aria-label="How to compare the two images">
        <button type="button" class="cmp-btn" data-cmp-mode="split" aria-pressed="true">${icon("split")}Side by side</button>
        <button type="button" class="cmp-btn" data-cmp-mode="wipe" aria-pressed="false">${icon("wipe")}Wipe</button>
      </div>
      <div class="cmp-seg" data-cmp-seg="layer" role="group" aria-label="Earth imagery layer">
        <button type="button" class="cmp-btn" data-cmp-layer="relief" aria-pressed="${layer === "relief"}"${noEarth}>Relief</button>
        <button type="button" class="cmp-btn" data-cmp-layer="satellite" aria-pressed="${layer === "satellite"}"${noEarth}>Satellite</button>
      </div>
      <div class="cmp-seg" data-cmp-seg="km" role="group" aria-label="Ground width">
        <button type="button" class="cmp-btn" data-cmp-km="70" aria-pressed="true">70 km</button>
        <button type="button" class="cmp-btn" data-cmp-km="140" aria-pressed="false">140 km</button>
      </div>
      <button type="button" class="cmp-ov" aria-pressed="true" title="Show or hide cell box and markers"><span class="cmp-ov-dot" aria-hidden="true"></span>Overlays</button>
    </div>
    <div class="cmp-stage">
      ${earthPanel}
      ${targetPanel}
      <span class="cmp-knob" aria-hidden="true"><span class="cmp-puck"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 6 3.5 10l4 4"/><path d="m12.5 6 4 4-4 4"/></svg></span></span>
      <input class="cmp-range" type="range" min="0" max="100" value="50" step="1" aria-label="Wipe divider: Earth on the left, ${esc(bodyName)} on the right" aria-valuetext="Divider at 50%">
    </div>
    <div class="cmp-foot">
      <div class="cmp-scale"><span class="cmp-sb" aria-hidden="true"><i></i></span><span class="cmp-scale-txt"><b>${barKm} km</b> · ${viewKm} km wide, same ground scale</span></div>
      <figcaption class="cmp-caps">
        <p class="eimg-cap"><b>Earth</b> <span>${esc(x.place)}</span> <span class="cmp-ll">${latlon(x.lat, x.lon)}</span><span class="cmp-src">${esc(earthCredit(e))}</span>${e ? fbNote("earth") : ""}</p>
        <p class="timg-cap"><b>${esc(bodyName)}</b> <span>${esc(tDisplay)}</span> <span class="cmp-ll">${latlon(x.target.lat, x.target.lon)}</span><span class="cmp-src">${esc(targetCredit(x.body, polar))}</span>${fbNote(x.body)}</p>
      </figcaption>
      <details class="cmp-about"><summary>About these images</summary>
        <p class="cmp-about-earth"><b>Earth:</b> ${earthAbout(e)}</p>
        <p class="cmp-about-target"><b>${esc(bodyName)}:</b> ${targetAbout(x.body, polar, regions.length > 0, tv.kmPerPx)}</p>
        <p>We calculate both scales from the radius of each body (Earth ${num(RADIUS.earth)} km, ${esc(bodyName)} ${num(RADIUS[x.body], 1)} km) and from the map projection at the centre.</p>
      </details>
    </div>
  </figure>`;
}

const cache = new Map<string, Promise<ImageData>>();
const panelTimers = new WeakMap<HTMLElement, number>();

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
  const viewKm = Number(panel.dataset.km) || VIEW_KM;
  const proj = panel.dataset.proj ?? "";
  const drawKey = `${viewKm}:${proj}`;
  if (panel.dataset.fbKey === drawKey) {
    panel.dataset.fbReady = "1";
    panel.classList.remove("loading");
    return;
  }
  if (panel.dataset.drawnKey === drawKey) return;
  panel.dataset.drawnKey = drawKey;
  const body = (panel.dataset.body ?? "earth") as Body | "earth";
  const cv = panel.querySelector<HTMLCanvasElement>("canvas.cmp-fb");
  if (!cv) return;
  const lat0 = Number(panel.dataset.lat);
  const lon0 = Number(panel.dataset.lon);
  const R = RADIUS[body];
  const sp = proj === "sp";
  const [cx, cy] = sp ? spXY(lat0, lon0) : [0, 0];
  pixels(FALLBACK[body])
    .then((img) => {
      if (panel.dataset.drawnKey !== drawKey) return;
      const g = cv.getContext("2d")!;
      const S = cv.width;
      const out = g.createImageData(S, S);
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const u = ((i + 0.5) / S - 0.5) * viewKm;
          const v = (0.5 - (j + 0.5) / S) * viewKm;
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
      panel.dataset.fbKey = drawKey;
      panel.dataset.fbReady = "1";
      panel.classList.remove("loading");
    })
    .catch(() => {
      if (panel.dataset.drawnKey !== drawKey) return;
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
    let minRgb = 255;
    let maxRgb = 0;
    let maxA = 0;
    for (let k = 0; k < d.length; k += 4) {
      const a = d[k + 3];
      if (a > maxA) maxA = a;
      if (a < 12) continue;
      for (let ch = 0; ch < 3; ch++) {
        const v = d[k + ch];
        if (v < minRgb) minRgb = v;
        if (v > maxRgb) maxRgb = v;
      }
    }
    const layer = img.dataset.layer;
    // Hide transparent or black nodata tiles (Sentinel-2 over Antarctica), pure-white Sentinel-2 fill,
    // and ASTER's uniform grey (RGB 88) polar edge nodata so NASA Blue Marble shows seamlessly underneath.
    const emptyAlpha = maxA < 12;
    const solidBlack = maxRgb < 12;
    const solidWhite = layer === "satellite" && (minRgb >= 250 || (maxRgb - minRgb <= 4 && minRgb >= 246));
    const asterPolarNodata = layer === "relief" && img.dataset.polarEdge === "1" && maxRgb - minRgb <= 3 && minRgb >= 82 && maxRgb <= 94;
    if (emptyAlpha || solidBlack || solidWhite || asterPolarNodata) img.classList.add("blank");
  } catch {
    return;
  }
}

const WAIT_MS = 10000;

function clearPanelTimer(p: HTMLElement) {
  const prev = panelTimers.get(p);
  if (prev != null) {
    clearTimeout(prev);
    panelTimers.delete(p);
  }
}

function giveUp(p: HTMLElement) {
  panelTimers.delete(p);
  if (!p.isConnected || p.classList.contains("fb")) return;
  const slow = [...p.querySelectorAll<HTMLImageElement>("img.t")].filter((im) => !im.complete);
  for (const im of slow) if (im.classList.contains("hi")) im.remove();
  if (!slow.some((im) => !im.classList.contains("hi"))) return;
  p.classList.add("fb");
  drawFallback(p);
}

function scheduleGiveUp(p: HTMLElement) {
  clearPanelTimer(p);
  panelTimers.set(p, window.setTimeout(() => giveUp(p), WAIT_MS));
}

function inspectPanel(p: HTMLElement, armTimer: boolean) {
  if (p.classList.contains("none")) return;
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
  if (armTimer) scheduleGiveUp(p);
}

function parseRegions(fig: HTMLElement): RegionMark[] {
  const raw = fig.dataset.regions;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function currentScale(fig: HTMLElement): ScaleKm {
  return Number(fig.dataset.km) === 140 ? 140 : 70;
}

function currentLayer(fig: HTMLElement): EarthLayer {
  return fig.dataset.layer === "relief" ? "relief" : "satellite";
}

function updateEarth(fig: HTMLElement, viewKm: ScaleKm, layer: EarthLayer) {
  const panel = fig.querySelector<HTMLElement>(".cmp-p.eimg");
  if (!panel || panel.classList.contains("none")) return;
  const lat = Number(fig.dataset.lat);
  const lon = Number(fig.dataset.lon);
  const place = fig.dataset.place ?? "";
  const e = earthView(lat, lon, viewKm, layer);
  if (!e) return;

  panel.dataset.km = String(viewKm);
  panel.dataset.layer = layer;
  panel.setAttribute("aria-label", earthAria(place, viewKm, layer));
  panel.classList.remove("fb");
  delete panel.dataset.fbReady;
  panel.classList.add("loading");

  const tiles = panel.querySelector<HTMLElement>(".cmp-tiles");
  if (tiles) tiles.innerHTML = e.tiles;
  panel.querySelectorAll(".cmp-cell").forEach((el) => el.remove());
  const tag = panel.querySelector<HTMLElement>(".cmp-tag");
  if (tag) {
    tag.insertAdjacentHTML("beforebegin", e.marks);
    const sub = tag.querySelector<HTMLElement>(".cmp-tag-m");
    if (sub) sub.textContent = layer === "relief" ? "Relief" : "Satellite";
  }

  const capSrc = fig.querySelector<HTMLElement>(".eimg-cap .cmp-src");
  if (capSrc) capSrc.textContent = earthCredit(e);
  const about = fig.querySelector<HTMLElement>(".cmp-about-earth");
  if (about) about.innerHTML = `<b>Earth:</b> ${earthAbout(e)}`;

  inspectPanel(panel, true);
}

function updateTarget(fig: HTMLElement, viewKm: ScaleKm) {
  const panel = fig.querySelector<HTMLElement>(".cmp-p.timg");
  if (!panel) return;
  const body = (fig.dataset.body === "mars" ? "mars" : "moon") as Body;
  const bodyName = body === "moon" ? "Moon" : "Mars";
  const tName = fig.dataset.tname ?? "";
  const tLat = Number(fig.dataset.tlat);
  const tLon = Number(fig.dataset.tlon);
  const regions = parseRegions(fig);
  const { polar, view: tv } = targetView(body, tLat, tLon, regions, viewKm);

  panel.dataset.km = String(viewKm);
  panel.dataset.proj = polar ? "sp" : "eq";
  panel.setAttribute("aria-label", targetAria(bodyName, tName, viewKm));
  panel.classList.remove("fb");
  delete panel.dataset.fbReady;
  panel.classList.add("loading");

  const tiles = panel.querySelector<HTMLElement>(".cmp-tiles");
  if (tiles) tiles.innerHTML = tv.tiles;
  panel.querySelectorAll(".cmp-win, .cmp-x, .cmp-mark").forEach((el) => el.remove());
  const tag = panel.querySelector<HTMLElement>(".cmp-tag");
  if (tag) tag.insertAdjacentHTML("beforebegin", tv.marks);

  const capSrc = fig.querySelector<HTMLElement>(".timg-cap .cmp-src");
  if (capSrc) capSrc.textContent = targetCredit(body, polar);
  const about = fig.querySelector<HTMLElement>(".cmp-about-target");
  if (about) about.innerHTML = `<b>${esc(bodyName)}:</b> ${targetAbout(body, polar, regions.length > 0, tv.kmPerPx)}`;

  inspectPanel(panel, true);
}

function setMode(fig: HTMLElement, mode: string) {
  fig.dataset.mode = mode;
  fig.querySelectorAll<HTMLButtonElement>("[data-cmp-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cmpMode === mode)));
}

function setLayer(fig: HTMLElement, layer: EarthLayer) {
  if (currentLayer(fig) === layer) return;
  fig.dataset.layer = layer;
  fig.querySelectorAll<HTMLButtonElement>("[data-cmp-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cmpLayer === layer)));
  updateEarth(fig, currentScale(fig), layer);
}

function setScale(fig: HTMLElement, km: ScaleKm) {
  if (currentScale(fig) === km) return;
  fig.dataset.km = String(km);
  const barKm = BAR_KM[km];
  fig.style.setProperty("--bar", `${((barKm / km) * 100).toFixed(3)}%`);
  fig.querySelectorAll<HTMLButtonElement>("[data-cmp-km]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.cmpKm) === km)));
  const scaleTxt = fig.querySelector<HTMLElement>(".cmp-scale-txt");
  if (scaleTxt) scaleTxt.innerHTML = `<b>${barKm} km</b> · ${km} km wide, same ground scale`;
  updateEarth(fig, km, currentLayer(fig));
  updateTarget(fig, km);
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
    const modeBtn = target?.closest?.<HTMLButtonElement>("[data-cmp-mode]");
    if (modeBtn) {
      const fig = modeBtn.closest<HTMLElement>(".cmp");
      if (fig) setMode(fig, modeBtn.dataset.cmpMode ?? "split");
      return;
    }
    const layerBtn = target?.closest?.<HTMLButtonElement>("[data-cmp-layer]");
    if (layerBtn && !layerBtn.disabled) {
      const fig = layerBtn.closest<HTMLElement>(".cmp");
      const next = layerBtn.dataset.cmpLayer === "relief" ? "relief" : "satellite";
      if (fig) setLayer(fig, next);
      return;
    }
    const kmBtn = target?.closest?.<HTMLButtonElement>("[data-cmp-km]");
    if (kmBtn) {
      const fig = kmBtn.closest<HTMLElement>(".cmp");
      const next: ScaleKm = Number(kmBtn.dataset.cmpKm) === 140 ? 140 : 70;
      if (fig) setScale(fig, next);
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

export function wireCompare(el: HTMLElement): () => void {
  install();
  const cleanups: (() => void)[] = [];
  el.querySelectorAll<HTMLElement>(".cmp-seg").forEach((seg) => cleanups.push(bindSegmented(seg)));
  const panels = [...el.querySelectorAll<HTMLElement>(".cmp-p")];
  const seen = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      scheduleGiveUp(e.target as HTMLElement);
    }
  });
  for (const p of panels) {
    seen.observe(p);
    inspectPanel(p, false);
  }
  return () => {
    seen.disconnect();
    for (const p of panels) clearPanelTimer(p);
    for (const fn of cleanups) fn();
  };
}

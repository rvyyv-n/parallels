import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { LabelPoint } from "./contract";
import { LUT } from "./ramp";
import { esc, reduced } from "./format";

const GIBS =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const MAXLAT = 85.051129;
const W = 720;
const H = 1024;
// Gentle dimming over uncolored Earth when spotlighting top-share zones (rgba(7, 7, 9, 0.38)).
const DIM = 97;
const WORLD: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, MAXLAT],
  [180, MAXLAT],
  [180, -MAXLAT],
  [-180, -MAXLAT],
];

const GLOBE_SKY: maplibregl.SkySpecification = {
  "sky-color": "#131720",
  "horizon-color": "#2a3342",
  "sky-horizon-blend": 0.42,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.44, 4.5, 0.24, 7, 0.04],
};

export interface Grid {
  lat: Float32Array;
  lon: Float32Array;
  n: number;
}

export interface Earth {
  paint(score: Float32Array, mask: Uint8Array, focused: boolean, outline: number[]): void;
  select(i: number, fly: boolean): void;
  top(rows: Top[]): void;
  strength(v: number): void;
  labels(on: boolean): void;
  flat(on: boolean): void;
  hover(i: number | null): void;
  at(i: number): { x: number; y: number } | null;
  project(lat: number, lon: number): { x: number; y: number } | null;
  cellIndex(lat: number, lon: number): number;
  flyTo(lat: number, lon: number, opts?: { zoom?: number; onArrived?: () => void }): void;
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  back(): void;
  resize(): void;
}

export interface Top {
  i: number;
  name: string;
  score: string;
}

export interface Hooks {
  pick(i: number): void;
  analogPick(p: LabelPoint, cell: number, x: number, y: number): void;
  analogOver(p: LabelPoint | null, x: number, y: number): void;
  pin(i: number | null): void;
  over(i: number | null, x: number, y: number, pin: boolean): void;
  moved(): void;
  away(on: boolean): void;
  pointer(at: { lat: number; lon: number } | null): void;
  scale: HTMLElement;
}

export const cellAt = (lat: number, lon: number) => {
  const r = Math.floor((90 - lat) / 0.5);
  const c = Math.floor((lon + 180) / 0.5);
  return r >= 0 && r < 360 && c >= 0 && c < 720 ? r * 720 + c : -1;
};

function lookup(g: Grid) {
  const at = new Int32Array(360 * 720).fill(-1);
  for (let i = 0; i < g.n; i++) {
    const k = cellAt(g.lat[i], g.lon[i]);
    if (k >= 0) at[k] = i;
  }
  const rows = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    const m = Math.PI * (1 - (2 * (y + 0.5)) / H);
    const lat = (Math.atan(Math.sinh(m)) * 180) / Math.PI;
    rows[y] = Math.min(359, Math.floor((90 - lat) / 0.5));
  }
  const px = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px[y * W + x] = at[rows[y] * 720 + x];
  return { at, px };
}

function painter(far: HTMLCanvasElement, near: HTMLCanvasElement, px: Int32Array) {
  const gf = far.getContext("2d")!;
  const gn = near.getContext("2d")!;
  const imgF = gf.createImageData(W, H);
  const imgN = gn.createImageData(W, H);
  const d = imgF.data;
  const e = imgN.data;
  let shown = new Float32Array(0);
  let raf = 0;
  const draw = (s: Float32Array, keep: Uint8Array, focused: boolean) => {
    for (let p = 0; p < px.length; p++) {
      const i = px[p];
      const o = p * 4;
      if (i < 0 || (focused && !keep[i])) {
        d[o] = e[o] = 7;
        d[o + 1] = e[o + 1] = 7;
        d[o + 2] = e[o + 2] = 9;
        d[o + 3] = e[o + 3] = focused ? DIM : 0;
        continue;
      }
      const v = s[i];
      if (Number.isNaN(v)) {
        d[o] = e[o] = 120;
        d[o + 1] = e[o + 1] = 122;
        d[o + 2] = e[o + 2] = 126;
        d[o + 3] = e[o + 3] = keep[i] ? 70 : 30;
        continue;
      }
      const c = Math.max(0, Math.min(1, v));
      const l = Math.round(c * 255) * 3;
      if (focused) {
        // Blend a 12% warm solar-gold wash (#e5aa4c) inside focused spotlight cells.
        d[o] = e[o] = Math.round(LUT[l] * 0.88 + 229 * 0.12);
        d[o + 1] = e[o + 1] = Math.round(LUT[l + 1] * 0.88 + 170 * 0.12);
        d[o + 2] = e[o + 2] = Math.round(LUT[l + 2] * 0.88 + 76 * 0.12);
      } else {
        d[o] = e[o] = LUT[l];
        d[o + 1] = e[o + 1] = LUT[l + 1];
        d[o + 2] = e[o + 2] = LUT[l + 2];
      }
      d[o + 3] = keep[i] ? Math.round(255 * (0.34 + 0.6 * c)) : 15;
      e[o + 3] = keep[i] ? Math.round(255 * (0.14 + 0.75 * c * c)) : 15;
    }
    gf.putImageData(imgF, 0, 0);
    gn.putImageData(imgN, 0, 0);
  };
  return (score: Float32Array, keep: Uint8Array, focused: boolean, tick: () => void, done: () => void) => {
    cancelAnimationFrame(raf);
    const from = shown.length === score.length ? shown.slice() : score;
    const to = score;
    shown = new Float32Array(to);
    if (reduced() || from === to) {
      draw(to, keep, focused);
      tick();
      done();
      return;
    }
    const mix = new Float32Array(to.length);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 380);
      const k = 1 - Math.pow(1 - t, 3);
      for (let i = 0; i < to.length; i++) {
        const a = from[i];
        const b = to[i];
        mix[i] = Number.isNaN(a) || Number.isNaN(b) ? (t < 0.5 ? a : b) : a + (b - a) * k;
      }
      draw(mix, keep, focused);
      tick();
      if (t < 1) raf = requestAnimationFrame(step);
      else done();
    };
    raf = requestAnimationFrame(step);
  };
}

function square(lat: number, lon: number) {
  const a = lat - 0.25;
  const b = lat + 0.25;
  const l = lon - 0.25;
  const r = lon + 0.25;
  return { type: "Polygon" as const, coordinates: [[[l, a], [r, a], [r, b], [l, b], [l, a]]] };
}

function parallel(lat: number) {
  return { type: "LineString" as const, coordinates: Array.from({ length: 145 }, (_, i) => [-180 + i * 2.5, lat]) };
}

export function createEarth(el: HTMLElement, g: Grid, labels: LabelPoint[], on: Hooks): Earth {
  maplibregl.setWorkerUrl(workerUrl);
  const { at, px } = lookup(g);
  const sheet = (id: string) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.id = id;
    c.style.display = "none";
    document.body.append(c);
    return c;
  };
  const farCanvas = sheet("match-far-canvas");
  const nearCanvas = sheet("match-near-canvas");
  const paint = painter(farCanvas, nearCanvas, px);
  const pts = labels.filter((l) => l.kind === "known_analog" || l.kind === "cave");
  const phone = matchMedia("(max-width: 759px)").matches;
  const fit = () => {
    const b = el.getBoundingClientRect();
    const d = Math.min(b.width, b.height || b.width) * (phone ? 0.92 : 0.88);
    return Math.max(0, Math.min(3, Math.log2((d * Math.PI) / 512)));
  };

  const map = new maplibregl.Map({
    container: el,
    style: {
      version: 8,
      projection: { type: "globe" },
      sources: {
        fallback: { type: "image", url: `${import.meta.env.BASE_URL}img/blue-marble.jpg`, coordinates: WORLD },
        bm: {
          type: "raster",
          tiles: [GIBS],
          tileSize: 256,
          maxzoom: 8,
        },
        sel: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        zone: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        pts: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: pts.map((p, idx) => ({
              type: "Feature",
              properties: { idx, kind: p.kind, name: p.name },
              geometry: { type: "Point", coordinates: [p.lon, p.lat] },
            })),
          },
        },
      },
      layers: [
        { id: "space", type: "background", paint: { "background-color": "#070709", "background-opacity": 0 } },
        { id: "fallback", type: "raster", source: "fallback", paint: { "raster-saturation": -0.24, "raster-brightness-max": 0.84, "raster-fade-duration": 0 } },
        { id: "bm", type: "raster", source: "bm", paint: { "raster-saturation": -0.24, "raster-brightness-max": 0.84, "raster-contrast": 0.05 } },
        {
          id: "zone-glow",
          type: "line",
          source: "zone",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#e5aa4c", "line-width": 6, "line-blur": 5, "line-opacity": 0.55 },
        },
        {
          id: "zone-line",
          type: "line",
          source: "zone",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#f5ebc4", "line-width": 1.35, "line-opacity": 0.94 },
        },
        { id: "par", type: "line", source: "sel", filter: ["==", ["get", "k"], "par"], paint: { "line-color": "#e5aa4c", "line-width": 1, "line-dasharray": [2, 3], "line-opacity": 0.72 } },
        { id: "cell", type: "line", source: "sel", filter: ["==", ["get", "k"], "cell"], paint: { "line-color": "#e5aa4c", "line-width": 2.5 } },
        {
          id: "analogs",
          type: "circle",
          source: "pts",
          filter: ["==", ["get", "kind"], "known_analog"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 4.2, 5, 6.2],
            "circle-color": "rgba(229, 170, 76, 0.26)",
            "circle-stroke-color": "#f2f0eb",
            "circle-stroke-width": 1.6,
          },
        },
        {
          id: "caves",
          type: "circle",
          source: "pts",
          filter: ["==", ["get", "kind"], "cave"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 3.4, 5, 5.2],
            "circle-color": "#e5aa4c",
            "circle-stroke-color": "#070709",
            "circle-stroke-width": 1.3,
          },
        },
      ],
      sky: GLOBE_SKY,
    },
    center: [10, 15],
    zoom: fit(),
    minZoom: 0,
    maxZoom: 7.5,
    cooperativeGestures: phone,
    attributionControl: false,
    fadeDuration: 0,
  });

  const resetView = () => {
    const c: [number, number] = selected >= 0 ? [g.lon[selected], Math.max(-68, Math.min(68, g.lat[selected]))] : [10, 15];
    map.flyTo({ center: c, zoom: fit(), duration: reduced() ? 0 : 900, essential: false });
  };

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(
    {
      onAdd() {
        const box = document.createElement("div");
        box.className = "maplibregl-ctrl maplibregl-ctrl-group";
        box.innerHTML = `<button type="button" class="ctl-fit" title="Reset the view" aria-label="Reset the view"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg></button>`;
        box.firstElementChild!.addEventListener("click", resetView);
        return box;
      },
      onRemove() {},
    },
    "top-right",
  );
  on.scale.append(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }).onAdd(map));

  const LAYERS = ["match-far", "match-near"] as const;
  const srcs = () => LAYERS.map((id) => map.getSource(id) as maplibregl.CanvasSource | undefined);
  const fade = (id: (typeof LAYERS)[number], k: number): maplibregl.ExpressionSpecification =>
    id === "match-far" ? ["interpolate", ["linear"], ["zoom"], 2.5, k, 4.5, 0] : ["interpolate", ["linear"], ["zoom"], 2.5, 0, 4.5, k];
  const ready = new Promise<void>((r) => {
    const init = () => {
      for (const id of LAYERS) {
        if (!map.getSource(id)) {
          map.addSource(id, { type: "canvas", canvas: id === "match-far" ? farCanvas : nearCanvas, coordinates: WORLD, animate: false });
          map.addLayer({ id, type: "raster", source: id, paint: { "raster-resampling": "nearest", "raster-fade-duration": 0, "raster-opacity": fade(id, 1) } }, "zone-glow");
        }
      }
      r();
    };
    // Use style.load so pins and the match overlay mount immediately without blocking on remote GIBS tiles.
    if (map.isStyleLoaded()) init();
    else map.once("style.load", init);
  });

  let selected = -1;
  let centred = false;
  let labelsVisible = true;
  let mask: Uint8Array = new Uint8Array(0);
  const markers: maplibregl.Marker[] = [];
  const tags: maplibregl.Marker[] = [];

  const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
  const cellIndex = (lat: number, lon: number) => {
    const k = cellAt(lat, wrap(lon));
    return k >= 0 ? at[k] : -1;
  };
  const hit = (e: maplibregl.MapMouseEvent, anyLand = false) => {
    const i = cellIndex(e.lngLat.lat, e.lngLat.lng);
    if (i < 0) return -1;
    return anyLand || mask[i] ? i : -1;
  };
  const analogHit = (pt: maplibregl.Point): LabelPoint | null => {
    if (!labelsVisible || !map.getLayer("analogs")) return null;
    const pad = 7;
    const feats = map.queryRenderedFeatures(
      [
        [pt.x - pad, pt.y - pad],
        [pt.x + pad, pt.y + pad],
      ],
      { layers: ["analogs", "caves"] },
    );
    if (!feats.length) return null;
    const idx = Number(feats[0].properties?.idx);
    return Number.isInteger(idx) && pts[idx] ? pts[idx] : null;
  };

  const onPin = (e: maplibregl.MapMouseEvent) => !!(e.originalEvent.target as HTMLElement).closest?.(".pin, .pin-tag");
  map.on("click", (e) => {
    if (onPin(e)) return;
    const ap = analogHit(e.point);
    if (ap) {
      on.analogPick(ap, cellIndex(ap.lat, ap.lon), e.point.x, e.point.y);
      return;
    }
    // Click inspects any valid land cell even outside the highlighted top-share zone.
    on.pick(hit(e, true));
  });
  map.on("mousemove", (e) => {
    if (onPin(e)) return;
    on.pointer({ lat: e.lngLat.lat, lon: wrap(e.lngLat.lng) });
    const ap = analogHit(e.point);
    if (ap) {
      map.getCanvas().style.cursor = "pointer";
      on.over(null, 0, 0, false);
      on.analogOver(ap, e.point.x, e.point.y);
      return;
    }
    on.analogOver(null, 0, 0);
    const i = hit(e, false);
    map.getCanvas().style.cursor = i >= 0 ? "pointer" : "";
    on.over(i >= 0 ? i : null, e.point.x, e.point.y, false);
  });
  map.on("mouseout", () => {
    on.pointer(null);
    on.over(null, 0, 0, false);
    on.analogOver(null, 0, 0);
  });

  const facing = (lat: number, lon: number) => {
    if (map.getProjection()?.type === "mercator") return true;
    const c = map.getCenter();
    const r = Math.PI / 180;
    return Math.sin(lat * r) * Math.sin(c.lat * r) + Math.cos(lat * r) * Math.cos(c.lat * r) * Math.cos((lon - c.lng) * r) > 0.05;
  };
  const projectPoint = (lat: number, lon: number) => {
    if (!facing(lat, lon)) return null;
    const p = map.project([lon, lat]);
    const b = el.getBoundingClientRect();
    return p.x >= 0 && p.y >= 0 && p.x <= b.width && p.y <= b.height ? { x: p.x, y: p.y } : null;
  };

  const declutter = () => {
    const stage = el.getBoundingClientRect();
    if (stage.width <= 0 || stage.height <= 0) return;
    const pad = 4;
    type Box = { id: number; left: number; right: number; top: number; bottom: number };
    const obstacles: Box[] = [];
    for (const m of markers) {
      const mEl = m.getElement();
      const id = Number(mEl.dataset.i);
      const r = mEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && mEl.style.opacity !== "0" && facing(g.lat[id], g.lon[id])) {
        obstacles.push({ id, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      }
    }
    const hits = (cand: { left: number; right: number; top: number; bottom: number }, ownId: number) =>
      obstacles.some(
        (o) =>
          o.id !== ownId &&
          cand.left < o.right + pad &&
          cand.right > o.left - pad &&
          cand.top < o.bottom + pad &&
          cand.bottom > o.top - pad,
      );
    for (const tm of tags) {
      const t = tm.getElement();
      const i = Number(t.dataset.i);
      t.style.marginLeft = "";
      if (!facing(g.lat[i], g.lon[i]) || t.style.opacity === "0") {
        t.classList.add("is-dim");
        continue;
      }
      const b = t.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) {
        t.classList.add("is-dim");
        continue;
      }
      const rightBox = { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      if (rightBox.right <= stage.right - 6 && !hits(rightBox, i)) {
        t.classList.remove("is-dim");
        obstacles.push({ id: -1, ...rightBox });
        continue;
      }
      const leftOffset = -(b.width + 32);
      const leftBox = { left: b.left + leftOffset, right: b.right + leftOffset, top: b.top, bottom: b.bottom };
      if (leftBox.left >= stage.left + 6 && !hits(leftBox, i)) {
        t.style.marginLeft = `${Math.round(leftOffset)}px`;
        t.classList.remove("is-dim");
        obstacles.push({ id: -1, ...leftBox });
        continue;
      }
      t.classList.add("is-dim");
    }
  };
  map.on("move", () => on.moved());
  map.on("moveend", declutter);
  map.on("resize", declutter);
  map.on("idle", declutter);

  const visible = () => {
    if (selected < 0) return true;
    const ll = new maplibregl.LngLat(g.lon[selected], g.lat[selected]);
    const c = map.getCenter();
    const r = Math.PI / 180;
    const dot = Math.sin(ll.lat * r) * Math.sin(c.lat * r) + Math.cos(ll.lat * r) * Math.cos(c.lat * r) * Math.cos((ll.lng - c.lng) * r);
    if (map.getProjection()?.type !== "mercator" && dot < 0.15) return false;
    const p = map.project(ll);
    const b = el.getBoundingClientRect();
    return p.x >= 0 && p.y >= 0 && p.x <= b.width && p.y <= b.height;
  };
  let away = false;
  const check = () => {
    const now = !visible();
    if (now !== away) on.away((away = now));
  };
  map.on("moveend", check);
  map.on("resize", check);
  map.on("move", () => {
    if (away && visible()) on.away((away = false));
  });

  const goTo = (i: number, animate: boolean) => {
    const z = Math.max(map.getZoom(), fit());
    const center: [number, number] = [g.lon[i], Math.max(-68, Math.min(68, g.lat[i]))];
    if (!animate || reduced()) {
      map.jumpTo({ center, zoom: z });
      check();
      declutter();
    } else map.flyTo({ center, zoom: z, duration: 1100, essential: false });
    map.once("idle", declutter);
  };

  let flyToken = 0;

  return {
    paint(score, keep, focused, outline) {
      mask = keep;
      const lines: number[][][] = [];
      for (let j = 0; j < outline.length; j += 4) lines.push([[outline[j], outline[j + 1]], [outline[j + 2], outline[j + 3]]]);
      ready.then(() => {
        (map.getSource("zone") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: lines.length ? [{ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: lines } }] : [],
        });
        paint(
          score,
          keep,
          focused,
          () => {
            for (const c of srcs()) c?.play();
          },
          () =>
            requestAnimationFrame(() => {
              for (const c of srcs()) c?.pause();
            }),
        );
      });
    },
    select(i, fly) {
      selected = i;
      const lat = g.lat[i];
      const lon = g.lon[i];
      ready.then(() => {
        (map.getSource("sel") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: { k: "par" }, geometry: parallel(lat) },
            { type: "Feature", properties: { k: "cell" }, geometry: square(lat, lon) },
          ],
        });
        for (const m of markers) m.getElement().classList.toggle("sel", Number(m.getElement().dataset.i) === i);
        if (!centred) {
          centred = true;
          goTo(i, false);
          return;
        }
        if (fly) goTo(i, true);
        else check();
      });
    },
    top(rows) {
      ready.then(() => {
        for (const m of markers.splice(0)) m.remove();
        for (const t of tags.splice(0)) t.remove();
        rows.forEach(({ i }, r) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = r >= 10 ? "pin pin-minor" : "pin";
          b.tabIndex = -1;
          b.dataset.i = String(i);
          b.style.setProperty("--z", String(21 - r));
          b.textContent = String(r + 1);
          b.setAttribute("aria-hidden", "true");
          b.classList.toggle("sel", i === selected);
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            on.pick(i);
          });
          b.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
          b.addEventListener("mouseenter", () => {
            on.pin(i);
            on.analogOver(null, 0, 0);
            const p = map.project([g.lon[i], g.lat[i]]);
            on.over(i, p.x, p.y, true);
          });
          b.addEventListener("mouseleave", () => {
            on.pin(null);
            on.over(null, 0, 0, true);
          });
          markers.push(new maplibregl.Marker({ element: b, opacityWhenCovered: "0" }).setLngLat([g.lon[i], g.lat[i]]).addTo(map));
        });
        rows.slice(0, 3).forEach(({ i, name, score }) => {
          const t = document.createElement("span");
          t.className = "pin-tag";
          t.dataset.i = String(i);
          t.setAttribute("aria-hidden", "true");
          t.innerHTML = `${esc(name)} <b>${esc(score)}</b>`;
          tags.push(
            new maplibregl.Marker({ element: t, anchor: "left", offset: [16, 0], opacityWhenCovered: "0" }).setLngLat([g.lon[i], g.lat[i]]).addTo(map),
          );
        });
        declutter();
        requestAnimationFrame(declutter);
        map.once("render", declutter);
        map.once("idle", declutter);
      });
    },
    strength(v) {
      const k = Math.max(0, Math.min(1, v));
      ready.then(() => {
        for (const id of LAYERS) map.setPaintProperty(id, "raster-opacity", fade(id, k));
      });
    },
    labels(onFlag) {
      labelsVisible = onFlag;
      ready.then(() => {
        for (const id of ["analogs", "caves"]) map.setLayoutProperty(id, "visibility", onFlag ? "visible" : "none");
      });
    },
    flat(onFlag) {
      ready.then(() => {
        map.setProjection({ type: onFlag ? "mercator" : "globe" });
        map.setPaintProperty("space", "background-opacity", onFlag ? 1 : 0);
        map.setSky(onFlag ? { "atmosphere-blend": 0 } : GLOBE_SKY);
        map.once("idle", () => {
          check();
          declutter();
        });
      });
    },
    hover(i) {
      for (const m of markers) m.getElement().classList.toggle("hot", i != null && Number(m.getElement().dataset.i) === i);
    },
    at(i) {
      return projectPoint(g.lat[i], g.lon[i]);
    },
    project: projectPoint,
    cellIndex,
    flyTo(lat, lon, opts) {
      const mine = ++flyToken;
      ready.then(() => {
        if (mine !== flyToken) return;
        const clampedLat = Math.max(-76, Math.min(76, lat));
        const z = Math.max(map.getZoom(), opts?.zoom ?? Math.max(fit(), 2.6));
        const center: [number, number] = [wrap(lon), clampedLat];
        if (reduced()) {
          map.jumpTo({ center, zoom: z });
          check();
          declutter();
          opts?.onArrived?.();
          return;
        }
        let settled = false;
        const done = () => {
          if (settled || mine !== flyToken) return;
          settled = true;
          clearTimeout(guard);
          check();
          declutter();
          opts?.onArrived?.();
        };
        const guard = window.setTimeout(done, 1200);
        map.once("moveend", done);
        map.flyTo({ center, zoom: z, duration: 700, essential: false });
      });
    },
    zoomIn() {
      map.zoomIn({ duration: reduced() ? 0 : 250 });
    },
    zoomOut() {
      map.zoomOut({ duration: reduced() ? 0 : 250 });
    },
    resetView,
    back() {
      if (selected >= 0) goTo(selected, true);
    },
    resize() {
      map.resize();
    },
  };
}

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { LabelPoint } from "./contract";
import { LUT } from "./ramp";
import { reduced } from "./format";

const GIBS =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const MAXLAT = 85.051129;
const W = 720;
const H = 1024;
const WORLD: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, MAXLAT],
  [180, MAXLAT],
  [180, -MAXLAT],
  [-180, -MAXLAT],
];

export interface Grid {
  lat: Float32Array;
  lon: Float32Array;
  n: number;
}

export interface Earth {
  paint(score: Float32Array, keep: (i: number) => boolean): void;
  select(i: number, fly: boolean): void;
  top(ids: number[]): void;
  strength(v: number): void;
  labels(on: boolean): void;
  flat(on: boolean): void;
  point(): { x: number; y: number } | null;
  onMove(f: () => void): void;
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
  const draw = (s: Float32Array, keep: Uint8Array) => {
    for (let p = 0; p < px.length; p++) {
      const i = px[p];
      const o = p * 4;
      if (i < 0) {
        d[o + 3] = e[o + 3] = 0;
        continue;
      }
      const v = s[i];
      if (Number.isNaN(v)) {
        d[o] = e[o] = 120;
        d[o + 1] = e[o + 1] = 126;
        d[o + 2] = e[o + 2] = 134;
        d[o + 3] = e[o + 3] = keep[i] ? 70 : 30;
        continue;
      }
      const c = Math.max(0, Math.min(1, v));
      const l = Math.round(c * 255) * 3;
      d[o] = e[o] = LUT[l];
      d[o + 1] = e[o + 1] = LUT[l + 1];
      d[o + 2] = e[o + 2] = LUT[l + 2];
      d[o + 3] = keep[i] ? Math.round(255 * (0.3 + 0.6 * c)) : 15;
      e[o + 3] = keep[i] ? Math.round(255 * (0.1 + 0.75 * c * c)) : 15;
    }
    gf.putImageData(imgF, 0, 0);
    gn.putImageData(imgN, 0, 0);
  };
  return (score: Float32Array, keep: Uint8Array, tick: () => void, done: () => void) => {
    cancelAnimationFrame(raf);
    const from = shown.length === score.length ? shown.slice() : score;
    const to = score;
    shown = new Float32Array(to);
    if (reduced() || from === to) {
      draw(to, keep);
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
      draw(mix, keep);
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

export function createEarth(el: HTMLElement, g: Grid, labels: LabelPoint[], onPick: (i: number) => void): Earth {
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
          attribution: '<a href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener">NASA GIBS Blue Marble</a>',
        },
        sel: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        pts: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: pts.map((p) => ({ type: "Feature", properties: { kind: p.kind, name: p.name }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })),
          },
        },
      },
      layers: [
        { id: "space", type: "background", paint: { "background-color": "#050607" } },
        { id: "fallback", type: "raster", source: "fallback", paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.9, "raster-fade-duration": 0 } },
        { id: "bm", type: "raster", source: "bm", paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.9, "raster-contrast": 0.05 } },
        { id: "par", type: "line", source: "sel", filter: ["==", ["get", "k"], "par"], paint: { "line-color": "#4fd8ff", "line-width": 1, "line-dasharray": [2, 3], "line-opacity": 0.75 } },
        { id: "cell", type: "line", source: "sel", filter: ["==", ["get", "k"], "cell"], paint: { "line-color": "#4fd8ff", "line-width": 2.5 } },
        {
          id: "analogs",
          type: "circle",
          source: "pts",
          filter: ["==", ["get", "kind"], "known_analog"],
          paint: { "circle-radius": 3.5, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.4 },
        },
        {
          id: "caves",
          type: "circle",
          source: "pts",
          filter: ["==", ["get", "kind"], "cave"],
          paint: { "circle-radius": 2.6, "circle-color": "#ffffff", "circle-stroke-color": "#050607", "circle-stroke-width": 1 },
        },
      ],
      sky: { "atmosphere-blend": 0 },
    },
    center: [10, 15],
    zoom: phone ? 0.2 : 1.1,
    minZoom: 0,
    maxZoom: 7.5,
    cooperativeGestures: phone,
    attributionControl: { compact: true },
    fadeDuration: 0,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  const LAYERS = ["match-far", "match-near"] as const;
  const srcs = () => LAYERS.map((id) => map.getSource(id) as maplibregl.CanvasSource | undefined);
  const fade = (id: (typeof LAYERS)[number], k: number): maplibregl.ExpressionSpecification =>
    id === "match-far" ? ["interpolate", ["linear"], ["zoom"], 2.5, k, 4.5, 0] : ["interpolate", ["linear"], ["zoom"], 2.5, 0, 4.5, k];
  const ready = new Promise<void>((r) =>
    map.once("load", () => {
      for (const id of LAYERS) {
        map.addSource(id, { type: "canvas", canvas: id === "match-far" ? farCanvas : nearCanvas, coordinates: WORLD, animate: false });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-resampling": "nearest", "raster-fade-duration": 0, "raster-opacity": fade(id, 1) } }, "par");
      }
      r();
    }),
  );
  let selected = -1;
  let centred = false;
  const markers: maplibregl.Marker[] = [];

  map.on("click", (e) => {
    const k = cellAt(e.lngLat.lat, ((((e.lngLat.lng + 180) % 360) + 360) % 360) - 180);
    if (k >= 0 && at[k] >= 0) onPick(at[k]);
  });
  map.on("mousemove", (e) => {
    const k = cellAt(e.lngLat.lat, e.lngLat.lng);
    map.getCanvas().style.cursor = k >= 0 && at[k] >= 0 ? "pointer" : "";
  });

  return {
    paint(score, keep) {
      const k = new Uint8Array(score.length);
      for (let i = 0; i < k.length; i++) k[i] = keep(i) ? 1 : 0;
      ready.then(() =>
        paint(
          score,
          k,
          () => {
            for (const c of srcs()) c?.play();
          },
          () =>
            requestAnimationFrame(() => {
              for (const c of srcs()) c?.pause();
            }),
        ),
      );
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
        const z = Math.max(map.getZoom(), phone ? 1.1 : 1.8);
        if (!centred) {
          centred = true;
          map.jumpTo({ center: [lon, Math.max(-60, Math.min(60, lat))], zoom: z });
          return;
        }
        if (!fly) return;
        if (reduced()) map.jumpTo({ center: [lon, Math.max(-60, Math.min(60, lat))], zoom: z });
        else map.flyTo({ center: [lon, Math.max(-60, Math.min(60, lat))], zoom: z, duration: 1300, essential: false });
      });
    },
    top(ids) {
      ready.then(() => {
        for (const m of markers.splice(0)) m.remove();
        ids.forEach((i, r) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "pin";
          b.tabIndex = -1;
          b.dataset.i = String(i);
          b.textContent = String(r + 1);
          b.setAttribute("aria-hidden", "true");
          b.classList.toggle("sel", i === selected);
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            onPick(i);
          });
          markers.push(new maplibregl.Marker({ element: b, opacityWhenCovered: "0" }).setLngLat([g.lon[i], g.lat[i]]).addTo(map));
        });
      });
    },
    strength(v) {
      const k = Math.max(0, Math.min(1, v));
      ready.then(() => {
        for (const id of LAYERS) map.setPaintProperty(id, "raster-opacity", fade(id, k));
      });
    },
    labels(on) {
      ready.then(() => {
        for (const id of ["analogs", "caves"]) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      });
    },
    flat(on) {
      ready.then(() => map.setProjection({ type: on ? "mercator" : "globe" }));
    },
    point() {
      if (selected < 0 || !map.loaded()) return null;
      const ll = new maplibregl.LngLat(g.lon[selected], g.lat[selected]);
      const c = map.getCenter();
      const r = Math.PI / 180;
      const far = Math.sin(ll.lat * r) * Math.sin(c.lat * r) + Math.cos(ll.lat * r) * Math.cos(c.lat * r) * Math.cos((ll.lng - c.lng) * r) < 0.15;
      if (map.getProjection()?.type === "globe" && far) return null;
      const p = map.project(ll);
      const b = el.getBoundingClientRect();
      if (p.x < 0 || p.y < 0 || p.x > b.width || p.y > b.height) return null;
      return { x: b.left + p.x, y: b.top + p.y };
    },
    onMove(f) {
      map.on("move", f);
      map.on("idle", f);
      map.on("resize", f);
    },
  };
}

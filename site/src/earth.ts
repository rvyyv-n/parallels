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
const DIM = 80;
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
  paint(score: Float32Array, mask: Uint8Array, focused: boolean, outline: number[]): void;
  select(i: number, fly: boolean): void;
  top(rows: Top[]): void;
  strength(v: number): void;
  labels(on: boolean): void;
  flat(on: boolean): void;
  hover(i: number | null): void;
  at(i: number): { x: number; y: number } | null;
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
        d[o] = e[o] = 2;
        d[o + 1] = e[o + 1] = 7;
        d[o + 2] = e[o + 2] = 10;
        d[o + 3] = e[o + 3] = focused ? DIM : 0;
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
          attribution: '<a href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener">NASA GIBS Blue Marble</a>',
        },
        sel: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        zone: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
        pts: {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: pts.map((p) => ({ type: "Feature", properties: { kind: p.kind, name: p.name }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })),
          },
        },
      },
      layers: [
        { id: "space", type: "background", paint: { "background-color": "#02070a" } },
        { id: "fallback", type: "raster", source: "fallback", paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.9, "raster-fade-duration": 0 } },
        { id: "bm", type: "raster", source: "bm", paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.9, "raster-contrast": 0.05 } },
        { id: "zone-glow", type: "line", source: "zone", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffc24a", "line-width": 5, "line-blur": 4, "line-opacity": 0.55 } },
        { id: "zone-line", type: "line", source: "zone", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffe08a", "line-width": 1.1, "line-opacity": 0.95 } },
        { id: "par", type: "line", source: "sel", filter: ["==", ["get", "k"], "par"], paint: { "line-color": "#5bbbe9", "line-width": 1, "line-dasharray": [2, 3], "line-opacity": 0.75 } },
        { id: "cell", type: "line", source: "sel", filter: ["==", ["get", "k"], "cell"], paint: { "line-color": "#5bbbe9", "line-width": 2.5 } },
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
          paint: { "circle-radius": 2.6, "circle-color": "#ffffff", "circle-stroke-color": "#02070a", "circle-stroke-width": 1 },
        },
      ],
      sky: { "atmosphere-blend": 0 },
    },
    center: [10, 15],
    zoom: fit(),
    minZoom: 0,
    maxZoom: 7.5,
    cooperativeGestures: phone,
    attributionControl: { compact: true },
    fadeDuration: 0,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(
    {
      onAdd() {
        const box = document.createElement("div");
        box.className = "maplibregl-ctrl maplibregl-ctrl-group";
        box.innerHTML = `<button type="button" class="ctl-fit" title="Reset the view" aria-label="Reset the view"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg></button>`;
        box.firstElementChild!.addEventListener("click", () => {
          const c: [number, number] = selected >= 0 ? [g.lon[selected], Math.max(-60, Math.min(60, g.lat[selected]))] : [10, 15];
          map.flyTo({ center: c, zoom: fit(), duration: reduced() ? 0 : 900, essential: false });
        });
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
  const ready = new Promise<void>((r) =>
    map.once("load", () => {
      for (const id of LAYERS) {
        map.addSource(id, { type: "canvas", canvas: id === "match-far" ? farCanvas : nearCanvas, coordinates: WORLD, animate: false });
        map.addLayer({ id, type: "raster", source: id, paint: { "raster-resampling": "nearest", "raster-fade-duration": 0, "raster-opacity": fade(id, 1) } }, "zone-glow");
      }
      r();
    }),
  );
  let selected = -1;
  let centred = false;
  let mask: Uint8Array = new Uint8Array(0);
  const markers: maplibregl.Marker[] = [];
  const tags: maplibregl.Marker[] = [];

  const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
  const hit = (e: maplibregl.MapMouseEvent) => {
    const k = cellAt(e.lngLat.lat, wrap(e.lngLat.lng));
    const i = k >= 0 ? at[k] : -1;
    return i >= 0 && mask[i] ? i : -1;
  };
  const onPin = (e: maplibregl.MapMouseEvent) => !!(e.originalEvent.target as HTMLElement).closest?.(".pin, .pin-tag");
  map.on("click", (e) => {
    if (!onPin(e)) on.pick(hit(e));
  });
  map.on("mousemove", (e) => {
    if (onPin(e)) return;
    const i = hit(e);
    map.getCanvas().style.cursor = i >= 0 ? "pointer" : "";
    on.pointer({ lat: e.lngLat.lat, lon: wrap(e.lngLat.lng) });
    on.over(i >= 0 ? i : null, e.point.x, e.point.y, false);
  });
  map.on("mouseout", () => {
    on.pointer(null);
    on.over(null, 0, 0, false);
  });
  const facing = (lat: number, lon: number) => {
    if (map.getProjection()?.type === "mercator") return true;
    const c = map.getCenter();
    const r = Math.PI / 180;
    return Math.sin(lat * r) * Math.sin(c.lat * r) + Math.cos(lat * r) * Math.cos(c.lat * r) * Math.cos((lon - c.lng) * r) > 0.05;
  };
  const declutter = () => {
    const boxes: DOMRect[] = markers.map((m) => m.getElement().getBoundingClientRect());
    for (const t of tags.map((m) => m.getElement())) {
      t.hidden = false;
      const b = t.getBoundingClientRect();
      const i = Number(t.dataset.i);
      const lap = boxes.some((o) => b.left < o.right && b.right > o.left && b.top < o.bottom && b.bottom > o.top);
      t.hidden = lap || !facing(g.lat[i], g.lon[i]);
      if (!t.hidden) boxes.push(b);
    }
  };
  map.on("move", () => on.moved());
  map.on("moveend", declutter);

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
    const center: [number, number] = [g.lon[i], Math.max(-60, Math.min(60, g.lat[i]))];
    if (!animate || reduced()) {
      map.jumpTo({ center, zoom: z });
      check();
    } else map.flyTo({ center, zoom: z, duration: 1300, essential: false });
  };

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
          b.className = "pin";
          b.tabIndex = -1;
          b.dataset.i = String(i);
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
            new maplibregl.Marker({ element: t, anchor: "left", offset: [15, 0], opacityWhenCovered: "0" }).setLngLat([g.lon[i], g.lat[i]]).addTo(map),
          );
        });
        requestAnimationFrame(declutter);
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
      ready.then(() => {
        map.setProjection({ type: on ? "mercator" : "globe" });
        map.once("idle", check);
      });
    },
    hover(i) {
      for (const m of markers) m.getElement().classList.toggle("hot", i != null && Number(m.getElement().dataset.i) === i);
    },
    at(i) {
      if (!facing(g.lat[i], g.lon[i])) return null;
      const p = map.project([g.lon[i], g.lat[i]]);
      const b = el.getBoundingClientRect();
      return p.x >= 0 && p.y >= 0 && p.x <= b.width && p.y <= b.height ? { x: p.x, y: p.y } : null;
    },
    back() {
      if (selected >= 0) goTo(selected, true);
    },
    resize() {
      map.resize();
    },
  };
}

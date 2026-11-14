import * as maplibregl from "maplibre-gl";
import type { Body, Site } from "./types";

const GIBS =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

export interface SiteMap {
  update(top: string[], selected: string, body: Body): void;
}

export function createMap(el: HTMLElement, sites: Site[], onPick: (id: string) => void): SiteMap {
  const map = new maplibregl.Map({
    container: el,
    style: {
      version: 8,
      sources: {
        bm: {
          type: "raster",
          tiles: [GIBS],
          tileSize: 256,
          maxzoom: 8,
          attribution: '<a href="https://nasa-gibs.github.io/gibs-api-docs/" target="_blank" rel="noopener">NASA GIBS Blue Marble</a>',
        },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#d9e0e6" } },
        { id: "bm", type: "raster", source: "bm", paint: { "raster-saturation": -0.75, "raster-brightness-min": 0.22, "raster-contrast": -0.15 } },
      ],
    },
    bounds: [[-168, -56], [178, 76]],
    minZoom: 0,
    maxZoom: 7,
    renderWorldCopies: false,
    cooperativeGestures: true,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  const markers = new Map<string, { el: HTMLButtonElement; marker: maplibregl.Marker }>();
  for (const s of sites) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pin";
    b.setAttribute("aria-label", s.name);
    b.title = s.name;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(s.id);
    });
    markers.set(s.id, { el: b, marker: new maplibregl.Marker({ element: b }).setLngLat([s.lon, s.lat]).addTo(map) });
  }

  let last = "";
  return {
    update(top, selected) {
      for (const [id, { el }] of markers) {
        const i = top.indexOf(id);
        el.classList.toggle("top", i >= 0);
        el.classList.toggle("sel", id === selected);
        el.innerHTML = i >= 0 ? `<span>${i + 1}</span>` : "";
        el.style.zIndex = id === selected ? "3" : i >= 0 ? String(2) : "1";
        el.setAttribute("aria-label", i >= 0 ? `${i + 1}. ${el.title}` : el.title);
      }
      if (selected !== last) {
        last = selected;
        const s = sites.find((x) => x.id === selected)!;
        if (!map.getBounds().contains([s.lon, s.lat])) map.easeTo({ center: [s.lon, Math.max(-60, Math.min(70, s.lat))], duration: 600 });
      }
    },
  };
}

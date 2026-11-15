import { useEffect, useRef, useState } from "preact/hooks";
import type { Target } from "../../../dataset/contract";
import type { PlaceInfo } from "../data/load";
import { formatCoords } from "../data/match";
import { box, ELEVATION, loadHeights, loadImagery } from "../terrain/tiles";
import { stretchFor, TerrainView } from "../terrain/view";
import { placeName } from "./Feature";
import "./terrain.css";

export interface TerrainProps {
  place: PlaceInfo;
  target: Target;
  onClose: () => void;
}

type Shown =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; min: number; max: number; stretch: number; credit: string };

const FAILED = "We could not load the map tiles for this place. The tiles come live from open map servers, so check your connection and try again later. The rest of the page works without them.";
const EDGE = "Map tiles stop at 85° latitude, so we cannot show this place in 3D.";
const NO_3D = "This browser cannot draw 3D graphics, so we cannot show this ground in 3D.";

const metres = (v: number) => `${Math.round(v).toLocaleString("en")} m`;

export default function Terrain({ place, target, onClose }: TerrainProps) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<TerrainView | undefined>(undefined);
  const [shown, setShown] = useState<Shown>({ state: "loading" });
  const [sun, setSun] = useState(20);
  const { name, country } = placeName(place.region);
  const pole = target.values.sun_height?.value ?? null;
  const there = target.name.split(" (")[0];

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    root.current!.querySelector<HTMLElement>('[data-testid="terrain-close"]')!.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", key);
    return () => {
      removeEventListener("keydown", key);
      html.style.overflow = overflow;
      back?.focus();
    };
  }, []);

  useEffect(() => {
    const area = box(place.lat, place.lon);
    if (!area) {
      setShown({ state: "error", message: EDGE });
      return;
    }
    try {
      view.current = new TerrainView(canvas.current!, matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      setShown({ state: "error", message: NO_3D });
      return;
    }
    const abort = new AbortController();
    Promise.all([loadHeights(area, abort.signal), loadImagery(area, abort.signal)])
      .then(([heights, imagery]) => {
        const stretch = stretchFor(heights);
        view.current!.show(heights, imagery?.canvas, stretch);
        setShown({
          state: "ready",
          min: heights.min,
          max: heights.max,
          stretch,
          credit: `${ELEVATION.credit}. ${imagery ? imagery.source.credit : "No satellite image could be loaded here, so the ground is plain grey"}.`,
        });
      })
      .catch(() => {
        if (!abort.signal.aborted) setShown({ state: "error", message: FAILED });
      });
    return () => {
      abort.abort();
      view.current?.dispose();
      view.current = undefined;
    };
  }, [place.cell]);

  const moveSun = (degrees: number) => {
    setSun(degrees);
    view.current?.setSun(degrees);
  };

  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const stops = [...root.current!.querySelectorAll<HTMLElement>("button, input, [tabindex='0']")].filter((el) => el.offsetParent);
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      class="terrain-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terrain-h"
      data-testid="terrain"
      data-state={shown.state}
      ref={root}
      onKeyDown={trap}
    >
      <canvas
        class="terrain-canvas"
        ref={canvas}
        tabIndex={shown.state === "ready" ? 0 : -1}
        aria-label={`Terrain of ${name} in 3D. Drag it, or use the arrow keys, to turn it.`}
      />
      <header class="terrain-head">
        <div>
          <p class="terrain-kicker">The ground in 3D · about 50 km across</p>
          <h2 id="terrain-h" class="terrain-name">
            <span class="sr">3D terrain: </span>
            {name}
          </h2>
          <p class="terrain-coords">
            {country && country + " · "}
            {formatCoords(place.lat, place.lon)}
          </p>
        </div>
        <button class="terrain-close" data-testid="terrain-close" aria-label="Close the 3D view" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {shown.state === "loading" && (
        <p class="terrain-status" role="status">
          Loading the terrain…
        </p>
      )}
      {shown.state === "error" && (
        <div class="terrain-error" data-testid="terrain-error" role="alert">
          <p>{shown.message}</p>
          <button class="ghost" onClick={onClose}>
            Back to the page
          </button>
        </div>
      )}
      {shown.state === "ready" && (
        <div class="terrain-bar">
          <div class="terrain-sun">
            <label for="terrain-sun">
              Sun height <b>{sun}°</b>
            </label>
            <input
              id="terrain-sun"
              data-testid="terrain-sun"
              type="range"
              min={1}
              max={90}
              step={0.5}
              value={sun}
              aria-valuetext={`${sun}°`}
              onInput={(e) => moveSun(Number(e.currentTarget.value))}
            />
            <span class="terrain-ends" aria-hidden="true">
              <span>low sun</span>
              <span>overhead</span>
            </span>
          </div>
          {pole !== null && (
            <div class="terrain-pole">
              <button data-testid="terrain-pole" aria-pressed={sun === pole} onClick={() => moveSun(pole)}>
                {target.body === "moon" ? "South pole light" : `${there} light`} <b>{pole}°</b>
              </button>
              <p>
                Sun height at {target.body === "moon" ? "the " : ""}
                {there}: {target.values.sun_height.stat}.
              </p>
            </div>
          )}
          <div class="terrain-facts">
            <p>
              Lowest <b>{metres(shown.min)}</b> · Highest <b>{metres(shown.max)}</b> ·{" "}
              {shown.stretch > 1 ? `Heights stretched ×${shown.stretch}` : "Heights not stretched"}
            </p>
            <p>Earth terrain under a lowered sun. Not a picture of the Moon or Mars.</p>
            <p class="terrain-credit" data-testid="terrain-credit">
              {shown.credit}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

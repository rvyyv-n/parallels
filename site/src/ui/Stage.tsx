import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Target } from "../../../dataset/contract";
import type { Listing } from "../data/load";
import { matchPixels } from "../scene/match-map";
import { Scene, type Layout } from "../scene/scene";

interface Props {
  target: Target;
  listing: Listing | undefined;
  openCell: number | null;
  onOpen: (cell: number) => void;
}

const COMPANION_SIZE = { moon: 0.273, mars: 0.4 };

function layoutFor(width: number, height: number, body: Target["body"], open: boolean): Layout {
  if (width >= 900) {
    const r = height * (open ? 0.54 : 0.45);
    const earth = { x: Math.max(width * 0.67, 560 + r), y: height * (open ? 0.62 : 0.6), r };
    const cr = r * COMPANION_SIZE[body] * (open ? 1.1 : 1);
    return { earth, companion: { x: width - cr - 30, y: cr + 28, r: cr } };
  }
  const r = Math.min(width * 0.4, 190);
  const earth = { x: width * 0.43, y: 52 + r, r };
  const cr = r * Math.min(COMPANION_SIZE[body], 0.3);
  return { earth, companion: { x: width - cr - 18, y: cr + 62, r: cr } };
}

export function Stage({ target, listing, openCell, onOpen }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pins = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const places = listing?.places ?? [];
  const open = places.find((p) => p.cell === openCell);

  useLayoutEffect(() => {
    const el = canvas.current!;
    let s: Scene;
    try {
      s = new Scene(el, import.meta.env.BASE_URL + "img/", matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      setFailed(true);
      return;
    }
    scene.current = s;
    const size = () => s.resize(el.clientWidth, el.clientHeight);
    const watch = new ResizeObserver(size);
    watch.observe(el);
    size();
    return () => {
      watch.disconnect();
      s.dispose();
    };
  }, []);

  useEffect(() => {
    const s = scene.current;
    const el = canvas.current!;
    if (!s) return;
    const apply = () => s.setLayout(layoutFor(el.clientWidth, el.clientHeight, target.body, open !== undefined));
    apply();
    const watch = new ResizeObserver(apply);
    watch.observe(el);
    return () => watch.disconnect();
  }, [target.body, open !== undefined]);

  useEffect(() => {
    scene.current?.setBody(target.body, target.lat, target.lon);
  }, [target]);

  useEffect(() => {
    if (listing) scene.current?.setMatch(matchPixels(listing.score, listing.lat, listing.lon, listing.kept));
  }, [listing]);

  const focus = open ?? places[0];
  useEffect(() => {
    if (!focus) return;
    scene.current?.lookAt(focus.lat, focus.lon);
  }, [focus?.cell]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.onFrame = () => {
      const box = pins.current;
      if (!box) return;
      for (const el of Array.from(box.children) as HTMLElement[]) {
        const lat = Number(el.dataset.lat);
        const lon = Number(el.dataset.lon);
        const p = el.dataset.on === "companion" ? s.projectCompanion(lat, lon) : s.projectEarth(lat, lon);
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        el.classList.toggle("hidden", !p.visible);
      }
    };
    s.onFrame();
  });

  return (
    <div class="scene" data-failed={failed || undefined}>
      <canvas ref={canvas} aria-hidden="true" />
      <div class="pins" ref={pins}>
        {places.map((p, i) => (
          <button
            key={p.cell}
            class="pin"
            data-lat={p.lat}
            data-lon={p.lon}
            data-rank={i + 1}
            aria-current={p.cell === (open?.cell ?? places[0]?.cell) || undefined}
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => onOpen(p.cell)}
          >
            <span>{i + 1}</span>
          </button>
        ))}
        <div class="pin target-pin" data-on="companion" data-lat={target.lat} data-lon={target.lon} aria-hidden="true">
          <span>Base site</span>
        </div>
      </div>
    </div>
  );
}

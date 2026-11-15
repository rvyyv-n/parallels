import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Target } from "../../../dataset/contract";
import type { BasePlan } from "../data/base";
import type { Listing, PlaceInfo } from "../data/load";
import { CHAPTERS, entrance, keyframe, mix, smooth, WIDE_FROM } from "../scene/keyframes";
import { matchPixels } from "../scene/match-map";
import { Scene, type World as SceneWorld } from "../scene/scene";

interface Props {
  story: RefObject<HTMLDivElement | null>;
  target: Target;
  listing: Listing | undefined;
  selected: PlaceInfo | undefined;
  plan: BasePlan | undefined;
  onSelect: (cell: number) => void;
}

export function World({ story, target, listing, selected, plan, onSelect }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pins = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | undefined>(undefined);
  const targetRef = useRef(target);
  const entered = useRef(false);
  const [failed, setFailed] = useState(false);
  const places = listing?.places ?? [];
  targetRef.current = target;

  useLayoutEffect(() => {
    const el = canvas.current!;
    const root = story.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let s: Scene;
    try {
      s = new Scene(el, import.meta.env.BASE_URL + "img/", reduced, innerWidth < WIDE_FROM);
    } catch {
      setFailed(true);
      return;
    }
    scene.current = s;

    let queued = 0;
    const update = () => {
      queued = 0;
      const width = el.clientWidth;
      const height = el.clientHeight;
      const wide = innerWidth >= WIDE_FROM;
      const line = wide ? 0 : height;
      const chapters = CHAPTERS.map((id) => root.querySelector<HTMLElement>(`[data-chapter="${id}"]`));
      let index = 0;
      const progress = chapters.map((c, i) => {
        if (!c) return -1;
        const rect = c.getBoundingClientRect();
        if (rect.top <= line + 1) index = i;
        return (line - rect.top) / rect.height;
      });
      const next = Math.min(index + 1, CHAPTERS.length - 1);
      const t = chapters[next] && next !== index ? smooth(wide ? 0.48 : 0.72, 1, progress[index]) : 0;
      const to = mix(
        keyframe(CHAPTERS[index], width, height, targetRef.current),
        keyframe(CHAPTERS[next], width, height, targetRef.current),
        t,
      );
      s.setLayout(to, entered.current ? undefined : entrance(to, height));
      entered.current = true;

      root.dataset.at = CHAPTERS[t > 0.5 ? next : index];
      chapters.forEach((c, i) => {
        if (!c) return;
        const p = progress[i];
        const last = i === CHAPTERS.length - 1;
        const show = !wide || reduced ? 1 : i === 0 ? 1 - smooth(0.42, 0.78, p) : smooth(-0.34, -0.06, p) * (last ? 1 : 1 - smooth(0.6, 0.9, p));
        c.style.setProperty("--show", show.toFixed(3));
        c.toggleAttribute("data-away", show < 0.02);
      });
    };
    const queue = () => {
      queued ||= requestAnimationFrame(update);
    };
    const size = () => {
      s.resize(el.clientWidth, el.clientHeight);
      update();
    };
    const watch = new ResizeObserver(size);
    watch.observe(el);
    watch.observe(root);
    addEventListener("scroll", queue, { passive: true });
    size();
    return () => {
      cancelAnimationFrame(queued);
      removeEventListener("scroll", queue);
      watch.disconnect();
      s.dispose();
    };
  }, []);

  useEffect(() => {
    scene.current?.setSite(target.body, target.lat, target.lon);
    dispatchEvent(new Event("scroll"));
  }, [target]);

  const sharpened = useRef(false);
  useEffect(() => {
    if (!listing) return;
    scene.current?.setMatch(matchPixels(listing.score, listing.lat, listing.lon, listing.kept));
    if (!sharpened.current && innerWidth >= WIDE_FROM) scene.current?.sharpen();
    sharpened.current = true;
  }, [listing]);

  const first = useRef(true);
  useEffect(() => {
    if (!selected) return;
    scene.current?.lookAt(selected.lat, selected.lon, first.current ? -70 : 0);
    first.current = false;
  }, [selected?.cell]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    s.onFrame = () => {
      const box = pins.current;
      if (!box) return;
      for (const el of Array.from(box.children) as HTMLElement[]) {
        const lat = Number(el.dataset.lat);
        const lon = Number(el.dataset.lon);
        const p = s.project(el.dataset.on as SceneWorld, lat, lon);
        el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        el.classList.toggle("hidden", !p.visible);
      }
    };
    s.onFrame();
  });

  return (
    <div class="world" data-failed={failed || undefined}>
      <canvas ref={canvas} aria-hidden="true" />
      <div class="pins" ref={pins}>
        {places.map((p, i) => (
          <button
            key={p.cell}
            class="pin"
            data-on="earth"
            data-lat={p.lat}
            data-lon={p.lon}
            aria-current={p.cell === selected?.cell || undefined}
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => onSelect(p.cell)}
          >
            <span>{i + 1}</span>
          </button>
        ))}
        {selected && !places.some((p) => p.cell === selected.cell) && (
          <div class="pin" data-on="earth" data-lat={selected.lat} data-lon={selected.lon} aria-current="true" aria-hidden="true" />
        )}
        {plan?.places.map((p) => (
          <button
            key={`base-${p.cell}`}
            class="pin base-pin"
            data-on="earth"
            data-lat={p.lat}
            data-lon={p.lon}
            aria-current={p.cell === selected?.cell || undefined}
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => onSelect(p.cell)}
          >
            <span>{p.n}</span>
          </button>
        ))}
        <div class="pin target-pin" data-on={target.body} data-lat={target.lat} data-lon={target.lon} aria-hidden="true">
          <span>Base site</span>
        </div>
      </div>
    </div>
  );
}

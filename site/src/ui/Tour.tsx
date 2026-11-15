import { useEffect, useReducer, useRef } from "preact/hooks";
import type { Manifest, MissionFilter, Target } from "../../../dataset/contract";
import type { BasePlan } from "../data/base";
import { checked } from "../data/checked";
import { loadValidation, type PlaceInfo } from "../data/load";
import { WIDE_FROM } from "../scene/keyframes";
import { useAsync, type View } from "../state";
import { starts, STEPS, total, type Section, type Step } from "./tour-steps";
import "./tour.css";

export interface TourProps {
  manifest: Manifest;
  target: Target;
  filter: MissionFilter;
  places: PlaceInfo[];
  selected: PlaceInfo | undefined;
  plan: BasePlan | undefined;
  chrome: boolean;
  setView: (patch: Partial<View>) => void;
  onExit: () => void;
}

declare global {
  interface Window {
    __tour?: { total: number; steps: { at: number; id: string; seconds: number }[]; played: { at: number; id: string }[] };
  }
}

const TOTAL = total(STEPS);
const STARTS = starts(STEPS);
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "]);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function spot(section: Section): number {
  const el = document.getElementById(section);
  if (!el || section === "intro") return 0;
  const top = el.getBoundingClientRect().top + scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  const wide = innerWidth >= WIDE_FROM;
  const band = document.querySelector(".world")!.getBoundingClientRect().height;
  const y =
    section === "checked" ? top - (wide ? 24 : 48) : wide ? top + (section === "find" ? 0 : innerHeight * 0.12) : top - band - 6;
  return Math.max(0, Math.min(max, y));
}

function ready(step: Step, p: TourProps, place: PlaceInfo | undefined, want: string | undefined) {
  if (step.need === "plan") return !!p.plan;
  if (step.need === "checks") return !!document.querySelector('[data-testid="checked-chart"]');
  return !!place && (!want || p.target.id === want) && !!document.querySelector('.pairs-box[aria-busy="false"]');
}

export function Tour(props: TourProps) {
  const live = useRef(props);
  live.current = props;
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const validation = useAsync(loadValidation, []);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const query = new URLSearchParams(location.search);
  const speed = Number(query.get("speed")) || 1;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const run = useRef({
    index: 0,
    s: 0,
    from: 0,
    glide: 0,
    entered: false,
    ready: false,
    waited: 0,
    playing: !reduced,
    view: undefined as Partial<View> | undefined,
    want: undefined as string | undefined,
  });

  const step = STEPS[run.current.index];
  const aim = step.view?.(props.manifest).target;
  const target = props.manifest.targets.find((t) => t.id === aim) ?? props.target;
  const place = target === props.target && props.selected && props.places.includes(props.selected) ? props.selected : undefined;
  const caption = step.caption({
    manifest: props.manifest,
    target,
    filter: props.filter,
    place,
    plan: props.plan,
    checks: validation && checked(validation).fourth,
  });

  const go = (index: number) => {
    if (index >= STEPS.length) {
      run.current.playing = false;
      return live.current.onExit();
    }
    Object.assign(run.current, { index, s: 0, entered: false, ready: false, waited: 0 });
    document.documentElement.dataset.step = STEPS[index].id;
    redraw(0);
  };
  const toggle = () => {
    run.current.playing = !run.current.playing;
    redraw(0);
  };

  useEffect(() => {
    const html = document.documentElement;
    const t0 = performance.now();
    window.__tour = { total: TOTAL, steps: STEPS.map((s, i) => ({ at: STARTS[i], id: s.id, seconds: s.seconds })), played: [] };
    html.dataset.step = STEPS[0].id;
    let last = t0;
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const r = run.current;
      const p = live.current;
      const step = STEPS[r.index];
      if (!r.entered) {
        r.entered = true;
        r.view = step.view?.(p.manifest);
        r.want = undefined;
        r.from = scrollY;
        r.glide = reduced ? 0 : Math.min(step.seconds * 0.45, 0.8 + (0.2 * Math.abs(spot(step.section) - r.from)) / innerHeight);
        window.__tour!.played.push({ at: (performance.now() - t0) / 1000, id: step.id });
        return;
      }
      if (r.playing) r.s = Math.min(r.s + dt * speed, r.ready ? Infinity : r.glide);
      if (r.view && r.s >= r.glide) {
        p.setView(r.view);
        r.want = r.view.target;
        r.view = undefined;
      } else if (!r.view && !r.ready) {
        const place = p.selected && p.places.includes(p.selected) ? p.selected : undefined;
        r.waited += dt;
        r.ready = ready(step, p, place, r.want) || r.waited > (r.index === 0 ? 20 : 6);
      }
      const to = spot(step.section);
      const y = r.glide > 0 && r.s < r.glide ? r.from + (to - r.from) * ease(r.s / r.glide) : to;
      if (Math.abs(scrollY - y) > 0.5) scrollTo({ top: y, behavior: "instant" });
      bar.current?.style.setProperty("--done", String(Math.min(1, (STARTS[r.index] + Math.min(r.s, step.seconds)) / TOTAL)));
      if (r.playing && r.ready && r.s >= step.seconds) go(r.index + 1);
    });

    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      live.current.onExit();
    };
    const mine = (e: Event) => e.target instanceof Node && (root.current?.contains(e.target) ?? false);
    const starter = (e: Event) => e.target instanceof Element && !!e.target.closest('[data-testid="tour-start"]');
    const onPointer = (e: Event) => {
      if (!mine(e) && !starter(e)) end();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return end();
      if (mine(e)) {
        if (SCROLL_KEYS.has(e.key) && e.key !== " ") end();
        return;
      }
      if (starter(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Tab" || SCROLL_KEYS.has(e.key) || e.key.length === 1) end();
    };
    const onClick = (e: Event) => {
      if (!starter(e)) return;
      Object.assign(run.current, { playing: !reduced });
      window.__tour!.played = [];
      go(0);
    };
    addEventListener("wheel", end, { passive: true });
    addEventListener("pointerdown", onPointer, true);
    addEventListener("touchstart", onPointer, { capture: true, passive: true });
    addEventListener("keydown", onKey, true);
    addEventListener("click", onClick, true);
    if (document.activeElement instanceof HTMLButtonElement) root.current?.querySelector<HTMLElement>(".tour-main")?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("wheel", end);
      removeEventListener("pointerdown", onPointer, true);
      removeEventListener("touchstart", onPointer, true);
      removeEventListener("keydown", onKey, true);
      removeEventListener("click", onClick, true);
      delete html.dataset.step;
    };
  }, []);

  const { index, playing } = run.current;
  const state = playing ? "playing" : "paused";
  if (!props.chrome) return <div class="tour" data-testid="tour" data-state={state} />;

  const lastStep = index === STEPS.length - 1;
  return (
    <div class="tour" data-testid="tour" data-state={state} data-side={step.section === "checked" ? "left" : undefined} ref={root}>
      <div class="tour-panel">
        <p class="tour-caption" data-testid="tour-caption" aria-live="polite">
          {caption}
        </p>
        <div class="tour-controls">
          <div
            class="tour-progress"
            data-testid="tour-progress"
            ref={bar}
            role="progressbar"
            aria-label="Tour progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={index + 1}
          >
            {STARTS.slice(1).map((at) => (
              <i key={at} style={{ left: `${(at / TOTAL) * 100}%` }} />
            ))}
          </div>
          <span class="tour-count">
            {String(index + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
          </span>
          {reduced ? (
            <button class="tour-button tour-main" data-testid="tour-next" onClick={() => go(index + 1)}>
              {lastStep ? "Finish" : "Next"}
            </button>
          ) : (
            <>
              <button class="tour-button tour-main" data-testid="tour-pause" onClick={toggle}>
                {playing ? "Pause" : "Play"}
              </button>
              <button class="tour-button" data-testid="tour-next" onClick={() => go(index + 1)}>
                {lastStep ? "Finish" : "Next"}
              </button>
            </>
          )}
          <button class="tour-button" data-testid="tour-exit" onClick={() => props.onExit()}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

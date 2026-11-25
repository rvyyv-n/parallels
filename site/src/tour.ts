import "./tour.css";
import { reduced } from "./format";
import { at, go, hrefFor } from "./router";

interface Step {
  page: string;
  at: string;
  title: string;
  text: string;
  href?: () => string | null | undefined;
  enter?: (el: HTMLElement) => void;
  leave?: () => void;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const PLAY_MS = 7000;

const one = (q: string) => [...document.querySelectorAll<HTMLElement>(q)].find((e) => e.getClientRects().length > 0) ?? null;
const hrefOf = (q: string) => one(q)?.getAttribute("href");

const STEPS: Step[] = [
  {
    page: "",
    at: "#ch-moon .sites",
    title: "Select a base site",
    text: "Each Moon and Mars base site is in this list. Select one, or wait, and the tour opens the Finder for it.",
    href: () => "#ch-moon",
  },
  {
    page: "find",
    at: "#summary",
    title: "The best match",
    text: "The Finder ranks all land on Earth for the base site. This card shows the best place and how many new places it found.",
    href: () => hrefOf("#ch-moon a.site[aria-current]") ?? hrefOf("#ch-moon a.site"),
  },
  {
    page: "find",
    at: "#earth",
    title: "The map",
    text: "The map lights the best 2% of land. The numbered pins are the top 20. Open the legend pill below to show more or less land.",
  },
  {
    page: "find",
    at: "#rank li[data-i]",
    title: "Point at a place",
    text: "Move the pointer onto a row to see its pin and a view of the ground from space.",
    enter: (el) => el.querySelector(".rk-row")?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
    leave: () => document.querySelector("#rank")?.dispatchEvent(new MouseEvent("mouseleave")),
  },
  {
    page: "find",
    at: "#rank .rk-chips",
    title: "The challenge chips",
    text: "Each chip shows one challenge: green is very close and red is far off.",
  },
  {
    page: "find",
    at: ".presets",
    title: "Presets",
    text: "Balanced counts every challenge the same. The other presets rank for a rover, a crew or a habitat.",
  },
  {
    page: "find",
    at: "#weights",
    title: "Change a weight",
    text: "Move a slider and the list changes its order immediately.",
    enter: (el) => ((el as HTMLDetailsElement).open = true),
    leave: () => {
      const w = document.querySelector<HTMLDetailsElement>("#weights");
      if (w) w.open = false;
    },
  },
  {
    page: "find",
    at: "#rank .rk-row",
    title: "Open a place",
    text: "Select a place to see the full match for each challenge.",
  },
  {
    page: "place",
    at: "#pl-mb",
    title: "Where it breaks",
    text: "Each place shows what matches the base site, where it breaks, and what no place on Earth can copy.",
    href: () => hrefOf("#rank .rk-row"),
  },
];

let box: HTMLElement;
let hole: HTMLElement;
let steps: Step[] = [];
let n = -1;
let raf = 0;
let token = 0;
let timer = 0;
let playing = true;
let from: HTMLElement | null = null;
let target: HTMLElement | null = null;
let lastQuad = 0;
let lastHoleKey = "";
let lastBoxKey = "";

const padRect = (r: Rect, p: number): Rect => ({ left: r.left - p, top: r.top - p, right: r.right + p, bottom: r.bottom + p });

const overlap = (a: Rect, b: Rect) => {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return w * h;
};

const safeTop = () => {
  const bar = document.querySelector<HTMLElement>(".top");
  const bottom = bar ? Math.min(120, Math.max(0, bar.getBoundingClientRect().bottom)) : 62;
  return Math.max(16, Math.round(bottom + 12));
};

function placeBox(hr: Rect, snap: boolean) {
  const vw = innerWidth;
  const vh = innerHeight;
  const topMin = safeTop();
  const bw = box.offsetWidth || Math.min(380, vw - 28);
  const bh = box.offsetHeight || 220;

  let left: number;
  let top: number;

  if (vw < 760) {
    const m = 14;
    const midY = (hr.top + hr.bottom) / 2;
    left = m;
    top = midY < vh / 2 ? Math.max(topMin, vh - bh - m) : topMin;
    top = Math.max(topMin, Math.min(vh - bh - m, top));
  } else {
    const m = 18;
    const clampX = (x: number) => Math.max(m, Math.min(vw - bw - m, x));
    const clampY = (y: number) => Math.max(topMin, Math.min(vh - bh - m, y));
    const hc = one(".hovercard:not([hidden])");
    const cr = hc ? hc.getBoundingClientRect() : null;
    const cardRect: Rect | null = cr && cr.width > 0 && cr.height > 0 ? padRect({ left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom }, 12) : null;
    const holePadded = padRect(hr, 14);
    const workH = Math.max(1, vh - topMin);

    const candidates: { x: number; y: number; clearArea: number }[] = [
      // bottom-right
      { x: clampX(vw - bw - m), y: clampY(vh - bh - m), clearArea: Math.max(Math.max(0, vw - hr.right) * workH, Math.max(0, vh - hr.bottom) * vw) },
      // bottom-left
      { x: clampX(m), y: clampY(vh - bh - m), clearArea: Math.max(Math.max(0, hr.left) * workH, Math.max(0, vh - hr.bottom) * vw) },
      // top-right
      { x: clampX(vw - bw - m), y: clampY(topMin), clearArea: Math.max(Math.max(0, vw - hr.right) * workH, Math.max(0, hr.top - topMin) * vw) },
      // top-left
      { x: clampX(m), y: clampY(topMin), clearArea: Math.max(Math.max(0, hr.left) * workH, Math.max(0, hr.top - topMin) * vw) },
    ];

    let bestIdx = 0;
    let bestPenalty = Infinity;
    let bestClear = -1;

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const boxRect: Rect = { left: c.x, top: c.y, right: c.x + bw, bottom: c.y + bh };
      const pen = overlap(boxRect, holePadded) * 2 + (cardRect ? overlap(boxRect, cardRect) * 3 : 0);
      const area = c.clearArea * (i === lastQuad && pen === 0 ? 1.05 : 1);
      if (pen < bestPenalty - 1 || (Math.abs(pen - bestPenalty) <= 1 && area > bestClear)) {
        bestPenalty = pen;
        bestClear = area;
        bestIdx = i;
      }
    }
    lastQuad = bestIdx;
    left = candidates[bestIdx].x;
    top = candidates[bestIdx].y;
  }

  const rx = Math.round(left);
  const ry = Math.round(top);
  const key = `${rx},${ry}`;
  if (key !== lastBoxKey) {
    lastBoxKey = key;
    if (snap) box.classList.add("tour-snap");
    box.style.left = `${rx}px`;
    box.style.top = `${ry}px`;
    if (snap) {
      void box.offsetWidth;
      box.classList.remove("tour-snap");
    }
  }
}

function syncGeometry(el: HTMLElement, snap = false) {
  const r = el.getBoundingClientRect();
  const left = Math.max(r.left, 0);
  const top = Math.max(r.top, 0);
  const right = Math.min(r.right, innerWidth);
  const bottom = Math.min(r.bottom, innerHeight);
  const w = Math.max(0, right - left);
  const h = Math.max(0, bottom - top);
  const key = `${Math.round(left)},${Math.round(top)},${Math.round(w)},${Math.round(h)}`;
  if (key !== lastHoleKey) {
    lastHoleKey = key;
    if (snap) hole.classList.add("tour-snap");
    hole.style.left = `${left}px`;
    hole.style.top = `${top}px`;
    hole.style.width = `${w}px`;
    hole.style.height = `${h}px`;
    if (snap) {
      void hole.offsetWidth;
      hole.classList.remove("tour-snap");
    }
  }
  placeBox({ left, top, right, bottom }, snap);
}

const track = () => {
  raf = 0;
  if (n < 0) return;
  const el = one(steps[n].at);
  if (el) syncGeometry(el, false);
  raf = requestAnimationFrame(track);
};

const wait = (q: string, mine: number) =>
  new Promise<HTMLElement | null>((done) => {
    const t0 = performance.now();
    const look = () => {
      if (mine !== token) return done(null);
      const el = one(q);
      if (el) return done(el);
      if (performance.now() - t0 > 15000) return done(null);
      setTimeout(look, 100);
    };
    look();
  });

const next = () => (n >= steps.length - 1 ? end() : void show(n + 1));

function schedule() {
  clearTimeout(timer);
  box.style.setProperty("--play", `${PLAY_MS}ms`);
  box.classList.remove("ticking");
  if (!playing || n < 0) return;
  void box.offsetWidth;
  box.classList.add("ticking");
  timer = window.setTimeout(next, PLAY_MS);
}

function setPlaying(on: boolean) {
  playing = on;
  const b = box.querySelector<HTMLButtonElement>('[data-tour="play"]')!;
  b.textContent = on ? "Pause" : "Play";
  b.setAttribute("aria-pressed", String(!on));
  schedule();
}

function syncPips(k: number) {
  const wrap = box.querySelector<HTMLElement>(".tour-pips");
  if (!wrap) return;
  if (wrap.children.length !== steps.length) {
    wrap.innerHTML = steps.map(() => `<span class="tour-pip"></span>`).join("");
  }
  for (let i = 0; i < wrap.children.length; i++) {
    const pip = wrap.children[i];
    pip.classList.toggle("is-done", i < k);
    pip.classList.toggle("is-now", i === k);
  }
}

async function show(k: number) {
  steps[n]?.leave?.();
  clearTimeout(timer);
  const mine = ++token;
  n = k;
  const st = steps[k];
  const wasHidden = Boolean(hole.hidden);
  const switching = at() !== st.page;
  target = null;
  if (switching) hole.hidden = true;
  box.setAttribute("aria-busy", "true");
  if (switching) go(st.href?.() ?? hrefFor(st.page));
  const el = await wait(st.at, mine);
  if (mine !== token) return;
  box.removeAttribute("aria-busy");
  if (!el) return end();
  target = el;
  box.querySelector(".tour-n")!.textContent = `${k + 1} of ${steps.length}`;
  syncPips(k);
  box.querySelector(".tour-t")!.textContent = st.title;
  box.querySelector(".tour-p")!.textContent = st.text;
  box.querySelector<HTMLButtonElement>('[data-tour="back"]')!.disabled = k === 0;
  box.querySelector('[data-tour="next"]')!.textContent = k === steps.length - 1 ? "Finish" : "Next";
  el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: el.offsetHeight > innerHeight * 0.6 ? "start" : "center" });
  st.enter?.(el);
  const snap = wasHidden || switching;
  hole.hidden = box.hidden = false;
  syncGeometry(el, snap);
  document.documentElement.classList.add("touring");
  if (!box.contains(document.activeElement)) box.querySelector<HTMLButtonElement>(".tour-next")!.focus({ preventScroll: true });
  if (!raf) raf = requestAnimationFrame(track);
  schedule();
}

function end() {
  steps[n]?.leave?.();
  clearTimeout(timer);
  token++;
  n = -1;
  target = null;
  lastHoleKey = "";
  lastBoxKey = "";
  hole.hidden = box.hidden = true;
  box.classList.remove("ticking");
  document.documentElement.classList.remove("touring");
  cancelAnimationFrame(raf);
  raf = 0;
  if (from?.getClientRects().length) from.focus({ preventScroll: true });
}

function build() {
  if (box) return;
  hole = document.createElement("div");
  hole.className = "tour-hole";
  hole.hidden = true;
  box = document.createElement("div");
  box.className = "tour-box";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Guided tour");
  box.innerHTML = `<div class="tour-head"><p class="tour-n" aria-hidden="true"></p><div class="tour-pips" aria-hidden="true"></div></div>
    <div aria-live="polite"><h2 class="tour-t"></h2><p class="tour-p"></p></div>
    <div class="tour-bar" aria-hidden="true"><i></i></div>
    <div class="tour-btns"><button type="button" data-tour="back">Back</button><button type="button" data-tour="play" aria-pressed="false">Pause</button><button type="button" data-tour="next" class="tour-next">Next</button><button type="button" data-tour="end" aria-label="Close the tour">Close</button></div>`;
  document.body.append(hole, box);
  box.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tour]");
    if (!b) return;
    if (b.dataset.tour === "end") end();
    else if (b.dataset.tour === "play") setPlaying(!playing);
    else if (b.dataset.tour === "back") void show(Math.max(0, n - 1));
    else next();
  });
  box.addEventListener("pointerenter", () => clearTimeout(timer));
  box.addEventListener("pointerleave", () => schedule());
  document.addEventListener("keydown", (e) => {
    if (n < 0 || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") {
      e.preventDefault();
      end();
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    const tag = active?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || active?.isContentEditable) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      if (n > 0) {
        e.preventDefault();
        void show(n - 1);
      }
    } else if (e.key === " " || e.code === "Space") {
      if (tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        setPlaying(!playing);
      }
    }
  });
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (n < 0 || box.contains(e.target as Node)) return;
      if (target?.contains(e.target as Node) && n < steps.length - 1) {
        clearTimeout(timer);
        setTimeout(next, 400);
      } else if (playing) setPlaying(false);
    },
    true,
  );
}

export function tourButton(button: HTMLElement, start: "home" | "find"): void {
  build();
  button.addEventListener("click", () => {
    from = button;
    steps = start === "home" ? STEPS : STEPS.slice(1);
    playing = true;
    setPlaying(true);
    void show(0);
  });
}

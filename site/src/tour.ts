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

const one = (q: string) => [...document.querySelectorAll<HTMLElement>(q)].find((e) => e.getClientRects().length > 0) ?? null;
const hrefOf = (q: string) => one(q)?.getAttribute("href");

const STEPS: Step[] = [
  {
    page: "",
    at: "#ch-moon .sites",
    title: "Select a base site",
    text: "Select a Moon base site to see the places on Earth that match it.",
    href: () => "#ch-moon",
  },
  {
    page: "find",
    at: "#earth",
    title: "The map",
    text: "The map colours the best 2% of land for the site, and the pins show the top 20.",
    href: () => hrefOf("#ch-moon a.site[aria-current]"),
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
    at: "#weights",
    title: "Change a weight",
    text: "Move a slider and the list changes its order immediately.",
    enter: (el) => ((el as HTMLDetailsElement).open = true),
  },
  {
    page: "find",
    at: "#rank .rk-row",
    title: "Open a place",
    text: "Click a place to see the full match for each challenge.",
  },
  {
    page: "place",
    at: ".mv-strips",
    title: "Where it breaks",
    text: "Each match shows its weak points and what no place on Earth can copy.",
    href: () => hrefOf("#rank .rk-row"),
  },
];

let box: HTMLElement;
let hole: HTMLElement;
let steps: Step[] = [];
let n = -1;
let raf = 0;
let token = 0;
let from: HTMLElement | null = null;

const track = () => {
  raf = 0;
  if (n < 0) return;
  const el = one(steps[n].at);
  if (el) {
    const r = el.getBoundingClientRect();
    const top = Math.max(r.top, 0);
    const bottom = Math.min(r.bottom, innerHeight);
    hole.style.cssText = `left:${Math.max(r.left, 0)}px;top:${top}px;width:${Math.min(r.right, innerWidth) - Math.max(r.left, 0)}px;height:${Math.max(0, bottom - top)}px`;
  }
  raf = requestAnimationFrame(track);
};

const wait = (q: string, mine: number) =>
  new Promise<HTMLElement | null>((done) => {
    const t0 = performance.now();
    const look = () => {
      if (mine !== token) return done(null);
      const el = one(q);
      if (el) return done(el);
      if (performance.now() - t0 > 12000) return done(null);
      setTimeout(look, 100);
    };
    look();
  });

async function show(k: number) {
  steps[n]?.leave?.();
  const mine = ++token;
  n = k;
  const st = steps[k];
  hole.hidden = true;
  box.setAttribute("aria-busy", "true");
  if (at() !== st.page) go(st.href?.() ?? hrefFor(st.page));
  const el = await wait(st.at, mine);
  if (mine !== token) return;
  box.removeAttribute("aria-busy");
  if (!el) return end();
  box.querySelector(".tour-n")!.textContent = `${k + 1} of ${steps.length}`;
  box.querySelector(".tour-t")!.textContent = st.title;
  box.querySelector(".tour-p")!.textContent = st.text;
  box.querySelector<HTMLButtonElement>('[data-tour="back"]')!.disabled = k === 0;
  box.querySelector('[data-tour="next"]')!.textContent = k === steps.length - 1 ? "Finish" : "Next";
  el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: el.offsetHeight > innerHeight * 0.6 ? "start" : "center" });
  st.enter?.(el);
  hole.hidden = box.hidden = false;
  document.documentElement.classList.add("touring");
  if (!box.contains(document.activeElement)) box.querySelector<HTMLButtonElement>(".tour-next")!.focus({ preventScroll: true });
  if (!raf) raf = requestAnimationFrame(track);
}

function end() {
  steps[n]?.leave?.();
  token++;
  n = -1;
  hole.hidden = box.hidden = true;
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
  box.innerHTML = `<p class="tour-n" aria-hidden="true"></p><div aria-live="polite"><h2 class="tour-t"></h2><p class="tour-p"></p></div>
    <div class="tour-btns"><button type="button" data-tour="back">Back</button><button type="button" data-tour="next" class="tour-next">Next</button><button type="button" data-tour="end" aria-label="Close the tour">Close</button></div>`;
  document.body.append(hole, box);
  box.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tour]");
    if (!b) return;
    if (b.dataset.tour === "end") end();
    else if (b.dataset.tour === "back") void show(Math.max(0, n - 1));
    else if (n === steps.length - 1) end();
    else void show(n + 1);
  });
  document.addEventListener("keydown", (e) => {
    if (n >= 0 && e.key === "Escape") end();
  });
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (n >= 0 && !box.contains(e.target as Node)) end();
    },
    true,
  );
}

export function tourButton(button: HTMLElement, start: "home" | "find"): void {
  build();
  button.addEventListener("click", () => {
    from = button;
    steps = start === "home" ? STEPS : STEPS.slice(1);
    void show(0);
  });
}

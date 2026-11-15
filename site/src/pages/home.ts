import type { Body, Manifest } from "../contract";
import { esc, num, webgl } from "../format";
import { icon } from "../icons";
import type { Intro } from "../intro";
import { logo } from "../logo";
import { go, reveal, type Page } from "../router";
import { headline, TEXTURE, TITLE } from "../worlds";
import { home, type Ctx } from "./ctx";

const CHAPTERS = [
  { id: "ch-hero", name: "Start" },
  { id: "ch-count", name: "All of Earth's land" },
  { id: "ch-moon", name: "The Moon" },
  { id: "ch-mars", name: "Mars" },
  { id: "ch-choose", name: "Choose a world" },
];

const next = (id: string, label: string) =>
  `<a class="chap-next" href="#${id}"><span>${label}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>`;

function facts(m: Manifest, body: Body) {
  return `<div class="facts"><p class="facts-k">${icon("cant")}Earth can't copy</p><dl>${m.cant_copy
    .map((c) => {
      const [big, rest] = headline(c[body]);
      return `<div><dt>${esc(c.name)}</dt><dd><b>${esc(big)}</b>${rest ? `<span>${esc(rest)}</span>` : ""}<small>${esc(c.source)}</small></dd></div>`;
    })
    .join("")}</dl></div>`;
}

function world(m: Manifest, b: Body, n: number) {
  return `<section class="chap chap-${b}" id="ch-${b}" data-chap="${n}" aria-labelledby="${b}-chap-h">
    <div class="copy">
      <p class="intro-k">What Earth can't copy</p>
      <h2 id="${b}-chap-h" class="w-${b}">${TITLE[b]}</h2>
      ${facts(m, b)}
      ${next(CHAPTERS[n + 1].id, CHAPTERS[n + 1].name)}
    </div>
  </section>`;
}

function choice(m: Manifest, b: Body) {
  const n = m.targets.filter((t) => t.body === b).length;
  return `<a class="choice choice-${b}" href="#/${b}" data-world="${b}"><span class="w-disc w-disc-${b}" aria-hidden="true"></span><span class="choice-n">${TITLE[b]}</span><span class="choice-s">${num(n)} base ${
    n === 1 ? "site" : "sites"
  } to choose from</span></a>`;
}

const html = (m: Manifest) => `<section id="intro" class="intro" aria-labelledby="intro-h">
  <div class="intro-stage">
    <div class="intro-view" id="intro-view" aria-hidden="true"><div class="intro-still">${logo()}</div></div>
    <nav class="intro-dots" aria-label="Opening chapters">${CHAPTERS.map((c, i) => `<a href="#${c.id}" data-dot="${i}"><span>${c.name}</span></a>`).join("")}</nav>
  </div>
  <div class="chapters">
    <section class="chap chap-hero" id="ch-hero" data-chap="0">
      <div class="copy">
        <p class="intro-k">NASA Space Apps Challenge 2026</p>
        <h1 id="intro-h" tabindex="-1">No place on Earth is <span class="w-moon">the Moon.</span> <span class="w-mars">Or Mars.</span></h1>
        <p class="intro-lede">But every patch of land copies a part of them. Parallels identifies the Earth locations that analog a permanent Moon base and Mars, part by part.</p>
        ${next("ch-count", "Scroll to begin")}
      </div>
    </section>
    <section class="chap chap-count" id="ch-count" data-chap="1" aria-labelledby="count-h">
      <div class="copy">
        <p class="intro-k">All of Earth's land</p>
        <h2 id="count-h">Every patch, scored. Not just the famous ones.</h2>
        <dl class="counts">
          <div><dt>${num(m.grid.n)}</dt><dd>patches of land, each about 50 km across</dd></div>
          <div><dt id="count-known">—</dt><dd>places already used as analogs, drawn in amber</dd></div>
        </dl>
        ${next("ch-moon", "The Moon")}
      </div>
    </section>
    ${world(m, "moon", 2)}
    ${world(m, "mars", 3)}
    <section class="chap chap-choose" id="ch-choose" data-chap="4" aria-labelledby="choose-h">
      <div class="copy">
        <p class="intro-k">Where is the base?</p>
        <h2 id="choose-h">Choose a world</h2>
        <p class="intro-lede">Pick the Moon or Mars, then a base site on it. Parallels ranks all of Earth's land against that site.</p>
        <div class="choices">${choice(m, "moon")}${choice(m, "mars")}</div>
      </div>
    </section>
  </div>
</section>`;

export function homePage(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let intro: Intro | null = null;
  let place = () => {};
  return {
    title: () => "",
    mount(root) {
      el = root;
      el.innerHTML = html(m);
      const chaps = [...el.querySelectorAll<HTMLElement>(".chap")];
      const dots = [...el.querySelectorAll<HTMLElement>(".intro-dots a")];
      const top = document.querySelector<HTMLElement>(".top");
      let ticking = false;
      place = () => {
        ticking = false;
        if (el.hidden) return;
        const head = top?.offsetHeight ?? 0;
        const mid = head + (innerHeight - head) / 2;
        const cs = chaps.map((c) => {
          const r = c.getBoundingClientRect();
          return r.top + Math.min(r.height, innerHeight) / 2;
        });
        let at = 0;
        for (let i = 0; i < cs.length - 1; i++) if (mid >= cs[i]) at = i + Math.min(1, (mid - cs[i]) / Math.max(1, cs[i + 1] - cs[i]));
        intro?.chapter(at);
        const on = Math.round(at);
        chaps.forEach((c, i) => c.classList.toggle("in", c.classList.contains("in") || Math.abs(at - i) < 0.62));
        dots.forEach((a, i) => (i === on ? a.setAttribute("aria-current", "step") : a.removeAttribute("aria-current")));
      };
      const onScroll = () => {
        if (ticking || el.hidden) return;
        ticking = true;
        requestAnimationFrame(place);
      };
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll, { passive: true });
      for (const a of el.querySelectorAll<HTMLElement>(".choice")) {
        const pick = () => {
          const b = a.dataset.world as Body;
          const t = home(m, b);
          if (t) intro?.target(b, t);
        };
        a.addEventListener("pointerenter", pick);
        a.addEventListener("focus", pick);
      }
      let known: { lat: number; lon: number }[] = [];
      void ctx.labels().then((ls) => {
        known = ls.filter((l) => l.kind === "known_analog");
        el.querySelector("#count-known")!.textContent = known.length ? num(known.length) : "no data";
        intro?.known(known);
      });
      const weak = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
      if (!webgl() || weak) return;
      import("../intro")
        .then(({ createIntro }) => {
          const view = el.querySelector<HTMLElement>("#intro-view")!;
          const img = (f: string) => `${import.meta.env.BASE_URL}${f.startsWith("img/") ? f : `img/${f}`}`;
          const spot = (b: Body) => home(m, b) ?? { lat: 0, lon: 0 };
          intro = createIntro(
            view,
            {
              earth: innerWidth >= 900 ? [img("blue-marble-4k.jpg"), img("blue-marble-8k.jpg")] : [img("blue-marble.jpg"), img("blue-marble-4k.jpg")],
              moon: [img(TEXTURE.moon), img("moon-4k.jpg")],
              mars: [img(TEXTURE.mars), img("mars-4k.jpg")],
            },
            { moon: spot("moon"), mars: spot("mars") },
            { world: (w) => go(`#/${w}`), earth: () => reveal("ch-choose", true) },
          );
          view.classList.add("live");
          intro.target("moon", spot("moon"));
          intro.known(known);
          place();
        })
        .catch(() => {});
    },
    show() {
      requestAnimationFrame(place);
    },
  };
}

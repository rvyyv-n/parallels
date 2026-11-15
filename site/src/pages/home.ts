import type { Body, LabelPoint, Manifest, Target } from "../contract";
import { esc, latlon, num, webgl } from "../format";
import { icon } from "../icons";
import type { Intro } from "../intro";
import { logo } from "../logo";
import { reveal, type Page } from "../router";
import { headline, NAME, SHARP, TEXTURE, thumb, TITLE } from "../worlds";
import { home, rankedOf, type Ctx } from "./ctx";

const CHAPTERS = [
  { id: "ch-hero", name: "Start" },
  { id: "ch-count", name: "All of Earth's land" },
  { id: "ch-moon", name: "The Moon" },
  { id: "ch-mars", name: "Mars" },
  { id: "ch-known", name: "Known analog places" },
  { id: "ch-go", name: "Open the Finder" },
];

const LEDE: Record<Body, string> = { moon: "Choose a lunar site to see how Earth compares", mars: "Choose a Mars site to see how Earth compares" };

const KNOWN = ["Haughton crater, Devon Island", "Yungay, Atacama", "McMurdo Dry Valleys", "Mauna Kea", "Rio Tinto", "Black Point lava flow"];

const next = (id: string, label: string) =>
  `<a class="chap-next" href="#${id}"><span>${label}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>`;

const sitesOf = (m: Manifest, b: Body) => {
  const ts = m.targets.filter((t) => t.body === b);
  const i = ts.findIndex((t) => t.default);
  return i > 0 ? [ts[i], ...ts.slice(0, i), ...ts.slice(i + 1)] : ts;
};

const site = (t: Target, i: number) =>
  `<li><a class="site" href="#/find?t=${esc(t.id)}" data-site="${esc(t.id)}" tabindex="${i ? -1 : 0}"${i ? "" : ' aria-current="true"'}><canvas class="site-thumb" width="128" height="128" data-thumb="${esc(
    t.id,
  )}" aria-hidden="true"></canvas><span class="site-n">${esc(t.name)}</span><span class="site-at">${latlon(t.lat, t.lon, 1)}</span></a></li>`;

function cant(m: Manifest, b: Body) {
  const src = [...new Map(m.cant_copy.map((c) => [c.source, c.url])).entries()];
  return `<div class="cant"><p class="cant-k">${icon("cant")}Earth can't copy</p><dl>${m.cant_copy
    .map((c) => `<div title="${esc(`${c[b]} (${c.source})`)}"><dt>${esc(c.name.replace(/ on the surface$/, ""))}</dt><dd>${esc(headline(c[b])[0])}</dd></div>`)
    .join("")}</dl><p class="cant-src">Sources: ${src.map(([s, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s)}</a>`).join(" · ")}</p></div>`;
}

const world = (m: Manifest, b: Body, n: number) => `<section class="chap chap-world" id="ch-${b}" data-chap="${n}" aria-labelledby="${b}-h">
    <div class="copy">
      <h2 id="${b}-h"${b === "mars" ? ' class="w-mars"' : ""}>${TITLE[b]}</h2>
      <p class="sites-lede">${LEDE[b]}</p>
      <ul class="sites" data-world="${b}" aria-label="Base sites on ${NAME[b]}" aria-describedby="${b}-keys">${sitesOf(m, b).map(site).join("")}</ul>
      <p class="sites-keys" id="${b}-keys">Arrow keys move through the sites. Enter opens Earth's matches in the Finder.</p>
      ${cant(m, b)}
    </div>
  </section>`;

const html = (m: Manifest) => `<section id="intro" class="intro" aria-labelledby="intro-h">
  <div class="intro-stage">
    <div class="intro-view" id="intro-view" aria-hidden="true"><div class="intro-still">${logo()}</div></div>
    <nav class="intro-dots" aria-label="Home chapters">${CHAPTERS.map((c, i) => `<a href="#${c.id}" data-dot="${i}"><span>${c.name}</span></a>`).join("")}</nav>
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
          <div><dt id="count-ranked">—</dt><dd>ranked for the ${esc((home(m, "moon")?.short ?? "").replace(/\s*\(.*\)$/, ""))}</dd></div>
          <div><dt id="count-known">—</dt><dd>places already used as analogs, drawn in amber</dd></div>
        </dl>
        ${next("ch-moon", "The Moon")}
      </div>
    </section>
    ${world(m, "moon", 2)}
    ${world(m, "mars", 3)}
    <section class="chap chap-known" id="ch-known" data-chap="4" aria-labelledby="known-h">
      <div class="copy">
        <h2 id="known-h">The Moon and Mars are closer than you think.</h2>
        <p class="intro-lede">Crews have rehearsed Moon and Mars work at these places. Click one to go there.</p>
        <ul class="places" aria-label="Known analog places"></ul>
      </div>
    </section>
    <section class="chap chap-go" id="ch-go" data-chap="5" aria-label="Open the Finder">
      <div class="copy"><a class="go" href="#/find">Open the Finder${icon("chevron")}</a></div>
    </section>
  </div>
</section>`;

export function homePage(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let intro: Intro | null = null;
  let place = () => {};
  let counted = false;
  const picked: Record<Body, Target | undefined> = { moon: home(m, "moon"), mars: home(m, "mars") };
  let places: LabelPoint[] = [];
  let spot = 0;
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

      for (const ul of el.querySelectorAll<HTMLElement>(".sites")) {
        const b = ul.dataset.world as Body;
        const ts = sitesOf(m, b);
        const links = [...ul.querySelectorAll<HTMLAnchorElement>("a.site")];
        let at = 0;
        const select = (i: number) => {
          if (!ts[i]) return;
          at = i;
          links.forEach((a, n) => {
            a.tabIndex = n === i ? 0 : -1;
            if (n === i) a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          });
          picked[b] = ts[i];
          intro?.target(b, ts[i]);
        };
        links.forEach((a, i) => {
          a.addEventListener("pointerenter", () => select(i));
          a.addEventListener("focus", () => select(i));
        });
        ul.addEventListener("keydown", (e) => {
          const n = links.length;
          const k = e.key;
          const to = k === "ArrowDown" || k === "ArrowRight" ? (at + 1) % n : k === "ArrowUp" || k === "ArrowLeft" ? (at - 1 + n) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
          if (to < 0) return;
          e.preventDefault();
          links[to].focus();
        });
        const io = new IntersectionObserver(
          ([e]) => {
            if (!e.isIntersecting) return;
            io.disconnect();
            for (const t of ts) {
              const cv = ul.querySelector<HTMLCanvasElement>(`[data-thumb="${t.id}"]`);
              if (cv) thumb(cv, t).catch(() => {});
            }
          },
          { rootMargin: "600px 0px" },
        );
        io.observe(ul);
      }

      const list = el.querySelector<HTMLElement>(".places")!;
      const choose = (i: number) => {
        const p = places[i];
        if (!p) return;
        spot = i;
        list.querySelectorAll<HTMLButtonElement>("button").forEach((x, n) => {
          x.setAttribute("aria-pressed", String(n === i));
          x.tabIndex = n === i ? 0 : -1;
        });
        intro?.place(p, p.country ? `${p.name}, ${p.country}` : p.name);
      };
      list.addEventListener("click", (e) => {
        const x = (e.target as Element).closest<HTMLButtonElement>("button[data-i]");
        if (x) choose(Number(x.dataset.i));
      });
      list.addEventListener("keydown", (e) => {
        const bs = [...list.querySelectorAll<HTMLButtonElement>("button")];
        const k = e.key;
        const to = k === "ArrowDown" ? (spot + 1) % bs.length : k === "ArrowUp" ? (spot - 1 + bs.length) % bs.length : -1;
        if (to < 0) return;
        e.preventDefault();
        bs[to].focus();
        choose(to);
      });

      let known: LabelPoint[] = [];
      void ctx.labels().then((ls) => {
        known = ls.filter((l) => l.kind === "known_analog");
        el.querySelector("#count-known")!.textContent = known.length ? num(known.length) : "no data";
        intro?.known(known);
        places = KNOWN.map((n) => known.find((l) => l.name === n)).filter((l): l is LabelPoint => !!l);
        list.innerHTML = places.length
          ? places
              .map(
                (p, i) =>
                  `<li><button type="button" data-i="${i}" aria-pressed="${i === 0}" tabindex="${i ? -1 : 0}"><span class="place-n">${esc(p.name)}</span>${
                    p.country ? `<span class="place-c">${esc(p.country)}</span>` : ""
                  }</button></li>`,
              )
              .join("")
          : `<li class="muted">No data: the known analog list could not be loaded.</li>`;
        choose(0);
      });

      const weak = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
      if (!webgl() || weak) return;
      import("../intro")
        .then(({ createIntro }) => {
          const view = el.querySelector<HTMLElement>("#intro-view")!;
          const img = (f: string) => `${import.meta.env.BASE_URL}${f.startsWith("img/") ? f : `img/${f}`}`;
          const spot0 = (b: Body) => picked[b] ?? { lat: 0, lon: 0 };
          intro = createIntro(
            view,
            {
              earth: innerWidth >= 900 ? [img("blue-marble-4k.jpg"), img("blue-marble-8k.jpg")] : [img("blue-marble.jpg"), img("blue-marble-4k.jpg")],
              moon: [img(TEXTURE.moon), img(SHARP.moon)],
              mars: [img(TEXTURE.mars), img(SHARP.mars)],
            },
            { moon: spot0("moon"), mars: spot0("mars") },
            { world: (w) => reveal(`ch-${w}`, true) },
          );
          view.classList.add("live");
          for (const b of ["moon", "mars"] as const) {
            intro.sites(b, sitesOf(m, b));
            const t = picked[b];
            if (t) intro.target(b, t);
          }
          intro.known(known);
          if (places.length) choose(spot);
          place();
        })
        .catch(() => {});
    },
    show() {
      requestAnimationFrame(place);
      const t = home(m, "moon");
      if (counted || !t) return;
      counted = true;
      void ctx
        .cols(t)
        .then((cols) => {
          const s = cols[`score:${m.filters[0].id}`];
          el.querySelector("#count-ranked")!.textContent = s ? num(rankedOf(s)) : "no data";
        })
        .catch(() => {
          counted = false;
        });
    },
  };
}

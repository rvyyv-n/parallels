import type { Body, LabelPoint, Manifest, Target } from "../contract";
import type { Cols } from "../data";
import { esc, fmtSup, latlon, num, targetName, webgl } from "../format";
import { icon } from "../icons";
import type { Intro } from "../intro";
import { logo } from "../logo";
import { go, reveal, type Page } from "../router";
import { tourButton } from "../tour";
import { headline, NAME, SHARP, TEXTURE, thumb, TITLE } from "../worlds";
import { home, rankedOf, type Ctx } from "./ctx";

const CHAPTERS = [
  { id: "ch-hero", name: "Start" },
  { id: "ch-count", name: "All land on Earth" },
  { id: "ch-moon", name: "The Moon" },
  { id: "ch-mars", name: "Mars" },
  { id: "ch-known", name: "Known analog places" },
  { id: "ch-go", name: "Open the Finder" },
];

const LEDE: Record<Body, string> = { moon: "Select a Moon base site to see the places on Earth that match it.", mars: "Select a Mars base site to see the places on Earth that match it." };

const KNOWN = ["Haughton crater, Devon Island", "Yungay, Atacama", "McMurdo Dry Valleys", "Mauna Kea", "Rio Tinto", "Black Point lava flow"];

const next = (id: string, label: string) =>
  `<a class="chap-next" href="#${id}"><span>${label}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v11M3 8.5 8 13l5-4.5" fill="none" stroke="currentColor" stroke-width="2"/></svg></a>`;

const sitesOf = (m: Manifest, b: Body) => {
  const ts = m.targets.filter((t) => t.body === b);
  const i = ts.findIndex((t) => t.default);
  return i > 0 ? [ts[i], ...ts.slice(0, i), ...ts.slice(i + 1)] : ts;
};

const site = (t: Target, i: number) =>
  `<li><a class="site" href="#/find?t=${esc(t.id)}" data-site="${esc(t.id)}" tabindex="${i ? -1 : 0}"${i ? "" : ' aria-current="true"'}><span class="site-frame" aria-hidden="true"><canvas class="site-thumb" width="128" height="128" data-thumb="${esc(
    t.id,
  )}" aria-hidden="true"></canvas></span><span class="site-n">${esc(targetName(t.name))}</span><span class="site-at">${latlon(t.lat, t.lon, 1)}</span><span class="site-go" aria-hidden="true">${icon("chevron")}</span></a></li>`;

function placeCaption(p: LabelPoint): string {
  const raw = (p.note ?? "")
    .replace(/^(?:Analog for:[^.]*\.\s*)?/i, "")
    .replace(/^Used for:[^.]*\.\s*/i, "")
    .trim();
  if (!raw) return "";
  const m = raw.match(/^.+?[.!?](?=\s|$)/);
  return m ? m[0] : raw;
}

function findCell(cells: Cols | null, lat: number, lon: number): number {
  if (!cells?.lat || !cells?.lon) return -1;
  const r = Math.floor((90 - lat) / 0.5);
  const c = Math.floor((lon + 180) / 0.5);
  const n = cells.lat.length;
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < n; i++) {
    const la = cells.lat[i];
    const lo = cells.lon[i];
    if (Math.floor((90 - la) / 0.5) === r && Math.floor((lo + 180) / 0.5) === c) return i;
    const dLat = Math.abs(la - lat);
    const dLon = Math.abs(lo - lon);
    if (dLat <= 0.5 && dLon <= 0.5) {
      const d2 = dLat * dLat + dLon * dLon;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
  }
  return best;
}

function defaultTargetFor(m: Manifest, p: LabelPoint): Target {
  const first = p.groups?.[0] ?? "";
  const body: Body = first.startsWith("moon-") ? "moon" : first.startsWith("mars-") ? "mars" : p.groups?.some((g) => g.startsWith("mars-")) ? "mars" : "moon";
  return home(m, body) ?? m.targets[0];
}

function cant(m: Manifest, b: Body) {
  const src = [...new Map(m.cant_copy.map((c) => [c.source, c.url])).entries()];
  return `<div class="cant"><p class="cant-k">${icon("cant")}Earth cannot copy</p><dl>${m.cant_copy
    .map((c) => `<div title="${esc(`${c[b]} (${c.source})`)}"><dt>${esc(c.name.replace(/ on the surface$/, ""))}</dt><dd>${fmtSup(headline(c[b])[0])}</dd></div>`)
    .join("")}</dl><p class="cant-src">Sources: ${src.map(([s, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s)}</a>`).join(" · ")}</p></div>`;
}

const world = (m: Manifest, b: Body, n: number) => `<section class="chap chap-world" id="ch-${b}" data-chap="${n}" aria-labelledby="${b}-h">
    <div class="copy">
      <h2 id="${b}-h"${b === "mars" ? ' class="w-mars"' : ""}>${TITLE[b]}</h2>
      <p class="sites-lede">${LEDE[b]}</p>
      <ul class="sites" data-world="${b}" aria-label="Base sites on ${NAME[b]}" aria-describedby="${b}-keys">${sitesOf(m, b).map(site).join("")}</ul>
      <p class="sites-keys" id="${b}-keys">Use the arrow keys to move between the sites. Push Enter to open the matches on Earth in the Finder.</p>
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
        <h1 id="intro-h" tabindex="-1">No place on Earth is the same as <span class="w-moon">the Moon</span> or <span class="w-mars">Mars</span>.</h1>
        <p class="intro-lede">But each patch of land is similar to them in some ways. Parallels finds the places on Earth that are most similar to each part of a permanent Moon or Mars base.</p>
        <div class="hero-go">${next("ch-count", "Scroll down to start")}<button type="button" class="tour-btn" id="tour-home"><i aria-hidden="true"></i>Guided tour</button></div>
      </div>
    </section>
    <section class="chap chap-count" id="ch-count" data-chap="1" aria-labelledby="count-h">
      <div class="copy">
        <p class="intro-k">All land on Earth</p>
        <h2 id="count-h">We give a score to each patch of land, not only to the famous places.</h2>
        <dl class="counts">
          <div><dt>${num(m.grid.n)}</dt><dd>patches of land, each approximately 50 km wide</dd></div>
          <div><dt id="count-ranked">—</dt><dd>patches with a rank for the ${esc(targetName((home(m, "moon")?.short ?? "").replace(/\s*\(.*\)$/, "")))}</dd></div>
          <div><dt id="count-known">—</dt><dd>known analog places, shown in amber</dd></div>
        </dl>
        ${next("ch-moon", "The Moon")}
      </div>
    </section>
    ${world(m, "moon", 2)}
    ${world(m, "mars", 3)}
    <section class="chap chap-known" id="ch-known" data-chap="4" aria-labelledby="known-h">
      <div class="copy">
        <h2 id="known-h">Crews already train on Earth for the Moon and Mars.</h2>
        <p class="intro-lede">Crews practised Moon and Mars work at these places. Hover to locate one on the globe, or select it to inspect its Earth match.</p>
        <ul class="places" aria-label="Known analog places"></ul>
        <div class="place-note" id="place-note" aria-live="polite"></div>
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
  let visible = false;
  const picked: Record<Body, Target | undefined> = { moon: home(m, "moon"), mars: home(m, "mars") };
  let places: LabelPoint[] = [];
  let spot = 0;
  return {
    title: () => "",
    mount(root) {
      el = root;
      el.innerHTML = html(m);
      tourButton(el.querySelector<HTMLElement>("#tour-home")!, "home");
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
      const noteEl = el.querySelector<HTMLElement>("#place-note");
      const defaultFilterId = (m.filters.find((f) => f.id === "balanced") ?? m.filters[0]).id;
      let gridCells: Cols | null = null;
      let cellsReq: Promise<Cols | null> | null = null;

      const hrefFor = (p: LabelPoint) => {
        const tgt = defaultTargetFor(m, p);
        const cell = findCell(gridCells, p.lat, p.lon);
        return cell >= 0
          ? `#/place?t=${encodeURIComponent(tgt.id)}&f=${encodeURIComponent(defaultFilterId)}&known=1&c=${cell}`
          : `#/find?t=${encodeURIComponent(tgt.id)}&known=1`;
      };

      const syncPlaceHrefs = () => {
        list.querySelectorAll<HTMLAnchorElement>("a.place-link").forEach((a, i) => {
          if (places[i]) a.href = hrefFor(places[i]);
        });
        const openLink = noteEl?.querySelector<HTMLAnchorElement>(".place-open");
        if (openLink && places[spot]) openLink.href = hrefFor(places[spot]);
      };

      const ensureCells = () => {
        if (gridCells) return Promise.resolve(gridCells);
        if (!cellsReq) {
          cellsReq = ctx
            .data()
            .then((d) => {
              gridCells = d.cells;
              syncPlaceHrefs();
              return gridCells;
            })
            .catch(() => {
              cellsReq = null;
              return null;
            });
        }
        return cellsReq;
      };

      const knownSec = el.querySelector<HTMLElement>("#ch-known");
      if (knownSec) {
        const knownIo = new IntersectionObserver(
          ([entry]) => {
            if (!entry.isIntersecting) return;
            knownIo.disconnect();
            void ensureCells();
          },
          { rootMargin: "450px 0px" },
        );
        knownIo.observe(knownSec);
      }

      const choose = (i: number) => {
        const p = places[i];
        if (!p) return;
        spot = i;
        list.querySelectorAll<HTMLAnchorElement>("a.place-link").forEach((x, n) => {
          if (n === i) x.setAttribute("aria-current", "true");
          else x.removeAttribute("aria-current");
          x.tabIndex = n === i ? 0 : -1;
        });
        if (noteEl) {
          const sentence = placeCaption(p);
          const url = p.analog_source ?? p.source;
          const tgt = defaultTargetFor(m, p);
          noteEl.innerHTML = sentence
            ? `<p style="margin:0">${esc(sentence)}</p><div class="place-note-links"><a class="place-open" href="${esc(hrefFor(p))}">Inspect match vs ${esc(
                targetName(tgt.short),
              )} <span aria-hidden="true">→</span></a>${url ? `<a class="place-src" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source</a>` : ""}</div>`
            : "";
        }
        intro?.place(p, p.country ? `${p.name}, ${p.country}` : p.name);
      };

      list.addEventListener("pointerenter", (e) => {
        const x = (e.target as Element).closest<HTMLAnchorElement>("a.place-link[data-i]");
        if (x) {
          void ensureCells();
          choose(Number(x.dataset.i));
        }
      }, true);
      list.addEventListener("focusin", (e) => {
        const x = (e.target as Element).closest<HTMLAnchorElement>("a.place-link[data-i]");
        if (x) {
          void ensureCells();
          choose(Number(x.dataset.i));
        }
      });
      list.addEventListener("click", (e) => {
        const x = (e.target as Element).closest<HTMLAnchorElement>("a.place-link[data-i]");
        if (!x || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const idx = Number(x.dataset.i);
        const p = places[idx];
        if (!p) return;
        choose(idx);
        if (!gridCells) {
          e.preventDefault();
          void Promise.race([ensureCells(), new Promise<null>((res) => setTimeout(() => res(null), 1800))]).then(() => {
            go(hrefFor(p));
          });
        }
      });
      list.addEventListener("keydown", (e) => {
        const as = [...list.querySelectorAll<HTMLAnchorElement>("a.place-link")];
        if (!as.length) return;
        const k = e.key;
        const to =
          k === "ArrowDown" || k === "ArrowRight"
            ? (spot + 1) % as.length
            : k === "ArrowUp" || k === "ArrowLeft"
              ? (spot - 1 + as.length) % as.length
              : k === "Home"
                ? 0
                : k === "End"
                  ? as.length - 1
                  : -1;
        if (to < 0) return;
        e.preventDefault();
        as[to].focus();
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
                  `<li><a class="place-link" href="${esc(hrefFor(p))}" data-i="${i}" tabindex="${i ? -1 : 0}"${
                    i ? "" : ' aria-current="true"'
                  }><i class="place-dot" aria-hidden="true"></i><span class="place-txt"><span class="place-n">${esc(p.name)}</span>${
                    p.country ? `<span class="place-c">${esc(p.country)}</span>` : ""
                  }</span><span class="place-go" aria-hidden="true">${icon("chevron")}</span></a></li>`,
              )
              .join("")
          : `<li class="muted">No data: the list of known analog places did not load.</li>`;
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
          if (!visible || el.hidden) intro.pause();
          else place();
        })
        .catch(() => {});
    },
    show() {
      visible = true;
      intro?.resume();
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
    hide() {
      visible = false;
      intro?.pause();
    },
  };
}

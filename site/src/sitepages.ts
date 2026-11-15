import type { Body, LabelPoint, Manifest, Target } from "./contract";
import { esc, latlon, webgl } from "./format";
import { icon } from "./icons";
import type { Planet } from "./planet";
import { fillAnalogs, NAME, SHARP, siteHtml, solveHtml, TEXTURE, thumb, TITLE } from "./worlds";

export interface SiteHooks {
  m: Manifest;
  body: Body;
  labels(): Promise<LabelPoint[]>;
  pick(id: string): void;
}

export interface SitePage {
  pause(on: boolean): void;
}

const LEDE: Record<Body, string> = { moon: "Choose a lunar site to see how Earth compares", mars: "Choose a Mars site to see how Earth compares" };
const FLAT: Record<Body, number> = { moon: 0xd3d0c8, mars: 0xfc734d };

const targets = (m: Manifest, b: Body) => {
  const ts = m.targets.filter((t) => t.body === b);
  const i = ts.findIndex((t) => t.default);
  return i > 0 ? [ts[i], ...ts.slice(0, i), ...ts.slice(i + 1)] : ts;
};

const item = (t: Target, i: number) =>
  `<li><a class="chip site" href="#/find?t=${esc(t.id)}" data-site="${esc(t.id)}" data-i="${i}" tabindex="${i ? -1 : 0}"${i ? "" : ' aria-current="true"'}><canvas class="site-thumb" width="128" height="128" data-thumb="${esc(
    t.id,
  )}" aria-hidden="true"></canvas><span class="site-n">${esc(t.name)}</span><span class="site-at">${latlon(t.lat, t.lon, 1)}${
    t.regions?.length ? ` · ${t.regions.length} candidate regions` : ""
  }</span></a></li>`;

export function sitePage(m: Manifest, b: Body): string {
  const ts = targets(m, b);
  return `<section class="sp sp-${b}" aria-labelledby="${b}-h">
    <div class="sp-stage" aria-hidden="true"><div class="sp-planet" data-planet><div class="w-disc w-disc-${b}"></div></div></div>
    <div class="sp-main">
      <h1 id="${b}-h" tabindex="-1">${TITLE[b]}</h1>
      <p class="sp-lede">${LEDE[b]}</p>
      <ul class="sp-list" aria-label="Base sites on ${NAME[b]}" aria-describedby="${b}-keys">${ts.map(item).join("")}</ul>
      <p class="sp-keys" id="${b}-keys">Use the arrow keys to move through the sites, and Enter to find Earth's matches.</p>
      <div class="w-panel" id="w-${b}" data-world="${b}">
        <section class="w-site" aria-live="polite">${ts[0] ? siteHtml(m, ts[0]) : ""}</section>
        <section class="w-solve"><h2>${icon("test")}What a base on ${NAME[b]} must solve</h2><ul>${solveHtml(m, b)}</ul></section>
        <section class="w-tested"><h2>${icon("pin")}Where crews already rehearse on Earth</h2>
          <p class="w-sub">Places already used to rehearse for ${NAME[b]}. Parallels checks its scores against them, then looks at all the land nobody uses yet.</p>
          <div class="w-analogs" data-analogs="${b}"><p class="muted">Loading the known analog sites…</p></div>
        </section>
      </div>
    </div>
  </section>`;
}

export function wireSitePage(el: HTMLElement, hooks: SiteHooks): SitePage {
  const { m, body } = hooks;
  const ts = targets(m, body);
  const links = [...el.querySelectorAll<HTMLAnchorElement>(".sp-list a.site")];
  const panel = el.querySelector<HTMLElement>(".w-site")!;
  let planet: Planet | null = null;
  let paused = false;
  let at = 0;

  for (const t of ts) {
    const cv = el.querySelector<HTMLCanvasElement>(`[data-thumb="${t.id}"]`);
    if (cv) thumb(cv, t).catch(() => {});
  }
  void hooks.labels().then((ls) => fillAnalogs(el, ls));

  const select = (i: number) => {
    if (i === at || !ts[i]) return;
    at = i;
    links.forEach((a, n) => {
      a.tabIndex = n === i ? 0 : -1;
      if (n === i) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    panel.innerHTML = siteHtml(m, ts[i]);
    planet?.focus(i);
  };

  links.forEach((a, i) => {
    a.addEventListener("pointerenter", () => select(i));
    a.addEventListener("focus", () => select(i));
    a.addEventListener("click", (e) => {
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      hooks.pick(ts[i].id);
    });
  });
  el.querySelector(".sp-list")!.addEventListener("keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    const n = links.length;
    const to = k === "ArrowDown" || k === "ArrowRight" ? (at + 1) % n : k === "ArrowUp" || k === "ArrowLeft" ? (at - 1 + n) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    links[to].focus();
    select(to);
  });

  const weak = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
  if (webgl() && !weak)
    import("./planet")
      .then(({ createPlanet }) => {
        const view = el.querySelector<HTMLElement>("[data-planet]")!;
        const img = (f: string) => `${import.meta.env.BASE_URL}${f}`;
        planet = createPlanet(view, [img(TEXTURE[body]), img(SHARP[body])], FLAT[body]);
        planet.sites(ts);
        planet.focus(at);
        planet.pause(paused);
        view.classList.add("live");
      })
      .catch(() => {});

  return {
    pause(on) {
      paused = on;
      planet?.pause(on);
    },
  };
}

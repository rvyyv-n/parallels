import { card, placeName, terrainOf, wireCard } from "../card";
import { esc, score100 } from "../format";
import { icon } from "../icons";
import { spread } from "../rank";
import { rankOf } from "../score";
import { go, type Page } from "../router";
import { filterOf, query, rankedOf, readState, scoreOf, targetOf, weightsOf, type Ctx } from "./ctx";

export function place(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let applied = "";
  let name = "";
  let seen: IntersectionObserver | null = null;

  const step = (a: HTMLAnchorElement, href: string | null, label: string) => {
    if (href) {
      a.href = href;
      a.removeAttribute("aria-disabled");
    } else {
      a.removeAttribute("href");
      a.setAttribute("aria-disabled", "true");
    }
    a.setAttribute("aria-label", label);
    a.title = label;
  };

  return {
    title: () => name || "A match on Earth",
    mount(root) {
      el = root;
      el.innerHTML = `<section class="place" id="match">
        <nav class="pl-bar" id="pl-bar" aria-label="This place">
          <a class="pl-back" id="back-find" href="#/find">${icon("chevron")}<span><span class="long">Back to the </span>Finder</span></a>
          <p class="pl-bar-name" aria-hidden="true"><span id="bar-name"></span><b id="bar-score"></b></p>
          <div class="pl-step">
            <a class="pl-st prev" id="pl-prev" aria-disabled="true">${icon("chevron")}<span class="long">Previous</span></a>
            <span class="pl-pos" id="pl-pos"></span>
            <a class="pl-st next" id="pl-next" aria-disabled="true"><span class="long">Next</span>${icon("chevron")}</a>
          </div>
        </nav>
        <div class="card-wrap" id="card"><h1 class="pl-loading" id="place-h" tabindex="-1">A match on Earth</h1></div>
      </section>`;
    },
    async show(q) {
      const s = readState(m, q);
      if (s.cell < 0) {
        go(`#/find?${query(s)}`, true);
        return;
      }
      const key = query(s);
      const t = targetOf(m, s);
      const f = filterOf(m, s);
      ctx.site(t);
      el.querySelector<HTMLAnchorElement>("#back-find")!.href = `#/find?${key}`;
      if (key === applied) return;
      applied = key;
      name = "";
      const box = el.querySelector<HTMLElement>("#card")!;
      const bar = el.querySelector<HTMLElement>("#pl-bar")!;
      try {
        const [d, cols, ranges] = await Promise.all([ctx.data(), ctx.cols(t), ctx.ranges()]);
        if (applied !== key) return;
        const score = scoreOf(m, cols, s, d.n);
        const terr = terrainOf(d.cells);
        const { ids } = spread(m, score, d.cells, (i) => s.type == null || terr?.[i] === s.type, s.known);
        const at = ids.indexOf(s.cell);
        const href = (i: number | undefined) => (i == null ? null : `#/place?${query({ ...s, cmp: [] }, i)}`);
        const nameOf = (i: number | undefined) => (i == null ? "" : placeName(m, d.cells, i));
        const prev = at > 0 ? ids[at - 1] : undefined;
        const next = at < 0 ? ids[0] : ids[at + 1];
        step(el.querySelector("#pl-prev")!, href(prev), prev == null ? "No previous place" : `Previous place: ${nameOf(prev)}`);
        step(el.querySelector("#pl-next")!, href(next), next == null ? "No next place" : `${at < 0 ? "First place in the top list" : "Next place"}: ${nameOf(next)}`);
        el.querySelector("#pl-pos")!.innerHTML =
          at < 0
            ? `<span class="sr">This place is </span><span class="long">not in the top ${ids.length}</span><span class="short" aria-hidden="true">–/${ids.length}</span>`
            : `<span class="long">${at + 1} of ${ids.length}</span><span class="short" aria-hidden="true">${at + 1}/${ids.length}</span><span class="sr"> in the Finder's top list</span>`;
        const focused = document.activeElement?.id === "place-h" || document.activeElement === document.body;
        box.innerHTML = card({
          m,
          body: t.body,
          target: t,
          cells: d.cells,
          t: cols,
          i: s.cell,
          score,
          place: rankOf(score, s.cell),
          ranked: rankedOf(score),
          weights: weightsOf(m, s),
          weightsName: s.hand ? "Your own weights" : f.name,
          plain: s.hand ? "you set the weight of each challenge." : f.plain,
          yr: s.yr && !s.hand,
          ranges,
        });
        wireCard(box);
        name = placeName(m, d.cells, s.cell);
        el.querySelector("#bar-name")!.textContent = name;
        el.querySelector("#bar-score")!.innerHTML = Number.isFinite(score[s.cell]) ? `${score100(score[s.cell])} <small>/ 100</small>` : "";
        const h = box.querySelector<HTMLElement>("#place-h")!;
        if (focused) h.focus({ preventScroll: true });
        seen?.disconnect();
        seen = new IntersectionObserver(([e]) => bar.classList.toggle("stuck", !e.isIntersecting && e.boundingClientRect.top < 200), { rootMargin: "-120px 0px 0px 0px" });
        seen.observe(h);
      } catch (e) {
        applied = "";
        box.innerHTML = `<h1 class="pl-loading" id="place-h" tabindex="-1">A match on Earth</h1><p class="pad" role="alert">The data files did not load (${esc((e as Error).message)}). Make sure that you are online, then reload the page.</p>`;
      }
    },
  };
}

import { BODY, card, placeName, wireCard } from "../card";
import { esc, latlon } from "../format";
import { rankOf } from "../score";
import { go, type Page } from "../router";
import { filterOf, query, rankedOf, readState, scoreOf, targetOf, weightsOf, type Ctx } from "./ctx";

export function place(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let applied = "";
  let name = "";
  return {
    title: () => name || "A match on Earth",
    mount(root) {
      el = root;
      el.innerHTML = `<section class="place match" id="match" aria-labelledby="place-h">
        <div class="match-head">
          <p class="back-find"><a id="back-find" href="#/find">Back to the Finder</a></p>
          <h1 class="tcap" id="place-h" tabindex="-1">A match on Earth</h1>
          <details class="ask-note"><summary>About this filter and target</summary><p class="ask-sub" id="ask-sub"></p></details>
        </div>
        <div class="card-wrap" id="card" tabindex="-1" aria-live="polite"></div>
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
      el.querySelector("#place-h")!.innerHTML = `<span class="tc-body">${BODY[t.body]}</span><span class="tc-k">A match on Earth for</span><b>${esc(t.name)}</b><span>${latlon(t.lat, t.lon, 2)}</span>${
        t.regions?.length ? `<span class="muted">+ ${t.regions.length} candidate regions</span>` : ""
      }`;
      el.querySelector("#ask-sub")!.innerHTML = `<b>${esc(s.hand ? "Your own weights" : f.name)}:</b> ${esc(s.hand ? "you set how much each challenge counts." : f.plain)} <span class="muted">${esc(t.name)}: ${esc(t.anchor_note)}</span>`;
      const box = el.querySelector<HTMLElement>("#card")!;
      box.innerHTML = `<p class="muted pad" role="status">Loading this place…</p>`;
      try {
        const [d, cols, ranges] = await Promise.all([ctx.data(), ctx.cols(t), ctx.ranges()]);
        if (applied !== key) return;
        const score = scoreOf(m, cols, s, d.n);
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
          yr: s.yr && !s.hand,
          ranges,
        });
        wireCard(box);
        name = placeName(m, d.cells, s.cell);
      } catch (e) {
        applied = "";
        box.innerHTML = `<p class="pad" role="alert">The data files could not be loaded (${esc((e as Error).message)}). Please check your connection and reload the page.</p>`;
      }
    },
  };
}

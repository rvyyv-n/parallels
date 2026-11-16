import "./card.css";
import { compareHtml, wireCompare } from "./compare";
import type { Challenge, Manifest, TargetValue, Trait } from "./contract";
import type { Cols } from "./data";
import { MONTHS, bits, esc, latlon, monthList, num, score100, unit } from "./format";
import { icon } from "./icons";
import { BANDS, bandOf, isNew, shortName } from "./rank";
import { coverage } from "./score";
import { BODY, breakRows, ds, row, same, scoreChip, scoredRows, short, traitHtml, val, type Row, type TraitInput } from "./traits";

export { BODY };

export interface CardInput extends TraitInput {
  score: Float32Array;
  place: number;
  ranked: number;
  weightsName: string;
  plain: string;
  yr: boolean;
}

export const terrainOf = (c: Cols) => c.terrain_type ?? c.terrain;

export const isIce = (c: Cols, i: number) => (c.ice?.[i] ?? 0) >= 50;

export function placeName(m: Manifest, c: Cols, i: number): string {
  const r = c.region?.[i];
  return (Number.isFinite(r) && m.regions[r]) || latlon(c.lat[i], c.lon[i], 2);
}

const chScore = (x: CardInput, c: Challenge) => x.t[`ch:${c.id}`]?.[x.i] ?? NaN;

const words = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

export function verdict(x: CardInput, chs: Challenge[]) {
  const sc = chs
    .filter((c) => x.weights[c.id] > 0)
    .map((c) => ({ c, v: chScore(x, c) }))
    .filter((o) => Number.isFinite(o.v))
    .sort((a, b) => b.v - a.v);
  if (!sc.length) return "Too little data here to judge this match.";
  const nm = (o: (typeof sc)[number]) => shortName(o.c.id, o.c.name).toLowerCase();
  const good = sc.filter((o) => o.v >= 0.75).slice(0, 2);
  const bad = sc.filter((o) => o.v < 0.5).reverse().slice(0, 2);
  const a = good.length ? `${good.every((o) => o.v >= 0.9) ? "Very close" : "Close"} on ${words(good.map(nm))}` : `Nothing close; best on ${nm(sc[0])}`;
  const b = bad.length ? `far off on ${words(bad.map(nm))}` : "nothing far off";
  return `${a}; ${b}.`;
}

function plainWhy(m: Manifest, why: string) {
  let s = why.replace(/closer than 0% of land/g, "farther from the target than almost all land");
  for (const tr of m.traits) {
    if (tr.scored_by !== "ideal") continue;
    const re = new RegExp(`(${tr.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [^;()]*? against )`, "g");
    s = s.replace(re, "$1ideal: ");
  }
  return s;
}

function topShare(place: number, ranked: number) {
  const p = (place / ranked) * 100;
  return p < 1 ? `${num(Math.max(0.1, Math.ceil(p * 10) / 10), 1)}%` : `${num(Math.ceil(p))}%`;
}

function pv(x: CardInput, r: Row, why: string) {
  const tv = r.tv!.value!;
  const ideal = r.tr.scored_by === "ideal";
  const src = `Earth: ${esc(short(x.m, r.tr.earth_dataset))}${ideal ? "" : ` · ${esc(BODY[x.body])}: ${esc(short(x.m, r.tv!.dataset))}`}`;
  return `<li class="pv">
    <div class="pv-top"><span class="pv-name">${esc(r.tr.label)}</span>${scoreChip(r.rank, r.tr.label)}</div>
    <p class="pv-vals"><span class="pv-here"><b>${val(r.tr, r.ev)}</b> here</span><span class="pv-there"><b>${val(r.tr, tv)}</b> ${ideal ? "ideal" : esc(BODY[x.body])}</span></p>
    ${why ? `<p class="pv-why">${why}</p>` : ""}
    <p class="pv-src">${src}</p>
  </li>`;
}

function matches(x: CardInput, chs: Challenge[]) {
  const top = scoredRows(x, chs)
    .filter((r) => Number.isFinite(r.rank) && r.rank >= 0.5)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 4);
  return top.length ? `<ul class="pvs">${top.map((r) => pv(x, r, "")).join("")}</ul>` : `<p class="muted">No scored trait is close at this place.</p>`;
}

function breaks(x: CardInput, chs: Challenge[]) {
  const out = breakRows(x, chs).filter(({ r }) => !same(r) || r.tr.scored_by === "presence");
  const body = BODY[x.body];
  const cant = `<p class="pv-cant">${icon("cant")}<span>And everywhere on Earth: ${body === "Moon" ? "the Moon's" : "Mars's"} ${esc(words(x.m.cant_copy.map((c) => c.name.toLowerCase())))}. <a href="#c-cant">See below</a>.</span></p>`;
  if (!out.length) return `<p class="muted">No scored trait is in the weaker half of the land on Earth or outside Earth's range.</p>${cant}`;
  const head = out.slice(0, 4);
  const rest = out.slice(4);
  return `<ul class="pvs">${head.map(({ r, why }) => pv(x, r, why)).join("")}</ul>${
    rest.length ? `<details class="pv-more"><summary>${rest.length} more ${rest.length === 1 ? "trait" : "traits"}${icon("chevron", "chev")}</summary><ul class="pvs">${rest.map(({ r, why }) => pv(x, r, why)).join("")}</ul></details>` : ""
  }${cant}`;
}

function chTile(x: CardInput, c: Challenge, open: boolean) {
  const v = chScore(x, c);
  const w = x.weights[c.id] ?? 0;
  const rows = c.traits.map((tw) => row(x, tw.id)).filter((r): r is Row => !!r);
  const cov = coverage(x.t[`cov:${c.id}`], v, x.i);
  const state = !c.traits.length ? "not scored" : cov <= 0 ? "no data here" : cov < 1 ? "some data missing" : "";
  const b = bandOf(v);
  return `<li class="ch${w > 0 ? "" : " off"}">
    <details${open ? " open" : ""}>
      <summary>
        <span class="ch-ic">${icon(c.id)}</span>
        <span class="ch-id"><span class="ch-name">${esc(c.name)}${c.only ? ` <span class="tag">${esc(c.only)}</span>` : ""}</span>
        <span class="ch-w">${w > 0 ? `Weight ${num(w, w % 1 ? 1 : 0)}` : "Not in this preset"}${state && state !== "not scored" ? ` · <span class="st">${state}</span>` : ""}</span></span>
        <span class="ch-bar" aria-hidden="true"><i class="${b ? b.cls : ""}" style="width:${b ? (v * 100).toFixed(1) : 0}%"></i></span>
        <span class="ch-n" data-band="${b ? b.cls : "b-na"}">${b ? `<b>${score100(v)}</b> / 100<em>${b.word}</em>` : `<em>${!c.traits.length ? "not scored" : "no data"}</em>`}</span>
        ${icon("chevron", "chev")}
      </summary>
      <div class="ch-body">
        <p class="ch-q">${esc(c.question)}</p>
        ${rows.length ? `<ul class="traits">${rows.map((r) => traitHtml(x, r, c.traits.find((t) => t.id === r.tr.id)?.why ?? "")).join("")}</ul>` : `<p class="muted">No scored traits. Its labels are under "Shown, but not scored".</p>`}
        <p class="ch-test">${icon("test")}<span><b>Test here:</b> ${esc(c.what_to_test)}</span></p>
      </div>
    </details>
  </li>`;
}

function seasons(x: CardInput) {
  const c = x.cells;
  const best = c.m_best?.[x.i];
  const frz = c.m_freeze?.[x.i];
  const rain = c.m_rain?.[x.i];
  const usable = c.usable?.[x.i];
  if (![best, frz, rain].some(Number.isFinite)) return `<p class="muted">No monthly climate data for this place.</p>`;
  const line = (name: string, mask: number, cls: string) =>
    `<tr><th scope="row">${name}</th>${bits(mask)
      .map((on, k) => `<td class="${on ? cls : ""}"><span class="sr">${MONTHS[k]} ${on ? "yes" : "no"}</span></td>`)
      .join("")}</tr>`;
  return `<p class="se-k"><b>${Number.isFinite(usable) ? num(usable) : "no data"}</b> of 12 months usable <span class="muted">· ${esc(short(x.m, "power_merra2"))}</span></p>
    <div class="scroll-x"><table class="months">
      <thead><tr><td></td>${MONTHS.map((mm) => `<th scope="col">${mm}</th>`).join("")}</tr></thead>
      <tbody>${line("Best", best, "on-best")}${line("Freeze–thaw", frz, "on-frz")}${line("Rainy", rain, "on-rain")}</tbody>
    </table></div>
    <dl class="se-list"><div><dt>Best</dt><dd>${monthList(best)}</dd></div><div><dt>Freeze–thaw</dt><dd>${monthList(frz)}</dd></div><div><dt>Rainy</dt><dd>${monthList(rain)}</dd></div></dl>
    ${x.yr ? `<p class="se-yr">${icon("info")}<span><b>Year-round testing is on.</b> ${esc(x.m.scoring.yearround_rule)}</span></p>` : ""}`;
}

const CANT_ICON = (name: string) => (/grav/i.test(name) ? "gravity" : /radiat/i.test(name) ? "radiation" : /air|atmos|pressure/i.test(name) ? "air" : "cant");

function cantCopy(x: CardInput) {
  const body = BODY[x.body];
  const rows = x.m.cant_copy
    .map(
      (c) =>
        `<tr><th scope="row">${icon(CANT_ICON(c.name))}<span>${esc(c.name)}</span></th><td><span class="cc-k">Earth</span>${esc(c.earth)}</td><td class="cc-there"><span class="cc-k">${body}</span>${esc(c[x.body])}</td><td class="cc-src"><span class="cc-k">Source</span><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)}</a></td></tr>`,
    )
    .join("");
  return `<p class="pl-sub">True for every place on Earth, at every score.</p>
    <table class="data cant"><thead><tr><th scope="col"><span class="sr">Condition</span></th><th scope="col">Earth</th><th scope="col">${body}</th><th scope="col">Source</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const SHOWN: Record<string, string> = {
  t_min_k: "Winter minimum temperature",
  t_max_k: "Summer maximum temperature",
  t_min_coldest_k: "Coldest spot, winter minimum",
  ground_strength_note: "Ground strength",
};

const atLimit = (key: string, v: number | null) => v != null && ((key.endsWith("_k") && v < 25) || (key === "cold" && v < 25 - 273.15));

function shownText(x: CardInput, key: string, v: TargetValue) {
  const tr = x.m.traits.find((t) => t.id === key);
  if (v.value == null) return "no value";
  if (key.endsWith("_share")) return `${num(v.value * 100, 0)}%`;
  if (key.endsWith("_k")) return `${num(v.value, 1)} K`;
  return num(v.value, tr?.digits ?? 2) + unit(tr?.unit ?? "");
}

function shownHtml(x: CardInput, key: string, v: TargetValue) {
  const lim = atLimit(key, v.value);
  const note = v.note ? `<span class="s-note">${lim ? "<b>At the limit of the instrument.</b> " : ""}${esc(v.note)}</span>` : "";
  return `<span class="s-val">${BODY[x.body]}: <b>${shownText(x, key, v)}</b>${lim ? ' <span class="tag warn">limit</span>' : ""}</span><span class="s-src">${esc(ds(x.m, v.dataset))} · ${esc(v.resolution)} · ${esc(v.stat)}</span>${note}`;
}

function unscored(x: CardInput, chs: Challenge[]) {
  const items = chs.flatMap((c) => c.labels.map((l) => ({ c, l })));
  const used = new Set(items.map(({ l }) => l.target_key).filter(Boolean));
  const extra = Object.entries(x.target.shown).filter(([k]) => !used.has(k));
  if (!items.length && !extra.length) return "";
  return `<details class="pl-fold"><summary>Shown, but not scored <span class="muted">(${items.length + extra.length})</span>${icon("chevron", "chev")}</summary><ul class="labels">
    ${items
      .map(
        ({ c, l }) => `<li><span class="b-name">${esc(l.name)}</span><span class="l-body"><span><span class="tag">${esc(c.name)}</span> ${esc(l.reason)}</span>${
          l.earth_text ? `<span class="muted">Here: ${esc(l.earth_text)}</span>` : ""
        }${l.target_key && x.target.shown[l.target_key] ? shownHtml(x, l.target_key, x.target.shown[l.target_key]) : ""}</span></li>`,
      )
      .join("")}
    ${extra
      .map(
        ([k, v]) =>
          `<li><span class="b-name">${esc(x.m.traits.find((t) => t.id === k)?.label ?? SHOWN[k] ?? k.replace(/_/g, " "))}</span><span class="l-body">${shownHtml(x, k, v)}</span></li>`,
      )
      .join("")}
  </ul></details>`;
}

function regions(x: CardInput) {
  const rs = x.target.regions;
  if (!rs?.length) return "";
  const keys = [...new Set(rs.flatMap((r) => Object.keys(r.values)))];
  const tr = (k: string) => x.m.traits.find((t) => t.id === k);
  const marks: { region: string; label: string; note: string }[] = [];
  const cell = (r: (typeof rs)[number], k: string) => {
    const v = r.values[k];
    if (v?.value == null) return "no data";
    let s = val(tr(k) ?? ({ unit: "", digits: 1 } as Trait), v.value).replace(unit(tr(k)?.unit ?? ""), "");
    if (atLimit(k, v.value) && v.note) {
      marks.push({ region: r.name, label: tr(k)?.label ?? k, note: v.note });
      s += `<sup>${marks.length}</sup>`;
    }
    return s;
  };
  const body = rs
    .map((r) => `<tr><th scope="row">${esc(r.name)}<span class="muted"> ${latlon(r.lat, r.lon, 1)}</span></th>${keys.map((k) => `<td class="n">${cell(r, k)}</td>`).join("")}</tr>`)
    .join("");
  return `<details class="pl-fold regions"><summary>Values for each of the ${rs.length} candidate regions${icon("chevron", "chev")}</summary>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Region</th>${keys
      .map((k) => `<th scope="col">${esc(tr(k)?.label ?? k)}${tr(k)?.unit ? ` <span class="muted">${esc(tr(k)!.unit)}</span>` : ""}</th>`)
      .join("")}</tr></thead><tbody>${body}</tbody></table></div>
    ${marks.length ? `<ol class="marks small">${marks.map((k) => `<li><b>${esc(k.region)}, ${esc(k.label)}:</b> ${esc(k.note)}</li>`).join("")}</ol>` : ""}
    <p class="muted small">Sources: ${[...new Set(rs.flatMap((r) => Object.values(r.values).map((v) => ds(x.m, v.dataset))))].map(esc).join(", ")}.</p>
  </details>`;
}

function datasets(x: CardInput, chs: Challenge[]) {
  const ids = (pick: (tr: Trait) => string | undefined) =>
    new Set(chs.flatMap((c) => c.traits.map((t) => x.m.traits.find((tr) => tr.id === t.id)).filter((tr): tr is Trait => !!tr && !!tr.column[x.body]).map(pick).filter((id): id is string => !!id)));
  const earth = ids((tr) => tr.earth_dataset);
  earth.add("power_merra2");
  const there = ids((tr) => (tr.scored_by === "ideal" ? undefined : x.target.values[tr.id]?.dataset));
  for (const v of Object.values(x.target.shown)) there.add(v.dataset);
  const li = (id: string) => {
    const d = x.m.datasets.find((d) => d.id === id);
    if (!d) return `<li>${esc(id)}</li>`;
    return `<li>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)} <span class="ds-ag">${esc(d.agency === "computed" ? "calculated" : d.agency === "other" || d.agency === "partner" ? "open data" : d.agency)}</span></li>`;
  };
  return `<div class="ds-cols">
    <div><h3>Earth values</h3><ul class="ds">${[...earth].map(li).join("")}</ul></div>
    <div><h3>${esc(BODY[x.body])} values</h3><ul class="ds">${[...there].map(li).join("")}</ul></div>
  </div>
  <p class="muted small">Images: NASA GIBS (Blue Marble, Landsat WELD) for Earth; NASA ${esc(BODY[x.body])} Trek for the ${esc(BODY[x.body])}. Each value above names its own dataset; open "Method and notes" under any trait for the full method.</p>`;
}

export function card(x: CardInput): string {
  const { m, i, cells, target } = x;
  const body = BODY[x.body];
  const chs = m.challenges[x.body];
  const s = x.score[i];
  const ttype = m.terrain_types.find((t) => t.id === terrainOf(cells)?.[i]);
  const far = cells.nearest_analog_km?.[i];
  const region = placeName(m, cells, i);
  const head = target.headline?.cell === i ? target.headline : null;
  const lead = chs
    .filter((c) => x.weights[c.id] > 0)
    .sort((a, b) => x.weights[b.id] - x.weights[a.id] || (chScore(x, b) || 0) - (chScore(x, a) || 0))[0];
  const firstOpen = chs.findIndex((c) => x.weights[c.id] > 0);
  const b = bandOf(s);
  const ok = Number.isFinite(s);
  const fresh = isNew(m, cells, i);
  return `<article class="card pl" aria-labelledby="place-h">
    <div class="pl-top">
      <header class="pl-hero">
        <p class="pl-for"><span class="pl-body" data-body="${x.body}">${body}</span><span>Match on Earth for <b>${esc(target.name)}</b></span><span class="pl-preset">${esc(x.weightsName)}${x.yr ? ", year-round" : ""}</span></p>
        <h1 id="place-h" tabindex="-1">${esc(region)}</h1>
        <p class="pl-meta"><span>${latlon(cells.lat[i], cells.lon[i])}</span><span>${!ttype ? "Terrain: no data" : ttype.key === "none" ? "Other land" : esc(ttype.name)}</span><span>0.5° cell, about 50 km</span></p>
        ${fresh || isIce(cells, i) ? `<p class="pl-flags">${fresh ? `<span><span class="rk-new">New</span>${num(far)} km from the nearest known analog</span>` : ""}${isIce(cells, i) ? `<span><span class="tag ice">Ice sheet</span>${num(cells.ice?.[i])}% permanent ice</span>` : ""}</p>` : ""}
        <div class="pl-score">
          <div class="ring" data-band="${b ? b.cls : "b-na"}" style="--p:${ok ? (s * 100).toFixed(1) : 0}" role="img" aria-label="${ok ? `Match score ${score100(s)} / 100` : "No match score"}">
            <b>${ok ? score100(s) : "—"}</b><span>${ok ? "/ 100" : "not ranked"}</span>
          </div>
          <div class="pl-rank">
            ${Number.isFinite(x.place) ? `<p><b>#${num(x.place)}</b> of ${num(x.ranked)} ranked land cells</p><p class="muted">In the top ${topShare(x.place, x.ranked)} of land</p>` : `<p>No rank with these settings</p>`}
          </div>
        </div>
        <p class="pl-verdict">${esc(verdict(x, chs))}</p>
        ${lead ? `<p class="pl-test">${icon("test")}<span><b>Test here:</b> ${esc(lead.what_to_test)}</span></p>` : ""}
        <div class="pl-folds">
          ${head ? `<details class="pl-fold"><summary>Why this is the main match${icon("chevron", "chev")}</summary><p><b>${esc(head.title)}.</b> ${esc(plainWhy(m, head.why))}</p></details>` : ""}
          <details class="pl-fold"><summary>How the score works${icon("chevron", "chev")}</summary>
            <p>${ok ? "The match score combines the challenge scores below with the weights of the preset. A challenge score comes from its traits: a trait scores higher when more land on Earth is farther from the base-site value than this place." : "Too many weighted challenges have no data here, so there is no match score."}</p>
            <p><b>${esc(x.weightsName)}:</b> ${esc(x.plain)}</p>
            <p class="muted">${esc(target.name)}: ${esc(target.anchor_note)}</p>
            <p class="pl-bands">${BANDS.map((bb) => `<span><i class="fc ${bb.cls}"></i>${bb.word}${Number.isFinite(bb.min) ? ` ${num(bb.min * 100)}+` : ""}</span>`).join("")}</p>
          </details>
        </div>
      </header>
      <section class="pl-cmp" aria-labelledby="pl-cmp-h">
        <h2 id="pl-cmp-h" class="sr">Earth beside ${esc(target.name)}</h2>
        ${compareHtml({ body: x.body, target, lat: cells.lat[i], lon: cells.lon[i], place: region })}
      </section>
    </div>
    <div class="pl-mb" id="pl-mb">
      <section class="pl-sec pl-match" aria-labelledby="pl-match-h"><h2 id="pl-match-h">${icon("check")}What matches</h2>${matches(x, chs)}</section>
      <section class="pl-sec pl-break" id="breaks" aria-labelledby="pl-break-h"><h2 id="pl-break-h">${icon("breaks")}Where it breaks</h2>${breaks(x, chs)}</section>
    </div>
    <section class="pl-sec pl-chs" aria-labelledby="pl-chs-h">
      <div class="pl-chs-head">
        <h2 id="pl-chs-h">Challenge by challenge</h2>
        <p class="key">${BANDS.map((bb) => `<span><i class="fc ${bb.cls}"></i>${bb.word}</span>`).join("")}<span><i class="kk band"></i>Earth's range</span><span><i class="kk here"></i>here</span><span><i class="kk tick"></i>${esc(body)} or ideal</span></p>
      </div>
      <ol class="chs">${chs.map((c, k) => chTile(x, c, k === firstOpen)).join("")}</ol>
    </section>
    <div class="pl-pair">
      <section class="pl-sec pl-seasons" aria-labelledby="pl-se-h"><h2 id="pl-se-h">${icon("seasons")}Seasons</h2>${seasons(x)}</section>
      <section class="pl-sec pl-cant" id="c-cant" aria-labelledby="pl-cant-h"><h2 id="pl-cant-h">${icon("cant")}Earth cannot copy</h2>${cantCopy(x)}</section>
    </div>
    <section class="pl-sec pl-data" aria-labelledby="pl-data-h">
      <h2 id="pl-data-h">${icon("sources")}Data sources</h2>
      ${datasets(x, chs)}
      ${unscored(x, chs)}
      ${regions(x)}
    </section>
  </article>`;
}


export function wireCard(el: HTMLElement): void {
  wireCompare(el);
}

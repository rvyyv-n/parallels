import type { Body, Challenge, Manifest, Target, TargetValue, Trait } from "./contract";
import type { Cols } from "./data";
import { MONTHS, bits, esc, latlon, monthList, num, score100, unit } from "./format";
import { colour } from "./ramp";
import { coverage } from "./score";

export interface CardInput {
  m: Manifest;
  body: Body;
  target: Target;
  cells: Cols;
  t: Cols;
  i: number;
  score: Float32Array;
  place: number;
  ranked: number;
  weights: Record<string, number>;
  weightsName: string;
  yr: boolean;
  ranges: Map<string, [number, number]>;
}

export const BODY = { moon: "Moon", mars: "Mars" };

export const terrainOf = (c: Cols) => c.terrain ?? c.terrain_type;

export function placeName(m: Manifest, c: Cols, i: number): string {
  const r = c.region?.[i];
  return (Number.isFinite(r) && m.regions[r]) || latlon(c.lat[i], c.lon[i], 2);
}

const ds = (m: Manifest, id: string) => m.datasets.find((d) => d.id === id)?.name ?? id;

function sourceLine(m: Manifest, label: string, dataset: string, resolution: string, stat: string) {
  return `<span><b>${esc(label)}</b> ${esc(ds(m, dataset))} · ${esc(resolution)} · ${esc(stat)}</span>`;
}

interface Row {
  tr: Trait;
  ev: number;
  tv: TargetValue | undefined;
  rank: number;
  lo: number;
  hi: number;
}

function row(x: CardInput, id: string): Row | null {
  const tr = x.m.traits.find((t) => t.id === id);
  if (!tr) return null;
  const col = tr.column[x.body];
  const ev = col && x.cells[col] ? x.cells[col][x.i] : NaN;
  const [lo, hi] = (col && x.ranges.get(col)) || [NaN, NaN];
  return { tr, ev, tv: x.target.values[id], rank: x.t[`rank:${id}`]?.[x.i] ?? NaN, lo, hi };
}

function ruler(r: Row, body: string) {
  const tv = r.tv?.value;
  if (!Number.isFinite(r.ev) || tv == null || !Number.isFinite(r.lo)) return "";
  const a = Math.min(r.lo, tv, r.ev);
  const b = Math.max(r.hi, tv, r.ev);
  const pad = (b - a || 1) * 0.04;
  const x = (v: number) => 8 + ((v - a + pad) / (b - a + 2 * pad)) * 284;
  const ex = x(r.ev);
  const tx = x(tv);
  const len = Math.abs(tx - ex);
  return `<svg class="ruler" viewBox="0 0 300 34" preserveAspectRatio="none" aria-hidden="true">
    <line x1="8" x2="292" y1="20" y2="20" class="r-base"/>
    <rect x="${x(r.lo)}" y="15" width="${Math.max(1, x(r.hi) - x(r.lo))}" height="10" class="r-earth"/>
    <line x1="${ex}" x2="${tx}" y1="20" y2="20" class="r-gap" style="--len:${len.toFixed(1)}"/>
    <line x1="${tx}" x2="${tx}" y1="8" y2="30" class="r-target"/>
    <line x1="${ex}" x2="${ex}" y1="20" y2="20" class="r-here"/>
    <text x="${tx}" y="6" class="r-lab" text-anchor="${tx > 250 ? "end" : tx < 50 ? "start" : "middle"}">${esc(body)}</text>
  </svg>`;
}

function traitHtml(x: CardInput, r: Row, why: string) {
  const body = BODY[x.body];
  const u = unit(r.tr.unit);
  const d = r.tr.digits;
  const tv = r.tv?.value;
  const missing = !Number.isFinite(r.ev)
    ? `No Earth data for this place${r.tr.note ? `: ${esc(r.tr.note)}` : "."}`
    : tv == null
      ? `Not scored: no ${body} value${r.tv?.note ? `: ${esc(r.tv.note)}` : "."}`
      : "";
  const gap = Number.isFinite(r.ev) && tv != null ? Math.abs(r.ev - tv) : NaN;
  const rank = Number.isFinite(r.rank)
    ? `<span class="t-rank" style="--c:${colour(r.rank)}"><i></i>Earth rank ${score100(r.rank)}</span>`
    : `<span class="t-rank none">not ranked</span>`;
  return `<li class="trait">
    <div class="t-head"><span class="t-name">${esc(r.tr.label)}</span>${rank}</div>
    <p class="t-plain">${esc(why || r.tr.plain)}</p>
    ${missing ? `<p class="t-missing">${missing}</p>` : ruler(r, body)}
    <dl class="t-vals">
      <div><dt>Here</dt><dd>${num(r.ev, d)}${Number.isFinite(r.ev) ? u : ""}</dd></div>
      <div><dt>Gap</dt><dd>${Number.isFinite(gap) ? num(gap, d) + u : "—"}</dd></div>
      <div><dt>${esc(body)}</dt><dd>${tv == null ? "no data" : num(tv, d) + u}</dd></div>
    </dl>
    <p class="t-src">${sourceLine(x.m, "Earth", r.tr.earth_dataset, r.tr.earth_resolution, r.tr.earth_stat)}${
      r.tv ? sourceLine(x.m, body, r.tv.dataset, r.tv.resolution, r.tv.stat + (r.tv.kind !== "computed" ? ` (${r.tv.kind})` : "")) : ""
    }</p>
  </li>`;
}

function breaks(x: CardInput, chs: Challenge[]) {
  const seen = new Set<string>();
  const out: { r: Row; text: string }[] = [];
  for (const c of chs) {
    if (!(x.weights[c.id] > 0)) continue;
    for (const { id } of c.traits) {
      if (seen.has(id)) continue;
      seen.add(id);
      const r = row(x, id);
      const tv = r?.tv?.value;
      if (!r || tv == null || !Number.isFinite(r.ev)) continue;
      const beyond = tv < r.lo || tv > r.hi;
      if (!beyond && !(r.rank < 0.5)) continue;
      const d = r.tr.digits;
      const u = unit(r.tr.unit);
      const side = r.ev > tv ? "above" : "below";
      const text = beyond
        ? `No land on Earth reaches the ${BODY[x.body]} value: Earth's land spans ${num(r.lo, d)} to ${num(r.hi, d)}${u}.`
        : `Weaker than most of Earth's land on this trait (Earth rank ${score100(r.rank)}).`;
      out.push({ r, text: `<b>${num(Math.abs(r.ev - tv), d)}${u}</b> ${side} the target. ${text}` });
    }
  }
  out.sort((a, b) => (a.r.rank || 0) - (b.r.rank || 0));
  if (!out.length) return `<p class="muted">No weighted trait falls in Earth's weaker half or beyond Earth's range here.</p>`;
  return `<ul class="breaks">${out.map(({ r, text }) => `<li><span class="b-name">${esc(r.tr.label)}</span><span>${text}</span></li>`).join("")}</ul>`;
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
  return `<table class="months">
      <thead><tr><td></td>${MONTHS.map((mm) => `<th scope="col">${mm}</th>`).join("")}</tr></thead>
      <tbody>${line("Best", best, "on-best")}${line("Freeze–thaw", frz, "on-frz")}${line("Rainy", rain, "on-rain")}</tbody>
    </table>
    <p class="m-sum">Usable months: <b>${Number.isFinite(usable) ? num(usable) : "no data"}</b> of 12. Best: ${monthList(best)}. Freeze–thaw: ${monthList(frz)}. Rainy: ${monthList(rain)}.${
      x.yr ? " Year-round testing is on, so part-year places rank lower." : ""
    }</p>`;
}

function shownValue(x: CardInput, key: string, v: TargetValue) {
  const tr = x.m.traits.find((t) => t.id === key);
  const val = v.value == null ? "no data" : num(v.value, tr?.digits ?? 2) + unit(tr?.unit ?? "");
  return `${val} <span class="muted">(${esc(ds(x.m, v.dataset))}, ${esc(v.resolution)}${v.note ? `; ${esc(v.note)}` : ""})</span>`;
}

function unscored(x: CardInput, chs: Challenge[]) {
  const items = chs.flatMap((c) => c.labels.map((l) => ({ c, l })));
  const used = new Set(items.map(({ l }) => l.target_key).filter(Boolean));
  const extra = Object.entries(x.target.shown).filter(([k]) => !used.has(k));
  if (!items.length && !extra.length) return "";
  return `<section class="c-block"><h4>Shown, not scored</h4><ul class="labels">
    ${items
      .map(
        ({ c, l }) => `<li><span class="b-name">${esc(l.name)}</span><span><span class="tag">${esc(c.name)}</span> ${esc(l.reason)}${
          l.earth_text ? ` <span class="muted">Here: ${esc(l.earth_text)}</span>` : ""
        }${l.target_key && x.target.shown[l.target_key] ? ` <span class="muted">${BODY[x.body]}: ${shownValue(x, l.target_key, x.target.shown[l.target_key])}</span>` : ""}</span></li>`,
      )
      .join("")}
    ${extra
      .map(([k, v]) => `<li><span class="b-name">${esc(x.m.traits.find((t) => t.id === k)?.label ?? k)}</span><span>${BODY[x.body]}: ${shownValue(x, k, v)}</span></li>`)
      .join("")}
  </ul></section>`;
}

function regions(x: CardInput) {
  const rs = x.target.regions;
  if (!rs?.length) return "";
  const keys = [...new Set(rs.flatMap((r) => Object.keys(r.values)))];
  const tr = (k: string) => x.m.traits.find((t) => t.id === k);
  return `<details class="c-block regions"><summary>The ${rs.length} regions' own values</summary>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Region</th>${keys
      .map((k) => `<th scope="col">${esc(tr(k)?.label ?? k)}${tr(k)?.unit ? ` <span class="muted">${esc(tr(k)!.unit)}</span>` : ""}</th>`)
      .join("")}</tr></thead><tbody>${rs
      .map(
        (r) => `<tr><th scope="row">${esc(r.name)}<span class="muted"> ${latlon(r.lat, r.lon, 1)}</span></th>${keys
          .map((k) => `<td class="n">${r.values[k]?.value == null ? "no data" : num(r.values[k].value!, tr(k)?.digits ?? 1)}</td>`)
          .join("")}</tr>`,
      )
      .join("")}</tbody></table></div>
    <p class="muted small">Sources per value: ${[...new Set(rs.flatMap((r) => Object.values(r.values).map((v) => ds(x.m, v.dataset))))].map(esc).join(", ")}.</p>
  </details>`;
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
    .sort((a, b) => x.weights[b.id] - x.weights[a.id] || (x.t[`ch:${b.id}`]?.[i] ?? 0) - (x.t[`ch:${a.id}`]?.[i] ?? 0))[0];
  const firstOpen = chs.findIndex((c) => x.weights[c.id] > 0);
  const chRows = chs
    .map((c, k) => {
      const r = x.t[`ch:${c.id}`]?.[i] ?? NaN;
      const w = x.weights[c.id] ?? 0;
      const rows = c.traits.map((tw) => row(x, tw.id)).filter((r): r is Row => !!r);
      const cov = coverage(x.t[`cov:${c.id}`], r, i);
      const state = !c.traits.length ? "labels only" : cov <= 0 ? "no data here" : cov < 1 ? "partial data" : "";
      return `<li class="ch${w > 0 ? "" : " off"}" style="--k:${k}">
        <details${k === firstOpen ? " open" : ""}>
          <summary>
            <span class="ch-name">${esc(c.name)}${c.only ? ` <span class="tag">${esc(c.only)}</span>` : ""}</span>
            <span class="ch-w">${w > 0 ? `weight ${num(w, w % 1 ? 1 : 0)}` : "not in this filter"}${state && c.traits.length ? ` · <span class="partial">${state}</span>` : ""}</span>
            <span class="ch-bar" aria-hidden="true"><i style="width:${Number.isFinite(r) ? r * 100 : 0}%;background:${Number.isFinite(r) ? colour(r) : "transparent"}"></i></span>
            <span class="ch-n${Number.isFinite(r) ? "" : " word"}">${Number.isFinite(r) ? score100(r) : !c.traits.length ? "not scored" : "no data"}</span>
          </summary>
          <div class="ch-body">
            <p class="ch-q">${esc(c.question)}</p>
            <ul class="traits">${rows.map((r) => traitHtml(x, r, c.traits.find((t) => t.id === r.tr.id)?.why ?? "")).join("")}</ul>
            <p class="ch-test"><b>What to test here:</b> ${esc(c.what_to_test)}</p>
          </div>
        </details>
      </li>`;
    })
    .join("");
  const cc = m.cant_copy
    .map((c) => `<tr><th scope="row">${esc(c.name)}</th><td>${esc(c.earth)}</td><td>${esc(c[x.body])}</td><td><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)}</a></td></tr>`)
    .join("");
  return `<article class="card" aria-labelledby="card-title">
    <header class="c-head">
      <p class="c-kicker">${Number.isFinite(x.place) ? `Match #${num(x.place)} of ${num(x.ranked)} ranked land cells` : "Not ranked for this filter"}${
        Number.isFinite(far) && far > 100 ? ` · <span class="rare">Rarely used: ${num(far)} km from any known analog</span>` : ""
      }</p>
      <h3 id="card-title">${esc(region)}</h3>
      <p class="c-meta">${region === latlon(cells.lat[i], cells.lon[i], 2) ? "" : `<span>${latlon(cells.lat[i], cells.lon[i])}</span>`}<span>${esc(ttype && ttype.key !== "none" ? ttype.name : "No terrain type")}</span>${
        Number.isFinite(cells.cluster?.[i]) ? `<span>Cluster ${num(cells.cluster[i])}</span>` : ""
      }<span>0.5° cell</span></p>
    </header>
    ${head ? `<section class="c-block headline"><h4>${esc(head.title)}</h4><p>${esc(head.why)}</p></section>` : ""}
    <section class="c-block">
      <div class="overall">
        <div class="o-num" style="--c:${Number.isFinite(s) ? colour(s) : "#777"}"><span class="o-label">Match</span><b>${Number.isFinite(s) ? score100(s) : "—"}</b></div>
        <p class="o-text">${esc(x.weightsName)} for ${esc(target.name)}${x.yr ? ", year-round" : ""}. It combines the challenge scores below, each an Earth rank from 0 to 100: ${
          Number.isFinite(s) ? "100 means closer to the target than all of Earth's land." : "not enough of the weighted challenges have data here."
        }</p>
      </div>
      <p class="key small muted"><i class="kk band"></i>Earth's land range <i class="kk dot"></i>this place <i class="kk tick"></i>target <i class="kk gap"></i>the gap, in real units</p>
      <ol class="chs">${chRows}</ol>
    </section>
    ${lead ? `<section class="c-block"><h4>What to test here</h4><p>${esc(lead.what_to_test)} <span class="muted">(${esc(lead.name)})</span></p></section>` : ""}
    <section class="c-block"><h4>Where it breaks</h4>${breaks(x, chs)}</section>
    <section class="c-block"><h4>Earth can't copy</h4>
      <div class="scroll-x"><table class="data cant"><thead><tr><th scope="col"></th><th scope="col">Earth</th><th scope="col">${body}</th><th scope="col">Source</th></tr></thead><tbody>${cc}</tbody></table></div>
    </section>
    <section class="c-block"><h4>Seasons</h4>${seasons(x)}</section>
    ${unscored(x, chs)}
    ${regions(x)}
  </article>`;
}

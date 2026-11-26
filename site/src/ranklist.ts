import "./rank.css";
import type { Challenge, Manifest } from "./contract";
import type { Cols } from "./data";
import { isIce, placeName } from "./card";
import { esc, num, score100 } from "./format";
import { icon } from "./icons";
import { APART_KM, BANDS, bandOf, countryOf, isNew, LIST, PER_COUNTRY, shortName, worldOf } from "./rank";

export interface View {
  m: Manifest;
  cells: Cols;
  t: Cols;
  chs: Challenge[];
  score: Float32Array;
  ids: number[];
  pool: number;
  known: boolean;
  robust: string | null;
  cell: number;
  cmp: number[];
  href(i: number): string;
}

const chipOf = (v: View, c: Challenge, i: number, text?: string, best = false) => {
  const col = v.t[`ch:${c.id}`];
  const x = col ? col[i] : NaN;
  const b = bandOf(x);
  const label = b ? `${c.name}: ${score100(x)} / 100, ${b.word}` : `${c.name}: no data`;
  const inner = esc(text ?? shortName(c.id, c.name));
  return `<span class="fc ${b ? b.cls : "b-na"}${best ? " cmp-best" : ""}" role="img" aria-label="${esc(label)}" title="${esc(label)}"><span class="fc-t">${inner}</span></span>`;
};

const across = (n: number) => (n > 5 ? Math.ceil(n / 2) : n);

export const chips = (v: View, i: number) => `<span class="rk-chips" style="--n:${across(v.chs.length)}">${v.chs.map((c) => chipOf(v, c, i)).join("")}</span>`;

export function summary(v: View): string {
  const { m, cells, ids } = v;
  if (!ids.length)
    return `<div class="sum-top"><p class="sum-k">No match</p><button type="button" class="sum-toggle" id="known" aria-pressed="${v.known}">${v.known ? "Known included" : "+ Known sites"}</button></div><p class="sum-empty muted">No ranked land agrees with these settings. Select "All land" in the terrain filter, or include known sites.</p>`;
  const best = ids[0];
  const countries = new Set(ids.map((i) => countryOf(m, cells, i)).filter(Boolean)).size;
  const fresh = ids.filter((i) => isNew(m, cells, i)).length;
  const held = v.robust ? ids.filter((i) => v.t[`stable:${v.robust}`]?.[i] === 1).length : null;
  return `<div class="sum-top"><p class="sum-k">Best match</p><button type="button" class="sum-toggle" id="known" aria-pressed="${v.known}">${v.known ? "Known included" : "+ Known sites"}</button></div>
    <p class="sum-best"><a href="${v.href(best)}" class="sum-name">${esc(placeName(m, cells, best))}</a><span class="sum-score"><b>${score100(v.score[best])}</b> / 100</span></p>
    <ul class="sum-facts">
      <li title="${esc(`${num(ids.length)} ${ids.length === 1 ? "site" : "sites"} in ${num(countries)} ${countries === 1 ? "country" : "countries"}`)}"><b>${num(ids.length)}<small> ${ids.length === 1 ? "site" : "sites"}</small></b><span>${num(countries)} ${countries === 1 ? "country" : "countries"}</span></li>
      <li title="Not in our list of known analog sites"><b class="sum-new">${num(fresh)}${v.known ? `/${num(ids.length)}` : ""}</b><span>new</span></li>
      ${held == null ? `<li class="muted" title="Robustness tests apply to the four presets without year-round scores"><b>—</b><span>robust</span></li>` : `<li title="Hold their place in every robustness test"><b>${num(held)}/${num(ids.length)}</b><span>robust</span></li>`}
    </ul>`;
}

export const rules = (v: View) =>
  `Top ${LIST} of ${num(v.pool)} cells · ${v.known ? "all sites" : "new only"} · ≥${num(APART_KM)} km · ≤${PER_COUNTRY}/country`;

export const key = () =>
  `<ul>${BANDS.map((b) => `<li><i class="key-mk ${b.cls}" aria-hidden="true"></i>${b.word}</li>`).join("")}<li><i class="key-mk b-na" aria-hidden="true"></i>no data</li></ul>`;

export function list(v: View, shut: Set<string>, moved: Map<number, number>, byRegion: boolean): string {
  const { m, cells, ids } = v;
  if (!ids.length) return `<p class="rk-empty">No ranked land agrees with these settings.</p>`;
  const full = v.cmp.length >= 3;
  const row = (i: number) => {
    const r = ids.indexOf(i) + 1;
    const name = placeName(m, cells, i);
    const keep = v.robust ? v.t[`keep:${v.robust}`]?.[i] : NaN;
    const d = moved.get(i);
    const on = v.cmp.includes(i);
    return `<li class="rk" data-i="${i}" data-rank="${r}"><a class="rk-row${i === v.cell ? " on" : ""}" href="${v.href(i)}"${i === v.cell ? ' aria-current="true"' : ""}>
      <span class="rk-n">${r}</span>
      <span class="rk-name">${esc(name)}</span>
      <span class="rk-badges">${isNew(m, cells, i) ? `<span class="rk-new" title="Not in our list of known analog sites">New</span>` : `<span class="rk-known" title="Within ${num(m.scoring.rare_km ?? 100)} km of a known analog site">Near a known analog</span>`}${
        Number.isFinite(keep) ? `<span class="rk-stab" title="In the top list in ${num(keep * 100)}% of the robustness tests">${num(keep * 100)}% stable</span>` : ""
      }${isIce(cells, i) ? `<span class="rk-ice">Ice sheet</span>` : ""}${d ? `<span class="rk-move ${d > 0 ? "up" : "down"}" title="${d > 0 ? "Up" : "Down"} ${Math.abs(d)}">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</span>` : ""}</span>
      ${chips(v, i)}
      <span class="rk-score"><b>${score100(v.score[i])}</b> / 100</span>
    </a><label class="rk-tick"><input type="checkbox" data-cmp="${i}"${on ? " checked" : full ? " disabled" : ""}><span aria-hidden="true">Compare</span><span class="sr">Compare ${esc(name)}</span></label></li>`;
  };
  if (!byRegion) return `<ol class="rk-list rk-flat">${ids.map(row).join("")}</ol>`;
  const groups = new Map<string, number[]>();
  for (const i of ids) {
    const g = worldOf(countryOf(m, cells, i));
    groups.set(g, [...(groups.get(g) ?? []), i]);
  }
  return [...groups]
    .map(
      ([g, rs]) =>
        `<details class="rk-grp" data-group="${esc(g)}"${shut.has(g) ? "" : " open"}><summary><span class="g-n">${esc(g)}</span><span class="g-m">${rs.length} ${rs.length === 1 ? "site" : "sites"} · best ${score100(v.score[rs[0]])}</span>${icon("chevron")}</summary><ol class="rk-list">${rs.map(row).join("")}</ol></details>`,
    )
    .join("");
}

export const sortBar = (byRegion: boolean) =>
  `<span class="sr" id="rk-sort-k">Sort</span><span class="rk-sort-seg">${[
    ["rank", "Rank"],
    ["region", "Region"],
  ]
    .map(([k, t]) => `<button type="button" data-sort="${k}" aria-pressed="${(k === "region") === byRegion}">${t}</button>`)
    .join("")}</span>`;

export function compare(v: View): string {
  const { m, cells } = v;
  const cs = v.cmp;
  if (!cs.length) return "";
  if (cs.length < 2) return `<div class="cmp-head"><p>Select one more site to compare the sites.</p><button type="button" class="sum-link" id="cmp-clear">Clear</button></div>`;
  return `<div class="cmp-head"><h2 id="cmp-h">Compare ${cs.length} sites</h2><button type="button" class="sum-link" id="cmp-clear">Clear</button></div>
    <table class="cmp-t" aria-labelledby="cmp-h"><thead><tr><th scope="col"><span class="sr">Challenge</span></th>${cs
      .map((i) => {
        const name = placeName(m, cells, i);
        return `<th scope="col"><div class="cmp-col-h"><span class="cmp-name">${esc(name)}</span><button type="button" class="cmp-rm" data-cmp-rm="${i}" aria-label="Remove ${esc(name)}" title="Remove ${esc(name)}">${icon("x")}</button></div><span class="cmp-score"><b>${score100(v.score[i])}</b> / 100</span><a class="cmp-open" href="${v.href(i)}">Open</a></th>`;
      })
      .join("")}</tr></thead><tbody>${v.chs
      .map((c) => {
        const col = v.t[`ch:${c.id}`];
        const vals = cs.map((i) => (col && Number.isFinite(col[i]) ? col[i] : NaN));
        const finite = vals.filter((x) => Number.isFinite(x));
        const hi = finite.length >= 2 ? Math.max(...finite) : NaN;
        const lo = finite.length >= 2 ? Math.min(...finite) : NaN;
        const hasBest = Number.isFinite(hi) && hi > lo + 1e-4;
        return `<tr><th scope="row">${esc(shortName(c.id, c.name))}</th>${cs
          .map((i, idx) => {
            const val = vals[idx];
            const best = hasBest && Number.isFinite(val) && Math.abs(val - hi) <= 1e-4;
            return `<td>${chipOf(v, c, i, Number.isFinite(val) ? score100(val) : "–", best)}</td>`;
          })
          .join("")}</tr>`;
      })
      .join("")}</tbody></table>`;
}

export interface Slider {
  c: Challenge;
  base: number;
  mul: number;
  has: boolean;
}

export const fmtMul = (v: number) => `${num(v, 1)}×`;

export function sliders(ss: Slider[]): string {
  return ss
    .map(({ c, base, mul, has }) => {
      const off = !has || !base;
      const note = !has ? "n/a: not used for this site" : !base ? "This preset does not use this challenge. Select Balanced to use it." : "";
      return `<div class="w-row${off ? " off" : ""}"><label for="w-${esc(c.id)}">${esc(c.name)}</label><output for="w-${esc(c.id)}">${!has ? "n/a" : !base ? "off" : fmtMul(mul)}</output>
        <input type="range" id="w-${esc(c.id)}" min="0" max="2" step="0.1" value="${off ? 0 : mul}" data-ch="${esc(c.id)}"${off ? " disabled" : ""}${note ? ` aria-describedby="wn-${esc(c.id)}"` : ""}>
        ${off ? "" : `<span class="w-ticks" aria-hidden="true"><span>0×</span><span>1×</span><span>2×</span></span>`}
        ${note ? `<p class="w-note" id="wn-${esc(c.id)}">${note}</p>` : ""}</div>`;
    })
    .join("");
}

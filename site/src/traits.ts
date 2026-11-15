import "./traits.css";
import type { Body, Challenge, Manifest, Target, TargetValue, Trait } from "./contract";
import type { Cols } from "./data";
import { esc, num, score100, unit } from "./format";
import { icon } from "./icons";
import { bandOf } from "./rank";

export const BODY = { moon: "Moon", mars: "Mars" };

export interface TraitInput {
  m: Manifest;
  body: Body;
  target: Target;
  cells: Cols;
  t: Cols;
  i: number;
  weights: Record<string, number>;
  ranges: Map<string, [number, number]>;
}

export interface Row {
  tr: Trait;
  ev: number;
  tv: TargetValue | undefined;
  rank: number;
  lo: number;
  hi: number;
}

const KIND: Record<string, string> = {
  computed: "calculated from the mission data",
  published: "from a published paper or fact sheet",
  derived: "calculated from other known values",
};

export const ds = (m: Manifest, id: string) => m.datasets.find((d) => d.id === id)?.name ?? id;

export const short = (m: Manifest, id: string) => {
  const n = ds(m, id);
  return n.replace(/\s*\([^)]*\)/g, "").split(", ")[0].trim() || n;
};

const brief = (res: string) => res.replace(/\s*\([^)]*\)/g, "").split(/[;,]/)[0].trim() || res;

const cite = (name: string, res: string) => {
  const b = brief(res);
  const r = b.startsWith(name) ? b.slice(name.length).trim() : b;
  return r ? `${name} · ${r}` : name;
};

const first = (s: string) => s.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? s;

export function row(x: TraitInput, id: string): Row | null {
  const tr = x.m.traits.find((t) => t.id === id);
  if (!tr) return null;
  const col = tr.column[x.body];
  const ev = col && x.cells[col] ? x.cells[col][x.i] : NaN;
  const [lo, hi] = (col && x.ranges.get(col)) || [NaN, NaN];
  return { tr, ev, tv: x.target.values[id], rank: x.t[`rank:${id}`]?.[x.i] ?? NaN, lo, hi };
}

const yesNo = (tr: Trait) => tr.scored_by === "presence" && tr.unit === "%";
const count = (tr: Trait) => tr.scored_by === "presence" && tr.unit !== "%";
export const side = (body: Body, tr: Trait) => (tr.scored_by === "ideal" ? "Ideal" : BODY[body]);

export function val(tr: Trait, v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "no data";
  if (yesNo(tr)) return v >= 50 ? "Yes" : "No";
  return num(v, tr.digits) + unit(tr.unit);
}

export const same = (r: Row) => r.tv?.value != null && num(Math.abs(r.ev - r.tv.value), r.tr.digits) === num(0, r.tr.digits);

function gapWords(r: Row) {
  const tv = r.tv?.value;
  if (!Number.isFinite(r.ev) || tv == null) return "no data";
  if (yesNo(r.tr)) return (r.ev >= 50) === (tv >= 50) ? "same" : "differs";
  if (same(r)) return "same";
  const d = r.ev - tv;
  const counted = count(r.tr) || r.tr.unit === "months";
  const dir = counted ? (d > 0 ? "more" : "fewer") : d > 0 ? "higher" : "lower";
  return `${num(Math.abs(d), r.tr.digits)}${unit(r.tr.unit)} ${dir}`;
}

export function scoreChip(v: number, what: string) {
  const b = bandOf(v);
  const label = b ? `${what}: ${score100(v)} / 100, ${b.word}` : `${what}: not ranked`;
  return `<span class="fc sc ${b ? b.cls : "b-na"}" role="img" aria-label="${esc(label)}" title="${esc(label)}">${b ? score100(v) : "–"}</span>`;
}

function flags(r: Row, label: string) {
  const tv = r.tv!.value!;
  if (yesNo(r.tr)) return "";
  const n = Math.max(1, Math.round(Math.max(tv, r.ev, Number.isFinite(r.hi) ? r.hi : 0)));
  const pips = (v: number) => Array.from({ length: n }, (_, k) => `<i class="${k < Math.round(v) ? "on" : ""}"></i>`).join("");
  return `<div class="cnt" role="img" aria-label="Here: ${num(r.ev)}. ${esc(label)}: ${num(tv)}. Up to ${num(n)} possible.">
    <span class="cnt-r here"><b>Here</b><span class="pp">${pips(r.ev)}</span></span><span class="cnt-r there"><b>${esc(label)}</b><span class="pp">${pips(tv)}</span></span></div>`;
}

function bullet(r: Row, label: string) {
  const tv = r.tv?.value;
  if (!Number.isFinite(r.ev) || tv == null) return "";
  if (r.tr.scored_by === "presence") return flags(r, label);
  const lo = Number.isFinite(r.lo) ? r.lo : Math.min(tv, r.ev);
  const hi = Number.isFinite(r.hi) ? r.hi : Math.max(tv, r.ev);
  const a = Math.min(lo, tv, r.ev);
  const b = Math.max(hi, tv, r.ev);
  const pad = (b - a || 1) * 0.03;
  const at = (v: number) => ((v - a + pad) / (b - a + 2 * pad)) * 100;
  const u = unit(r.tr.unit);
  const d = r.tr.digits;
  const tx = at(tv);
  const range = Number.isFinite(r.lo) ? `Land on Earth: ${num(r.lo, d)} to ${num(r.hi, d)}${u}` : "";
  return `<div class="bb" role="img" aria-label="Here ${esc(val(r.tr, r.ev))}. ${esc(label)} ${esc(val(r.tr, tv))}. ${esc(range)}">
      ${Number.isFinite(r.lo) ? `<span class="bb-band" style="left:${at(r.lo).toFixed(2)}%;width:${Math.max(0.6, at(r.hi) - at(r.lo)).toFixed(2)}%"></span>` : ""}
      <span class="bb-here" style="width:${Math.max(0.8, at(r.ev)).toFixed(2)}%"></span>
      <span class="bb-tick${tx > 80 ? " end" : tx < 20 ? " start" : ""}" style="left:${tx.toFixed(2)}%"><em>${esc(label)}</em></span>
    </div>
    ${range ? `<p class="bb-axis">${range}</p>` : ""}`;
}

function notes(x: TraitInput, r: Row, why: string) {
  const tv = r.tv;
  const ideal = r.tr.scored_by === "ideal";
  const there = !tv
    ? `<div class="sn"><h6>${esc(side(x.body, r.tr))}</h6><p>no data</p></div>`
    : `<div class="sn">
      <h6>${ideal ? "Ideal value" : `${esc(BODY[x.body])} value`} <span class="kb k-${esc(tv.kind)}">${ideal ? "ideal" : esc(tv.kind)}</span></h6>
      <p class="muted">${ideal ? "A goal that we set, not a measurement." : esc(KIND[tv.kind] ?? "")}</p>
      ${ideal ? "" : `<p>${esc(ds(x.m, tv.dataset))}</p>`}
      <p><b>Resolution:</b> ${esc(tv.resolution)}. <b>Method:</b> ${esc(tv.stat)}.</p>
      ${tv.note ? `<p>${esc(tv.note)}</p>` : ""}
    </div>`;
  return `<details class="t-notes"><summary>${icon("sources")}Method and notes</summary><div class="sn-grid">
    <div class="sn sn-what"><p>${esc(r.tr.plain)}</p>${why ? `<p class="muted">${esc(why)}</p>` : ""}</div>
    <div class="sn">
      <h6>Earth value</h6>
      <p>${esc(ds(x.m, r.tr.earth_dataset))}</p>
      <p><b>Resolution:</b> ${esc(r.tr.earth_resolution)}. <b>Method:</b> ${esc(r.tr.earth_stat)}.</p>
      ${r.tr.note ? `<p>${esc(r.tr.note)}</p>` : ""}
    </div>
    ${there}
  </div></details>`;
}

export function srcChips(x: TraitInput, r: Row) {
  const label = side(x.body, r.tr);
  const there = !r.tv
    ? ""
    : r.tr.scored_by === "ideal"
      ? `<span class="chip"><b>Ideal</b> a goal that we set</span>`
      : `<span class="chip"><b>${esc(label)}</b> ${esc(cite(short(x.m, r.tv.dataset), r.tv.resolution))}</span>`;
  return `<span class="chip"><b>Earth</b> ${esc(cite(short(x.m, r.tr.earth_dataset), r.tr.earth_resolution))}</span>${there}`;
}

export function traitHtml(x: TraitInput, r: Row, why: string) {
  const label = side(x.body, r.tr);
  const tv = r.tv?.value;
  const missing = !Number.isFinite(r.ev)
    ? `No Earth data for this place.`
    : tv == null
      ? `Not scored: there is no ${esc(label)} value.${r.tv?.note ? ` ${esc(r.tv.note)}` : ""}`
      : "";
  return `<li class="trait${missing ? " miss" : ""}">
    <div class="t-head"><span class="t-name">${esc(r.tr.label)}</span>${scoreChip(r.rank, r.tr.label)}</div>
    <p class="t-plain">${esc(first(r.tr.plain))}</p>
    <dl class="t-vals">
      <div class="tv-here"><dt>Here</dt><dd>${val(r.tr, r.ev)}</dd></div>
      <div class="tv-there"><dt>${esc(label)}</dt><dd>${val(r.tr, tv)}</dd></div>
      <div class="tv-gap"><dt>Gap</dt><dd>${gapWords(r)}</dd></div>
    </dl>
    ${missing ? `<p class="t-missing">${icon("info")}<span>${missing}</span></p>` : bullet(r, label)}
    <p class="t-src">${srcChips(x, r)}</p>
    ${notes(x, r, why)}
  </li>`;
}

export function scoredRows(x: TraitInput, chs: Challenge[]) {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const c of chs) {
    if (!(x.weights[c.id] > 0)) continue;
    for (const { id, weight } of c.traits) {
      if (seen.has(id) || !(weight > 0)) continue;
      seen.add(id);
      const r = row(x, id);
      if (!r || r.tv?.value == null || !Number.isFinite(r.ev)) continue;
      out.push(r);
    }
  }
  return out;
}

export function breakRows(x: TraitInput, chs: Challenge[]) {
  const out: { r: Row; why: string }[] = [];
  for (const r of scoredRows(x, chs)) {
    const tv = r.tv!.value!;
    if (r.tr.scored_by === "presence") {
      const miss = yesNo(r.tr) ? r.ev >= 50 !== tv >= 50 : r.ev < tv;
      if (miss) out.push({ r, why: "" });
      continue;
    }
    const beyond = tv < r.lo || tv > r.hi;
    if (!beyond && !(r.rank < 0.5)) continue;
    const u = unit(r.tr.unit);
    const d = r.tr.digits;
    out.push({
      r,
      why: beyond
        ? `No land on Earth reaches the ${r.tr.scored_by === "ideal" ? "ideal" : esc(BODY[x.body])} value (Earth: ${num(r.lo, d)} to ${num(r.hi, d)}${u}).`
        : "Most land on Earth is closer on this trait.",
    });
  }
  return out.sort((a, b) => (a.r.rank || 0) - (b.r.rank || 0));
}

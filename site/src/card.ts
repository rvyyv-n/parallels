import "./card.css";
import { compareHtml, wireCompare } from "./compare";
import type { Body, Challenge, Manifest, Target, TargetValue, Trait } from "./contract";
import type { Cols } from "./data";
import { MONTHS, bits, esc, latlon, monthList, num, score100, unit } from "./format";
import { icon } from "./icons";
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

export const terrainOf = (c: Cols) => c.terrain_type ?? c.terrain;

export const isIce = (c: Cols, i: number) => (c.ice?.[i] ?? 0) >= 50;

export function placeName(m: Manifest, c: Cols, i: number): string {
  const r = c.region?.[i];
  return (Number.isFinite(r) && m.regions[r]) || latlon(c.lat[i], c.lon[i], 2);
}

const BANDS = [
  { min: 80, word: "Close", cls: "close", ic: "check" },
  { min: 50, word: "Partial", cls: "partial", ic: "info" },
  { min: 0, word: "Weak", cls: "weak", ic: "x" },
];

const KIND: Record<string, string> = {
  computed: "we worked it out from the mission data",
  published: "taken from a published paper or fact sheet",
  derived: "calculated from other known values",
};

const ds = (m: Manifest, id: string) => m.datasets.find((d) => d.id === id)?.name ?? id;

const short = (m: Manifest, id: string) => {
  const n = ds(m, id);
  return n.replace(/\s*\([^)]*\)/g, "").split(", ")[0].trim() || n;
};

const brief = (res: string) => res.replace(/\s*\([^)]*\)/g, "").trim() || res;

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

const yesNo = (tr: Trait) => tr.scored_by === "presence" && tr.unit === "%";
const count = (tr: Trait) => tr.scored_by === "presence" && tr.unit !== "%";
const side = (x: CardInput, tr: Trait) => (tr.scored_by === "ideal" ? "Ideal" : BODY[x.body]);

function val(tr: Trait, v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "no data";
  if (yesNo(tr)) return v >= 50 ? "Yes" : "No";
  return num(v, tr.digits) + unit(tr.unit);
}

function gapWords(r: Row) {
  const tv = r.tv?.value;
  if (!Number.isFinite(r.ev) || tv == null) return "no data";
  if (yesNo(r.tr)) return (r.ev >= 50) === (tv >= 50) ? "same" : "differs";
  const d = r.ev - tv;
  if (num(Math.abs(d), r.tr.digits) === num(0, r.tr.digits)) return "same";
  const counted = count(r.tr) || r.tr.unit === "months";
  const dir = counted ? (d > 0 ? "more" : "fewer") : d > 0 ? "higher" : "lower";
  return `${num(Math.abs(d), r.tr.digits)}${unit(r.tr.unit)} ${dir}`;
}

function flags(r: Row, label: string) {
  const tv = r.tv!.value!;
  if (yesNo(r.tr)) {
    const here = r.ev >= 50;
    const there = tv >= 50;
    const box = (on: boolean, who: string, cls: string) =>
      `<span class="yn ${cls}${on ? " on" : ""}">${icon(on ? "check" : "x")}<span>${esc(who)}: <b>${on ? "yes" : "no"}</b></span></span>`;
    return `<div class="yns" role="img" aria-label="Here: ${here ? "yes" : "no"}. ${esc(label)}: ${there ? "yes" : "no"}.">${box(here, "Here", "here")}${box(there, label, "there")}</div>`;
  }
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
  const range = Number.isFinite(r.lo) ? `Earth's land spans ${num(r.lo, d)} to ${num(r.hi, d)}${u}.` : "";
  return `<div class="bb" role="img" aria-label="Here ${esc(val(r.tr, r.ev))}. ${esc(label)} ${esc(val(r.tr, tv))}. ${esc(range)}">
      ${Number.isFinite(r.lo) ? `<span class="bb-band" style="left:${at(r.lo).toFixed(2)}%;width:${Math.max(0.6, at(r.hi) - at(r.lo)).toFixed(2)}%"></span>` : ""}
      <span class="bb-here" style="width:${Math.max(0.8, at(r.ev)).toFixed(2)}%"></span>
      <span class="bb-tick${tx > 80 ? " end" : tx < 20 ? " start" : ""}" style="left:${tx.toFixed(2)}%"><em>${esc(label)}</em></span>
    </div>
    ${range ? `<p class="bb-axis">${range}</p>` : ""}`;
}

function kindBadge(tr: Trait, tv: TargetValue) {
  if (tr.scored_by === "ideal") return `<p class="kind"><span class="kb">ideal</span> a set goal, not a measurement (value field: ${esc(tv.kind)})</p>`;
  return `<p class="kind"><span class="kb k-${esc(tv.kind)}">${esc(tv.kind)}</span> ${esc(KIND[tv.kind] ?? "")}</p>`;
}

function sources(x: CardInput, r: Row) {
  const who = side(x, r.tr);
  const tv = r.tv;
  const earth = `<div class="sn">
      <h6>${icon("surface")}Earth value</h6>
      <p><span class="chip">${esc(ds(x.m, r.tr.earth_dataset))}</span></p>
      <p><b>Resolution:</b> ${esc(r.tr.earth_resolution)}</p>
      <p><b>Method:</b> ${esc(r.tr.earth_stat)}.</p>
      ${r.tr.note ? `<p><b>Note:</b> ${esc(r.tr.note)}</p>` : ""}
    </div>`;
  const there = tv
    ? `<div class="sn">
      <h6>${icon("site")}${r.tr.scored_by === "ideal" ? "Ideal value" : `${esc(who)} value`}</h6>
      ${kindBadge(r.tr, tv)}
      ${r.tr.scored_by === "ideal" ? "" : `<p><span class="chip">${esc(ds(x.m, tv.dataset))}</span></p>`}
      <p><b>Resolution:</b> ${esc(tv.resolution)}</p>
      <p><b>Method:</b> ${esc(tv.stat)}.</p>
      ${tv.note ? `<p><b>Note:</b> ${esc(tv.note)}</p>` : ""}
    </div>`
    : `<div class="sn"><h6>${icon("site")}${esc(who)} value</h6><p>no data</p></div>`;
  return `<details class="t-notes"><summary>${icon("sources")}Sources and notes</summary><div class="sn-grid">${earth}${there}</div></details>`;
}

function traitHtml(x: CardInput, r: Row, why: string) {
  const label = side(x, r.tr);
  const tv = r.tv?.value;
  const missing = !Number.isFinite(r.ev)
    ? `No Earth data for this place.`
    : tv == null
      ? `Not scored: no ${esc(label)} value.${r.tv?.note ? ` ${esc(r.tv.note)}` : ""}`
      : "";
  const rank = Number.isFinite(r.rank)
    ? `<span class="t-rank" style="--c:${colour(r.rank)}"><i></i>Earth rank <b>${score100(r.rank)}</b></span>`
    : `<span class="t-rank none">not ranked</span>`;
  const gap = gapWords(r);
  const tsrc = !r.tv
    ? ""
    : r.tr.scored_by === "ideal"
      ? `<span class="chip"><b>Ideal</b> a set goal</span>`
      : `<span class="chip"><b>${esc(label)}</b> ${esc(short(x.m, r.tv.dataset))} · ${esc(brief(r.tv.resolution))}</span>`;
  return `<li class="trait${missing ? " miss" : ""}">
    <div class="t-head"><span class="t-name">${esc(r.tr.label)}</span>${rank}</div>
    <p class="t-plain">${esc(why || r.tr.plain)}</p>
    ${missing ? `<p class="t-missing">${icon("info")}<span>${missing}</span></p>` : bullet(r, label)}
    <dl class="t-vals">
      <div class="tv-here"><dt>Here</dt><dd>${val(r.tr, r.ev)}</dd></div>
      <div class="tv-gap"><dt>Gap</dt><dd>${gap}</dd></div>
      <div class="tv-there"><dt>${esc(label)}</dt><dd>${val(r.tr, tv)}</dd></div>
    </dl>
    <p class="t-src"><span class="chip"><b>Earth</b> ${esc(short(x.m, r.tr.earth_dataset))} · ${esc(brief(r.tr.earth_resolution))}</span>${tsrc}</p>
    ${sources(x, r)}
  </li>`;
}

function scoredRows(x: CardInput, chs: Challenge[]) {
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

function breakRows(x: CardInput, chs: Challenge[]) {
  const out: { r: Row; text: string }[] = [];
  for (const r of scoredRows(x, chs)) {
    const tv = r.tv!.value!;
    const who = side(x, r.tr);
    if (r.tr.scored_by === "presence") {
      const short = yesNo(r.tr) ? r.ev >= 50 !== tv >= 50 : r.ev < tv;
      if (short) out.push({ r, text: `Here <b>${val(r.tr, r.ev)}</b>, ${esc(who)} <b>${val(r.tr, tv)}</b>.` });
      continue;
    }
    const beyond = tv < r.lo || tv > r.hi;
    if (!beyond && !(r.rank < 0.5)) continue;
    const d = r.tr.digits;
    const u = unit(r.tr.unit);
    const dir = r.ev > tv ? "above" : "below";
    const text = beyond
      ? `No land on Earth reaches the ${esc(who)} value: Earth's land spans ${num(r.lo, d)} to ${num(r.hi, d)}${u}.`
      : `Weaker than most of Earth's land on this trait (Earth rank ${score100(r.rank)}).`;
    const ref = r.tr.scored_by === "ideal" ? `the ideal (ideal: ${val(r.tr, tv)})` : `the ${esc(who)} value`;
    out.push({ r, text: `<b>${num(Math.abs(r.ev - tv), d)}${u}</b> ${dir} ${ref}. ${text}` });
  }
  return out.sort((a, b) => (a.r.rank || 0) - (b.r.rank || 0));
}

function breaks(x: CardInput, chs: Challenge[]) {
  const out = breakRows(x, chs);
  if (!out.length) return `<p class="muted">No weighted trait falls in Earth's weaker half or beyond Earth's range here.</p>`;
  return `<ul class="breaks">${out
    .map(
      ({ r, text }) =>
        `<li><span class="b-name">${esc(r.tr.label)}</span><span class="b-text">${text} <span class="b-src">Earth: ${esc(short(x.m, r.tr.earth_dataset))}${
          r.tr.scored_by === "ideal" || !r.tv ? "" : ` · ${esc(BODY[x.body])}: ${esc(short(x.m, r.tv.dataset))}`
        }</span></span></li>`,
    )
    .join("")}</ul>`;
}

function pairText(x: CardInput, r: Row) {
  const tv = r.tv!.value!;
  const ideal = r.tr.scored_by === "ideal";
  const there = ideal ? `ideal: ${val(r.tr, tv)}` : `${esc(BODY[x.body])} ${val(r.tr, tv)}`;
  const src = `Earth rank ${score100(r.rank)} · Earth: ${esc(short(x.m, r.tr.earth_dataset))}${ideal ? "" : ` · ${esc(BODY[x.body])}: ${esc(short(x.m, r.tv!.dataset))}`}`;
  return `<li><b>${esc(r.tr.label)}</b>: ${val(r.tr, r.ev)} here, ${there}<span class="s-src">${src}</span></li>`;
}

function summary(x: CardInput, chs: Challenge[]) {
  const all = scoredRows(x, chs).filter((r) => Number.isFinite(r.rank));
  const top = [...all].sort((a, b) => b.rank - a.rank).slice(0, 3);
  const weak = breakRows(x, chs)
    .map((b) => b.r)
    .filter((r) => !top.includes(r) && num(Math.abs(r.ev - r.tv!.value!), r.tr.digits) !== num(0, r.tr.digits))
    .slice(0, 2);
  const list = (rs: Row[], none: string) => (rs.length ? `<ul>${rs.map((r) => pairText(x, r)).join("")}</ul>` : `<p class="muted">${none}</p>`);
  const names = x.m.cant_copy.map((c) => c.name.toLowerCase());
  const said = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
  return `<section class="c-sum" aria-label="Summary">
    <div class="sum-row sum-ok"><h5 class="sum-k">${icon("check")}Matches</h5>${list(top, "no data")}</div>
    <div class="sum-row sum-bad"><h5 class="sum-k">${icon("breaks")}Breaks</h5>${list(weak, all.length ? "No trait in this filter is weak here." : "no data")}</div>
    <div class="sum-row sum-cant"><h5 class="sum-k">${icon("cant")}Earth can't copy</h5><p>${x.body === "moon" ? "The Moon's" : "Mars's"} ${esc(said)}. <a href="#c-cant">See the strip below.</a></p></div>
  </section>`;
}

function plainWhy(m: Manifest, why: string) {
  let s = why.replace(/closer than 0% of land/g, "further from the target than almost all land");
  for (const tr of m.traits) {
    if (tr.scored_by !== "ideal") continue;
    const re = new RegExp(`(${tr.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} [^;()]*? against )`, "g");
    s = s.replace(re, "$1ideal: ");
  }
  return s;
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
  const src = `${esc(ds(x.m, v.dataset))} · ${esc(v.resolution)} · ${esc(v.stat)}`;
  const note = v.note
    ? v.value == null
      ? `<span class="s-note">${esc(v.note)}</span>`
      : `<details class="t-notes"${lim ? " open" : ""}><summary>${icon("sources")}${lim ? "At the instrument's limit: note" : "Notes"}</summary><p>${esc(v.note)}</p></details>`
    : "";
  return `<span class="s-val">${BODY[x.body]}: <b>${shownText(x, key, v)}</b>${lim ? ' <span class="tag warn">limit</span>' : ""}</span><span class="s-src">${src}</span>${note}`;
}

function unscored(x: CardInput, chs: Challenge[]) {
  const items = chs.flatMap((c) => c.labels.map((l) => ({ c, l })));
  const used = new Set(items.map(({ l }) => l.target_key).filter(Boolean));
  const extra = Object.entries(x.target.shown).filter(([k]) => !used.has(k));
  if (!items.length && !extra.length) return "";
  return `<details class="c-block c-fold mv-shown"><summary><h4>${icon("info")}Shown, not scored <span class="muted">(${items.length + extra.length})</span></h4>${icon("chevron", "chev")}</summary><ul class="labels">
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
  return `<details class="c-block c-fold regions mv-regions"><summary><h4>${icon("site")}The ${rs.length} regions' own values</h4>${icon("chevron", "chev")}</summary>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Region</th>${keys
      .map((k) => `<th scope="col">${esc(tr(k)?.label ?? k)}${tr(k)?.unit ? ` <span class="muted">${esc(tr(k)!.unit)}</span>` : ""}</th>`)
      .join("")}</tr></thead><tbody>${body}</tbody></table></div>
    ${marks.length ? `<ol class="marks small">${marks.map((k) => `<li><b>${esc(k.region)}, ${esc(k.label)}:</b> ${esc(k.note)}</li>`).join("")}</ol>` : ""}
    <p class="muted small">Sources per value: ${[...new Set(rs.flatMap((r) => Object.values(r.values).map((v) => ds(x.m, v.dataset))))].map(esc).join(", ")}.</p>
  </details>`;
}

const CANT_ICON = (name: string) => (/grav/i.test(name) ? "gravity" : /radiat/i.test(name) ? "radiation" : /air|atmos|pressure/i.test(name) ? "air" : "cant");

function limiting(x: CardInput, chs: Challenge[]) {
  const rs = scoredRows(x, chs).filter((r) => Number.isFinite(r.rank));
  if (!rs.length) return `<p class="v-limit"><span class="v-k">Lowest-ranked trait</span> no data</p>`;
  const r = rs.reduce((a, b) => (b.rank < a.rank ? b : a));
  const who = side(x, r.tr);
  return `<p class="v-limit"><span class="v-k">${icon("limit")}Lowest-ranked trait</span><span><b>${esc(r.tr.label)}</b>: ${val(r.tr, r.ev)} here, ${
    r.tr.scored_by === "ideal" ? `ideal: ${val(r.tr, r.tv!.value)}` : `${esc(who)} ${val(r.tr, r.tv!.value)}`
  } <span class="muted">(Earth rank ${score100(r.rank)}; Earth: ${esc(short(x.m, r.tr.earth_dataset))})</span></span></p>`;
}

function chTile(x: CardInput, c: Challenge, k: number, open: boolean) {
  const i = x.i;
  const r = x.t[`ch:${c.id}`]?.[i] ?? NaN;
  const w = x.weights[c.id] ?? 0;
  const rows = c.traits.map((tw) => row(x, tw.id)).filter((r): r is Row => !!r);
  const cov = coverage(x.t[`cov:${c.id}`], r, i);
  const state = !c.traits.length ? "not scored" : cov <= 0 ? "no data here" : cov < 1 ? "partial data" : "";
  const ok = Number.isFinite(r);
  return `<li class="ch${w > 0 ? "" : " off"}" style="--k:${k}">
    <details${open ? " open" : ""}>
      <summary>
        <span class="ch-ic">${icon(c.id)}</span>
        <span class="ch-name">${esc(c.name)}${c.only ? ` <span class="tag">${esc(c.only)}</span>` : ""}</span>
        <span class="ch-n${ok ? "" : " word"}">${ok ? score100(r) : !c.traits.length ? "not scored" : "no data"}</span>
        <span class="ch-bar" aria-hidden="true"><i style="width:${ok ? r * 100 : 0}%;background:${ok ? colour(r) : "transparent"}"></i></span>
        <span class="ch-w">${w > 0 ? `Weight ${num(w, w % 1 ? 1 : 0)}` : "Not in this filter"}${state ? ` · <span class="st${state === "partial data" ? " part" : ""}">${state}</span>` : ""}</span>
        ${icon("chevron", "chev")}
      </summary>
      <div class="ch-body">
        <p class="ch-q">${esc(c.question)}</p>
        ${rows.length ? `<ul class="traits">${rows.map((r) => traitHtml(x, r, c.traits.find((t) => t.id === r.tr.id)?.why ?? "")).join("")}</ul>` : `<p class="muted">No scored traits: this challenge is shown with labels only (see "Shown, not scored").</p>`}
        <p class="ch-test">${icon("test")}<span><b>What to test here:</b> ${esc(c.what_to_test)}</span></p>
      </div>
    </details>
  </li>`;
}

export function card(x: CardInput): string {
  const { m, i, cells, target } = x;
  const body = BODY[x.body];
  const chs = m.challenges[x.body];
  const s = x.score[i];
  const ttype = m.terrain_types.find((t) => t.id === terrainOf(cells)?.[i]);
  const far = cells.nearest_analog_km?.[i];
  const ice = cells.ice?.[i];
  const region = placeName(m, cells, i);
  const head = target.headline?.cell === i ? target.headline : null;
  const lead = chs
    .filter((c) => x.weights[c.id] > 0)
    .sort((a, b) => x.weights[b.id] - x.weights[a.id] || (x.t[`ch:${b.id}`]?.[i] ?? 0) - (x.t[`ch:${a.id}`]?.[i] ?? 0))[0];
  const firstOpen = chs.findIndex((c) => x.weights[c.id] > 0);
  const ok = Number.isFinite(s);
  const band = ok ? BANDS.find((b) => s * 100 >= b.min - 0.5) ?? BANDS[2] : null;
  const cc = m.cant_copy
    .map(
      (c) =>
        `<tr><th scope="row">${icon(CANT_ICON(c.name))}<span>${esc(c.name)}</span></th><td><span class="cc-k">Earth</span>${esc(c.earth)}</td><td class="cc-there"><span class="cc-k">${body}</span>${esc(c[x.body])}</td><td class="cc-src"><span class="cc-k">Source</span><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)}</a></td></tr>`,
    )
    .join("");
  return `<article class="card mv" aria-labelledby="card-title">
    <header class="c-head">
      <p class="c-kicker">${Number.isFinite(x.place) ? `Match #${num(x.place)} of ${num(x.ranked)} ranked land cells` : "Not ranked for this filter"}${
        Number.isFinite(far) && far > 100 ? ` <span class="rare">Rarely used: ${num(far)} km from any known analog</span>` : ""
      }${isIce(cells, i) ? ` <span class="tag ice">Ice sheet: ${num(ice)}% permanent ice</span>` : ""}</p>
      <h3 id="card-title">${esc(region)}</h3>
      <p class="c-meta">${region === latlon(cells.lat[i], cells.lon[i], 2) ? "" : `<span>${latlon(cells.lat[i], cells.lon[i])}</span>`}<span>${
        !ttype ? "Terrain type: no data" : ttype.key === "none" ? "Other land (no special type)" : esc(ttype.name)
      }</span>${Number.isFinite(cells.cluster?.[i]) ? `<span>Cluster ${num(cells.cluster[i])}</span>` : ""}<span>0.5° cell</span></p>
    </header>
    <div class="mv-top">
      <section class="mv-cmp" aria-label="Earth and ${esc(body)} close-up, side by side">
        ${compareHtml({ body: x.body, target, lat: cells.lat[i], lon: cells.lon[i], place: region })}
      </section>
      <section class="mv-verdict" aria-label="Verdict">
        <div class="overall">
          <div class="o-num" style="--c:${ok ? colour(s) : "#777"};--p:${ok ? (s * 100).toFixed(1) : 0}"><span class="o-label">Match</span><b${ok ? "" : ' class="none"'}>${ok ? score100(s) : "—"}</b><span class="o-of">${ok ? "of 100" : "not ranked"}</span></div>
          <div class="o-band">
            ${band ? `<span class="band b-${band.cls}">${icon(band.ic)}${band.word} match</span>` : `<span class="band b-none">${icon("info")}No band</span>`}
            <p class="o-for">${esc(x.weightsName)} for ${esc(target.name)}${x.yr ? ", year-round" : ""}</p>
          </div>
        </div>
        ${limiting(x, chs)}
        <details class="o-how"><summary>${icon("info")}How the score works${icon("chevron", "chev")}</summary>
        <p class="o-text">${
          ok
            ? "The match is a weighted mix of the challenge scores below. Each challenge score comes from its traits. A trait scores higher when more of Earth's land is further from the target than this place."
            : "Not enough of the weighted challenges have data here to give a match."
        }</p>
        <p class="v-bands"><b>Bands are our own labels, not data:</b> Close: 80 and up. Partial: 50 to 79. Weak: under 50.</p>
        </details>
        ${summary(x, chs)}
      </section>
    </div>
    <div class="mv-notes">
      ${lead ? `<section class="c-block mv-test"><h4>${icon("test")}What to test here</h4><p>${esc(lead.what_to_test)} <span class="muted">(${esc(lead.name)})</span></p></section>` : ""}
      ${head ? `<details class="c-block c-fold headline"><summary><h4>${icon("site")}Why this is the headline match</h4>${icon("chevron", "chev")}</summary><p><b>${esc(head.title)}.</b> ${esc(plainWhy(m, head.why))}</p></details>` : ""}
    </div>
    <section class="c-block mv-chs" aria-labelledby="mv-chs-h">
      <div class="mv-chs-head">
        <h4 id="mv-chs-h">Challenges</h4>
        <p class="key"><span><i class="kk band"></i>Earth's land range</span><span><i class="kk here"></i>this place</span><span><i class="kk tick"></i>${esc(body)} target or ideal</span><span>Open a tile to see its traits.</span></p>
      </div>
      <ol class="chs">${chs.map((c, k) => chTile(x, c, k, k === firstOpen)).join("")}</ol>
    </section>
    <div class="mv-strips">
      <section class="c-block strip strip-break"><h4>${icon("breaks")}Where it breaks</h4>${breaks(x, chs)}</section>
      <section class="c-block strip strip-cant" id="c-cant"><h4>${icon("cant")}Earth can't copy</h4>
        <p class="strip-sub">True for every place on Earth, whatever its score.</p>
        <table class="data cant"><thead><tr><th scope="col"><span class="sr">Condition</span></th><th scope="col">Earth</th><th scope="col">${body}</th><th scope="col">Source</th></tr></thead><tbody>${cc}</tbody></table>
      </section>
    </div>
    <div class="mv-more">
      <section class="c-block mv-seasons"><h4>${icon("seasons")}Seasons</h4>${seasons(x)}</section>
      ${unscored(x, chs)}
      ${regions(x)}
    </div>
  </article>`;
}

export function wireCard(el: HTMLElement): void {
  wireCompare(el);
}

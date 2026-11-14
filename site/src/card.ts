import "./card.css";
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

export const terrainOf = (c: Cols) => c.terrain_type ?? c.terrain;

export const isIce = (c: Cols, i: number) => (c.ice?.[i] ?? 0) >= 50;

export function placeName(m: Manifest, c: Cols, i: number): string {
  const r = c.region?.[i];
  return (Number.isFinite(r) && m.regions[r]) || latlon(c.lat[i], c.lon[i], 2);
}

const TILE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8";
const FALLBACK = `${import.meta.env.BASE_URL}img/blue-marble.jpg`;

function merc(lat: number, lon: number, n: number) {
  const r = (lat * Math.PI) / 180;
  return [((lon + 180) / 360) * n * 256, ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n * 256];
}

function earthImage(x: CardInput) {
  const lat = x.cells.lat[x.i];
  const lon = x.cells.lon[x.i];
  const caption = `NASA Blue Marble (GIBS), about 1.2 km per pixel at the equator. The square is this 0.5° cell.`;
  if (Math.abs(lat) > 84.5) return `<figure class="eimg none"><p>No map image beyond 85° latitude.</p></figure>`;
  const z = 7;
  const n = 2 ** z;
  const S = 256;
  const [cx, cy] = merc(lat, lon, n);
  const x0 = cx - S / 2;
  const y0 = cy - S / 2;
  const tiles: string[] = [];
  for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + S) / 256); ty++)
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + S) / 256); tx++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      tiles.push(`<img src="${TILE}/${z}/${ty}/${wx}.jpeg" alt="" loading="lazy" style="left:${tx * 256 - x0}px;top:${ty * 256 - y0}px" onerror="this.closest('.eimg').classList.add('fb')">`);
    }
  const [ax, ay] = merc(lat + 0.25, lon - 0.25, n);
  const [bx, by] = merc(lat - 0.25, lon + 0.25, n);
  const scale = 2 ** (z - 2);
  return `<figure class="eimg" style="--fb:url('${FALLBACK}');--fbs:${1024 * scale}px;--fbx:${-x0}px;--fby:${-y0}px">
      <div class="eimg-view" role="img" aria-label="Satellite image of Earth around this place, with the 0.5 degree cell outlined">${tiles.join("")}<i style="left:${ax - x0}px;top:${ay - y0}px;width:${bx - ax}px;height:${by - ay}px"></i></div>
      <figcaption>${caption}<span class="fb-note"> The live tiles did not load, so this is the bundled low-resolution copy of the same imagery.</span></figcaption>
    </figure>`;
}

const ds = (m: Manifest, id: string) => m.datasets.find((d) => d.id === id)?.name ?? id;

const short = (m: Manifest, id: string) => {
  const n = ds(m, id);
  return n.replace(/\s*\([^)]*\)/g, "").split(", ")[0].trim() || n;
};

const brief = (res: string) => res.replace(/\s*\([^)]*\)/g, "").trim() || res;

function sourceLine(m: Manifest, label: string, dataset: string, resolution: string) {
  return `<span><b>${esc(label)}</b> ${esc(ds(m, dataset))} · ${esc(brief(resolution))}</span>`;
}

function targetSource(x: CardInput, r: Row, label: string) {
  if (!r.tv) return "";
  if (r.tr.scored_by === "ideal") return `<span><b>${esc(label)}</b> a set goal, not a measurement</span>`;
  return sourceLine(x.m, label, r.tv.dataset, r.tv.resolution);
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

const yesNo = (tr: Trait) => tr.scored_by === "presence" && tr.unit === "%";
const count = (tr: Trait) => tr.scored_by === "presence" && tr.unit !== "%";
const side = (x: CardInput, tr: Trait) => (tr.scored_by === "ideal" ? "Ideal" : BODY[x.body]);

function val(tr: Trait, v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "no data";
  if (yesNo(tr)) return v >= 50 ? "Yes" : "No";
  return num(v, tr.digits) + unit(tr.unit);
}

function flags(r: Row, label: string) {
  const tv = r.tv!.value!;
  if (yesNo(r.tr)) {
    const here = r.ev >= 50;
    const there = tv >= 50;
    return `<div class="flags" role="img" aria-label="Here: ${here ? "yes" : "no"}. ${esc(label)}: ${there ? "yes" : "no"}.">
      <span class="flag${here ? " on" : ""}"><i></i>Here: ${here ? "yes" : "no"}</span>
      <span class="flag${there ? " on" : ""}"><i></i>${esc(label)}: ${there ? "yes" : "no"}</span>
      <span class="flag-res">${here === there ? "Same" : "Differs"}</span></div>`;
  }
  const n = Math.max(1, Math.round(Math.max(tv, r.ev, Number.isFinite(r.hi) ? r.hi : 0)));
  const pips = (v: number) => Array.from({ length: n }, (_, k) => `<i class="${k < Math.round(v) ? "on" : ""}"></i>`).join("");
  return `<div class="pips" role="img" aria-label="Here: ${num(r.ev)}. ${esc(label)}: ${num(tv)}.">
    <span><b>Here</b>${pips(r.ev)}</span><span><b>${esc(label)}</b>${pips(tv)}</span></div>`;
}

function notes(x: CardInput, r: Row, missing: boolean) {
  const who = side(x, r.tr);
  const tv = r.tv;
  const parts = [
    !missing && r.tr.note ? `<p><b>Earth side.</b> ${esc(r.tr.note)}</p>` : "",
    !missing && tv?.note ? `<p><b>${esc(who)} side.</b> ${esc(tv.note)}</p>` : "",
    `<p><b>How the Earth value is worked out.</b> ${esc(r.tr.earth_stat)}. Resolution: ${esc(r.tr.earth_resolution)}.</p>`,
    tv
      ? `<p><b>How the ${r.tr.scored_by === "ideal" ? "ideal" : `${esc(who)} value`} is set.</b> ${esc(tv.stat)}${tv.kind !== "computed" ? ` (${esc(tv.kind)})` : ""}. ${
          r.tr.scored_by === "ideal" ? "" : `Source: ${esc(ds(x.m, tv.dataset))}. `
        }Resolution: ${esc(tv.resolution)}.</p>`
      : "",
  ].join("");
  return parts ? `<details class="t-notes"><summary>Notes</summary>${parts}</details>` : "";
}

function ruler(r: Row, body: string) {
  const tv = r.tv?.value;
  if (!Number.isFinite(r.ev) || tv == null || !Number.isFinite(r.lo)) return "";
  if (r.tr.scored_by === "presence") return flags(r, body);
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
  const label = side(x, r.tr);
  const u = unit(r.tr.unit);
  const d = r.tr.digits;
  const tv = r.tv?.value;
  const missing = !Number.isFinite(r.ev)
    ? `No Earth data for this place.${r.tr.note ? ` ${esc(r.tr.note)}` : ""}`
    : tv == null
      ? `Not scored: no ${esc(label)} value.${r.tv?.note ? ` ${esc(r.tv.note)}` : ""}`
      : "";
  const gap = Number.isFinite(r.ev) && tv != null ? Math.abs(r.ev - tv) : NaN;
  const gapText = !Number.isFinite(gap) ? "—" : yesNo(r.tr) ? ((r.ev >= 50) === (tv! >= 50) ? "none" : "differs") : num(gap, d) + u;
  const rank = Number.isFinite(r.rank)
    ? `<span class="t-rank" style="--c:${colour(r.rank)}"><i></i>Earth rank ${score100(r.rank)}</span>`
    : `<span class="t-rank none">not ranked</span>`;
  return `<li class="trait">
    <div class="t-head"><span class="t-name">${esc(r.tr.label)}</span>${rank}</div>
    <p class="t-plain">${esc(why || r.tr.plain)}</p>
    ${missing ? `<p class="t-missing">${missing}</p>` : ruler(r, label)}
    <dl class="t-vals">
      <div><dt>Here</dt><dd>${val(r.tr, r.ev)}</dd></div>
      <div><dt>Gap</dt><dd>${gapText}</dd></div>
      <div><dt>${esc(label)}</dt><dd>${val(r.tr, tv)}</dd></div>
    </dl>
    <p class="t-src">${sourceLine(x.m, "Earth", r.tr.earth_dataset, r.tr.earth_resolution)}${targetSource(x, r, label)}</p>
    ${notes(x, r, !!missing)}
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
    .map(({ r, text }) => `<li><span class="b-name">${esc(r.tr.label)}</span><span>${text} <span class="b-src">Earth: ${esc(short(x.m, r.tr.earth_dataset))}</span></span></li>`)
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
  return `<section class="c-block c-sum" aria-label="Summary">
    <div class="sum-row sum-ok"><h5 class="sum-k">Matches</h5>${list(top, "no data")}</div>
    <div class="sum-row sum-bad"><h5 class="sum-k">Breaks</h5>${list(weak, all.length ? "No trait in this filter is weak here." : "no data")}</div>
    <div class="sum-row sum-cant"><h5 class="sum-k">Earth can't copy</h5><p>${x.body === "moon" ? "The Moon's" : "Mars's"} ${esc(said)}. <a href="#c-cant">See the table below.</a></p></div>
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
      : `<details class="t-notes"${lim ? " open" : ""}><summary>${lim ? "At the instrument's limit: note" : "Notes"}</summary><p>${esc(v.note)}</p></details>`
    : "";
  return `<span class="s-val">${BODY[x.body]}: <b>${shownText(x, key, v)}</b>${lim ? ' <span class="tag warn">limit</span>' : ""}</span><span class="s-src">${src}</span>${note}`;
}

function unscored(x: CardInput, chs: Challenge[]) {
  const items = chs.flatMap((c) => c.labels.map((l) => ({ c, l })));
  const used = new Set(items.map(({ l }) => l.target_key).filter(Boolean));
  const extra = Object.entries(x.target.shown).filter(([k]) => !used.has(k));
  if (!items.length && !extra.length) return "";
  return `<details class="c-block c-fold"><summary><h4>Shown, not scored <span class="muted">(${items.length + extra.length})</span></h4></summary><ul class="labels">
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
  return `<details class="c-block regions"><summary>The ${rs.length} regions' own values</summary>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Region</th>${keys
      .map((k) => `<th scope="col">${esc(tr(k)?.label ?? k)}${tr(k)?.unit ? ` <span class="muted">${esc(tr(k)!.unit)}</span>` : ""}</th>`)
      .join("")}</tr></thead><tbody>${body}</tbody></table></div>
    ${marks.length ? `<ol class="marks small">${marks.map((k) => `<li><b>${esc(k.region)}, ${esc(k.label)}:</b> ${esc(k.note)}</li>`).join("")}</ol>` : ""}
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
  const ice = cells.ice?.[i];
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
        Number.isFinite(far) && far > 100 ? ` <span class="rare">Rarely used: ${num(far)} km from any known analog</span>` : ""
      }${
        isIce(cells, i) ? ` <span class="tag ice">Ice sheet: ${num(ice)}% permanent ice</span>` : ""
      }</p>
      <h3 id="card-title">${esc(region)}</h3>
      <p class="c-meta">${region === latlon(cells.lat[i], cells.lon[i], 2) ? "" : `<span>${latlon(cells.lat[i], cells.lon[i])}</span>`}<span>${!ttype ? "Terrain type: no data" : ttype.key === "none" ? "Other land (no special type)" : esc(ttype.name)}</span>${
        Number.isFinite(cells.cluster?.[i]) ? `<span>Cluster ${num(cells.cluster[i])}</span>` : ""
      }<span>0.5° cell</span></p>
    </header>
    ${summary(x, chs)}
    ${head ? `<details class="c-block c-fold headline"><summary><h4>Why this is the headline match</h4></summary><p><b>${esc(head.title)}.</b> ${esc(plainWhy(m, head.why))}</p></details>` : ""}
    <section class="c-block">
      <div class="overall">
        <div class="o-num" style="--c:${Number.isFinite(s) ? colour(s) : "#777"}"><span class="o-label">Match</span><b>${Number.isFinite(s) ? score100(s) : "—"}</b></div>
        <p class="o-text">${esc(x.weightsName)} for ${esc(target.name)}${x.yr ? ", year-round" : ""}. ${
          Number.isFinite(s)
            ? "The match is a weighted mix of the challenge scores below. Each challenge score comes from its traits. A trait scores higher when more of Earth's land is further from the target than this place."
            : "Not enough of the weighted challenges have data here to give a match."
        }</p>
      </div>
      <p class="key small muted"><span><i class="kk band"></i>Earth's land range</span><span><i class="kk dot"></i>this place</span><span><i class="kk tick"></i>target</span><span><i class="kk gap"></i>the gap, in real units</span></p>
      <ol class="chs">${chRows}</ol>
    </section>
    ${lead ? `<section class="c-block"><h4>What to test here</h4><p>${esc(lead.what_to_test)} <span class="muted">(${esc(lead.name)})</span></p></section>` : ""}
    <section class="c-block"><h4>Earth and ${esc(body)} side by side</h4><div class="pair">${earthImage(x)}<p class="pair-t">The ${esc(body)} side is the globe above, turned to ${esc(target.name)}. Earth can't show the target's low gravity, air or radiation: see below.</p></div></section>
    <section class="c-block"><h4>Where it breaks</h4>${breaks(x, chs)}</section>
    <section class="c-block" id="c-cant"><h4>Earth can't copy</h4>
      <div class="scroll-x"><table class="data cant"><thead><tr><th scope="col"></th><th scope="col">Earth</th><th scope="col">${body}</th><th scope="col">Source</th></tr></thead><tbody>${cc}</tbody></table></div>
    </section>
    <section class="c-block"><h4>Seasons</h4>${seasons(x)}</section>
    ${unscored(x, chs)}
    ${regions(x)}
  </article>`;
}

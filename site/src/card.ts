import "./card.css";
import { compareHtml, wireCompare } from "./compare";
import type { Challenge, Manifest, TargetValue, Trait } from "./contract";
import type { Cols } from "./data";
import { trekUrl, worldviewUrl } from "./export";
import { MONTHS, MONTH_NAMES, bits, esc, fmtSup, latlon, monthRanges, num, score100, targetName, unit } from "./format";
import { icon } from "./icons";
import { createPicker, type PickerOption } from "./picker";
import { BANDS, bandOf, isNew, shortName } from "./rank";
import { coverage } from "./score";
import { BODY, breakRows, ds, row, same, scoreChip, scoredRows, short, traitHtml, val, type Row, type TraitInput } from "./traits";
import { VITAL_ICONS, dedupeVitalSources, parseVitals } from "./vitals";

export { BODY };

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

const SVG_LINK = `<svg class="ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
const SVG_DOWNLOAD = `<svg class="ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;
const SVG_EXTERNAL = `<svg class="ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
const SVG_PRINT = `<svg class="ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>`;

export interface CardInput extends TraitInput {
  score: Float32Array;
  place: number;
  ranked: number;
  hand?: boolean;
  weightsName: string;
  plain: string;
  yr: boolean;
}

export interface CardHandlers {
  presetOptions?: PickerOption[];
  presetValue?: string;
  onPreset?: (filterId: string) => void;
  onYearRound?: () => void;
  onCsv?: () => void;
}

export const terrainOf = (c: Cols) => c.terrain_type ?? c.terrain;

export const isIce = (c: Cols, i: number) => (c.ice?.[i] ?? 0) >= 50;

export function placeName(m: Manifest, c: Cols, i: number): string {
  const r = c.region?.[i];
  return (Number.isFinite(r) && m.regions[r]) || latlon(c.lat[i], c.lon[i], 2);
}

const chScore = (x: CardInput, c: Challenge) => x.t[`ch:${c.id}`]?.[x.i] ?? NaN;

const words = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

function verdict(x: CardInput, chs: Challenge[]) {
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
  return `<li class="ch${w > 0 ? "" : " off"}" id="ch-item-${esc(c.id)}">
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

type SeasonKind = "best" | "frz" | "rain" | "both" | "frozen";

function monthRegime(best: boolean, frz: boolean, rain: boolean): { kind: SeasonKind; label: string; detail: string } {
  if (best) return { kind: "best", label: "Best", detail: "Dry, frost-free · usable" };
  if (frz && rain) return { kind: "both", label: "Freeze–thaw & Rainy", detail: "Crosses 0 °C and wet · not usable" };
  if (frz) return { kind: "frz", label: "Freeze–thaw", detail: "Crosses 0 °C daily · not usable" };
  if (rain) return { kind: "rain", label: "Rainy", detail: "Seasonal rain peak · not usable" };
  return { kind: "frozen", label: "Frozen", detail: "Below 0 °C all day · not usable" };
}

function seasons(x: CardInput) {
  const c = x.cells;
  const best = c.m_best?.[x.i];
  const frz = c.m_freeze?.[x.i];
  const rain = c.m_rain?.[x.i];
  const usable = c.usable?.[x.i];
  if (![best, frz, rain].some(Number.isFinite)) return `<p class="muted">No monthly climate data for this place.</p>`;
  const bestB = bits(best);
  const frzB = bits(frz);
  const rainB = bits(rain);
  const frozenB = bestB.map((on, k) => !on && !frzB[k] && !rainB[k]);
  const regs = bestB.map((on, k) => monthRegime(on, frzB[k], rainB[k]));
  const firstBest = bestB.indexOf(true);
  const defaultM = firstBest >= 0 ? firstBest : 0;
  const def = regs[defaultM];
  const strip = regs
    .map(
      (r, k) =>
        `<button type="button" class="se-m${k === defaultM ? " is-selected" : ""}" data-m="${k}" data-kind="${r.kind}" data-mname="${MONTH_NAMES[k]}" data-rlabel="${esc(
          r.label,
        )}" data-rdetail="${esc(r.detail)}" aria-pressed="${k === defaultM}" aria-label="${esc(`${MONTH_NAMES[k]}: ${r.label} — ${r.detail}`)}"><span class="se-m-bar" aria-hidden="true"></span><span class="se-m-lbl">${
          MONTHS[k]
        }</span></button>`,
    )
    .join("");
  return `<p class="se-k"><b>${Number.isFinite(usable) ? num(usable) : "no data"}</b> of 12 months usable <span class="muted">· ${esc(short(x.m, "power_merra2"))}</span></p>
    <div class="se-cal" data-selected="${defaultM}">
      <div class="se-strip" role="group" aria-label="Monthly climate windows">${strip}</div>
      <div class="se-readout" aria-live="polite" data-kind="${def.kind}">
        <i class="se-sw" data-kind="${def.kind}" aria-hidden="true"></i>
        <p class="se-ro-txt"><b class="se-ro-m">${MONTH_NAMES[defaultM]}</b><span class="se-ro-sep" aria-hidden="true">·</span><span class="se-ro-kind">${esc(
          def.label,
        )}</span><span class="se-ro-dash" aria-hidden="true">—</span><span class="se-ro-detail">${esc(def.detail)}</span></p>
      </div>
    </div>
    <ul class="se-legend" aria-label="Climate regimes">
      <li><i class="se-sw" data-kind="best" aria-hidden="true"></i><span class="se-lg-n">Best</span><span class="se-lg-r">${esc(monthRanges(bestB))}</span></li>
      <li><i class="se-sw" data-kind="frz" aria-hidden="true"></i><span class="se-lg-n">Freeze–thaw</span><span class="se-lg-r">${esc(monthRanges(frzB))}</span></li>
      <li><i class="se-sw" data-kind="rain" aria-hidden="true"></i><span class="se-lg-n">Rainy</span><span class="se-lg-r">${esc(monthRanges(rainB))}</span></li>
      <li><i class="se-sw" data-kind="frozen" aria-hidden="true"></i><span class="se-lg-n">Frozen</span><span class="se-lg-r">${esc(monthRanges(frozenB))}</span></li>
    </ul>
    ${x.yr ? `<p class="se-yr">${icon("info")}<span><b>Year-round testing is on.</b> ${esc(x.m.scoring.yearround_rule)}</span></p>` : ""}`;
}

function cantCopy(x: CardInput) {
  const rows = parseVitals(x.m, x.body);
  const sources = dedupeVitalSources(rows, x.body);
  return `<p class="pl-sub">True for every place on Earth, at every score.</p>
    <div class="cant" data-body="${x.body}" role="list" aria-label="${esc(`${BODY[x.body]} conditions Earth cannot copy`)}">${rows
      .map((v) => {
        const track = v.alert
          ? `<span class="cant-fill is-rad" style="width:100%"></span><span class="cant-earth-tick" style="width:${Math.max(1.2, v.earthPct).toFixed(2)}%"></span>`
          : v.trace
            ? `<span class="cant-fill is-trace"></span>`
            : `<span class="cant-fill${v.worldPct < 3 ? " is-thin" : ""}" style="width:${v.worldPct.toFixed(2)}%"></span>`;
        return `<div class="cant-row" role="listitem" data-vital="${v.id}">
          <div class="cant-head">
            <span class="cant-label">${VITAL_ICONS[v.id]}${esc(v.label)}</span>
            ${v.pill ? `<span class="cant-pill${v.alert ? " is-rad" : ""}">${esc(v.pill)}</span>` : ""}
          </div>
          <div class="cant-vals">
            <span class="cant-val"><b>${fmtSup(v.worldValue)}</b>${v.worldSub ? `<small>${fmtSup(v.worldSub)}</small>` : ""}</span>
            <span class="cant-ref${v.alert ? " is-tick" : ""}"><span>Earth ${fmtSup(v.earthLabel)}</span></span>
          </div>
          <div class="cant-track" aria-hidden="true">${track}</div>
          ${v.note ? `<p class="cant-note">${esc(v.note)}</p>` : ""}
        </div>`;
      })
      .join("")}<p class="cant-src">Sources: ${sources
        .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.source)}</a>`)
        .join(" · ")}</p></div>`;
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
  const badge = (ag: string): [string, string] => {
    if (ag === "NASA") return ["nasa", "NASA"];
    if (ag === "USGS") return ["usgs", "USGS"];
    if (ag === "ESA") return ["esa", "ESA"];
    if (ag === "computed") return ["calc", "Calculated"];
    return ["open", "Open data"];
  };
  const li = (id: string) => {
    const d = x.m.datasets.find((d) => d.id === id);
    if (!d) return `<li>${esc(id)}</li>`;
    const [key, label] = badge(d.agency);
    return `<li><span class="ds-name">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.name)}</a>` : esc(d.name)}</span><span class="ds-ag" data-ag="${key}">${esc(label)}</span></li>`;
  };
  return `<div class="ds-cols">
    <div><h3>Earth values</h3><ul class="ds">${[...earth].map(li).join("")}</ul></div>
    <div><h3>${esc(BODY[x.body])} values</h3><ul class="ds">${[...there].map(li).join("")}</ul></div>
  </div>
  <p class="muted small">Images: NASA GIBS (ASTER GDEM Greyscale Shaded Relief, Blue Marble: Shaded Relief and Bathymetry) and ESA Copernicus Sentinel-2 Cloudless 2024 (via EOX, CC BY 4.0) for Earth; NASA ${esc(BODY[x.body])} Trek for the ${esc(BODY[x.body])}. Each value above names its own dataset; open "Method and notes" under any trait for the full method.</p>`;
}

function ringHtml(s: number, b: { cls: string; word: string } | null) {
  const ok = Number.isFinite(s);
  const frac = ok ? Math.max(0, Math.min(1, s)) : 0;
  const offset = RING_C * (1 - frac);
  return `<div class="ring" data-band="${b ? b.cls : "b-na"}" style="--p:${ok ? (s * 100).toFixed(1) : 0}" role="img" aria-label="${ok ? `Match score ${score100(s)} / 100` : "No match score"}">
    <svg class="ring-svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="ring-track" cx="60" cy="60" r="${RING_R}" />
      <circle class="ring-arc${ok ? "" : " is-empty"}" cx="60" cy="60" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" />
    </svg>
    <b>${ok ? score100(s) : "—"}</b><span>${ok ? "/ 100" : "not ranked"}</span>
  </div>`;
}

function checkStrip(x: CardInput) {
  const body = BODY[x.body];
  const lat = x.cells.lat[x.i];
  const lon = x.cells.lon[x.i];
  const wv = worldviewUrl(lat, lon, x.m.generated);
  const tk = trekUrl(x.target);
  return `<div class="pl-check" role="region" aria-label="Check it yourself">
    <div class="pl-check-head">
      <h3>Check it yourself</h3>
      <p class="muted small">Export every number here, verify the coordinates in NASA's own viewers, or save a print report.</p>
    </div>
    <div class="pl-check-actions">
      <button type="button" class="pl-act" id="pl-csv">${SVG_DOWNLOAD}<span>Download CSV</span></button>
      <a class="pl-act" id="pl-worldview" href="${esc(wv)}" target="_blank" rel="noopener noreferrer">${SVG_EXTERNAL}<span>Open in NASA Worldview</span></a>
      <a class="pl-act" id="pl-trek" href="${esc(tk)}" target="_blank" rel="noopener noreferrer">${SVG_EXTERNAL}<span>Open in NASA ${esc(body)} Trek</span></a>
      <button type="button" class="pl-act" id="pl-print">${SVG_PRINT}<span>Print / Save PDF</span></button>
    </div>
  </div>`;
}

function snapStrip(x: CardInput, chs: Challenge[]) {
  const usable = x.cells.usable?.[x.i];
  const usableTxt = Number.isFinite(usable) ? `${num(usable)} / 12 mo usable` : "";
  const items = chs
    .map((c) => {
      const v = chScore(x, c);
      const w = x.weights[c.id] ?? 0;
      const b = bandOf(v);
      const pct = b ? (v * 100).toFixed(1) : "0";
      return `<a class="pl-snap-row${w > 0 ? "" : " is-off"}" href="#ch-item-${esc(c.id)}" data-open-ch="${esc(c.id)}" data-band="${b ? b.cls : "b-na"}">
        <span class="pl-snap-top"><span class="pl-snap-n">${esc(shortName(c.id, c.name))}</span><span class="pl-snap-v">${b ? score100(v) : "—"}</span></span>
        <span class="pl-snap-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      </a>`;
    })
    .join("");
  return `<div class="pl-snap" aria-label="Score overview by challenge">
    <div class="pl-snap-head">
      <span>Score overview</span>
      ${usableTxt ? `<a class="pl-snap-mo" href="#pl-se-h">${esc(usableTxt)}</a>` : ""}
    </div>
    <div class="pl-snap-grid">${items}</div>
  </div>`;
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
  const isHand = !!x.hand;
  const tFull = targetName(target.name);
  const tShort = targetName(target.short);
  const rawCoords = `${cells.lat[i].toFixed(4)}, ${cells.lon[i].toFixed(4)}`;
  return `<article class="card pl" aria-labelledby="place-h">
    <div class="pl-top">
      <header class="pl-hero" data-body="${x.body}">
        <div class="pl-for">
          <div class="pl-for-id" title="Match on Earth for ${esc(tFull)}">
            <span class="pl-body" data-body="${x.body}">${body}</span>
            <span class="pl-for-txt"><b>${esc(tShort)}</b></span>
          </div>
          <div class="pl-for-ctl">
            <span class="pl-preset" id="pl-preset-wrap" title="Switch mission preset"></span>
            <button type="button" class="pl-yr" id="pl-yr" aria-pressed="${x.yr ? "true" : "false"}"${isHand ? ' disabled title="Reset custom weights in Finder to use Year-round"' : ' title="Prefer places usable all year"'}><span class="pl-yr-dot" aria-hidden="true"></span>Year-round</button>
          </div>
        </div>
        <div class="pl-id">
          <h1 id="place-h" tabindex="-1">${esc(region)}</h1>
          <p class="pl-meta"><span>${latlon(cells.lat[i], cells.lon[i])}</span><span>${!ttype ? "Terrain: no data" : ttype.key === "none" ? "Other land" : esc(ttype.name)}</span><span>~50 km cell (0.5°)</span></p>
          <div class="pl-id-bar">
            ${fresh || isIce(cells, i) ? `<p class="pl-flags">${fresh ? `<span><span class="rk-new">New</span>${num(far)} km from nearest known analog</span>` : ""}${isIce(cells, i) ? `<span><span class="tag ice">Ice sheet</span>${num(cells.ice?.[i])}% permanent ice</span>` : ""}</p>` : `<span></span>`}
            <div class="pl-copy-grp">
              <button type="button" class="pl-copy" data-copy="link" aria-label="Copy link to this place" title="Copy link">${SVG_LINK}<span>Copy link</span></button>
              <button type="button" class="pl-copy" data-copy="coords" data-coords="${esc(rawCoords)}" aria-label="Copy coordinates" title="Copy coordinates">${icon("pin")}<span>Copy coords</span></button>
            </div>
          </div>
        </div>
        <div class="pl-score-well">
          ${ringHtml(s, b)}
          <div class="pl-summary">
            <div class="pl-rank">
              ${Number.isFinite(x.place) ? `<p class="pl-rank-main"><b>#${num(x.place)}</b><span>of ${num(x.ranked)} ranked cells</span><span class="pl-rank-pill">Top ${topShare(x.place, x.ranked)}</span></p>` : `<p class="pl-rank-main">No rank with these settings</p>`}
            </div>
            <p class="pl-verdict">${esc(verdict(x, chs))}</p>
            ${lead ? `<p class="pl-test">${icon("test")}<span><b>Test here:</b> ${esc(lead.what_to_test)}</span></p>` : ""}
          </div>
        </div>
        ${snapStrip(x, chs)}
        <div class="pl-folds">
          ${head ? `<details class="pl-fold"><summary>Why this is the main match${icon("chevron", "chev")}</summary><p><b>${esc(head.title)}.</b> ${esc(plainWhy(m, head.why))}</p></details>` : ""}
          <details class="pl-fold"><summary>How the score works${icon("chevron", "chev")}</summary>
            <p>${ok ? "The match score combines the challenge scores below with the weights of the preset. A challenge score comes from its traits: a trait scores higher when more land on Earth is farther from the base-site value than this place." : "Too many weighted challenges have no data here, so there is no match score."}</p>
            <p><b>${esc(x.weightsName)}:</b> ${esc(x.plain)}</p>
            <p class="muted">${esc(tFull)}: ${esc(target.anchor_note)}</p>
            <p class="pl-bands">${BANDS.map((bb) => `<span><i class="fc ${bb.cls}"></i>${bb.word}${Number.isFinite(bb.min) ? ` ${num(bb.min * 100)}+` : ""}</span>`).join("")}</p>
          </details>
        </div>
      </header>
      <section class="pl-cmp" aria-labelledby="pl-cmp-h">
        <h2 id="pl-cmp-h" class="sr">Earth beside ${esc(tFull)}</h2>
        ${compareHtml({ body: x.body, target, lat: cells.lat[i], lon: cells.lon[i], place: region })}
      </section>
    </div>
    <div class="pl-mb" id="pl-mb">
      <section class="pl-sec pl-match" aria-labelledby="pl-match-h"><h2 id="pl-match-h">${icon("check")}What matches</h2>${matches(x, chs)}</section>
      <section class="pl-sec pl-break" id="breaks" aria-labelledby="pl-break-h"><h2 id="pl-break-h">${icon("breaks")}Where it breaks</h2>${breaks(x, chs)}</section>
    </div>
    <section class="pl-sec pl-chs" aria-labelledby="pl-chs-h">
      <div class="pl-chs-head">
        <div class="pl-chs-top">
          <h2 id="pl-chs-h">Score breakdown</h2>
          <button type="button" class="pl-toggle-all" aria-expanded="false">Expand all</button>
        </div>
        <p class="key">
          <span class="key-grp">${BANDS.map((bb) => `<span><i class="fc ${bb.cls}"></i>${bb.word}</span>`).join("")}</span>
          <span class="key-grp"><span><i class="kk band"></i>Earth's range</span><span><i class="kk here"></i>here</span><span><i class="kk tick"></i>${esc(body)} or ideal</span></span>
        </p>
      </div>
      <ol class="chs">${chs.map((c, k) => chTile(x, c, k === firstOpen)).join("")}</ol>
    </section>
    <div class="pl-pair">
      <section class="pl-sec pl-seasons" aria-labelledby="pl-se-h"><h2 id="pl-se-h">${icon("seasons")}Seasons</h2>${seasons(x)}</section>
      <section class="pl-sec pl-cant" id="c-cant" aria-labelledby="pl-cant-h"><h2 id="pl-cant-h">${icon("cant")}Earth cannot copy</h2>${cantCopy(x)}</section>
    </div>
    <section class="pl-sec pl-data" aria-labelledby="pl-data-h">
      <h2 id="pl-data-h">${icon("sources")}Data sources</h2>
      ${checkStrip(x)}
      ${datasets(x, chs)}
      ${unscored(x, chs)}
      ${regions(x)}
    </section>
  </article>`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for restricted clipboard contexts.
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function wireCard(el: HTMLElement, handlers?: CardHandlers): () => void {
  const disposeCompare = wireCompare(el);
  const timers: number[] = [];

  const presetHost = el.querySelector<HTMLElement>("#pl-preset-wrap");
  const presetPicker =
    presetHost && handlers?.presetOptions?.length
      ? createPicker(presetHost, {
          id: "pl-preset",
          ariaLabel: "Mission preset",
          prefix: "Focus",
          options: handlers.presetOptions,
          value: handlers.presetValue ?? handlers.presetOptions[0].value,
          variant: "pill",
          align: "right",
          minMenuWidth: 284,
          onChange(val) {
            if (val && val !== "__custom") handlers.onPreset?.(val);
          },
        })
      : null;

  el.querySelectorAll<HTMLAnchorElement>(".pl-snap-row[data-open-ch]").forEach((link) => {
    link.addEventListener("click", () => {
      const targetLi = el.querySelector<HTMLElement>(`#ch-item-${CSS.escape(link.dataset.openCh ?? "")}`);
      const det = targetLi?.querySelector<HTMLDetailsElement>("details");
      if (det && !det.open) det.open = true;
    });
  });

  const yr = el.querySelector<HTMLButtonElement>("#pl-yr");
  yr?.addEventListener("click", () => {
    if (!yr.disabled) handlers?.onYearRound?.();
  });

  const csvBtn = el.querySelector<HTMLButtonElement>("#pl-csv");
  csvBtn?.addEventListener("click", () => handlers?.onCsv?.());

  const printBtn = el.querySelector<HTMLButtonElement>("#pl-print");
  printBtn?.addEventListener("click", () => window.print());

  el.querySelectorAll<HTMLButtonElement>(".pl-copy").forEach((btn) => {
    const label = btn.querySelector<HTMLElement>("span");
    const idleText = label?.textContent ?? "";
    let resetId = 0;
    btn.addEventListener("click", () => {
      const value = btn.dataset.copy === "coords" ? (btn.dataset.coords ?? "") : location.href;
      void copyText(value).then(() => {
        if (resetId) clearTimeout(resetId);
        btn.dataset.copied = "true";
        if (label) label.textContent = "Copied";
        resetId = window.setTimeout(() => {
          delete btn.dataset.copied;
          if (label) label.textContent = idleText;
        }, 2000);
        timers.push(resetId);
      });
    });
  });

  const toggleAll = el.querySelector<HTMLButtonElement>(".pl-toggle-all");
  const details = [...el.querySelectorAll<HTMLDetailsElement>(".ch > details")];
  const syncToggleAll = () => {
    if (!toggleAll || !details.length) return;
    const allOpen = details.every((d) => d.open);
    toggleAll.textContent = allOpen ? "Collapse all" : "Expand all";
    toggleAll.setAttribute("aria-expanded", String(allOpen));
  };
  if (toggleAll && details.length) {
    syncToggleAll();
    toggleAll.addEventListener("click", () => {
      const open = !details.every((d) => d.open);
      for (const d of details) d.open = open;
      syncToggleAll();
    });
    for (const d of details) d.addEventListener("toggle", syncToggleAll);
  }

  const seCal = el.querySelector<HTMLElement>(".se-cal");
  if (seCal) {
    const strip = seCal.querySelector<HTMLElement>(".se-strip");
    const btns = [...seCal.querySelectorAll<HTMLButtonElement>(".se-m")];
    const readout = seCal.querySelector<HTMLElement>(".se-readout");
    const roSw = readout?.querySelector<HTMLElement>(".se-sw");
    const roM = readout?.querySelector<HTMLElement>(".se-ro-m");
    const roKind = readout?.querySelector<HTMLElement>(".se-ro-kind");
    const roDetail = readout?.querySelector<HTMLElement>(".se-ro-detail");
    let selectedIdx = Number(seCal.dataset.selected) || 0;

    const showMonth = (idx: number) => {
      const btn = btns[idx];
      if (!btn || !readout) return;
      const kind = btn.dataset.kind ?? "frozen";
      readout.dataset.kind = kind;
      if (roSw) roSw.dataset.kind = kind;
      if (roM) roM.textContent = btn.dataset.mname ?? "";
      if (roKind) roKind.textContent = btn.dataset.rlabel ?? "";
      if (roDetail) roDetail.textContent = btn.dataset.rdetail ?? "";
      btns.forEach((b, k) => b.classList.toggle("is-preview", k === idx && k !== selectedIdx));
    };

    const selectMonth = (idx: number) => {
      if (!btns[idx]) return;
      selectedIdx = idx;
      seCal.dataset.selected = String(idx);
      btns.forEach((b, k) => {
        const on = k === idx;
        b.classList.toggle("is-selected", on);
        b.setAttribute("aria-pressed", String(on));
      });
      showMonth(idx);
    };

    strip?.addEventListener("click", (e) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>(".se-m");
      if (!btn) return;
      const idx = Number(btn.dataset.m);
      if (Number.isInteger(idx)) selectMonth(idx);
    });
    strip?.addEventListener("pointerover", (e) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>(".se-m");
      if (!btn) return;
      const idx = Number(btn.dataset.m);
      if (Number.isInteger(idx)) showMonth(idx);
    });
    strip?.addEventListener("pointerleave", () => showMonth(selectedIdx));
    strip?.addEventListener("focusin", (e) => {
      const btn = (e.target as Element | null)?.closest<HTMLButtonElement>(".se-m");
      if (!btn) return;
      const idx = Number(btn.dataset.m);
      if (Number.isInteger(idx)) showMonth(idx);
    });
    strip?.addEventListener("focusout", (e) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !strip.contains(next)) showMonth(selectedIdx);
    });
    strip?.addEventListener("keydown", (e) => {
      const cur = (e.target as Element | null)?.closest<HTMLButtonElement>(".se-m");
      if (!cur || !btns.length) return;
      const curIdx = Number(cur.dataset.m);
      if (!Number.isInteger(curIdx)) return;
      let to = -1;
      if (e.key === "ArrowRight") to = (curIdx + 1) % btns.length;
      else if (e.key === "ArrowLeft") to = (curIdx - 1 + btns.length) % btns.length;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = btns.length - 1;
      if (to >= 0) {
        e.preventDefault();
        btns[to].focus({ preventScroll: true });
      }
    });
  }

  return () => {
    presetPicker?.destroy();
    disposeCompare();
    for (const id of timers) clearTimeout(id);
  };
}

import "./learn.css";
import { placeName } from "../card";
import type { Body, CantCopy, LabelPoint, Manifest, Target, Trait } from "../contract";
import { bindPillRange, syncPillRange } from "../controls";
import type { Cols } from "../data";
import { bits, esc, num, reduced, unit } from "../format";
import type { Page } from "../router";
import { top } from "../score";
import { home, type Ctx } from "./ctx";
import { LOADS, PHOTOS } from "./learn-data";

const IMG = `${import.meta.env.BASE_URL}img/`;
const WORLD = { moon: "the Moon", mars: "Mars" };
const WORLD_TAB = { moon: "The Moon", mars: "Mars" };
const NAME = { earth: "Earth", moon: "Moon", mars: "Mars" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const CLOSE = 0.8;
const TEMPS: Record<string, [string, string]> = {
  cold: ["Coldest", "The lowest temperature of the ground."],
  season_swing: ["Summer to winter", "How much the ground temperature changes in one year."],
  day_swing_air: ["Day to night", "How much the air temperature changes between day and night."],
  day_swing_ground: ["Day to night, ground", "How much the ground temperature changes between day and night."],
};
const KELVIN: Record<string, string> = { cold: "t_min_k" };
const LEDE: Record<Body, string> = {
  moon: "Low gravity, vacuum, extreme cold, and high radiation. Earth can match the terrain and light—not the rest.",
  mars: "One-third gravity, thin air, cold nights, and fine dust. Earth can match the rock and dryness—not the rest.",
};

type VitalId = "gravity" | "air" | "radiation";

const ICONS: Record<VitalId, string> = {
  gravity:
    '<svg class="ln-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v8M5 7.5 8 10.5l3-3M3 13.5h10"/></svg>',
  air: '<svg class="ln-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 5.5h8.5a2 2 0 1 0-1.9-2.6M2 8.5h11a1.75 1.75 0 1 1-1.65 2.35M2 11.5h5.5"/></svg>',
  radiation:
    '<svg class="ln-ico" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v2.2M8 12v2.2M1.8 8H4M12 8h2.2M3.6 3.6l1.55 1.55M10.85 10.85l1.55 1.55M12.4 3.6l-1.55 1.55M5.15 10.85 3.6 12.4"/></svg>',
};

interface Vital {
  id: VitalId;
  label: string;
  worldValue: string;
  worldSub: string;
  earthLabel: string;
  pill: string;
  worldPct: number;
  earthPct: number;
  trace: boolean;
  alert: boolean;
  note: string;
  source: string;
  url: string;
}

interface Side {
  value: number;
  kelvin: number | null;
  source: string;
  url: string;
  res: string;
}

interface Pair {
  trait: Trait;
  world: Side;
  earth: Side;
  close: boolean;
}

const defaultFilter = (m: Manifest) => m.filters.find((f) => f.id === "balanced") ?? m.filters[0];
const ext = (url: string, text: string, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const short = (s: string) => s.split(" (")[0];
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const cleanSource = (s: string) => s.replace(/;\s*/g, " / ");
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const firstNumber = (s: string) => Number(s.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0] ?? NaN);
const fmtCompact = (x: number) => (Number.isInteger(x) ? num(x) : num(x, 1));
const heading = (id: string, n: number, text: string) =>
  `<h2 id="${id}" class="ln-h"><span class="ln-n" aria-hidden="true">${String(n).padStart(2, "0")}</span>${esc(text)}</h2>`;

function split(name: string) {
  const i = name.lastIndexOf(", ");
  return i < 0 ? { name, country: "" } : { name: name.slice(0, i), country: name.slice(i + 2) };
}

function dataset(m: Manifest, id: string) {
  const d = m.datasets.find((x) => x.id === id);
  return { source: d ? short(d.name) : id, url: d?.url ?? "" };
}

function gravity(m: Manifest) {
  const g = m.cant_copy.find((r) => r.name === "Gravity");
  if (!g) return null;
  const v = { earth: firstNumber(g.earth), moon: firstNumber(g.moon), mars: firstNumber(g.mars) };
  return Object.values(v).every(Number.isFinite) ? { row: g, v } : null;
}

function parseVital(r: CantCopy, w: Body): Vital | null {
  const rawW = r[w];
  const rawE = r.earth;

  if (r.name === "Gravity") {
    const e = firstNumber(rawE);
    const v = firstNumber(rawW);
    if (!Number.isFinite(e) || !Number.isFinite(v) || e <= 0) return null;
    const ratio = v / e;
    return {
      id: "gravity",
      label: "Gravity",
      worldValue: `${num(v, 2)} m/s²`,
      worldSub: "",
      earthLabel: `${num(e, 2)} m/s²`,
      pill: `${num(ratio, 2)}× Earth`,
      worldPct: Math.max(0, Math.min(100, ratio * 100)),
      earthPct: 100,
      trace: false,
      alert: false,
      note: "",
      source: r.source,
      url: r.url,
    };
  }

  if (r.name === "Air") {
    const e = firstNumber(rawE);
    if (!Number.isFinite(e) || e <= 0) return null;
    const isVacuum = /^none\b/i.test(rawW) || /×10⁻/.test(rawW);
    if (isVacuum) {
      const sci = rawW.match(/\d+(?:\.\d+)?\s*×\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+\s*bar/i)?.[0] ?? "";
      return {
        id: "air",
        label: "Air",
        worldValue: "Vacuum",
        worldSub: sci,
        earthLabel: `${num(e)} mbar`,
        pill: "~0% Earth",
        worldPct: 0,
        earthPct: 100,
        trace: true,
        alert: false,
        note: "",
        source: r.source,
        url: r.url,
      };
    }
    const v = firstNumber(rawW);
    if (!Number.isFinite(v)) return null;
    const pct = (v / e) * 100;
    return {
      id: "air",
      label: "Air",
      worldValue: `${num(v, 2)} mbar`,
      worldSub: "",
      earthLabel: `${num(e)} mbar`,
      pill: `${num(pct, 1)}% Earth`,
      worldPct: Math.max(0, Math.min(100, pct)),
      earthPct: 100,
      trace: false,
      alert: false,
      note: "",
      source: r.source,
      url: r.url,
    };
  }

  if (r.name === "Radiation on the surface") {
    const e = firstNumber(rawE);
    const v = firstNumber(rawW);
    if (!Number.isFinite(e) || !Number.isFinite(v) || e <= 0 || v <= 0) return null;
    const eApprox = /^about\b/i.test(rawE) ? "~" : "";
    const vApprox = /^about\b/i.test(rawW) ? "~" : "";
    const ratio = Math.round(v / e);
    const note = (rawW.match(/\(([^)]+)\)/)?.[1] ?? "").replace(/;\s*/g, " · ");
    return {
      id: "radiation",
      label: "Radiation",
      worldValue: `${vApprox}${fmtCompact(v)} µSv/day`,
      worldSub: "",
      earthLabel: `${eApprox}${fmtCompact(e)} µSv/day`,
      pill: `~${num(ratio)}× Earth`,
      worldPct: 100,
      earthPct: Math.max(0, Math.min(100, (e / v) * 100)),
      trace: false,
      alert: true,
      note,
      source: r.source,
      url: r.url,
    };
  }

  return null;
}

function vitals(m: Manifest, w: Body): Vital[] {
  const out: Vital[] = [];
  for (const r of m.cant_copy) {
    const v = parseVital(r, w);
    if (v) out.push(v);
  }
  return out;
}

function dedupeSources(rows: Vital[], w: Body): { source: string; url: string }[] {
  const byLabel = new Map<string, { source: string; url: string }>();
  for (const r of rows) {
    const prev = byLabel.get(r.source);
    if (!prev || (!prev.url.includes(w) && r.url.includes(w))) {
      byLabel.set(r.source, { source: cleanSource(r.source), url: r.url });
    }
  }
  return [...byLabel.values()];
}

function testedThere(note: string | undefined) {
  const text = (note ?? "").replace(/^Used for:[^.]*\.\s*/, "");
  return text.split(/(?<=\.)\s+(?=[A-Z])/)[0];
}

function usedFor(note: string | undefined, w: Body) {
  const m = (note ?? "").match(/^Used for:\s*([^.]*)\./);
  if (!m) return "";
  const parts = m[1].split(";").map((s) => s.trim());
  if (parts.length === 1 && !/^(Moon|Mars):/.test(parts[0])) return parts[0];
  return parts.find((p) => p.startsWith(`${NAME[w]}:`))?.replace(/^\w+:\s*/, "") ?? "";
}

function findCell(cells: Cols | null, lat: number, lon: number): number {
  if (!cells?.lat || !cells?.lon) return -1;
  const r = Math.floor((90 - lat) / 0.5);
  const c = Math.floor((lon + 180) / 0.5);
  const n = cells.lat.length;
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < n; i++) {
    const la = cells.lat[i];
    const lo = cells.lon[i];
    if (Math.floor((90 - la) / 0.5) === r && Math.floor((lo + 180) / 0.5) === c) return i;
    const dLat = Math.abs(la - lat);
    const dLon = Math.abs(lo - lon);
    if (dLat <= 0.5 && dLon <= 0.5) {
      const d2 = dLat * dLat + dLon * dLon;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
  }
  return best;
}

function monthTags(best: boolean[], frz: boolean[], rain: boolean[], i: number): [string, string][] {
  if (best[i]) return [["Best month", "is-match"]];
  const tags: [string, string][] = [];
  if (frz[i]) tags.push(["Freeze–thaw", "is-break"]);
  if (rain[i]) tags.push(["Rainy", "is-break"]);
  if (!tags.length) tags.push(["Frozen", "is-break"]);
  return tags;
}

function pairs(m: Manifest, t: Target, cells: Cols, cols: Cols, i: number): Pair[] {
  const out: Pair[] = [];
  for (const tr of m.traits) {
    const col = tr.column[t.body];
    const tv = t.values[tr.id];
    if (!TEMPS[tr.id] || !col || !tv || tv.value == null || !cells[col]) continue;
    const earth = cells[col][i];
    if (!Number.isFinite(earth)) continue;
    const k = KELVIN[tr.id] ? t.shown[KELVIN[tr.id]] : undefined;
    const kv = k?.value ?? null;
    const w = kv != null && k ? { value: kv - 273.15, kelvin: kv, ...dataset(m, k.dataset), res: k.resolution } : { value: tv.value, kelvin: null, ...dataset(m, tv.dataset), res: tv.resolution };
    const rank = cols[`rank:${tr.id}`]?.[i];
    out.push({
      trait: tr,
      world: w,
      earth: { value: earth, kelvin: null, ...dataset(m, tr.earth_dataset), res: tr.earth_resolution },
      close: Number.isFinite(rank) && rank >= CLOSE,
    });
  }
  return out;
}

const temp = (s: Side, tr: Trait) => `${num(s.value, 1)}${unit(tr.unit)}${s.kelvin == null ? "" : ` <small>(${num(s.kelvin, 1)} K)</small>`}`;
const srcLine = (s: Side) => `<span class="ln-src">${s.url ? ext(s.url, s.source) : esc(s.source)} · ${esc(short(s.res))}</span>`;

function meet(m: Manifest, t: Target, w: Body) {
  const rows = vitals(m, w);
  const sources = dedupeSources(rows, w);
  return `<section class="ln-sec ln-meet" data-testid="learn-meet" aria-labelledby="meet-h">
    <div class="ln-globe" role="img" aria-label="${esc(`${NAME[w]}, turning: a NASA photo map`)}" style="--map:url('${IMG}${w}.jpg')"></div>
    <div class="ln-copy">
      <p class="ln-k">Field primer</p>
      <h1 id="meet-h" tabindex="-1">Meet ${esc(WORLD[w])}</h1>
      <p class="ln-lede">${esc(LEDE[w])}</p>
      ${
        rows.length
          ? `<div class="ln-vitals" aria-label="${esc(`${NAME[w]} surface conditions compared with Earth`)}">${rows
              .map((v) => {
                const track = v.alert
                  ? `<span class="ln-v-fill is-rad" style="width:100%"></span><span class="ln-v-earth-tick" style="width:${Math.max(1.2, v.earthPct).toFixed(2)}%"></span>`
                  : v.trace
                    ? `<span class="ln-v-fill is-trace"></span>`
                    : `<span class="ln-v-fill${v.worldPct < 3 ? " is-thin" : ""}" style="width:${v.worldPct.toFixed(2)}%"></span>`;
                return `<div class="ln-vital" data-vital="${v.id}">
                  <div class="ln-v-head">
                    <span class="ln-v-label">${ICONS[v.id]}${esc(v.label)}</span>
                    <span class="ln-v-val"><b>${esc(v.worldValue)}</b>${v.worldSub ? `<small>${esc(v.worldSub)}</small>` : ""}<span class="ln-v-pill${
                      v.alert ? " is-rad" : ""
                    }">${esc(v.pill)}</span></span>
                  </div>
                  <div class="ln-v-track" aria-hidden="true">${track}</div>
                  <div class="ln-v-meta">${v.note ? `<span class="ln-v-note">${esc(v.note)}</span>` : "<span></span>"}<span class="ln-v-ref${
                    v.alert ? " is-tick" : ""
                  }">Earth ${esc(v.earthLabel)}</span></div>
                </div>`;
              })
              .join("")}<p class="ln-vitals-src">Sources: ${sources.map((s) => ext(s.url, s.source)).join(" · ")}</p></div>`
          : ""
      }
      ${
        t.facts.length
          ? `<details class="ln-more"><summary>About the base site: ${esc(t.short)}</summary><ul class="ln-facts">${t.facts
              .map((f) => `<li>${esc(f.text)}. ${ext(f.url, f.source)}</li>`)
              .join("")}</ul></details>`
          : ""
      }
    </div>
  </section>`;
}

function cant(m: Manifest, w: Body) {
  const g = gravity(m);
  const others = vitals(m, w).filter((v) => v.id !== "gravity");
  return `<section class="ln-sec ln-cant" data-testid="learn-cant" aria-labelledby="cant-h">
    ${heading("cant-h", 3, "What Earth cannot copy")}
    ${
      g
        ? `<p class="ln-lede">Same mass, different weight (mass × gravity). Select hardware.</p>
      <div class="chips ln-switch" role="group" aria-label="Load">${LOADS.map(
        (l, k) => `<button type="button" class="chip" data-load="${esc(l.id)}" aria-pressed="${k === 0}">${esc(l.short)}</button>`,
      ).join("")}</div>
      <div class="ln-panel">
        <p class="ln-load" id="ln-load"></p>
        <ul class="ln-weights" id="ln-weights"></ul>
        <p class="ln-src">Gravity: ${ext(g.row.url, g.row.source)}</p>
      </div>`
        : ""
    }
    <dl class="ln-pairs">${others
      .map((v) => {
        const earthFill = `<span class="ln-cmp-fill is-earth${v.earthPct < 3 ? " is-thin" : ""}" style="width:${v.earthPct.toFixed(2)}%"></span>`;
        const worldFill = v.trace
          ? `<span class="ln-cmp-fill is-trace"></span>`
          : `<span class="ln-cmp-fill${v.alert ? " is-rad" : ""}${v.worldPct < 3 ? " is-thin" : ""}" style="width:${v.worldPct.toFixed(2)}%"></span>`;
        return `<div class="ln-cmp" data-vital="${v.id}">
          <dt class="ln-cmp-head"><span class="ln-cmp-title">${ICONS[v.id]}${esc(v.label)}</span><span class="ln-ne-pill${v.alert ? " is-rad" : ""}"><span class="ln-ne" aria-label="is not">≠</span> ${esc(
            v.pill,
          )}</span></dt>
          <dd class="ln-cmp-body">
            <div class="ln-cmp-rows">
              <div class="ln-cmp-row">
                <div class="ln-cmp-line"><span class="ln-cmp-who">Earth</span><span class="ln-cmp-val">${esc(v.earthLabel)}</span></div>
                <div class="ln-cmp-track" aria-hidden="true">${earthFill}</div>
              </div>
              <div class="ln-cmp-row" data-side="world">
                <div class="ln-cmp-line"><span class="ln-cmp-who">${esc(NAME[w])}</span><span class="ln-cmp-val"><b>${esc(v.worldValue)}</b>${
                  v.worldSub ? `<small>${esc(v.worldSub)}</small>` : ""
                }</span></div>
                <div class="ln-cmp-track" aria-hidden="true">${worldFill}</div>
              </div>
            </div>
            ${v.note ? `<span class="ln-cmp-note">${esc(v.note)}</span>` : ""}
            ${ext(v.url, cleanSource(v.source), "ln-src")}
          </dd>
        </div>`;
      })
      .join("")}</dl>
  </section>`;
}

function weights(m: Manifest, w: Body, id: string) {
  const g = gravity(m)!;
  const l = LOADS.find((x) => x.id === id) ?? LOADS[0];
  const bodies = ["earth", "moon", "mars"] as const;
  const n = bodies.map((b) => l.kg * g.v[b]);
  const max = Math.max(...n);
  return {
    load: `${esc(l.name)}: <b>${num(l.kg)} kg</b>. ${ext(l.url, l.source)}`,
    rows: bodies
      .map(
        (b, k) => `<li data-body="${b}"${b === w ? " data-here" : ""}><span class="ln-who">${esc(NAME[b])}</span><span class="ln-bar" aria-hidden="true"><i style="transform:scaleX(${(
          n[k] / max
        ).toFixed(4)})"></i></span><span class="ln-num" data-testid="weight-${b}">${num(l.kg)} kg × ${num(g.v[b], 2)} m/s² = <b>${num(Math.round(n[k]))} N</b></span></li>`,
      )
      .join(""),
  };
}

function photos() {
  return `<section class="ln-sec ln-photos" data-testid="learn-photos" aria-labelledby="photos-h">
    ${heading("photos-h", 5, "Same process, two worlds")}
    <p class="ln-lede">Shared geology on Earth and its neighbours. Select a pair to enlarge.</p>
    <div class="ln-pairs-grid">${PHOTOS.map(
      (p, k) => `<figure class="ln-pair" data-pair="${esc(p.pair)}"><button type="button" class="ln-pair-btn" data-pair-open="${k}" aria-label="${esc(
        `Enlarge ${p.pair} photo pair`,
      )}"><span class="ln-pair-imgs">${p.photos
        .map(
          (x) =>
            `<span class="ln-photo"><img src="${IMG}learn/${esc(x.file)}" alt="${esc(x.alt)}" loading="lazy" decoding="async"><span class="ln-tag">${esc(x.world)}</span></span>`,
        )
        .join("")}</span><span class="ln-zoom-hint" aria-hidden="true">Enlarge</span></button><figcaption>${esc(p.line)}<small>${p.photos
        .map((x) => `${esc(x.credit)} (${esc(x.id)})`)
        .join(" · ")}</small></figcaption></figure>`,
    ).join("")}</div>
  </section>`;
}

export function learnPage(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let world: Body | null = null;
  let seq = 0;
  let month = new Date().getMonth();
  let masks: { name: string; best: number; freeze: number; rain: number }[] = [];
  let tempPairs: Pair[] = [];
  let bestName = "";
  let target: Target;
  let points: LabelPoint[] = [];
  let gridCells: Cols | null = null;
  let unbindMonth: (() => void) | null = null;
  let lightboxTrigger: HTMLElement | null = null;

  const $ = <T extends HTMLElement>(q: string) => el.querySelector<T>(q);

  const drawLoad = (id: string) => {
    if (!gravity(m) || !world) return;
    const r = weights(m, world, id);
    $("#ln-load")!.innerHTML = r.load;
    $("#ln-weights")!.innerHTML = r.rows;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-load]")) b.setAttribute("aria-pressed", String(b.dataset.load === id));
  };

  const drawTemp = (k: number) => {
    const box = $("#ln-temp");
    const p = tempPairs[k];
    if (!box || !p) return;
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-temp]")) b.setAttribute("aria-pressed", String(Number(b.dataset.temp) === k));
    const max = Math.max(Math.abs(p.world.value), Math.abs(p.earth.value)) || 1;
    const row = (kind: string, who: string, s: Side) =>
      `<li class="ln-temp" data-kind="${kind}"><span class="ln-who">${esc(who)}</span><span class="ln-bar" aria-hidden="true"><i style="transform:scaleX(${(Math.abs(s.value) / max).toFixed(
        4,
      )})"></i></span><span class="ln-num" data-testid="temp-${kind}">${temp(s, p.trait)}</span>${srcLine(s)}</li>`;
    box.innerHTML = `<p class="ln-note">${esc(TEMPS[p.trait.id][1])}</p>
      <ul class="ln-rows">${row("world", target.short, p.world)}${row("earth", bestName, p.earth)}</ul>
      <p class="ln-verdict ${p.close ? "is-match" : "is-break"}"><span aria-hidden="true">${p.close ? "=" : "≠"}</span>${
        p.close ? "Near: crews can practise this on Earth." : "Far apart: Earth cannot copy this."
      }</p>`;
  };

  const drawYear = (rebuild = false) => {
    const out = $("#ln-month-name");
    if (out) out.textContent = MONTHS[month];
    const slider = $<HTMLInputElement>("#ln-month");
    if (slider) {
      if (slider.value !== String(month)) slider.value = String(month);
      slider.setAttribute("aria-valuetext", MONTHS[month]);
      syncPillRange(slider);
    }
    const list = $("#ln-places");
    if (!list) return;

    const existing = list.querySelectorAll<HTMLLIElement>('[data-testid="year-place"]');
    if (!rebuild && existing.length === masks.length && masks.length > 0) {
      for (const h of list.querySelectorAll<HTMLElement>(".ln-mhead [data-hm]")) {
        h.toggleAttribute("data-now", Number(h.dataset.hm) === month);
      }
      masks.forEach((p, idx) => {
        const li = existing[idx];
        const best = bits(p.best);
        const frz = bits(p.freeze);
        const rain = bits(p.rain);
        const tags = monthTags(best, frz, rain, month);
        li.dataset.best = String(best[month]);
        li.dataset.freeze = String(frz[month]);
        li.dataset.rain = String(rain[month]);
        for (const btn of li.querySelectorAll<HTMLButtonElement>(".ln-mcell")) {
          const isNow = Number(btn.dataset.m) === month;
          btn.toggleAttribute("data-now", isNow);
          btn.setAttribute("aria-pressed", String(isNow));
        }
        const tagBox = li.querySelector<HTMLElement>(".ln-tags");
        if (tagBox) tagBox.innerHTML = tags.map(([t, c]) => `<b class="${c}">${esc(t)}</b>`).join("");
      });
      return;
    }

    const head = masks.length
      ? `<li class="ln-places-head" aria-hidden="true"><span class="ln-ph-place">Place</span><span class="ln-mhead">${MONTH_LETTERS.map(
          (ch, i) => `<i data-hm="${i}"${i === month ? " data-now" : ""}>${ch}</i>`,
        ).join("")}</span><span class="ln-ph-status">Selected month</span></li>`
      : "";
    list.innerHTML =
      head +
      masks
        .map((p) => {
          const best = bits(p.best);
          const frz = bits(p.freeze);
          const rain = bits(p.rain);
          const tags = monthTags(best, frz, rain, month);
          const { name, country } = split(p.name);
          const cellsHtml = best
            .map((on, i) => {
              const status = monthTags(best, frz, rain, i)
                .map(([t]) => t.toLowerCase())
                .join(", ");
              const label = `${name}, ${MONTHS[i]}: ${status}`;
              return `<button type="button" class="ln-mcell" data-m="${i}" aria-label="${esc(label)}" aria-pressed="${i === month}" title="${esc(
                `${MONTHS[i]}: ${status}`,
              )}"${on ? " data-best" : " data-avoid"}${i === month ? " data-now" : ""}></button>`;
            })
            .join("");
          return `<li data-testid="year-place" data-best="${best[month]}" data-freeze="${frz[month]}" data-rain="${rain[month]}">
            <span class="ln-place">${esc(name)}${country ? `<small>${esc(country)}</small>` : ""}</span>
            <span class="ln-cells" role="group" aria-label="${esc(`${name} by month`)}">${cellsHtml}</span>
            <span class="ln-tags">${tags.map(([t, c]) => `<b class="${c}">${esc(t)}</b>`).join("")}</span>
          </li>`;
        })
        .join("");
  };

  const drawAnalog = (id: string) => {
    const p = points.find((x) => x.id === id) ?? points[0];
    const card = $("#ln-analog");
    if (!p || !card || !world) return;
    for (const b of el.querySelectorAll<HTMLButtonElement>(".ln-pin")) b.setAttribute("aria-pressed", String(b.dataset.id === p.id));
    const link = p.analog_source ?? p.source;
    const used = usedFor(p.note, world);
    const filter = defaultFilter(m);
    const cell = findCell(gridCells, p.lat, p.lon);
    const inspectHref =
      cell >= 0
        ? `#/place?t=${encodeURIComponent(target.id)}&f=${encodeURIComponent(filter.id)}&c=${cell}`
        : `#/find?t=${encodeURIComponent(target.id)}&known=1`;
    card.innerHTML = `<h3>${esc(p.name)}</h3>${p.country ? `<p class="ln-country">${esc(p.country)}</p>` : ""}${
      used ? `<p class="ln-used">Practised here: <b>${esc(used)}</b></p>` : ""
    }<p>${esc(testedThere(p.note))}</p><div class="ln-analog-foot"><a class="ln-inspect" href="${inspectHref}">Inspect in Finder <span aria-hidden="true">→</span></a>${
      link ? ext(link, `Source: ${host(link)}`, "ln-src") : ""
    }</div>`;
  };

  const openLightbox = (k: number, trigger: HTMLElement) => {
    const p = PHOTOS[k];
    const dlg = $<HTMLDialogElement>("#ln-lightbox");
    if (!p || !dlg) return;
    lightboxTrigger = trigger;
    dlg.innerHTML = `<div class="ln-lb-head">
        <div>
          <p class="ln-k">Same process, two worlds</p>
          <h3 id="ln-lb-h">${esc(cap(p.pair))}</h3>
        </div>
        <button type="button" class="ln-lb-x" aria-label="Close photo view">×</button>
      </div>
      <div class="ln-lb-grid">${p.photos
        .map(
          (x) => `<figure class="ln-lb-fig">
            <div class="ln-lb-img"><img src="${IMG}learn/${esc(x.file)}" alt="${esc(x.alt)}" decoding="async"><span class="ln-tag">${esc(x.world)}</span></div>
            <figcaption><b>${esc(x.title)}</b><small>${esc(x.credit)} · NASA ID ${esc(x.id)}</small></figcaption>
          </figure>`,
        )
        .join("")}</div>
      <p class="ln-lb-line">${esc(p.line)}</p>`;
    if (!dlg.open) dlg.showModal();
  };

  async function fill(w: Body, mine: number) {
    const t = target;
    const filter = defaultFilter(m);
    const [d, cols, labels] = await Promise.all([ctx.data(), ctx.cols(t), ctx.labels()]);
    if (mine !== seq) return;
    const cells = d.cells;
    gridCells = cells;
    const score = cols[`score:${filter.id}`];
    const ids = score ? top(score, 5, cells).ids : [];

    const tempsBox = $("#ln-temps-body")!;
    if (ids.length) {
      const i = ids[0];
      bestName = placeName(m, cells, i);
      tempPairs = pairs(m, t, cells, cols, i);
      const { name, country } = split(bestName);
      tempsBox.innerHTML = tempPairs.length
        ? `<p class="ln-lede">${esc(t.short)} vs. top Earth match: <b>${esc(name)}</b>${country ? `, ${esc(country)}` : ""}.</p>
          <div class="chips ln-switch" role="group" aria-label="Temperature to show">${tempPairs
            .map((p, k) => `<button type="button" class="chip" data-temp="${k}" aria-pressed="${k === 0}">${esc(TEMPS[p.trait.id][0])}</button>`)
            .join("")}</div><div id="ln-temp"></div>`
        : `<p class="ln-lede">There are no measured temperatures for this base site.</p>`;
      drawTemp(0);
    } else tempsBox.innerHTML = `<p class="ln-lede">There is no ranked land for this base site.</p>`;
    $("#ln-temps")!.setAttribute("aria-busy", "false");

    const yr = $("#ln-year")!;
    masks = ids.map((i) => ({ name: placeName(m, cells, i), best: cells.m_best?.[i] ?? NaN, freeze: cells.m_freeze?.[i] ?? NaN, rain: cells.m_rain?.[i] ?? NaN }));
    $("#ln-year-lede")!.textContent = `Monthly testing windows at the top 5 Earth matches for ${t.short}. Drag the slider or click a month.`;
    drawYear(true);
    yr.setAttribute("aria-busy", "false");

    points = labels.filter((l) => l.kind === "known_analog" && l.groups?.some((g) => g.startsWith(`${w}-`))).sort((a, b) => a.lon - b.lon);
    $("#ln-analog-lede")!.textContent = `${points.length} training analog sites for ${WORLD[w]}. Select a pin.`;
    $("#ln-pins")!.innerHTML = points
      .map((p) => {
        const leftPct = ((p.lon + 180) / 360) * 100;
        const topPct = ((90 - p.lat) / 180) * 100;
        const tipX = leftPct < 22 ? ' data-tip-x="left"' : leftPct > 78 ? ' data-tip-x="right"' : "";
        const tipY = topPct < 22 ? ' data-tip-y="below"' : "";
        return `<button type="button" class="ln-pin" data-id="${esc(p.id)}" data-tip="${esc(p.name)}"${tipX}${tipY} style="left:${leftPct.toFixed(3)}%;top:${topPct.toFixed(3)}%" aria-label="${esc(
          p.country ? `${p.name}, ${p.country}` : p.name,
        )}" aria-pressed="false"></button>`;
      })
      .join("");
    drawAnalog(points.some((p) => p.id === "haughton-crater-devon-island") ? "haughton-crater-devon-island" : (points[0]?.id ?? ""));
    $("#ln-analogs")!.setAttribute("aria-busy", "false");
  }

  function render(w: Body) {
    unbindMonth?.();
    unbindMonth = null;
    target = home(m, w)!;
    const filter = defaultFilter(m);
    el.dataset.world = w;
    el.innerHTML = `<div class="ln" data-testid="learn" data-world="${w}">
      <nav class="ln-worlds" aria-label="World"><div class="ln-worlds-seg">${(["moon", "mars"] as const)
        .map(
          (b) =>
            `<a href="#/learn?world=${b}" data-world="${b}"${b === w ? ' aria-current="page"' : ""}><span class="ln-wdot" aria-hidden="true"></span>${esc(WORLD_TAB[b])}</a>`,
        )
        .join("")}</div></nav>
      ${meet(m, target, w)}
      <section class="ln-sec" id="ln-temps" data-testid="learn-temps" aria-labelledby="temps-h" aria-busy="true">
        ${heading("temps-h", 1, "Hot and cold")}
        <div id="ln-temps-body"><p class="ln-wait">The measured temperatures are loading…</p></div>
      </section>
      <section class="ln-sec" id="ln-year" data-testid="learn-year" aria-labelledby="year-h" aria-busy="true">
        ${heading("year-h", 2, "A year on Earth")}
        <p class="ln-lede" id="ln-year-lede">Monthly testing windows at the top 5 Earth matches.</p>
        <div class="ln-panel ln-year-panel">
          <div class="ln-month">
            <label for="ln-month" class="sr">Month</label>
            <input id="ln-month" class="ln-slider" type="range" min="0" max="11" step="1" value="${month}" aria-valuetext="${MONTHS[month]}">
            <output for="ln-month" class="ln-month-name" id="ln-month-name" data-testid="month-name">${MONTHS[month]}</output>
          </div>
          <p class="ln-key"><span><i data-best></i>Best window</span><span><i data-avoid></i>Freeze–thaw, rain, or frost</span></p>
          <ol class="ln-places" id="ln-places"></ol>
          <p class="ln-src">${ext(m.datasets.find((x) => x.id === "power_merra2")?.url ?? "https://power.larc.nasa.gov/", "NASA POWER (MERRA-2)")} · ~50 km grid · ${esc(
            filter.name,
          )} ranking.</p>
        </div>
      </section>
      ${cant(m, w)}
      <section class="ln-sec" id="ln-analogs" data-testid="learn-analogs" aria-labelledby="analogs-h" aria-busy="true">
        ${heading("analogs-h", 4, "First tested on Earth")}
        <p class="ln-lede" id="ln-analog-lede">Training analog sites.</p>
        <div class="ln-map-wrap">
          <div class="ln-map"><img src="${IMG}blue-marble-4k.jpg" alt="" width="4096" height="2048" loading="lazy" decoding="async"><div class="ln-pins" id="ln-pins"></div></div>
          <div class="ln-analog" id="ln-analog" data-testid="analog-card" aria-live="polite"></div>
        </div>
      </section>
      ${photos()}
      <section class="ln-sec ln-end" aria-labelledby="end-h">
        <h2 id="end-h" class="ln-h">Now you try</h2>
        <p class="ln-lede">Explore Earth matches for ${esc(target.short)} and see where each analogy breaks.</p>
        <a class="ln-cta" data-testid="learn-find" href="#/find?t=${encodeURIComponent(target.id)}">Open in Finder <span aria-hidden="true">→</span></a>
      </section>
      <dialog class="ln-lightbox" id="ln-lightbox" aria-labelledby="ln-lb-h"></dialog>
    </div>`;

    const monthInput = $<HTMLInputElement>("#ln-month");
    if (monthInput) unbindMonth = bindPillRange(monthInput);

    const dlg = $<HTMLDialogElement>("#ln-lightbox");
    dlg?.addEventListener("click", (ev) => {
      if (ev.target === dlg || (ev.target as Element).closest(".ln-lb-x")) dlg.close();
    });
    dlg?.addEventListener("close", () => {
      if (lightboxTrigger?.isConnected) lightboxTrigger.focus({ preventScroll: true });
      lightboxTrigger = null;
    });

    drawLoad(LOADS[0].id);
    const mine = ++seq;
    fill(w, mine).catch(() => {
      if (mine !== seq) return;
      for (const id of ["ln-temps-body", "ln-places"]) {
        const box = $(`#${id}`);
        if (box) box.innerHTML = `<p class="ln-wait">The data files did not load. Reload the page.</p>`;
      }
    });
  }

  return {
    title: () => "Learn",
    mount(e) {
      el = e;
      el.addEventListener("click", (ev) => {
        const b = (ev.target as Element).closest<HTMLElement>("[data-load],[data-temp],.ln-pin,[data-m],[data-pair-open]");
        if (!b) return;
        if (b.dataset.load) drawLoad(b.dataset.load);
        else if (b.dataset.temp) drawTemp(Number(b.dataset.temp));
        else if (b.dataset.id) drawAnalog(b.dataset.id);
        else if (b.dataset.m != null) {
          month = Number(b.dataset.m);
          drawYear();
        } else if (b.dataset.pairOpen != null) {
          openLightbox(Number(b.dataset.pairOpen), b);
        }
      });
      el.addEventListener("input", (ev) => {
        const s = ev.target as HTMLInputElement;
        if (s.id !== "ln-month") return;
        month = Number(s.value);
        drawYear();
      });
      el.classList.toggle("ln-still", reduced());
    },
    show(q) {
      const w: Body = q.get("world") === "mars" ? "mars" : "moon";
      if (w === world) return;
      world = w;
      render(w);
      $("h1")?.focus({ preventScroll: true });
    },
    hide() {
      const dlg = $<HTMLDialogElement>("#ln-lightbox");
      if (dlg?.open) dlg.close();
    },
  };
}

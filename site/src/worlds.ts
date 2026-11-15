import "./worlds.css";
import type { Body, LabelPoint, Manifest, Target, TargetValue } from "./contract";
import { esc, latlon, num, unit } from "./format";
import { icon } from "./icons";

export const TEXTURE = { moon: "img/moon.jpg", mars: "img/mars.jpg" };
export const SHARP = { moon: "img/moon-4k.jpg", mars: "img/mars-4k.jpg" };
export const NAME: Record<Body, string> = { moon: "the Moon", mars: "Mars" };
export const TITLE: Record<Body, string> = { moon: "The Moon", mars: "Mars" };
const SITE_TRAITS = ["cold", "season_swing", "day_swing_air", "slope", "safe10", "relief", "sun_height", "dust"];
const TI = " J m⁻² K⁻¹ s⁻½";
const SHOWN: Record<string, [string, (v: number) => string]> = {
  lit_share: ["Sunlight at the best-lit spot", (v) => `${num(v * 100)}% of the time`],
  psr_share: ["Ground in permanent shadow", (v) => `${num(v * 100)}%`],
  t_min_coldest_k: ["Coldest spot, winter minimum", (v) => `${num(v, 1)} K`],
  weh_pct: ["Water-equivalent hydrogen", (v) => `${num(v, 1)}% by weight`],
  dci: ["Dust cover index", (v) => num(v, 3)],
  thermal_inertia: ["Thermal inertia", (v) => num(v) + TI],
  thermal_inertia_moon_wide: ["Thermal inertia, Moon-wide", (v) => num(v) + TI],
};
const SPAN = 8;

export function headline(text: string): [string, string] {
  const cut = [" (", ": ", ", "].map((k) => text.indexOf(k)).filter((n) => n > 0).sort((x, y) => x - y)[0];
  return cut ? [text.slice(0, cut), text.slice(cut).replace(/^[\s:(,]+/, "").replace(/\)$/, "")] : [text, ""];
}

const images = new Map<string, Promise<HTMLImageElement>>();
const image = (src: string) => {
  let p = images.get(src);
  if (!p) {
    p = new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = fail;
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
};

function band(img: HTMLImageElement, top: number, bottom: number) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const y0 = Math.max(0, Math.floor(((90 - top) / 180) * h));
  const y1 = Math.min(h, Math.ceil(((90 - bottom) / 180) * h) + 1);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = y1 - y0;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, y0, w, y1 - y0, 0, 0, w, y1 - y0);
  const px = ctx.getImageData(0, 0, w, y1 - y0).data;
  return (lat: number, lon: number, out: Uint8ClampedArray, o: number) => {
    const x = ((((lon + 180) / 360) * w) % w + w) % w;
    const y = Math.max(0, Math.min(y1 - y0 - 1.001, ((90 - lat) / 180) * h - y0));
    const x0 = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - x0;
    const fy = y - yi;
    const a = (yi * w + x0) * 4;
    const b = (yi * w + ((x0 + 1) % w)) * 4;
    const c = a + w * 4;
    const d = b + w * 4;
    for (let k = 0; k < 3; k++)
      out[o + k] = (px[a + k] * (1 - fx) + px[b + k] * fx) * (1 - fy) + (px[c + k] * (1 - fx) + px[d + k] * fx) * fy;
    out[o + 3] = 255;
  };
}

function stretch(d: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[Math.round((d[i] + d[i + 1] + d[i + 2]) / 3)]++;
  const n = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let s = 0; lo < 255 && (s += hist[lo]) < n * 0.02; ) lo++;
  for (let s = 0; hi > 0 && (s += hist[hi]) < n * 0.02; ) hi--;
  const k = Math.max(1, Math.min(5, 180 / Math.max(1, hi - lo)));
  const mid = (lo + hi) / 2;
  for (let i = 0; i < d.length; i += 4) {
    const shift = ((d[i] + d[i + 1] + d[i + 2]) / 3 - mid) * (k - 1);
    for (let c = 0; c < 3; c++) d[i + c] += shift;
  }
}

export async function thumb(cv: HTMLCanvasElement, t: Target) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const img = await image(`${import.meta.env.BASE_URL}${SHARP[t.body]}`);
  const n = cv.width;
  const out = ctx.createImageData(n, n);
  const polar = Math.abs(t.lat) > 75;
  const s = Math.sign(t.lat) || 1;
  if (polar) {
    const at = band(img, s > 0 ? 90 : -90 + (90 - Math.abs(t.lat)) + SPAN, s > 0 ? Math.abs(t.lat) - SPAN : -90);
    const r0 = 90 - Math.abs(t.lat);
    const a0 = (t.lon * Math.PI) / 180;
    const x0 = r0 * Math.sin(a0);
    const y0 = -s * r0 * Math.cos(a0);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = x0 + (i / n - 0.5) * SPAN;
        const y = y0 - (j / n - 0.5) * SPAN;
        const r = Math.hypot(x, y);
        at(s * (90 - r), (Math.atan2(x, -s * y) * 180) / Math.PI, out.data, (j * n + i) * 4);
      }
  } else {
    const at = band(img, t.lat + SPAN, t.lat - SPAN);
    const wide = SPAN / Math.max(0.2, Math.cos((t.lat * Math.PI) / 180));
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) at(t.lat + (0.5 - j / n) * SPAN, t.lon + (i / n - 0.5) * wide, out.data, (j * n + i) * 4);
  }
  stretch(out.data);
  ctx.putImageData(out, 0, 0);
  ctx.lineWidth = n / 40;
  ctx.strokeStyle = "rgba(2, 7, 10, 0.7)";
  ctx.beginPath();
  ctx.arc(n / 2, n / 2, n * 0.11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = n / 64;
  ctx.strokeStyle = "#5bbbe9";
  ctx.stroke();
}

const dsLink = (m: Manifest, id: string) => {
  const ds = m.datasets.find((d) => d.id === id);
  return ds?.url ? `<a href="${esc(ds.url)}" target="_blank" rel="noopener">${esc(ds.name)}</a>` : esc(ds?.name ?? id);
};

const limit = (key: string, v: number) => (key.endsWith("_k") && v < 25) || (key === "cold" && v < 25 - 273.15);

const cell = (m: Manifest, key: string, label: string, text: string, v: TargetValue) =>
  `<div class="w-val"><dt>${esc(label)}</dt><dd><b>${esc(text)}</b>${
    limit(key, v.value!) ? `<em class="tag warn" title="${esc(v.note ?? "")}">at the instrument's limit</em>` : ""
  }<span>${esc(v.stat)}</span><small>${dsLink(m, v.dataset)}</small></dd></div>`;

export function siteHtml(m: Manifest, t: Target): string {
  const traits = SITE_TRAITS.map((id) => ({ id, tr: m.traits.find((x) => x.id === id), v: t.values[id] }))
    .filter((r) => r.tr && r.v && r.v.value != null)
    .slice(0, 6)
    .map((r) => cell(m, r.id, r.tr!.label, num(r.v.value!, r.tr!.digits) + unit(r.tr!.unit), r.v));
  const shown = Object.entries(t.shown ?? {})
    .filter(([k, v]) => SHOWN[k] && v.value != null)
    .map(([k, v]) => cell(m, k, SHOWN[k][0], SHOWN[k][1](v.value!), v));
  const rows = [...traits, ...shown].join("");
  const facts = t.facts
    .map((f) => `<li>${esc(f.text)} <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a></li>`)
    .join("");
  return `<h2>${icon("site")}Measured at ${esc(t.name)} <span class="muted">${latlon(t.lat, t.lon, 2)}</span></h2>
    ${t.check_note ? `<p class="w-check">${icon("info")}${esc(t.check_note)}</p>` : ""}
    ${rows ? `<dl class="w-vals">${rows}</dl>` : `<p class="muted">No measured values for this site.</p>`}
    ${facts ? `<ul class="w-known">${facts}</ul>` : ""}
    <p class="w-cta"><a class="go w-go" href="#/find?t=${esc(t.id)}">Find Earth's matches for ${esc(t.name)}${icon("chevron")}</a></p>`;
}

export function solveHtml(m: Manifest, b: Body): string {
  return m.challenges[b].map((c) => `<li>${icon(c.id)}<b>${esc(c.name)}</b><span>${esc(c.question)}</span></li>`).join("");
}

export function fillAnalogs(root: HTMLElement, labels: LabelPoint[]): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-analogs]")) {
    const b = el.dataset.analogs as Body;
    const list = labels.filter((l) => l.kind === "known_analog" && l.groups?.some((g) => g.startsWith(b)));
    if (!list.length) {
      el.innerHTML = `<p class="muted">No data: the known analog list could not be loaded.</p>`;
      continue;
    }
    const cardOf = (l: LabelPoint) => {
      const note = l.note ?? "";
      const cut = note.indexOf(". ");
      const used = cut > 0 ? note.slice(0, cut + 1) : note;
      const rest = cut > 0 ? note.slice(cut + 2) : "";
      return `<article class="w-analog"><h3>${esc(l.name)}</h3><p class="w-where">${l.country ? `${esc(l.country)} · ` : ""}${latlon(l.lat, l.lon, 1)}</p>
        ${used ? `<p class="w-used">${esc(used)}</p>` : ""}
        ${rest ? `<details><summary>More</summary><p>${esc(rest)}</p></details>` : ""}
        <a href="${esc(l.analog_source ?? l.source)}" target="_blank" rel="noopener">Source</a></article>`;
    };
    el.innerHTML =
      list.slice(0, 4).map(cardOf).join("") +
      (list.length > 4 ? `<details class="w-all"><summary>Show ${num(list.length - 4)} more places</summary><div class="w-analogs">${list.slice(4).map(cardOf).join("")}</div></details>` : "");
  }
}

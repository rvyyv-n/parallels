import "./worlds.css";
import type { Body, LabelPoint, Manifest, Target } from "./contract";
import { esc, latlon, num, unit } from "./format";
import { icon } from "./icons";

export const TEXTURE = { moon: "img/moon.jpg", mars: "img/mars.jpg" };
export const NAME: Record<Body, string> = { moon: "the Moon", mars: "Mars" };
export const TITLE: Record<Body, string> = { moon: "The Moon", mars: "Mars" };
const SITE_TRAITS = ["cold", "season_swing", "day_swing_air", "slope", "safe10", "relief", "sun_height", "dust"];

const home = (m: Manifest, b: Body) => m.targets.find((t) => t.body === b && t.default) ?? m.targets.find((t) => t.body === b);

export function headline(text: string): [string, string] {
  const cut = [" (", ": ", ", "].map((k) => text.indexOf(k)).filter((n) => n > 0).sort((x, y) => x - y)[0];
  return cut ? [text.slice(0, cut), text.slice(cut).replace(/^[\s:(,]+/, "").replace(/\)$/, "")] : [text, ""];
}

export function thumb(cv: HTMLCanvasElement, t: Target) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const mark = () => {
    ctx.strokeStyle = "#5bbbe9";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(44, 44, 9, 0, Math.PI * 2);
    ctx.stroke();
  };
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const span = w / 9;
    if (Math.abs(t.lat) > 75) {
      const cap = h / 6;
      ctx.drawImage(img, 0, t.lat < 0 ? h - cap : 0, w, cap, 0, 0, 88, 88);
    } else ctx.drawImage(img, ((t.lon + 180) / 360) * w - span / 2, ((90 - t.lat) / 180) * h - span / 2, span, span, 0, 0, 88, 88);
    mark();
  };
  img.src = `${import.meta.env.BASE_URL}${TEXTURE[t.body]}`;
}

function site(m: Manifest, t: Target) {
  const rows = SITE_TRAITS.map((id) => ({ tr: m.traits.find((x) => x.id === id), v: t.values[id] }))
    .filter((r) => r.tr && r.v && r.v.value != null)
    .slice(0, 6)
    .map((r) => {
      const ds = m.datasets.find((d) => d.id === r.v.dataset);
      return `<div class="w-val"><dt>${esc(r.tr!.label)}</dt><dd><b>${num(r.v.value!, r.tr!.digits)}${unit(r.tr!.unit)}</b><span>${esc(r.v.stat)}</span><small>${
        ds?.url ? `<a href="${esc(ds.url)}" target="_blank" rel="noopener">${esc(ds.name)}</a>` : esc(ds?.name ?? r.v.dataset)
      }</small></dd></div>`;
    })
    .join("");
  const facts = t.facts
    .map((f) => `<li>${esc(f.text)} <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.source)}</a></li>`)
    .join("");
  return `<h2>${icon("site")}At the base site: ${esc(t.name)} <span class="muted">${latlon(t.lat, t.lon, 2)}</span></h2>
    ${rows ? `<dl class="w-vals">${rows}</dl>` : `<p class="muted">No measured values for this site.</p>`}
    ${facts ? `<ul class="w-known">${facts}</ul>` : ""}`;
}

function solve(m: Manifest, b: Body) {
  return m.challenges[b]
    .map((c) => `<li>${icon(c.id)}<b>${esc(c.name)}</b><span>${esc(c.question)}</span></li>`)
    .join("");
}

export function worldPage(m: Manifest, b: Body): string {
  const t = home(m, b);
  const ts = m.targets.filter((x) => x.body === b);
  return `<section class="page-sec band worlds" aria-labelledby="${b}-h">
    <header class="w-lead">
      <div class="w-disc w-disc-${b}" aria-hidden="true"></div>
      <div>
        <p class="sec-k">Where is the base?</p>
        <h1 id="${b}-h" tabindex="-1">${TITLE[b]}</h1>
        <p class="lede">Choose a base site on ${NAME[b]} to see the places on Earth that match it best.</p>
        <ul class="chips sites" aria-label="Base sites on ${NAME[b]}">${ts
          .map(
            (x) =>
              `<li><a class="chip site" href="#/find?t=${esc(x.id)}" data-site="${esc(x.id)}"><canvas class="site-thumb" width="88" height="88" data-thumb="${esc(x.id)}" aria-hidden="true"></canvas><span class="site-n">${esc(
                x.short,
              )}</span><span class="site-at">${latlon(x.lat, x.lon, 1)}${x.regions?.length ? ` · ${x.regions.length} candidate regions` : ""}</span></a></li>`,
          )
          .join("")}</ul>
      </div>
    </header>
    <div class="w-panel" id="w-${b}" data-world="${b}">
      <div class="w-cols">
        <section class="w-site">${t ? site(m, t) : ""}</section>
        <section class="w-solve"><h2>${icon("test")}What a base there must solve</h2><ul>${solve(m, b)}</ul></section>
      </div>
      <section class="w-tested"><h2>${icon("pin")}Tested on Earth first</h2>
        <p class="w-sub">Places already used to rehearse for ${NAME[b]}. Parallels checks its scores against them, then looks at all the land nobody uses yet.</p>
        <div class="w-analogs" data-analogs="${b}"><p class="muted">Loading the known analog sites…</p></div>
      </section>
      ${t ? `<p class="w-cta"><a class="go w-go" href="#/find?t=${esc(t.id)}">Find Earth's matches for ${esc(t.name)}${icon("chevron")}</a></p>` : ""}
    </div>
  </section>`;
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
      list.slice(0, 6).map(cardOf).join("") +
      (list.length > 6 ? `<details class="w-all"><summary>Show ${num(list.length - 6)} more places</summary><div class="w-analogs">${list.slice(6).map(cardOf).join("")}</div></details>` : "");
  }
}

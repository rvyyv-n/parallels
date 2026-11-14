import "./worlds.css";
import type { Body, LabelPoint, Manifest, Target } from "./contract";
import { esc, latlon, num, unit } from "./format";
import { icon } from "./icons";

const NAME: Record<Body, string> = { moon: "the Moon", mars: "Mars" };
const TITLE: Record<Body, string> = { moon: "The Moon", mars: "Mars" };
const SITE_TRAITS = ["cold", "season_swing", "day_swing_air", "slope", "safe10", "relief", "sun_height", "dust"];
const CANT_ICON: Record<string, string> = { gravity: "gravity", air: "air" };

const home = (m: Manifest, b: Body) => m.targets.find((t) => t.body === b && t.default) ?? m.targets.find((t) => t.body === b);

export function headline(text: string): [string, string] {
  const cut = [" (", ": ", ", "].map((k) => text.indexOf(k)).filter((n) => n > 0).sort((x, y) => x - y)[0];
  return cut ? [text.slice(0, cut), text.slice(cut).replace(/^[\s:(,]+/, "").replace(/\)$/, "")] : [text, ""];
}

function cant(m: Manifest, b: Body) {
  return m.cant_copy
    .map((c) => {
      const [big, rest] = headline(c[b]);
      return `<div class="w-fact">${icon(CANT_ICON[c.name.toLowerCase()] ?? "radiation")}<dt>${esc(c.name)}</dt><dd><b>${esc(big)}</b>${rest ? `<span>${esc(rest)}</span>` : ""}<span>Earth: ${esc(c.earth)}</span><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.source)}</a></dd></div>`;
    })
    .join("");
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
  return `<h4>${icon("site")}At the base site: ${esc(t.name)} <span class="muted">${latlon(t.lat, t.lon, 2)}</span></h4>
    ${rows ? `<dl class="w-vals">${rows}</dl>` : `<p class="muted">No measured values for this site.</p>`}
    ${facts ? `<ul class="w-known">${facts}</ul>` : ""}`;
}

function solve(m: Manifest, b: Body) {
  return m.challenges[b]
    .map((c) => `<li>${icon(c.id)}<b>${esc(c.name)}</b><span>${esc(c.question)}</span></li>`)
    .join("");
}

function panel(m: Manifest, b: Body, on: boolean) {
  const t = home(m, b);
  return `<div class="w-panel" id="w-${b}" data-world="${b}"${on ? "" : " hidden"}>
    <div class="w-lead">
      <div class="w-disc w-disc-${b}" aria-hidden="true"></div>
      <div>
        <h3>${TITLE[b]}</h3>
        <h4>${icon("cant")}What Earth can't copy</h4>
        <dl class="w-facts">${cant(m, b)}</dl>
      </div>
    </div>
    <div class="w-cols">
      <section class="w-site">${t ? site(m, t) : ""}</section>
      <section class="w-solve"><h4>${icon("test")}What a base there must solve</h4><ul>${solve(m, b)}</ul></section>
    </div>
    <section class="w-tested"><h4>${icon("pin")}Tested on Earth first</h4>
      <p class="w-sub">Places already used to rehearse for ${NAME[b]}. Parallels checks its scores against them, then looks at all the land nobody uses yet.</p>
      <div class="w-analogs" data-analogs="${b}"><p class="muted">Loading the known analog sites…</p></div>
    </section>
    ${t ? `<p class="w-cta"><button type="button" class="go w-go" data-target="${esc(t.id)}">Find Earth's matches for ${NAME[b]}${icon("chevron")}</button></p>` : ""}
  </div>`;
}

export function worlds(m: Manifest, first: Body): string {
  return `<section id="worlds" class="page-sec band worlds" aria-labelledby="worlds-h">
    <header class="sec-head"><p class="sec-k">Worlds</p><h2 id="worlds-h">Meet the Moon and Mars</h2>
      <p class="lede">What a base there faces, where crews and rovers already rehearse on Earth, and what no place on Earth can copy. Every value names its source.</p></header>
    <div class="w-tabs" role="group" aria-label="Choose a world">${(["moon", "mars"] as const)
      .map((b) => `<button type="button" class="w-tab w-tab-${b}" data-show="${b}" aria-pressed="${b === first}">${TITLE[b]}</button>`)
      .join("")}</div>
    ${(["moon", "mars"] as const).map((b) => panel(m, b, b === first)).join("")}
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
      return `<article class="w-analog"><h5>${esc(l.name)}</h5><p class="w-where">${l.country ? `${esc(l.country)} · ` : ""}${latlon(l.lat, l.lon, 1)}</p>
        ${used ? `<p class="w-used">${esc(used)}</p>` : ""}
        ${rest ? `<details><summary>More</summary><p>${esc(rest)}</p></details>` : ""}
        <a href="${esc(l.analog_source ?? l.source)}" target="_blank" rel="noopener">Source</a></article>`;
    };
    el.innerHTML =
      list.slice(0, 6).map(cardOf).join("") +
      (list.length > 6 ? `<details class="w-all"><summary>Show ${num(list.length - 6)} more places</summary><div class="w-analogs">${list.slice(6).map(cardOf).join("")}</div></details>` : "");
  }
}

export function wireWorlds(root: HTMLElement): void {
  root.addEventListener("click", (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>("[data-show]");
    if (!tab) return;
    for (const b of root.querySelectorAll<HTMLElement>("[data-show]")) b.setAttribute("aria-pressed", String(b === tab));
    for (const p of root.querySelectorAll<HTMLElement>("[data-world]")) p.hidden = p.dataset.world !== tab.dataset.show;
  });
}

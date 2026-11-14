import type { Manifest, Validation, ValidationTest } from "./contract";
import { esc, num } from "./format";

const pct = (v: number | null | undefined) => (v == null ? "not run" : `${num(v * 100, 0)}%`);

export const NAV = [
  ["explore", "Explore"],
  ["checked", "How we checked it"],
  ["terrain", "Terrain types"],
  ["benchmarks", "Benchmarks"],
  ["questions", "Seven questions"],
  ["data", "Data"],
  ["limits", "Not in this version"],
];

const WHERE: Record<number, string> = { 1: "data", 2: "terrain", 3: "explore", 4: "terrain", 5: "explore", 6: "explore" };

export const IMAGERY = [
  {
    name: "Blue Marble: Shaded Relief and Bathymetry (map background, live tiles)",
    by: "NASA Earth Observatory via NASA GIBS",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    licence: "NASA open data, no restrictions",
    use: "Earth globe background. A bundled copy of the same imagery takes over if the tile service is down.",
  },
  {
    name: "CGI Moon Kit: LROC colour map with filled poles",
    by: "NASA Scientific Visualization Studio (LRO data)",
    url: "https://svs.gsfc.nasa.gov/4720",
    licence: "Public domain (NASA)",
    use: "Surface of the 3D Moon globe. Display only, not scored.",
  },
  {
    name: "Viking MDIM 2.1 global colour mosaic",
    by: "NASA / USGS Astrogeology, via NASA Mars Trek tiles",
    url: "https://trek.nasa.gov/mars/",
    licence: "Public domain (NASA / USGS)",
    use: "Surface of the 3D Mars globe. Display only, not scored.",
  },
];

export const CODE = [
  { name: "MapLibre GL JS", url: "https://maplibre.org/", licence: "BSD-3-Clause", use: "Earth globe and map" },
  { name: "three.js", url: "https://threejs.org/", licence: "MIT", use: "3D Moon and Mars globes" },
  { name: "Archivo (variable font, by Omnibus-Type)", url: "https://fontsource.org/fonts/archivo", licence: "SIL Open Font Licence 1.1", use: "Headings, labels and numbers" },
  { name: "Vite and TypeScript", url: "https://vite.dev/", licence: "MIT / Apache-2.0", use: "Building the site" },
];

function chart(t: ValidationTest) {
  const W = 640;
  const L = 12;
  const R = 12;
  const RH = 54;
  const x = (r: number) => L + r * (W - L - R);
  const h = t.groups.length * RH + 34;
  const grid = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="${x(v / 100)}" x2="${x(v / 100)}" y1="10" y2="${h - 24}" class="v-grid"/><text x="${x(v / 100)}" y="${h - 8}" class="v-tick">${v}</text>`)
    .join("");
  const rows = t.groups
    .map((g, k) => {
      const y = k * RH + 40;
      const pts = t.places.filter((p) => p.group === g.id && p.land_rank != null);
      const dots = pts
        .map((p, j) => {
          const cx = x(p.land_rank!);
          const cy = y + ((j % 3) - 1) * 6;
          const title = `<title>${esc(p.name)}: Earth rank ${num(p.land_rank! * 100, 0)}${p.blind ? ", blind" : ""}${p.held_out ? ", held out" : ""}</title>`;
          return p.blind
            ? `<rect x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" class="v-dot g${k} blind" transform="rotate(45 ${cx} ${cy})">${title}</rect>`
            : `<circle cx="${cx}" cy="${cy}" r="4.5" class="v-dot g${k}${p.held_out ? " held" : ""}">${title}</circle>`;
        })
        .join("");
      return `<text x="${L}" y="${y - 16}" class="v-glabel">${esc(g.name)} <tspan class="v-count">${pts.length} scored</tspan></text><line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="v-row"/>${dots}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${h}" class="v-chart" role="img" aria-label="${esc(t.title)}: each test place on a 0 to 100 Earth-rank line, one row per group">${grid}${rows}</svg>`;
}

function test(t: ValidationTest) {
  const off = t.places.filter((p) => p.land_rank == null);
  return `<article class="v-test">
    <h3>${esc(t.title)}</h3>
    <p>${esc(t.plain)}</p>
    <ul class="v-groups">${t.groups.map((g, k) => `<li><i class="sw g${k}"></i><b>${esc(g.name)}.</b> ${esc(g.plain)}</li>`).join("")}</ul>
    <div class="scroll-x">${chart(t)}</div>
    <p class="small muted">Position: Earth rank of the place's match score, from 0 (worse than all land) to 100 (better than all land). Circles: scored places; open circles: the held-out half; diamonds: blind places never scored before.</p>
    <div class="scroll-x"><table class="data">
      <thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Pass mark</th><th scope="col">Held-out half</th><th scope="col">Blind only</th><th scope="col">Pairs</th><th scope="col">Outcome</th></tr></thead>
      <tbody>${t.checks
        .map(
          (c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${pct(c.result)}</td><td class="n">${pct(c.pass_mark)}</td><td class="n">${pct(c.held_out_only)}</td><td class="n">${pct(c.blind_only)}</td><td class="n">${num(c.n_pairs)}</td><td class="${
            c.passed ? "pass" : c.passed === false ? "fail" : ""
          }">${c.passed ? "Passed" : c.passed === false ? "Not passed" : "Not run"}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
    <p class="small muted">A result is the share of random pairs where the first group's place ranks higher than the second's.</p>
    ${t.misses.length ? `<h4>Misses, explained</h4><ul class="plain">${t.misses.map((m) => `<li><b>${esc(m.place)}:</b> ${esc(m.why)}</li>`).join("")}</ul>` : ""}
    ${
      off.length
        ? `<details><summary>${off.length} test places not on the chart</summary><ul class="plain">${off.map((p) => `<li><b>${esc(p.name)}:</b> ${esc(p.note ?? "Not scored.")}</li>`).join("")}</ul></details>`
        : ""
    }
  </article>`;
}

function checked(v: Validation | null) {
  if (!v) return `<p>The validation file is missing from this build, so no check results are shown.</p>`;
  return `<p class="lede">If the method works, places NASA already trusts should score higher than ordinary farmland, and higher than big deserts that are dry but not analogs. The pass marks were set in our plan before any data came in.</p>
    <p class="note"><b>Not a blind first run.</b> ${esc(v.not_blind_note)}</p>
    ${v.prototype_runs.length ? `<p class="small muted">Earlier prototype runs: ${v.prototype_runs.map((r) => `${esc(r.date)}: ${esc(r.result)}`).join("; ")}. Weights fixed at commit ${esc(v.weights_commit)}.</p>` : ""}
    <div class="v-tests">${v.tests.map(test).join("")}</div>
    ${v.stability ? `<p>${esc(v.stability)}</p>` : ""}
    <h3>Data checks</h3>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Outcome</th></tr></thead><tbody>${v.data_checks
      .map((c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${esc(c.result)}</td><td class="${c.passed ? "pass" : "fail"}">${c.passed ? "Passed" : "Not passed"}</td></tr>`)
      .join("")}</tbody></table></div>`;
}

function terrain(m: Manifest) {
  return `<div class="cols2">
    <div><h3>Terrain types</h3><p>Every land cell gets one tag, by rules worked out from the data. Filter the map by type above.</p>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Type</th><th scope="col">Rule</th><th scope="col">Cells</th></tr></thead><tbody>${m.terrain_types
      .map((t) => `<tr><th scope="row">${esc(t.name)}</th><td>${esc(t.rule)}</td><td class="n">${num(t.cells)}</td></tr>`)
      .join("")}</tbody></table></div></div>
    <div><h3>Clusters</h3><p>${esc(m.clustering.summary)}</p><p class="small muted">${esc(m.clustering.method)}. ${m.clustering.k} clusters, from: ${m.clustering.inputs.map(esc).join(", ")}.</p>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Cluster</th><th scope="col">Cells</th><th scope="col">Most common type</th><th scope="col">Share</th></tr></thead><tbody>${m.clustering.agreement
      .map((a) => `<tr><th scope="row">${num(a.cluster)}</th><td class="n">${num(a.cells)}</td><td>${esc(a.top_type)}</td><td class="n">${num(a.share * 100, 0)}%</td></tr>`)
      .join("")}</tbody></table></div></div>
  </div>`;
}

function data(m: Manifest) {
  const order = ["NASA", "USGS", "computed", "ESA", "partner", "other"];
  const ds = [...m.datasets].sort((a, b) => order.indexOf(a.agency) - order.indexOf(b.agency));
  return `<p class="lede">Every number on this site traces to one of these. NASA data does the main scoring work; partner data is marked.</p>
    <div class="scroll-x"><table class="data ds"><thead><tr><th scope="col">Dataset</th><th scope="col">Agency</th><th scope="col">Licence</th><th scope="col">Used for</th></tr></thead><tbody>${ds
      .map(
        (d) => `<tr><th scope="row">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}${d.archive ? `<span class="muted small"> ${esc(d.archive)}</span>` : ""}</th><td>${esc(d.agency)}${
          d.agency === "partner" ? ' <span class="tag">partner</span>' : ""
        }</td><td>${esc(d.licence)}</td><td>${esc(d.used_for)}</td></tr>`,
      )
      .join("")}</tbody></table></div>
    <h3>Imagery shown, not scored</h3>
    <ul class="plain">${IMAGERY.map((i) => `<li><a href="${i.url}" target="_blank" rel="noopener">${esc(i.name)}</a>, ${esc(i.by)}. ${esc(i.licence)}. ${esc(i.use)}</li>`).join("")}</ul>
    <h3>Code and fonts</h3>
    <ul class="plain">${CODE.map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener">${esc(c.name)}</a>: ${esc(c.licence)}. ${esc(c.use)}.</li>`).join("")}</ul>`;
}

export function sections(m: Manifest, v: Validation | null) {
  const sec = (id: string, title: string, body: string) => `<section id="${id}" class="page-sec" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${body}</section>`;
  return [
    sec("checked", "How we checked it", checked(v)),
    sec("terrain", "Terrain types and clusters", terrain(m)),
    sec(
      "benchmarks",
      "The six benchmarks",
      `<p class="lede">From our local event's Challenge Guide, in its own words.</p><ol class="bench">${m.benchmarks
        .map(
          (b) => `<li><span class="b-n">${b.n}</span><div><p class="guide">${esc(b.guide_words)}</p><p>${esc(b.how)}</p><p class="small"><a href="#${WHERE[b.n] ?? "explore"}">${esc(b.where)}</a></p></div></li>`,
        )
        .join("")}</ol>`,
    ),
    sec(
      "questions",
      "Seven questions",
      `<ol class="qs">${m.questions.map((q) => `<li><span class="b-n">${q.n}</span><div><p class="guide">${esc(q.question)}</p><p>${esc(q.answer)}</p></div></li>`).join("")}</ol>`,
    ),
    sec("data", "Data", data(m)),
    sec("limits", "Not in this version", `<ul class="plain limits">${m.not_in_version.map((n) => `<li><b>${esc(n.item)}.</b> ${esc(n.reason)}</li>`).join("")}</ul>`),
  ].join("");
}

import "./sections.css";
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

const placeName = (t: ValidationTest, id: string) => t.places.find((p) => p.id === id)?.name ?? id;

const outcome = (passed: boolean | null) =>
  `<td class="${passed ? "pass" : passed === false ? "fail" : ""}">${passed ? "Passed" : passed === false ? "Not passed" : "Not run"}</td>`;

function chart(t: ValidationTest, m: Manifest) {
  const W = 640;
  const L = 12;
  const R = 12;
  const RH = 54;
  const x = (r: number) => L + r * (W - L - R);
  const h = t.groups.length * RH + 34;
  const chName = (id?: string) => (id ? (Object.values(m.challenges).flat().find((c) => c.id === id)?.name ?? id) : "");
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
          const title = `<title>${esc(p.name)}${p.challenge ? ` (${esc(chName(p.challenge))})` : ""}: Earth rank ${num(p.land_rank! * 100, 0)}${p.blind ? ", blind" : ""}${p.held_out ? ", held out" : ""}</title>`;
          return p.blind
            ? `<rect x="${cx - 4.5}" y="${cy - 4.5}" width="9" height="9" class="v-dot g${k} blind" transform="rotate(45 ${cx} ${cy})">${title}</rect>`
            : `<circle cx="${cx}" cy="${cy}" r="4.5" class="v-dot g${k}${p.held_out ? " held" : ""}">${title}</circle>`;
        })
        .join("");
      return `<text x="${L}" y="${y - 16}" class="v-glabel">${esc(g.name)} <tspan class="v-count">${pts.length} scored</tspan></text><line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="v-row"/>${dots}`;
    })
    .join("");
  const table = `<details class="v-table"><summary>Every place as a table</summary><div class="scroll-x"><table class="data">
    <thead><tr><th scope="col">Place</th><th scope="col">Group</th>${t.places.some((p) => p.challenge) ? '<th scope="col">Checked on</th>' : ""}<th scope="col">Earth rank</th><th scope="col">Held out</th><th scope="col">Blind</th></tr></thead>
    <tbody>${[...t.places]
      .sort((a, b) => (b.land_rank ?? -1) - (a.land_rank ?? -1))
      .map(
        (p) => `<tr><th scope="row">${esc(p.name)}</th><td>${esc(t.groups.find((g) => g.id === p.group)?.name ?? p.group)}</td>${
          t.places.some((q) => q.challenge) ? `<td>${esc(chName(p.challenge))}</td>` : ""
        }<td class="n">${p.land_rank == null ? "not scored" : num(p.land_rank * 100, 0)}</td><td>${p.held_out ? "yes" : ""}</td><td>${p.blind ? "yes" : ""}</td></tr>`,
      )
      .join("")}</tbody></table></div></details>`;
  return `<div class="scroll-x"><svg viewBox="0 0 ${W} ${h}" class="v-chart" role="img" aria-label="${esc(t.title)}: each test place on a 0 to 100 Earth-rank line, one row per group">${grid}${rows}</svg></div>${table}`;
}

function test(t: ValidationTest, m: Manifest) {
  const off = t.places.filter((p) => p.land_rank == null);
  return `<article class="v-test">
    <h3>${esc(t.title)}</h3>
    <p>${esc(t.plain)}</p>
    <ul class="v-groups">${t.groups.map((g, k) => `<li><i class="sw g${k}"></i><b>${esc(g.name)}.</b> ${esc(g.plain)}</li>`).join("")}</ul>
    ${chart(t, m)}
    <p class="small muted">Position: Earth rank of the place's match score, from 0 (worse than all land) to 100 (better than all land). Filled circles: scored places; open circles: the held-out half; diamonds: blind places never scored before.</p>
    ${t.misses.length ? `<h4>Misses, explained</h4><ul class="plain">${t.misses.map((x) => `<li><b>${esc(placeName(t, x.place))}:</b> ${esc(x.why)}</li>`).join("")}</ul>` : ""}
    ${off.length ? `<h4>Could not be scored</h4><ul class="plain">${off.map((p) => `<li><b>${esc(p.name)}:</b> ${esc(p.note ?? "Not scored.")}</li>`).join("")}</ul>` : ""}
  </article>`;
}

function checksTable(tests: ValidationTest[]) {
  return `<div class="scroll-x"><table class="data v-checks">
    <thead><tr><th scope="col">Check</th><th scope="col">Pass mark</th><th scope="col">All sites</th><th scope="col">Held-out half</th><th scope="col">Blind sites</th><th scope="col">Pairs</th><th scope="col">Outcome</th></tr></thead>
    <tbody>${tests
      .flatMap((t) => t.checks)
      .map(
        (c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${pct(c.pass_mark)}</td><td class="n big">${pct(c.result)}</td><td class="n">${pct(c.held_out_only)}</td><td class="n">${pct(c.blind_only)}</td><td class="n">${num(c.n_pairs)}</td>${outcome(c.passed)}</tr>`,
      )
      .join("")}</tbody>
  </table></div>
  <p class="small muted">A result is the share of pairs where the first group's place ranks higher than the second's (a pair with exactly equal scores counts as half). "Held-out half" uses only the analogs set aside in a fixed split; "blind sites" uses only analogs never scored before this run.</p>`;
}

const judged = (tests: ValidationTest[]) => tests.flatMap((t) => t.checks).filter((c) => c.passed != null);
const passCount = (tests: ValidationTest[]) => judged(tests).filter((c) => c.passed).length;

function verdict(tests: ValidationTest[], summary?: string) {
  const all = judged(tests);
  const passed = passCount(tests);
  return `<div class="verdict${passed === all.length ? " ok" : ""}">
    <p class="v-count-big"><b>${num(passed)} of ${num(all.length)}</b> checks passed</p>
    ${summary ? `<p class="v-summary">${esc(summary)}</p>` : ""}
  </div>`;
}

type Later = NonNullable<Validation["second_run"]> & Partial<Pick<NonNullable<Validation["third_run"]>, "method_change" | "adopted" | "adoption_rule">>;

type Run = { id: string; title: string; adopted?: boolean; tests: ValidationTest[]; body: string };

const methodOf = (title: string) => title.match(/method version ([\d.]+)/i)?.[1];

function later(r: Later, id: string, m: Manifest) {
  const extra = [
    r.method_change ? `<p><b>Method change.</b> ${esc(r.method_change)}</p>` : "",
    r.adoption_rule ? `<p><b>Adoption rule.</b> ${esc(r.adoption_rule)}</p>` : "",
    r.adopted != null ? `<p><b>Adopted.</b> ${r.adopted ? "Yes" : "No"}</p>` : "",
  ].join("");
  return `<div class="second" id="${id}">
      <h3 class="run-h">${esc(r.title)}</h3>
      <p class="note"><b>Designed after seeing the first run.</b> Its design was chosen knowing the first run's result, so it can't confirm the method the way the first run could. Config fixed at commit ${esc(r.config_commit)}.</p>
      <p>${esc(r.plain)}</p>
      ${extra}
      ${verdict(r.tests, r.summary)}
      ${checksTable(r.tests)}
      <div class="v-tests">${r.tests.map((t) => test(t, m)).join("")}</div>
      ${r.unchecked.length ? `<h4>Not checked in this run</h4><ul class="plain">${r.unchecked.map((u) => `<li><b>${esc(u.place)}:</b> ${esc(u.why)}</li>`).join("")}</ul>` : ""}
    </div>`;
}

function first(v: Validation, m: Manifest) {
  return `<div class="run-first" id="first-run">
    <h3 class="run-h">First run</h3>
    ${verdict(v.tests, v.summary)}
    ${checksTable(v.tests)}
    <p class="note"><b>Not a blind first run.</b> ${esc(v.not_blind_note)}${
      v.prototype_runs.length ? ` Earlier prototype runs: ${v.prototype_runs.map((r) => `${esc(r.date)}, ${esc(r.result)}`).join("; ")}.` : ""
    } Weights and pass marks fixed at commit ${esc(v.weights_commit)}.</p>
    <div class="v-tests">${v.tests.map((t) => test(t, m)).join("")}</div>
  </div>`;
}

function runs(v: Validation, m: Manifest): Run[] {
  const out: Run[] = [{ id: "first-run", title: "First run", tests: v.tests, body: first(v, m) }];
  if (v.second_run) out.push({ id: "second-run", title: v.second_run.title, tests: v.second_run.tests, body: later(v.second_run, "second-run", m) });
  if (v.third_run) out.push({ id: "third-run", title: v.third_run.title, adopted: v.third_run.adopted, tests: v.third_run.tests, body: later(v.third_run, "third-run", m) });
  for (const r of v.more_runs ?? []) {
    const id = `run-${out.length + 1}`;
    out.push({ id, title: r.title, adopted: r.adopted, tests: r.tests, body: later(r, id, m) });
  }
  return out;
}

function history(all: Run[], now: Run) {
  return `<div class="scroll-x"><table class="data run-hist"><thead><tr><th scope="col">Run</th><th scope="col">Method</th><th scope="col">Checks passed</th><th scope="col">Used now</th></tr></thead><tbody>${all
    .map((r, i) => {
      const v = methodOf(r.title);
      return `<tr${r === now ? ' class="now"' : ""}><th scope="row"><a href="#${r.id}">Run ${num(i + 1)}</a></th><td>${v ? `version ${esc(v)}` : esc(r.title)}</td><td class="n">${num(passCount(r.tests))} of ${num(judged(r.tests).length)}</td><td>${r === now ? "Yes" : "No"}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}

function checked(v: Validation | null, m: Manifest) {
  if (!v) return `<p>The validation file is missing from this build, so no check results are shown.</p>`;
  const all = runs(v, m);
  const now = [...all].reverse().find((r) => r.adopted) ?? all[0];
  const ver = m.method_version ?? methodOf(now.title);
  const earlier = all.filter((r) => r !== now);
  return `<p class="lede">If the method works, places NASA already trusts should score higher than ordinary farmland, and higher than big deserts that are dry but not analogs. The pass marks were set in our plan before any data came in.</p>
    <div class="current-box">
      <p class="cur-h">${ver ? `Current method: version ${esc(ver)} (the map uses this)` : `Current method: ${esc(now.title)} (the map uses this)`}</p>
      ${history(all, now)}
    </div>
    ${now.body}
    ${earlier.length ? `<details class="earlier"><summary>Earlier runs (${num(earlier.length)})</summary>${earlier.map((r) => r.body).join("")}</details>` : ""}
    ${v.stability ? `<p>${esc(v.stability)}</p>` : ""}
    <h3>Data checks</h3>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Outcome</th></tr></thead><tbody>${v.data_checks
      .map((c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${esc(c.result)}</td>${outcome(c.passed)}</tr>`)
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
  const archives = [...new Set(ds.map((d) => d.archive).filter((a): a is string => !!a && !/^(computed|published paper)$/i.test(a)))];
  const b1 = m.benchmarks.find((b) => b.n === 1);
  return `<p class="lede">Every number on this site traces to one of these. NASA data does the main scoring work; partner data is marked.</p>
    ${
      b1
        ? `<div class="archives"><p class="guide">${esc(b1.guide_words)}</p><p>${num(archives.length)} open data archives feed this site: ${archives.map(esc).join(", ")}.</p></div>`
        : ""
    }
    <div class="scroll-x"><table class="data ds"><thead><tr><th scope="col">Dataset</th><th scope="col">Agency</th><th scope="col">Archive</th><th scope="col">Licence</th><th scope="col">Used for</th></tr></thead><tbody>${ds
      .map(
        (d) => `<tr><th scope="row">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}</th><td>${esc(d.agency)}${
          d.agency === "partner" ? ' <span class="tag">partner</span>' : ""
        }</td><td>${esc(d.archive ?? "")}</td><td>${esc(d.licence)}</td><td>${esc(d.used_for)}</td></tr>`,
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
    sec("checked", "How we checked it", checked(v, m)),
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

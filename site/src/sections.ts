import "./sections.css";
import type { Manifest, Validation, ValidationTest } from "./contract";
import { esc, num } from "./format";

const pct = (v: number | null | undefined) => (v == null ? "not run" : `${num(v * 100, 0)}%`);

const WHERE: Record<number, string> = { 1: "data", 2: "terrain", 3: "explore", 4: "terrain", 5: "explore", 6: "explore" };

export const IMAGERY = [
  {
    name: "Blue Marble: Shaded Relief and Bathymetry (map background, live tiles)",
    by: "NASA Earth Observatory via NASA GIBS",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    licence: "NASA open data, no restrictions",
    use: "The background of the Earth map, the 3D Earth on Home and the bottom layer of the Earth close-up. If the tile service is down, the site uses its own copy of the same images.",
  },
  {
    name: "Landsat WELD true colour, global annual mosaic (Earth close-up, live tiles)",
    by: "NASA / USGS Landsat, via NASA GIBS",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    licence: "NASA open data, no restrictions",
    use: "The Earth side of the close-up in each match. We show it but do not score it. Where it has no data, Blue Marble shows.",
  },
  {
    name: "LOLA south-pole shaded relief, 87.5° S to the pole (Moon close-up, live tiles)",
    by: "NASA LRO LOLA, via NASA Moon Trek tiles",
    url: "https://trek.nasa.gov/moon/",
    licence: "Public domain (NASA)",
    use: "The Moon side of the close-up. This is shaded relief from laser altimetry, not a photo. We show it but do not score it.",
  },
  {
    name: "CGI Moon Kit: LROC colour map with filled poles",
    by: "NASA Scientific Visualization Studio (LRO data)",
    url: "https://svs.gsfc.nasa.gov/4720",
    licence: "Public domain (NASA)",
    use: "The surface of the 3D Moon in the Moon part of Home, and the site pictures in its list. We draw the site pictures as a view from above the pole with more contrast, because the map is very flat near the pole. The site also uses its own copy as the fallback for the Moon close-up. We show it but do not score it.",
  },
  {
    name: "Viking MDIM 2.1 global colour mosaic",
    by: "NASA / USGS Astrogeology, via NASA Mars Trek tiles",
    url: "https://trek.nasa.gov/mars/",
    licence: "Public domain (NASA / USGS)",
    use: "The surface of the 3D Mars in the Mars part of Home, the site pictures in its list, and the Mars side of the close-up. The close-up uses live tiles, with a copy on the site as the fallback. We show it but do not score it.",
  },
];

export const CODE = [
  { name: "MapLibre GL JS", url: "https://maplibre.org/", licence: "BSD-3-Clause", use: "Earth globe and map" },
  { name: "three.js", url: "https://threejs.org/", licence: "MIT", use: "3D Earth, Moon and Mars in the intro" },
  { name: "Lucide icons 1.73.0", url: "https://lucide.dev/", licence: "ISC", use: "Icons on the match page" },
  { name: "Archivo (variable font, by Omnibus-Type)", url: "https://fontsource.org/fonts/archivo", licence: "SIL Open Font Licence 1.1", use: "Headings, labels and numbers" },
  { name: "Vite and TypeScript", url: "https://vite.dev/", licence: "MIT / Apache-2.0", use: "Tools that build the site" },
];

const placeName = (t: ValidationTest, id: string) => t.places.find((p) => p.id === id)?.name ?? id;

const outcome = (passed: boolean | null) =>
  `<td class="${passed ? "pass" : passed === false ? "fail" : ""}">${passed ? "Passed" : passed === false ? "Not passed" : "Not run"}</td>`;

type Check = ValidationTest["checks"][number];

const FEW = /\s*\(too few sites[^)]*\)\s*$/i;
const bare = (name: string) => name.replace(FEW, "");

const fold = (summary: string, body: string, cls = "") => `<details${cls ? ` class="${cls}"` : ""}><summary>${summary}</summary>${body}</details>`;

const label = (l: string) => `<p class="run-label">${esc(l)}</p>`;

function chart(t: ValidationTest, m: Manifest, l: string) {
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
  const table = `<details class="v-table"><summary>Every place as a table (${num(t.places.length)})</summary>${label(l)}<div class="scroll-x"><table class="data">
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

function test(t: ValidationTest, m: Manifest, l: string, plain: boolean) {
  return `<article class="v-test">
    <h4>${esc(t.title)}</h4>
    ${plain ? `<p>${esc(t.plain)}</p>` : ""}
    <ul class="v-groups">${t.groups.map((g, k) => `<li><i class="sw g${k}"></i><b>${esc(g.name)}.</b> ${esc(g.plain)}</li>`).join("")}</ul>
    ${chart(t, m, l)}
  </article>`;
}

function tests(ts: ValidationTest[], m: Manifest, l: string) {
  const groups: ValidationTest[][] = [];
  for (const t of ts) {
    const g = groups[groups.length - 1];
    if (g && g[0].plain === t.plain) g.push(t);
    else groups.push([t]);
  }
  const body = groups
    .map((g) =>
      g.length > 1
        ? `<div class="v-same"><p>${esc(g[0].plain)}</p><div class="v-tests">${g.map((t) => test(t, m, l, false)).join("")}</div></div>`
        : `<div class="v-tests">${test(g[0], m, l, true)}</div>`,
    )
    .join("");
  return `${label(l)}${body}<p class="small muted">Position: Earth rank of the place's match score, from 0 (worse than all land) to 100 (better than all land). Filled circles: scored places; open circles: the held-out half; diamonds: blind places never scored before.</p>`;
}

function notRun(ts: ValidationTest[]) {
  const off = ts.flatMap((t) => t.checks.filter((c) => c.passed == null).map((c) => ({ t, c })));
  if (!off.length) return "";
  const min = off.map(({ c }) => c.name.match(/fewer than (\d+)/i)?.[1]).find(Boolean);
  const by = [...new Set(off.map(({ t }) => t))].map((t) => `<b>${esc(t.title)}:</b> ${off.filter((o) => o.t === t).map(({ c }) => esc(bare(c.name))).join("; ")}.`);
  return `<p class="not-run">${num(off.length)} ${off.length === 1 ? "check" : "checks"} had ${min ? `fewer than ${esc(min)} test sites` : "too few test sites"}, so no pass or fail. ${by.join(" ")}</p>`;
}

function checksTable(ts: ValidationTest[], l: string) {
  const rows = ts.flatMap((t) => t.checks).filter((c) => c.passed != null);
  return fold(
    `Every check in this run (${num(rows.length)})`,
    `${label(l)}<div class="scroll-x"><table class="data v-checks">
    <thead><tr><th scope="col">Check</th><th scope="col">Pass mark</th><th scope="col">All sites</th><th scope="col">Held-out half</th><th scope="col">Blind sites</th><th scope="col">Pairs</th><th scope="col">Outcome</th></tr></thead>
    <tbody>${rows
      .map(
        (c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${pct(c.pass_mark)}</td><td class="n big">${pct(c.result)}</td><td class="n">${pct(c.held_out_only)}</td><td class="n">${pct(c.blind_only)}</td><td class="n">${num(c.n_pairs)}</td>${outcome(c.passed)}</tr>`,
      )
      .join("")}</tbody>
  </table></div>
  <p class="small muted">A result is the share of pairs where the first group's place ranks higher than the second's (a pair with exactly equal scores counts as half). "Held-out half" uses only the analogs set aside in a fixed split; "blind sites" uses only analogs never scored before this run.</p>`,
    "v-all",
  );
}

const judged = (ts: ValidationTest[]) => ts.flatMap((t) => t.checks).filter((c) => c.passed != null);
const passCount = (ts: ValidationTest[]) => judged(ts).filter((c) => c.passed).length;

const share = (v: number) => Math.max(0, Math.min(100, v * 100));

function bar(t: ValidationTest, c: Check, same = false) {
  const st = `${c.passed ? "pass" : "fail"}${same ? " same" : ""}`;
  const word = c.passed ? '<span class="cbar-st pass"><i aria-hidden="true">\u2713</i> Passed</span>' : '<span class="cbar-st fail"><i aria-hidden="true">\u2715</i> Not passed</span>';
  const fill = c.result == null ? "" : `<i class="cbar-fill" style="width:${share(c.result)}%"></i>`;
  return `<li class="cbar ${st}">
    <p class="cbar-name"><span class="cbar-test">${esc(t.title)}</span>${esc(c.name)}</p>
    <div class="cbar-track" aria-hidden="true">${fill}<i class="cbar-mark" style="left:${share(c.pass_mark)}%"></i></div>
    <p class="cbar-num">${word} <span><b>${c.result == null ? "no data" : pct(c.result)}</b> against a pass mark of ${pct(c.pass_mark)}</span></p>
  </li>`;
}

function verdict(ts: ValidationTest[], summary?: string, head = true) {
  const all = judged(ts);
  const passed = passCount(ts);
  const pairs = (p: boolean) => ts.flatMap((t) => t.checks.filter((c) => c.passed === p).map((c) => ({ t, c })));
  const failed = pairs(false);
  const ok = pairs(true);
  return `<div class="verdict${passed === all.length ? " ok" : ""}">
    ${head ? `<p class="v-count-big"><b>${num(passed)} of ${num(all.length)}</b> checks passed</p>` : ""}
    ${
      failed.length
        ? `<p class="v-failed"><b>Not passed (${num(failed.length)})</b></p><ul class="v-fail-list cbars">${failed.map(({ t, c }, i) => bar(t, c, failed[i - 1]?.t === t)).join("")}</ul>`
        : ""
    }
    ${ok.length ? fold(`Passed (${num(ok.length)})`, `<ul class="cbars">${ok.map(({ t, c }, i) => bar(t, c, ok[i - 1]?.t === t)).join("")}</ul>`, "v-passed") : ""}
  </div>
  ${summary ? fold("What this run found, in full", `<p class="v-summary">${esc(summary)}</p>`) : ""}`;
}

function misses(ts: ValidationTest[]) {
  const ms = ts.flatMap((t) => t.misses.map((x) => ({ t, x })));
  const off = ts.flatMap((t) => t.places.filter((p) => p.land_rank == null).map((p) => ({ t, p })));
  return [
    ms.length
      ? fold(
          `Misses, explained (${num(ms.length)})`,
          `<ul class="plain">${ms.map(({ t, x }) => `<li><b>${esc(placeName(t, x.place))}</b> <span class="muted">(${esc(t.title)})</span>: ${esc(x.why)}</li>`).join("")}</ul>`,
        )
      : "",
    off.length
      ? fold(
          `Could not be scored (${num(off.length)})`,
          `<ul class="plain">${off.map(({ t, p }) => `<li><b>${esc(p.name)}</b> <span class="muted">(${esc(t.title)})</span>: ${esc(p.note ?? "Not scored.")}</li>`).join("")}</ul>`,
        )
      : "",
  ].join("");
}

function block(ts: ValidationTest[], m: Manifest, l: string) {
  return `${checksTable(ts, l)}${fold(`Each test, with its chart (${num(ts.length)})`, tests(ts, m, l))}${misses(ts)}`;
}

type Later = NonNullable<Validation["second_run"]> & Partial<Pick<NonNullable<Validation["third_run"]>, "method_change" | "adopted" | "adoption_rule">>;

type Run = { id: string; title: string; label: string; adopted?: boolean; preset?: string; tests: ValidationTest[]; body: (head: boolean) => string };

const presetName = (m: Manifest, id: string) => m.filters.find((f) => f.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

const methodOf = (title: string) => title.match(/method version ([\d.]+)/i)?.[1];

const runLabel = (n: number, title: string, preset?: string) => {
  const v = methodOf(title);
  return `Run ${n} · ${preset ? `check of the ${preset} preset` : v ? `method ${v}` : title}`;
};

function later(r: Later, id: string, l: string, m: Manifest, head: boolean, preset?: string) {
  const extra = preset
    ? `<p><b>A check of the ${esc(presetName(m, preset))} preset.</b> It runs the same checks on that preset's ranking. It does not change the method or what the map uses.</p>`
    : [
        r.method_change ? `<p><b>Method change.</b> ${esc(r.method_change)}</p>` : "",
        r.adoption_rule ? `<p><b>Adoption rule.</b> ${esc(r.adoption_rule)}</p>` : "",
        r.adopted != null ? `<p><b>Adopted.</b> ${r.adopted ? "Yes" : "No"}</p>` : "",
      ].join("");
  return `<div class="second${preset ? " preset-run" : ""}" id="${id}">
      ${preset ? `<p class="run-label">Check of the ${esc(presetName(m, preset))} preset</p>` : ""}
      <h3 class="run-h">${esc(r.title)}</h3>
      ${verdict(r.tests, undefined, head)}
      <div class="run-notes">${notRun(r.tests)}<p class="note"><b>Designed after seeing the first run.</b> Its design was chosen knowing the first run's result, so it can't confirm the method the way the first run could. Config fixed at commit ${esc(r.config_commit)}.</p></div>
      <div class="folds">
      ${r.summary ? fold("What this run found, in full", `<p class="v-summary">${esc(r.summary)}</p>`) : ""}
      ${fold(extra && !preset ? "What this run changed, and the rule for using it" : "What this run did", `<p>${esc(r.plain)}</p>${extra}`)}
      ${block(r.tests, m, l)}
      ${r.unchecked.length ? fold(`Not checked in this run (${num(r.unchecked.length)})`, `<ul class="plain">${r.unchecked.map((u) => `<li><b>${esc(u.place)}:</b> ${esc(u.why)}</li>`).join("")}</ul>`) : ""}
      </div>
    </div>`;
}

function first(v: Validation, l: string, m: Manifest, head: boolean) {
  return `<div class="run-first" id="first-run">
    <h3 class="run-h">First run</h3>
    ${verdict(v.tests, undefined, head)}
    <div class="run-notes">${notRun(v.tests)}<p class="note"><b>Not a blind first run.</b> ${esc(v.not_blind_note)}${
      v.prototype_runs.length ? ` Earlier prototype runs: ${v.prototype_runs.map((r) => `${esc(r.date)}, ${esc(r.result)}`).join("; ")}.` : ""
    } Weights and pass marks fixed at commit ${esc(v.weights_commit)}.</p></div>
    <div class="folds">
    ${v.summary ? fold("What this run found, in full", `<p class="v-summary">${esc(v.summary)}</p>`) : ""}
    ${block(v.tests, m, l)}
    </div>
  </div>`;
}

function runs(v: Validation, m: Manifest): Run[] {
  const out: Run[] = [];
  const add = (id: string, title: string, tests: ValidationTest[], adopted: boolean | undefined, body: (l: string, head: boolean) => string, preset?: string) => {
    const l = runLabel(out.length + 1, title, preset && presetName(m, preset));
    out.push({ id, title, label: l, adopted, preset, tests, body: (head) => body(l, head) });
  };
  add("first-run", "First run", v.tests, undefined, (l, h) => first(v, l, m, h));
  const s = v.second_run;
  if (s) add("second-run", s.title, s.tests, undefined, (l, h) => later(s, "second-run", l, m, h));
  const t = v.third_run;
  if (t) add("third-run", t.title, t.tests, t.adopted, (l, h) => later(t, "third-run", l, m, h));
  for (const r of v.more_runs ?? []) {
    const id = `run-${out.length + 1}`;
    const preset = r.preset;
    add(id, r.title, r.tests, r.adopted, (l, h) => later(r, id, l, m, h, preset), preset);
  }
  return out;
}

function meter(passed: number, all: number, cls = "") {
  const w = all ? (passed / all) * 100 : 0;
  return `<span class="meter${cls ? ` ${cls}` : ""}" aria-hidden="true"><i style="width:${w}%"></i></span>`;
}

function runHistory(all: Run[], now: Run, m: Manifest) {
  return `<ol class="run-hist">${all
    .map((r, i) => {
      const v = methodOf(r.title);
      const p = passCount(r.tests);
      const n = judged(r.tests).length;
      return `<li${r === now ? ' class="rh-now"' : ""}><a href="#${r.id}">
        <span class="rh-n">Run ${num(i + 1)}</span>
        <span class="rh-m">${v ? `Method version ${esc(v)}` : esc(r.title)}</span>
        ${meter(p, n)}
        <span class="rh-p"><b>${num(p)} of ${num(n)}</b> checks passed</span>
        <span class="rh-u${r === now ? " on" : ""}">${r === now ? "Used now" : r.preset ? `Check of the ${esc(presetName(m, r.preset))} preset` : "Not used now"}</span>
      </a></li>`;
    })
    .join("")}</ol>`;
}

function checked(v: Validation | null, m: Manifest) {
  if (!v) return { lede: "", body: `<p>The validation file is missing from this build, so no check results are shown.</p>` };
  const all = runs(v, m);
  const now = [...all].reverse().find((r) => r.adopted && !r.preset) ?? all[0];
  const ver = m.method_version ?? methodOf(now.title);
  const earlier = all.filter((r) => r !== now && !r.preset);
  const presets = all.filter((r) => r.preset);
  const dataOk = v.data_checks.filter((c) => c.passed).length;
  const dataBad = v.data_checks.filter((c) => !c.passed);
  const p = passCount(now.tests);
  const n = judged(now.tests).length;
  const off = now.tests.flatMap((t) => t.checks).filter((c) => c.passed == null).length;
  return {
    lede: "Places NASA already trusts should score higher than ordinary farmland and plain deserts. We set the pass marks before any data came in.",
    body: `<div class="chk-head">
      <div class="chk-score${p === n ? " ok" : ""}">
        <p class="cur-h">${ver ? `Current method: version ${esc(ver)}` : `Current method: ${esc(now.title)}`} <span>(the map uses this)</span></p>
        <p class="v-count-big"><b>${num(p)} of ${num(n)}</b> checks passed</p>
        ${meter(p, n, "big")}
        <p class="chk-sub">${num(n - p)} not passed${off ? `. ${num(off)} more had too few test sites to judge` : ""}.</p>
      </div>
      <div class="current-box">
        <p class="run-label">Every run</p>
        ${runHistory(all, now, m)}
      </div>
    </div>
    ${now.body(false)}
    ${presets.map((r) => r.body(true)).join("")}
    <div class="folds chk-more">
    ${earlier.length ? `<details class="earlier"><summary>Earlier runs (${num(earlier.length)})</summary>${earlier.map((r) => r.body(true)).join("")}</details>` : ""}
    ${v.stability ? fold("How stable the top places are", `<p>${esc(v.stability)}</p>`) : ""}
    ${fold(
      `Data checks (${num(dataOk)} of ${num(v.data_checks.length)} passed)`,
      `<div class="scroll-x"><table class="data"><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Outcome</th></tr></thead><tbody>${v.data_checks
        .map((c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${esc(c.result)}</td>${outcome(c.passed)}</tr>`)
        .join("")}</tbody></table></div>`,
    )}
    </div>
    ${dataBad.length ? `<p class="v-failed"><b>Data checks not passed:</b> ${dataBad.map((c) => esc(c.name)).join("; ")}</p>` : ""}`,
  };
}

const block2 = (id: string, n: number, title: string, line: string, body: string) =>
  `<details class="ch-block" id="${id}"><summary><span class="cb-n">${num(n)}</span><span class="cb-tx"><span class="cb-t">${title}</span><span class="cb-s">${line}</span></span></summary><div class="cb-body">${body}</div></details>`;

function terrain(m: Manifest) {
  return block2(
    "terrain",
    m.terrain_types.length,
    "Terrain types and clusters",
    `${num(m.terrain_types.length)} terrain types and ${num(m.clustering.k)} clusters, from the data.`,
    `<p>Each land cell gets one terrain type. Rules that come from the data set the type. <a href="#/find">The Finder</a> can filter its list and map by type.</p>
    <h3>Terrain types</h3>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Type</th><th scope="col">Rule</th><th scope="col">Cells</th></tr></thead><tbody>${m.terrain_types
      .map((t) => `<tr><th scope="row">${esc(t.name)}</th><td>${esc(t.rule)}</td><td class="n">${num(t.cells)}</td></tr>`)
      .join("")}</tbody></table></div>
    <h3>Clusters</h3><p>${esc(m.clustering.summary)}</p><p class="small muted">${esc(m.clustering.method)}. ${m.clustering.k} clusters, from: ${m.clustering.inputs.map(esc).join(", ")}.</p>
    <div class="scroll-x"><table class="data"><thead><tr><th scope="col">Cluster</th><th scope="col">Cells</th><th scope="col">Most common type</th><th scope="col">Share</th></tr></thead><tbody>${m.clustering.agreement
      .map((a) => `<tr><th scope="row">${num(a.cluster)}</th><td class="n">${num(a.cells)}</td><td>${esc(a.top_type)}</td><td class="n">${num(a.share * 100, 0)}%</td></tr>`)
      .join("")}</tbody></table></div>`,
  );
}

function challenge(m: Manifest) {
  return {
    lede: `The Challenge Guide of our local event gives ${num(m.benchmarks.length)} benchmarks and ${num(m.questions.length)} questions. This part shows how we meet each benchmark and answer each question.`,
    body: `<div class="ch-grid">
    ${block2(
      "benchmarks",
      m.benchmarks.length,
      "Benchmarks, and how we meet them",
      "Each benchmark in the words of the guide, with a link to where you can see it on this site.",
      `<p class="small muted">In the words of the guide.</p><ol class="bench">${m.benchmarks
        .map(
          (b) => `<li><span class="b-n">${b.n}</span><div><p class="guide">${esc(b.guide_words)}</p><p>${esc(b.how)}</p><p class="small"><a href="#${WHERE[b.n] ?? "explore"}">${esc(b.where)}</a></p></div></li>`,
        )
        .join("")}</ol>`,
    )}
    ${block2(
      "questions",
      m.questions.length,
      "Questions and answers",
      "Each question from the guide, with our answer.",
      `<ol class="qs">${m.questions.map((q) => `<li><span class="b-n">${q.n}</span><div><p class="guide">${esc(q.question)}</p><p>${esc(q.answer)}</p></div></li>`).join("")}</ol>`,
    )}
    ${terrain(m)}
    </div>`,
  };
}

function data(m: Manifest) {
  const order = ["NASA", "USGS", "computed", "ESA", "partner", "other"];
  const ds = [...m.datasets].sort((a, b) => order.indexOf(a.agency) - order.indexOf(b.agency));
  const archives = [...new Set(ds.map((d) => d.archive).filter((a): a is string => !!a && !/^(computed|published paper)$/i.test(a)))];
  const b1 = m.benchmarks.find((b) => b.n === 1);
  const card = (n: number, summary: string, line: string, body: string) =>
    fold(`<span class="cb-n">${num(n)}</span><span class="cb-tx"><span class="cb-t">${summary}</span>${line ? `<span class="cb-s">${line}</span>` : ""}</span>`, body, "d-block");
  return {
    lede: "Each number on this site comes from a named dataset. NASA data does most of the scoring. A tag shows partner data.",
    body: `<div class="d-grid">
    ${
      b1
        ? `<div class="archives"><p class="guide">${esc(b1.guide_words)}</p><p>This site uses data from ${num(archives.length)} open data archives: ${archives.map(esc).join(", ")}.</p></div>`
        : ""
    }
    ${card(ds.length, "Datasets", "Each dataset with its archive, licence and use.", `<div class="scroll-x"><table class="data ds"><thead><tr><th scope="col">Dataset</th><th scope="col">Agency</th><th scope="col">Archive</th><th scope="col">Licence</th><th scope="col">Used for</th></tr></thead><tbody>${ds
      .map(
        (d) => `<tr><th scope="row">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}</th><td>${esc(d.agency)}${
          d.agency === "partner" ? ' <span class="tag">partner</span>' : ""
        }</td><td>${esc(d.archive ?? "")}</td><td>${esc(d.licence)}</td><td>${esc(d.used_for)}</td></tr>`,
      )
      .join("")}</tbody></table></div>`)}
    ${card(IMAGERY.length, "Images that we show but do not score", "", `<ul class="plain">${IMAGERY.map((i) => `<li><a href="${i.url}" target="_blank" rel="noopener">${esc(i.name)}</a>, ${esc(i.by)}. ${esc(i.licence)}. ${esc(i.use)}</li>`).join("")}</ul>`)}
    ${card(CODE.length, "Code and fonts", "", `<ul class="plain">${CODE.map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener">${esc(c.name)}</a>: ${esc(c.licence)}. ${esc(c.use)}.</li>`).join("")}</ul>`)}
    </div>`,
  };
}

function limits(m: Manifest) {
  return {
    lede: `We did not put these ${num(m.not_in_version.length)} items in this version. Open an item to read the reason.`,
    body: `<ul class="lim-grid">${m.not_in_version
      .map((n) => `<li><details><summary>${esc(n.item)}</summary><p>${esc(n.reason)}</p></details></li>`)
      .join("")}</ul>`,
  };
}

const sec = (id: string, kicker: string, title: string, part: { lede: string; body: string }, h = "h2") =>
  `<section id="${id}" class="page-sec band" aria-labelledby="${id}-h"><header class="sec-head"><p class="sec-k">${esc(kicker)}</p><${h} id="${id}-h"${h === "h1" ? ' tabindex="-1"' : ""}>${esc(title)}</${h}>${
    part.lede ? `<p class="lede">${part.lede}</p>` : ""
  }</header>${part.body}</section>`;

export const checksPage = (m: Manifest, v: Validation | null) => sec("checked", "Checks", "How we checked it", checked(v, m), "h1");

export const aboutParts = (m: Manifest) =>
  [sec("challenge", "Challenge", "The challenge", challenge(m)), sec("data", "Data", "Data", data(m)), sec("limits", "Limits", "Not in this version", limits(m))].join("");

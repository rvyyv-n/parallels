import "./sections.css";
import type { Manifest, Validation, ValidationTest } from "./contract";
import { esc, num } from "./format";

const pct = (v: number | null | undefined) => (v == null ? "not run" : `${num(v * 100, 0)}%`);

export const NAV = [
  ["checked", "Checks"],
  ["challenge", "Challenge"],
  ["data", "Data"],
  ["limits", "Limits"],
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

function verdict(ts: ValidationTest[], summary?: string) {
  const all = judged(ts);
  const passed = passCount(ts);
  const failed = all.filter((c: Check) => c.passed === false);
  return `<div class="verdict${passed === all.length ? " ok" : ""}">
    <p class="v-count-big"><b>${num(passed)} of ${num(all.length)}</b> checks passed</p>
    ${
      failed.length
        ? `<p class="v-failed"><b>Not passed:</b></p><ul class="v-fail-list">${failed
            .map((c) => `<li>${esc(c.name)}: <span class="fail">${pct(c.result)}</span> against a pass mark of ${pct(c.pass_mark)}</li>`)
            .join("")}</ul>`
        : ""
    }
    ${notRun(ts)}
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

type Run = { id: string; title: string; label: string; adopted?: boolean; tests: ValidationTest[]; body: string };

const methodOf = (title: string) => title.match(/method version ([\d.]+)/i)?.[1];

const runLabel = (n: number, title: string) => {
  const v = methodOf(title);
  return `Run ${n} · ${v ? `method ${v}` : title}`;
};

function later(r: Later, id: string, l: string, m: Manifest) {
  const extra = [
    r.method_change ? `<p><b>Method change.</b> ${esc(r.method_change)}</p>` : "",
    r.adoption_rule ? `<p><b>Adoption rule.</b> ${esc(r.adoption_rule)}</p>` : "",
    r.adopted != null ? `<p><b>Adopted.</b> ${r.adopted ? "Yes" : "No"}</p>` : "",
  ].join("");
  return `<div class="second" id="${id}">
      <h3 class="run-h">${esc(r.title)}</h3>
      ${verdict(r.tests, r.summary)}
      <p class="note"><b>Designed after seeing the first run.</b> Its design was chosen knowing the first run's result, so it can't confirm the method the way the first run could. Config fixed at commit ${esc(r.config_commit)}.</p>
      ${fold(extra ? "What this run changed, and the rule for using it" : "What this run did", `<p>${esc(r.plain)}</p>${extra}`)}
      ${block(r.tests, m, l)}
      ${r.unchecked.length ? fold(`Not checked in this run (${num(r.unchecked.length)})`, `<ul class="plain">${r.unchecked.map((u) => `<li><b>${esc(u.place)}:</b> ${esc(u.why)}</li>`).join("")}</ul>`) : ""}
    </div>`;
}

function first(v: Validation, l: string, m: Manifest) {
  return `<div class="run-first" id="first-run">
    <h3 class="run-h">First run</h3>
    ${verdict(v.tests, v.summary)}
    <p class="note"><b>Not a blind first run.</b> ${esc(v.not_blind_note)}${
      v.prototype_runs.length ? ` Earlier prototype runs: ${v.prototype_runs.map((r) => `${esc(r.date)}, ${esc(r.result)}`).join("; ")}.` : ""
    } Weights and pass marks fixed at commit ${esc(v.weights_commit)}.</p>
    ${block(v.tests, m, l)}
  </div>`;
}

function runs(v: Validation, m: Manifest): Run[] {
  const out: Run[] = [];
  const add = (id: string, title: string, tests: ValidationTest[], adopted: boolean | undefined, body: (l: string) => string) => {
    const l = runLabel(out.length + 1, title);
    out.push({ id, title, label: l, adopted, tests, body: body(l) });
  };
  add("first-run", "First run", v.tests, undefined, (l) => first(v, l, m));
  const s = v.second_run;
  if (s) add("second-run", s.title, s.tests, undefined, (l) => later(s, "second-run", l, m));
  const t = v.third_run;
  if (t) add("third-run", t.title, t.tests, t.adopted, (l) => later(t, "third-run", l, m));
  for (const r of v.more_runs ?? []) {
    const id = `run-${out.length + 1}`;
    add(id, r.title, r.tests, r.adopted, (l) => later(r, id, l, m));
  }
  return out;
}

function runHistory(all: Run[], now: Run) {
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
  const dataOk = v.data_checks.filter((c) => c.passed).length;
  const dataBad = v.data_checks.filter((c) => !c.passed);
  return `<p class="lede">Places NASA already trusts should score higher than ordinary farmland and plain deserts. We set the pass marks before any data came in.</p>
    <div class="current-box">
      <p class="cur-h">${ver ? `Current method: version ${esc(ver)} (the map uses this)` : `Current method: ${esc(now.title)} (the map uses this)`}</p>
      ${runHistory(all, now)}
    </div>
    ${now.body}
    ${earlier.length ? `<details class="earlier"><summary>Earlier runs (${num(earlier.length)})</summary>${earlier.map((r) => r.body).join("")}</details>` : ""}
    ${v.stability ? fold("How stable the top places are", `<p>${esc(v.stability)}</p>`) : ""}
    ${dataBad.length ? `<p class="v-failed"><b>Data checks not passed:</b> ${dataBad.map((c) => esc(c.name)).join("; ")}</p>` : ""}
    ${fold(
      `Data checks (${num(dataOk)} of ${num(v.data_checks.length)} passed)`,
      `<div class="scroll-x"><table class="data"><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Outcome</th></tr></thead><tbody>${v.data_checks
        .map((c) => `<tr><th scope="row">${esc(c.name)}</th><td class="n">${esc(c.result)}</td>${outcome(c.passed)}</tr>`)
        .join("")}</tbody></table></div>`,
    )}`;
}

const block2 = (id: string, title: string, body: string) => `<details class="ch-block" id="${id}"><summary><span class="cb-t">${title}</span></summary><div class="cb-body">${body}</div></details>`;

function terrain(m: Manifest) {
  return block2(
    "terrain",
    `Terrain types and clusters (${num(m.terrain_types.length)} types)`,
    `<p>Every land cell gets one terrain tag, by rules worked out from the data. Filter the map by type above.</p>
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
  return `<p class="lede">Our local event's Challenge Guide sets ${num(m.benchmarks.length)} benchmarks and asks ${num(m.questions.length)} questions. Here is how we meet and answer each.</p>
    ${block2(
      "benchmarks",
      `The ${num(m.benchmarks.length)} benchmarks, and how we meet each`,
      `<p class="small muted">In the guide's own words.</p><ol class="bench">${m.benchmarks
        .map(
          (b) => `<li><span class="b-n">${b.n}</span><div><p class="guide">${esc(b.guide_words)}</p><p>${esc(b.how)}</p><p class="small"><a href="#${WHERE[b.n] ?? "explore"}">${esc(b.where)}</a></p></div></li>`,
        )
        .join("")}</ol>`,
    )}
    ${block2(
      "questions",
      `The ${num(m.questions.length)} questions, answered`,
      `<ol class="qs">${m.questions.map((q) => `<li><span class="b-n">${q.n}</span><div><p class="guide">${esc(q.question)}</p><p>${esc(q.answer)}</p></div></li>`).join("")}</ol>`,
    )}
    ${terrain(m)}`;
}

function data(m: Manifest) {
  const order = ["NASA", "USGS", "computed", "ESA", "partner", "other"];
  const ds = [...m.datasets].sort((a, b) => order.indexOf(a.agency) - order.indexOf(b.agency));
  const archives = [...new Set(ds.map((d) => d.archive).filter((a): a is string => !!a && !/^(computed|published paper)$/i.test(a)))];
  const b1 = m.benchmarks.find((b) => b.n === 1);
  return `<p class="lede">Every number on this site traces to a named dataset. NASA data does the main scoring work; partner data is marked.</p>
    ${
      b1
        ? `<div class="archives"><p class="guide">${esc(b1.guide_words)}</p><p>${num(archives.length)} open data archives feed this site: ${archives.map(esc).join(", ")}.</p></div>`
        : ""
    }
    ${fold(`All ${num(ds.length)} datasets, with archive, licence and use`, `<div class="scroll-x"><table class="data ds"><thead><tr><th scope="col">Dataset</th><th scope="col">Agency</th><th scope="col">Archive</th><th scope="col">Licence</th><th scope="col">Used for</th></tr></thead><tbody>${ds
      .map(
        (d) => `<tr><th scope="row">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}</th><td>${esc(d.agency)}${
          d.agency === "partner" ? ' <span class="tag">partner</span>' : ""
        }</td><td>${esc(d.archive ?? "")}</td><td>${esc(d.licence)}</td><td>${esc(d.used_for)}</td></tr>`,
      )
      .join("")}</tbody></table></div>`)}
    ${fold(`Imagery shown, not scored (${num(IMAGERY.length)})`, `<ul class="plain">${IMAGERY.map((i) => `<li><a href="${i.url}" target="_blank" rel="noopener">${esc(i.name)}</a>, ${esc(i.by)}. ${esc(i.licence)}. ${esc(i.use)}</li>`).join("")}</ul>`)}
    ${fold(`Code and fonts (${num(CODE.length)})`, `<ul class="plain">${CODE.map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener">${esc(c.name)}</a>: ${esc(c.licence)}. ${esc(c.use)}.</li>`).join("")}</ul>`)}`;
}

export function sections(m: Manifest, v: Validation | null) {
  const sec = (id: string, title: string, body: string) => `<section id="${id}" class="page-sec" aria-labelledby="${id}-h"><h2 id="${id}-h">${esc(title)}</h2>${body}</section>`;
  return [
    sec("checked", "How we checked it", checked(v, m)),
    sec("challenge", "The challenge", challenge(m)),
    sec("data", "Data", data(m)),
    sec(
      "limits",
      "Not in this version",
      `<p class="lede">Left out for now: ${m.not_in_version.map((n) => esc(n.item)).join(", ")}.</p>${fold(
        `Why each is left out (${num(m.not_in_version.length)})`,
        `<ul class="plain limits">${m.not_in_version.map((n) => `<li><b>${esc(n.item)}.</b> ${esc(n.reason)}</li>`).join("")}</ul>`,
      )}`,
    ),
  ].join("");
}

function reveal(id: string, smooth: boolean) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (el instanceof HTMLDetailsElement) el.open = true;
  for (let p = el.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
  el.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto", block: "start" });
  return true;
}

let wired = false;
let watch: IntersectionObserver | null = null;

export function wire(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".top nav a")];
  const ids = links.map((a) => a.hash.slice(1));
  const mark = (id: string | null) =>
    links.forEach((a) => (a.hash.slice(1) === id ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
  const seen = new Map<string, boolean>();
  watch?.disconnect();
  watch = new IntersectionObserver(
    (es) => {
      for (const e of es) seen.set(e.target.id, e.isIntersecting);
      mark(ids.find((id) => seen.get(id)) ?? null);
    },
    { rootMargin: "-30% 0px -60% 0px" },
  );
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) watch.observe(el);
  }
  if (location.hash) reveal(decodeURIComponent(location.hash.slice(1)), false);
  if (wired) return;
  wired = true;
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute("href")!.slice(1));
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    reveal(id, true);
  });
  addEventListener("hashchange", () => location.hash && reveal(decodeURIComponent(location.hash.slice(1)), true));
}

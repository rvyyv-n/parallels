import "./about.css";
import type { Manifest, Validation, ValidationTest } from "../contract";
import { BASE } from "../data";
import { esc, num } from "../format";
import { icon } from "../icons";
import type { Page } from "../router";
import { CODE, IMAGERY } from "../sections";
import { PHOTOS } from "./learn-data";
import type { Ctx } from "./ctx";

const pc = (v: number) => `${num(Math.floor(v * 100 + 1e-9))}%`;

const TOC_IDS = ["scoring", "checked", "challenge", "data", "limits", "credits"] as const;

const head = (id: string, k: string, title: string, lede = "") =>
  `<header class="ab-head"><p class="sec-k">${esc(k)}</p><h2 id="${id}-h">${esc(title)}</h2>${lede ? `<p class="ab-lede">${lede}</p>` : ""}</header>`;

const sec = (id: string, k: string, title: string, body: string, lede = "") =>
  `<section id="${id}" class="ab-sec" aria-labelledby="${id}-h">${head(id, k, title, lede)}${body}</section>`;

function intro(m: Manifest) {
  return `<section class="ab-sec ab-top" aria-labelledby="about-h">
    <p class="sec-k">About</p>
    <h1 id="about-h" tabindex="-1">About Parallels</h1>
    <p class="ab-big">Parallels finds the places on Earth that come closest to a planned base site on the Moon or Mars.</p>
    <p class="ab-lede">We measure the same traits at the base site and on all ${num(m.grid.n)} patches of land on Earth, then rank every patch. Each match says what is similar, how similar, and where the likeness breaks.</p>
    <nav class="ab-toc" aria-label="On this page">${[
      ["scoring", "How scoring works"],
      ["checked", "How we checked it"],
      ["challenge", "The challenge"],
      ["data", "Data"],
      ["limits", "Limits"],
      ["credits", "Team"],
    ]
      .map(([id, t]) => `<a href="#${id}" data-toc="${id}">${t}</a>`)
      .join("")}</nav>
  </section>`;
}

function scoring(m: Manifest) {
  const chs = m.challenges;
  const names = chs.moon.slice(0, 3).map((c) => c.name);
  const steps = [
    ["Measure", `The same ${num(m.traits.length)} traits at the base site and on each land patch, about 50 km wide.`],
    ["Rank", "Each trait, against all of Earth's land. A patch ranks high when most land is further from the base site."],
    ["Group", `Traits make challenges: ${num(chs.moon.length)} for the Moon, ${num(chs.mars.length)} for Mars, such as ${esc(names.join(", "))}.`],
    [
      "Weigh",
      `A preset weights each challenge. We combine them with a weighted geometric mean: an average where one very poor challenge pulls the total down.`,
    ],
    ["Score", "A match score out of 100. It is a rank against all land, not a percentage of similarity."],
  ];
  return sec(
    "scoring",
    "Method",
    "How scoring works",
    `<ol class="ab-steps">${steps.map(([t, x], i) => `<li><span class="ab-n">${String(i + 1).padStart(2, "0")}</span><b>${t}</b><p>${x}</p></li>`).join("")}</ol>
    <details class="ab-fold"><summary>The exact rule</summary><p>${esc(m.scoring.rule)}</p><p>${esc(m.scoring.yearround_rule)}</p></details>`,
  );
}

type Run = { title: string; tests: ValidationTest[]; adopted?: boolean; preset?: string; method_change?: string };

const judged = (r: Run) => r.tests.flatMap((t) => t.checks).filter((c) => c.passed != null);
const tally = (r: Run) => `${num(judged(r).filter((c) => c.passed).length)} of ${num(judged(r).length)}`;

function pooled(r: Run, body: string) {
  const t = r.tests.find((x) => x.title.toLowerCase().startsWith(body) && x.title.toLowerCase().includes("challenge by challenge"));
  const c = t?.checks.find((x) => /^all challenges pooled/i.test(x.name));
  return c && c.result != null ? c : null;
}

function runLabel(r: Run, i: number) {
  if (r.preset) return `${r.preset[0].toUpperCase()}${r.preset.slice(1)} preset`;
  const ver = r.title.match(/method version ([\d.]+)/i)?.[1];
  return ver ? `Run ${i + 1} · v${ver}` : `Run ${i + 1}`;
}

function placeLabel(t: ValidationTest, slug: string) {
  return t.places?.find((p) => p.id === slug)?.name ?? slug.replace(/-/g, " ");
}

function valDetails(v: Validation, runs: Run[], now: Run) {
  const prog = `<div class="ab-prog" aria-label="Method progression">${runs
    .map((r, i) => {
      const mPool = pooled(r, "moon");
      const rPool = pooled(r, "mars");
      const status =
        r === now
          ? `<span class="ab-badge is-pass">Adopted</span>`
          : r.preset
            ? `<span class="ab-badge is-info">Preset</span>`
            : i === 0
              ? `<span class="ab-badge">Baseline</span>`
              : `<span class="ab-badge">Prior</span>`;
      const held =
        mPool?.held_out_only != null && rPool?.held_out_only != null
          ? `<span class="ab-prog-ho">Held-out: Moon ${pc(mPool.held_out_only)} · Mars ${pc(rPool.held_out_only)}</span>`
          : `<span class="ab-prog-ho">Whole-site checks only</span>`;
      return `<div class="ab-prog-card${r === now ? " is-now" : ""}">
        <div class="ab-prog-top"><b>${esc(runLabel(r, i))}</b>${status}</div>
        <p class="ab-prog-tally"><strong>${tally(r)}</strong> checks pass</p>
        ${held}
      </div>`;
    })
    .join("")}</div>`;

  const checksTable = `<div class="ab-vscroll"><table class="ab-vtable">
    <thead><tr><th scope="col">Check</th><th scope="col" class="n">Result</th><th scope="col" class="n">Held-out</th><th scope="col" class="n">Pass mark</th><th scope="col">Status</th></tr></thead>
    ${now.tests
      .map(
        (t) =>
          `<tbody><tr class="ab-vtg"><th scope="rowgroup" colspan="5">${esc(t.title)}</th></tr>${t.checks
            .map((c) => {
              const badge =
                c.passed === true
                  ? `<span class="ab-badge is-pass">Pass</span>`
                  : c.passed === false
                    ? `<span class="ab-badge is-fail">Miss</span>`
                    : `<span class="ab-badge">Too few</span>`;
              return `<tr>
                <th scope="row">${esc(c.name)}</th>
                <td class="n" data-col="Result">${c.result != null ? pc(c.result) : "—"}</td>
                <td class="n" data-col="Held-out">${c.held_out_only != null ? pc(c.held_out_only) : "—"}</td>
                <td class="n" data-col="Pass mark">${pc(c.pass_mark)}</td>
                <td data-col="Status">${badge}</td>
              </tr>`;
            })
            .join("")}</tbody>`,
      )
      .join("")}
  </table></div>`;

  const seenMiss = new Set<string>();
  const misses: { group: string; name: string; why: string }[] = [];
  for (const t of now.tests) {
    for (const ms of t.misses ?? []) {
      const key = `${ms.place}|${ms.why}`;
      if (seenMiss.has(key)) continue;
      seenMiss.add(key);
      misses.push({ group: t.title, name: placeLabel(t, ms.place), why: ms.why });
    }
  }
  const missHtml = misses.length
    ? `<h4 class="ab-vh">Honest misses in this run (${num(misses.length)})</h4>
      <ul class="ab-misses">${misses
        .map((x) => `<li><b>${esc(x.name)}</b> <span class="ab-miss-g">${esc(x.group)}</span><p>${esc(x.why)}</p></li>`)
        .join("")}</ul>`
    : "";

  const notes: string[] = [];
  if (v.stability) notes.push(`<div class="ab-vnote"><h4>Weight stability (1,000 runs)</h4><p>${esc(v.stability)}</p></div>`);
  if (v.not_blind_note) notes.push(`<div class="ab-vnote"><h4>Split and independence note</h4><p>${esc(v.not_blind_note)}</p></div>`);
  if (v.data_checks?.length) {
    notes.push(
      `<div class="ab-vnote"><h4>Data sanity checks</h4><ul class="ab-dchecks">${v.data_checks
        .map((d) => `<li><span class="ab-badge ${d.passed ? "is-pass" : "is-fail"}">${d.passed ? "Pass" : "Miss"}</span><span>${esc(d.name)}: <b>${esc(d.result)}</b></span></li>`)
        .join("")}</ul></div>`,
    );
  }

  return `<details class="ab-fold ab-val-runs" id="val-runs">
    <summary>Explore all validation runs, misses and weight stability</summary>
    <div class="ab-val-body">
      <h4 class="ab-vh">Method progression</h4>
      ${prog}
      <h4 class="ab-vh">Per-challenge checks (${esc(now.title)})</h4>
      ${checksTable}
      ${missHtml}
      ${notes.length ? `<div class="ab-vnotes">${notes.join("")}</div>` : ""}
    </div>
  </details>`;
}

function checked(v: Validation | null) {
  if (!v) return sec("checked", "Validation", "How we checked it", `<p>The validation file did not load, so no results show here.</p>`);
  const later: Run[] = [v.second_run, v.third_run, ...(v.more_runs ?? [])].filter((r): r is NonNullable<typeof r> => !!r);
  const runs: Run[] = [{ title: "First run", tests: v.tests }, ...later];
  const now = [...runs].reverse().find((r) => r.adopted && !r.preset) ?? runs[0];
  const bal = [...runs].reverse().find((r) => r.preset === "balanced");
  const ver = now.title.match(/method version ([\d.]+)/i)?.[1];
  const bodies = (
    [
      ["moon", "The Moon"],
      ["mars", "Mars"],
    ] as const
  )
    .map(([b, name]) => ({ b, name, c: pooled(now, b) }))
    .filter((x) => x.c);
  const mark = bodies[0]?.c?.pass_mark ?? 0.8;
  const bar = (b: string, label: string, v: number | null | undefined, cls: string) =>
    v == null
      ? ""
      : `<div class="ab-bar ${cls}" title="${esc(label)}: ${pc(v)}"><span class="ab-bl">${esc(label)}</span><span class="ab-track"><i class="ab-fill" data-body="${b}" style="width:${(v * 100).toFixed(1)}%"></i></span><b class="ab-bv">${pc(v)}</b></div>`;
  const chart = bodies.length
    ? `<figure class="ab-chart" aria-labelledby="chk-cap">
      <figcaption id="chk-cap">How often known analogs beat ordinary places, pair by pair</figcaption>
      <div class="ab-plot" style="--mark:${(mark * 100).toFixed(1)}%">
        <span class="ab-ref ab-chance" aria-hidden="true"><span>50%: a coin flip</span></span>
        <span class="ab-ref ab-mark" aria-hidden="true"><span>Pass mark ${pc(mark)}</span></span>
        ${bodies
          .map(
            ({ b, name, c }) =>
              `<div class="ab-grp"><p class="ab-gn"><i class="ab-sw" data-body="${b}"></i>${name}</p>${bar(b, "Held-out half", c!.held_out_only, "held")}${bar(b, "All test places", c!.result, "all")}</div>`,
          )
          .join("")}
      </div>
    </figure>`
    : "";
  const tiles = bodies
    .filter(({ c }) => c!.held_out_only != null)
    .map(
      ({ b, name, c }) =>
        `<div class="ab-tile" data-body="${b}"><b>${pc(c!.held_out_only!)}</b><p><strong>${name}.</strong> Known analogs beat ordinary places in this share of comparisons, on the held-out half.</p></div>`,
    )
    .join("");
  return sec(
    "checked",
    "Validation",
    "How we checked it",
    `<div class="ab-chk">
      <div class="ab-tiles">${tiles}</div>
      ${chart}
    </div>
    <p class="ab-total">In the current run${ver ? ` (method ${esc(ver)})` : ""}, <b>${tally(now)}</b> checks pass${bal ? `; the Balanced preset passes <b>${tally(bal)}</b>` : ""}. Only the Moon's south pole and Jezero are checked against test places. <a href="${BASE}validation.json">Every check, as data</a></p>
    ${valDetails(v, runs, now)}`,
    "Places where crews already train for the Moon and Mars should beat ordinary places. We set the pass marks before the results came in. The held-out half is the test places we set aside in a fixed split.",
  );
}

const WHERE: Record<number, string> = { 1: "#data", 2: "#/find", 3: "#/find", 4: "#checked", 5: "#/find", 6: "#/find" };

function challenge(m: Manifest) {
  const row = (id: string, n: number, sum: string, body: string) =>
    `<details class="ab-row"${id ? ` id="${id}"` : ""}><summary><span class="ab-rn">${n}</span><span>${sum}</span>${icon("chevron")}</summary><div class="ab-rb">${body}</div></details>`;
  const types = m.terrain_types.filter((t) => t.key !== "none");
  const bench = m.benchmarks
    .map((b) =>
      row(
        b.n === 2 ? "terrain" : "",
        b.n,
        esc(b.guide_words),
        `<p>${esc(b.how)}</p>${
          b.n === 2 ? `<ul class="ab-types">${types.map((t) => `<li>${esc(t.name)} <span>${num(t.cells)} cells</span></li>`).join("")}</ul>` : ""
        }${b.n === 4 ? `<p class="ab-muted">${esc(m.clustering.summary)}</p>` : ""}<p><a href="${WHERE[b.n] ?? "#/find"}">${esc(b.where)}</a></p>`,
      ),
    )
    .join("");
  const qs = m.questions.map((q) => row("", q.n, esc(q.question), `<p>${esc(q.answer)}</p>`)).join("");
  return sec(
    "challenge",
    "Challenge",
    "The challenge",
    `<div class="ab-two">
      <div id="benchmarks"><h3>${num(m.benchmarks.length)} benchmarks</h3>${bench}</div>
      <div id="questions"><h3>${num(m.questions.length)} questions</h3>${qs}</div>
    </div>`,
    "Our local event's Challenge Guide sets these. Open a row to see how we meet it.",
  );
}

const AGENCY: Record<string, string> = { NASA: "NASA", USGS: "USGS", ESA: "ESA (partner)", partner: "Partner", other: "Other open sources", computed: "Worked out from the data" };
const AGENCY_PILL: Record<string, string> = { NASA: "NASA", USGS: "USGS", ESA: "ESA", partner: "Partner", other: "Other", computed: "Calculated" };

const photoUrl = (id: string) => (/^PIA\d+$/.test(id) ? `https://photojournal.jpl.nasa.gov/catalog/${id}` : `https://images.nasa.gov/details/${encodeURIComponent(id)}`);

function data(m: Manifest) {
  const order = ["NASA", "USGS", "ESA", "partner", "other", "computed"];
  const groups = order.map((a) => [a, m.datasets.filter((d) => d.agency === a)] as const).filter(([, ds]) => ds.length);
  const archives = new Set(m.datasets.map((d) => d.archive).filter((a): a is string => !!a && !/^(computed|published paper)$/i.test(a)));
  const pills = `<div class="ab-agency-pills" role="group" aria-label="Filter datasets by agency">
    <button type="button" class="ab-apill" data-agency="all" aria-pressed="true">All (${num(m.datasets.length)})</button>${groups
      .map(
        ([a, ds]) =>
          `<button type="button" class="ab-apill" data-agency="${esc(a)}" aria-pressed="false" title="${esc(`${AGENCY[a] ?? a} (${ds.length})`)}" data-count="${ds.length}">${esc(
            AGENCY_PILL[a] ?? a,
          )}</button>`,
      )
      .join("")}
  </div>`;
  const table = `<div class="ab-scroll"><table class="ab-table">
    <thead><tr><th scope="col">Dataset and what we use it for</th><th scope="col">Licence</th></tr></thead>
    ${groups
      .map(
        ([a, ds]) =>
          `<tbody data-agency="${esc(a)}"><tr class="ab-tg"><th scope="rowgroup" colspan="2">${esc(AGENCY[a] ?? a)} <span>${num(ds.length)}</span></th></tr>${ds
            .map(
              (d) =>
                `<tr><th scope="row">${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>` : esc(d.name)}<span>${esc(d.used_for)}</span></th><td>${esc(d.licence)}</td></tr>`,
            )
            .join("")}</tbody>`,
      )
      .join("")}
  </table></div>`;
  const photos = PHOTOS.flatMap((p) => p.photos);
  const images = `<ul class="ab-imgs">${IMAGERY.map(
    (i) => `<li><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.name)}</a><span>${esc(i.by)} · ${esc(i.licence)}</span></li>`,
  ).join("")}</ul>
  <ul class="ab-photos">${photos
    .map(
      (p) =>
        `<li><img src="${import.meta.env.BASE_URL}img/learn/${esc(p.file)}" alt="" loading="lazy" decoding="async" width="160" height="110"><a href="${esc(photoUrl(p.id))}" target="_blank" rel="noopener">${esc(p.title)}</a><span>${esc(p.credit)} · ${esc(p.id)}</span></li>`,
    )
    .join("")}</ul>`;
  const code = `<ul class="ab-code">${CODE.map((c) => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.name)}</a><span>${esc(c.licence)}</span></li>`).join("")}</ul>`;
  return sec(
    "data",
    "Data",
    "Data",
    `<div class="ab-data-bar"><h3 id="ab-ds-h">${num(m.datasets.length)} datasets</h3>${pills}</div>${table}
    <h3>Images we show but do not score</h3><p class="ab-muted">The map and planet images, and the ${num(photos.length)} photos on the Learn page. Open imagery from NASA, NASA/USGS, and ESA Copernicus (via EOX), free to use with attribution.</p>${images}
    <h3>Code and fonts</h3>${code}`,
    `Every number on this site comes from one of these, from ${num(archives.size)} open archives. NASA data does most of the scoring.`,
  );
}

function limits(m: Manifest) {
  return sec(
    "limits",
    "Limits",
    "Not in this version",
    `<div class="ab-lims">${m.not_in_version.map((n) => `<details class="ab-row"><summary><span>${esc(n.item)}</span>${icon("chevron")}</summary><div class="ab-rb"><p>${esc(n.reason)}</p></div></details>`).join("")}</div>`,
    "Open an item for the reason.",
  );
}

const credits = sec(
  "credits",
  "Credits",
  "Team and credits",
  `<p class="ab-team"><b>TEAM RMD</b> made the core idea and the key design decisions.</p><p class="ab-muted">How we used AI: see <a href="#ai-note">the note at the foot of each page</a>. Data, image and code credits are in <a href="#data">Data</a>.</p>`,
);

export function about(ctx: Ctx): Page {
  const { m } = ctx;
  let el: HTMLElement;
  let done = false;
  let spy: IntersectionObserver | null = null;
  const visible = new Set<string>();

  const setActiveToc = (id: string) => {
    for (const a of el.querySelectorAll<HTMLAnchorElement>(".ab-toc a[data-toc]")) {
      const on = a.dataset.toc === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
  };

  const stopSpy = () => {
    spy?.disconnect();
    spy = null;
    visible.clear();
  };

  const startSpy = () => {
    stopSpy();
    if (typeof IntersectionObserver === "undefined") return;
    spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const hit = TOC_IDS.find((id) => visible.has(id));
        if (hit) setActiveToc(hit);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.1] },
    );
    for (const id of TOC_IDS) {
      const s = el.querySelector<HTMLElement>(`#${id}`);
      if (s) spy.observe(s);
    }
  };

  return {
    title: () => "About",
    mount(root) {
      el = root;
      el.innerHTML = `<div class="ab">${intro(m)}${scoring(m)}${sec("checked", "Validation", "How we checked it", `<p class="ab-muted">Loading…</p>`)}${challenge(m)}${data(m)}${limits(m)}${credits}</div>`;
      el.addEventListener("click", (ev) => {
        const tocLink = (ev.target as Element).closest<HTMLAnchorElement>(".ab-toc a[data-toc]");
        if (tocLink?.dataset.toc) setActiveToc(tocLink.dataset.toc);

        const pill = (ev.target as Element).closest<HTMLButtonElement>(".ab-agency-pills [data-agency]");
        if (!pill) return;
        const agency = pill.dataset.agency ?? "all";
        for (const b of el.querySelectorAll<HTMLButtonElement>(".ab-agency-pills [data-agency]")) {
          b.setAttribute("aria-pressed", String(b === pill));
        }
        let shown = 0;
        for (const tb of el.querySelectorAll<HTMLElement>(".ab-table tbody[data-agency]")) {
          const match = agency === "all" || tb.dataset.agency === agency;
          tb.hidden = !match;
          if (match) shown += tb.querySelectorAll("tr:not(.ab-tg)").length;
        }
        const h = el.querySelector<HTMLElement>("#ab-ds-h");
        if (h) h.textContent = agency === "all" ? `${num(m.datasets.length)} datasets` : `${num(shown)} of ${num(m.datasets.length)} datasets`;
      });
    },
    async show() {
      startSpy();
      if (done) return;
      const v = await ctx.validation();
      done = true;
      el.querySelector("#checked")!.outerHTML = checked(v);
      startSpy();
    },
    hide() {
      stopSpy();
    },
  };
}

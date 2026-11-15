import type { Manifest } from "../contract";
import { esc, num } from "../format";
import type { Page } from "../router";
import { aboutParts } from "../sections";
import type { Ctx } from "./ctx";

const list = (xs: string[]) => esc(xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

function scoring(m: Manifest) {
  const chs = (["moon", "mars"] as const).map((b) => `${m.challenges[b].length} for ${b === "moon" ? "the Moon" : "Mars"}`).join(" and ");
  return `<section id="scoring" class="page-sec band" aria-labelledby="scoring-h">
    <header class="sec-head"><p class="sec-k">Method</p><h2 id="scoring-h">How scoring works</h2>
      <p class="lede">We compare each patch of land on Earth with one base site on the Moon or Mars, one trait at a time. We do not guess values. Each trait comes from a named dataset.</p></header>
    <ol class="steps">
      <li><b>Divide the land into patches.</b> There are ${num(m.grid.n)} patches. Each patch is approximately 50 km wide.</li>
      <li><b>Measure the same traits.</b> We measure ${num(m.traits.length)} traits at the base site and on each patch, for example ${list(m.traits.slice(0, 3).map((t) => t.label.toLowerCase()))}.</li>
      <li><b>Rank each trait against all land.</b> A patch gets a higher rank on a trait when more land on Earth is farther from the base site value than this patch.</li>
      <li><b>Put the traits into challenges.</b> There are ${esc(chs)}. Each challenge is one part of the work to build a base, for example ${list(m.challenges.moon.slice(0, 3).map((c) => c.name))}.</li>
      <li><b>Give a weight to each challenge.</b> Each preset (${m.filters.map((f) => esc(f.name)).join(", ")}) gives different weights. The result is a match score from 0 to 100. The score is a rank, not a percentage of similarity.</li>
    </ol>
    <details class="fold-rule"><summary>The full rule</summary><p>${esc(m.scoring.rule)}</p><p>${esc(m.scoring.yearround_rule)}</p>${m.method_note ? `<p>${esc(m.method_note)}</p>` : ""}</details>
  </section>`;
}

const credits = `<section id="credits" class="page-sec band" aria-labelledby="credits-h">
  <header class="sec-head"><p class="sec-k">Credits</p><h2 id="credits-h">Team and credits</h2></header>
  <p><b>TEAM RMD.</b> Our team made the core idea and the key design decisions. The note <a href="#ai-note">How we used AI</a> is at the bottom of each page.</p>
  <p>The <a href="#data">Data</a> part lists each dataset, image and code library that we used, with its source and licence.</p>
</section>`;

export function about(ctx: Ctx): Page {
  const { m } = ctx;
  return {
    title: () => "About",
    mount(el) {
      el.innerHTML = `<section class="page-sec band" aria-labelledby="about-h"><header class="sec-head"><p class="sec-k">About</p><h1 id="about-h" tabindex="-1">About Parallels</h1>
        <p class="lede">This page tells how the score works, which challenge we answer and which datasets we use. It also lists what is not in this version.</p></header></section>
        ${scoring(m)}${aboutParts(m)}${credits}`;
    },
    show() {},
  };
}

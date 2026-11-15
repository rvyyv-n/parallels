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
      <p class="lede">Every patch of Earth's land is compared with one base site on the Moon or Mars, trait by trait. Nothing is guessed: each trait comes from a named dataset.</p></header>
    <ol class="steps">
      <li><b>Cut the land into patches.</b> ${num(m.grid.n)} patches, each about 50 km across.</li>
      <li><b>Measure the same traits.</b> ${num(m.traits.length)} traits, such as ${list(m.traits.slice(0, 3).map((t) => t.label.toLowerCase()))}, measured at the base site and on every patch.</li>
      <li><b>Rank each trait against all land.</b> A patch scores higher on a trait when more of Earth's land is further from the base site's value than it is.</li>
      <li><b>Group traits into challenges.</b> ${esc(chs)}: the parts of building a base, such as ${list(m.challenges.moon.slice(0, 3).map((c) => c.name))}.</li>
      <li><b>Weigh the challenges for a test.</b> Each mission filter (${m.filters.map((f) => esc(f.name)).join(", ")}) weighs them differently. The result is a match score from 0 to 100: a rank, not a percentage of likeness.</li>
    </ol>
    <details class="fold-rule"><summary>The exact rule</summary><p>${esc(m.scoring.rule)}</p><p>${esc(m.scoring.yearround_rule)}</p>${m.method_note ? `<p>${esc(m.method_note)}</p>` : ""}</details>
    <p><a href="#/checks">How we checked the method</a></p>
  </section>`;
}

const credits = `<section id="credits" class="page-sec band" aria-labelledby="credits-h">
  <header class="sec-head"><p class="sec-k">Credits</p><h2 id="credits-h">Team and credits</h2></header>
  <p><b>TEAM RMD.</b> The core idea and the key design decisions are the team's. <a href="#ai-note">How we used AI</a> is noted at the foot of every page.</p>
  <p>Every dataset, image and code library we used is listed under <a href="#data">Data</a>, with its source and licence.</p>
</section>`;

export function about(ctx: Ctx): Page {
  const { m } = ctx;
  return {
    title: () => "About",
    mount(el) {
      el.innerHTML = `<section class="page-sec band" aria-labelledby="about-h"><header class="sec-head"><p class="sec-k">About</p><h1 id="about-h" tabindex="-1">About Parallels</h1>
        <p class="lede">How the scoring works, the challenge we answer, every dataset we use, and what is not in this version.</p></header></section>
        ${scoring(m)}${aboutParts(m)}${credits}`;
    },
    show() {},
  };
}

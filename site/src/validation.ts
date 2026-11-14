import type { App, Body } from "./types";
import { esc, num, pct } from "./format";

const W = 640;
const ROW = 60;
const LEFT = 8;
const RIGHT = 16;

function jitter(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 12;
}

function chart(data: App, body: Body): string {
  const v = data.validation[body];
  const names = new Map(data.sites.map((s) => [s.id, s.name]));
  const x = (r: number) => LEFT + r * (W - LEFT - RIGHT);
  const h = v.groups.length * ROW + 40;
  const ticks = [0, 25, 50, 75, 100]
    .map((t) => `<line x1="${x(t / 100)}" x2="${x(t / 100)}" y1="0" y2="${h - 26}" class="grid" /><text x="${x(t / 100)}" y="${h - 10}" class="tick">${t}</text>`)
    .join("");
  const rows = v.groups
    .map((g, i) => {
      const y = i * ROW + 38;
      const ranks = g.points.map((p) => p.rank).sort((a, b) => a - b);
      const med = ranks[Math.floor(ranks.length / 2)];
      const dots = g.points
        .map((p) => `<circle cx="${x(p.rank)}" cy="${y + jitter(p.site)}" r="5" class="d g${i}"><title>${esc(names.get(p.site) ?? p.site)}: ${pct(p.rank)}</title></circle>`)
        .join("");
      return `<text x="${LEFT}" y="${y - 20}" class="glabel">${esc(g.label)} <tspan class="gcount">(${g.points.length})</tspan></text>
        ${dots}<line x1="${x(med)}" x2="${x(med)}" y1="${y - 12}" y2="${y + 12}" class="med" />`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${h}" class="vchart" role="img" aria-label="${body === "moon" ? "Moon" : "Mars"} check: Earth rank of each test place by group">${ticks}${rows}</svg>`;
}

export function renderValidation(el: HTMLElement, data: App) {
  const panel = (body: Body) => {
    const v = data.validation[body];
    const checks = v.checks
      .map(
        (c) => `<tr><th>${esc(c.label)}</th><td class="num">${num(c.value * 100, 1)}% of pairs</td><td class="num">pass mark ${pct(c.pass_mark)}%</td><td class="${c.passed ? "pass" : "fail"}">${c.passed ? "passed" : "not passed"}</td></tr>`,
      )
      .join("");
    return `<div class="vpanel">
      <h3>${body === "moon" ? "Moon: south-pole regions" : "Mars: five sites"}</h3>
      ${chart(data, body)}
      <p class="axis-note">Each dot is one test place. Position: share of Earth's land that scores lower (0–100). Bar: group median.</p>
      <table class="checks"><tbody>${checks}</tbody></table>
      <p class="vnote">${esc(v.note)}</p>
      <p class="tr-src">${esc(v.firstRun)}</p>
      <p class="tr-src">Each place's score averages these challenges, each counted once, using only their real-data traits: ${v.challenges.map((id) => esc(data.challenges[body].find((c) => c.id === id)!.name.toLowerCase())).join(", ")}. Traits: ${v.traits.map((t) => esc(data.traits[t].label.toLowerCase())).join(", ")}. The held-out half of the known analogs is a fixed random split, set before the second run.</p>
    </div>`;
  };
  el.innerHTML = `
    <div class="v-intro">
      <h2>How we checked it</h2>
      <p>A method is only useful if it finds the places NASA already trusts. We scored three groups of places the same way: known analogs, ordinary farmland and forest, and, for Mars, plain deserts that catch a method that just rewards "dry and bare". Each place counts with its best-matching target. The pass marks were set in our plan before any data came in.</p>
      <p class="flagline"><strong>Real data only.</strong> This check leaves out every sample value, so no placeholder can help a place pass. ${data.referenceSize} random points on Earth's land set the 0–100 scale.</p>
    </div>
    <div class="vgrid">${panel("moon")}${panel("mars")}</div>`;
}

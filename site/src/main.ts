import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
import { createMap, type SiteMap } from "./map";
import { renderMatch } from "./match";
import { renderSources } from "./sources";
import type { App, Body, Challenge } from "./types";
import { esc, groupLabel, pct } from "./format";
import { renderValidation } from "./validation";

interface State {
  body: Body;
  target: string;
  challenge: string;
  site: string;
}

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="top">
    <div class="brand">
      <h1>Analog Finder</h1>
      <span class="wip">working name</span>
    </div>
    <p class="lede">No single place on Earth can stand in for a Moon or Mars base. So we split base-building into challenges, and for each one we rank the Earth sites best suited to test it.</p>
    <nav class="toplinks"><a href="#checked">How we checked it</a><a href="#data">Data used</a></nav>
  </header>
  <main class="workspace">
    <section class="controls" aria-label="Choose a target and a challenge">
      <fieldset class="step">
        <legend><span class="n">1</span>Where is the base?</legend>
        <div class="seg" role="radiogroup" aria-label="Body">
          <label><input type="radio" name="body" value="moon" />Moon</label>
          <label><input type="radio" name="body" value="mars" />Mars</label>
        </div>
        <label class="field"><span>Compare against</span><select id="target"></select></label>
        <p class="note" id="target-note"></p>
      </fieldset>
      <div class="step">
        <h3><span class="n">2</span>Pick a challenge</h3>
        <ul class="challenges" data-testid="challenges"></ul>
        <p class="ch-active" id="ch-active"></p>
      </div>
    </section>
    <section class="mapcol" aria-label="Earth test sites">
      <div id="map" class="map" role="region" aria-label="World map of Earth test sites"></div>
      <div class="step ranking-wrap" id="ranking-wrap">
        <h3><span class="n">3</span>Best Earth test sites <span class="for" id="ranking-for"></span></h3>
        <div data-testid="ranking" id="ranking"></div>
      </div>
    </section>
    <article class="card" data-testid="match" id="match" aria-live="polite"></article>
  </main>
  <section class="validation" id="checked" data-testid="validation"></section>
  <section class="sources" id="data"></section>
  <footer class="foot">
    <div>
      <h4>How we used AI</h4>
      <p>The core idea and the key design decisions come from our team. We used Claude (Anthropic) to research the challenge and the data, write our planning documents, and write and test this site's code and data pipeline. We checked its work at each step. Nothing on this site is an AI-made image.</p>
    </div>
    <div>
      <h4>About this prototype</h4>
      <p>A NASA Space Apps 2026 entry for "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars". This is a preview: values marked <span class="tag sample">sample</span> are placeholders, not measurements.</p>
    </div>
  </footer>
`;

const data: App = await (await fetch("/data/app.json")).json();
const siteById = new Map(data.sites.map((s) => [s.id, s]));
const targetById = new Map(data.targets.map((t) => [t.id, t]));

const state: State = readHash() ?? defaults("moon");
let map: SiteMap | null = null;

function defaults(body: Body): State {
  const target = data.targets.find((t) => t.body === body)!.id;
  const challenge = data.challenges[body][0].id;
  return { body, target, challenge, site: data.results[target][challenge][0].site };
}

function readHash(): State | null {
  const [body, target, challenge, site] = location.hash.replace(/^#\/?/, "").split("/");
  if ((body !== "moon" && body !== "mars") || targetById.get(target)?.body !== body || !siteById.has(site)) return null;
  if (!data.challenges[body].some((c) => c.id === challenge)) return null;
  return { body, target, challenge, site };
}

function challenge(): Challenge {
  return data.challenges[state.body].find((c) => c.id === state.challenge)!;
}

function ranking() {
  return data.results[state.target]?.[state.challenge] ?? [];
}

function topSite() {
  return ranking()[0]?.site ?? state.site;
}

function set(patch: Partial<State>, opts: { reveal?: "match" | "ranking" } = {}) {
  Object.assign(state, patch);
  history.replaceState(null, "", `#/${state.body}/${state.target}/${state.challenge}/${state.site}`);
  render();
  const narrow = window.matchMedia(opts.reveal === "match" ? "(max-width: 1099px)" : "(max-width: 759px)").matches;
  if (opts.reveal && narrow) {
    const el = document.getElementById(opts.reveal === "match" ? "match" : "ranking-wrap")!;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
}

function renderControls() {
  for (const r of app.querySelectorAll<HTMLInputElement>("input[name=body]")) r.checked = r.value === state.body;
  const select = app.querySelector<HTMLSelectElement>("#target")!;
  const targets = data.targets.filter((t) => t.body === state.body);
  select.innerHTML = targets.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  select.value = state.target;
  const t = targetById.get(state.target)!;
  app.querySelector("#target-note")!.textContent =
    state.body === "moon"
      ? "One of NASA's nine Artemis III landing regions near the Moon's south pole."
      : (t.facts[0]?.text ?? "");

  app.querySelector("#ch-active")!.textContent = challenge().question;
  const list = app.querySelector("[data-testid=challenges]")!;
  list.innerHTML = data.challenges[state.body]
    .map((c) => {
      const scored = c.parts.length > 0;
      const tags = [c.only ? `<span class="tag">${esc(c.only)}</span>` : "", scored ? "" : `<span class="tag muted">not scored</span>`].join("");
      return `<li><button type="button" class="ch${c.id === state.challenge ? " on" : ""}" data-id="${c.id}" aria-pressed="${c.id === state.challenge}">
        <span class="ch-name">${esc(c.name)}${tags}</span>
        <span class="ch-q">${esc(c.question)}</span>
      </button></li>`;
    })
    .join("");
}

function renderRanking() {
  const c = challenge();
  const target = targetById.get(state.target)!;
  app.querySelector("#ranking-for")!.textContent = `for ${c.name.toLowerCase()} at ${target.name}`;
  const box = app.querySelector<HTMLDivElement>("#ranking")!;
  if (!c.parts.length) {
    box.innerHTML = `<div class="unscored">
      <p class="u-head"><span class="tag muted">not scored</span> No Earth sites are ranked for ${esc(c.name.toLowerCase())}: it is shown as a label only. The reason is in the panel titled "Why there is no ranking".</p>
    </div>`;
    return;
  }
  if (data.previews[state.target]?.includes(state.challenge)) {
    box.innerHTML = `<div class="unscored">
      <p class="u-head"><span class="tag sample">sample</span> <strong>Preview, not ranked.</strong> Every value in this challenge is a sample at ${esc(target.name)} for now, so a ranking would be noise. Pick any site on the map to see what will be compared.</p>
    </div>`;
    return;
  }
  const rows = ranking().slice(0, 10);
  box.innerHTML = `<div class="rank-head" aria-hidden="true"><span>#</span><span>Site</span><span>Match</span></div>
    ${rows
      .map((r, i) => {
        const s = siteById.get(r.site)!;
        const g = groupLabel(s.groups);
        return `<button type="button" class="row${r.site === state.site ? " on" : ""}" data-site="${s.id}" data-name="${esc(s.name)}" aria-pressed="${r.site === state.site}">
          <span class="rk">${i + 1}</span>
          <span class="nm"><span class="nm-main">${esc(s.name)}</span><span class="nm-sub">${esc(s.country)} · ${esc(g)}</span></span>
          <span class="sc"><span class="num">${pct(r.score)}</span>${r.sample ? `<span class="tag sample">sample</span>` : ""}<span class="bar"><i style="width:${pct(r.score)}%"></i></span></span>
        </button>`;
      })
      .join("")}`;
}

function render() {
  renderControls();
  renderRanking();
  renderMatch(app.querySelector("#match")!, data, state);
  map?.update(ranking().slice(0, 10).map((r) => r.site), state.site, state.body);
}

app.addEventListener("change", (e) => {
  const el = e.target as HTMLElement;
  if (el instanceof HTMLInputElement && el.name === "body") {
    set(defaults(el.value as Body));
  } else if (el instanceof HTMLSelectElement && el.id === "target") {
    state.target = el.value;
    set({ site: topSite() });
  }
});

app.addEventListener("click", (e) => {
  const ch = (e.target as HTMLElement).closest<HTMLButtonElement>("button.ch");
  if (ch) {
    state.challenge = ch.dataset.id!;
    set({ site: topSite() }, { reveal: "ranking" });
    return;
  }
  const row = (e.target as HTMLElement).closest<HTMLButtonElement>("button.row");
  if (row) set({ site: row.dataset.site! }, { reveal: "match" });
});

renderSources(app.querySelector("#data")!, data);
renderValidation(app.querySelector("#checked")!, data);
render();
map = createMap(app.querySelector("#map")!, data.sites, (id) => set({ site: id }, { reveal: "match" }));
map.update(ranking().slice(0, 10).map((r) => r.site), state.site, state.body);

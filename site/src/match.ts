import type { App, Body, Challenge, Site, Target, Trait, Value } from "./types";
import { esc, fmt, groupLabel, link, num, pct } from "./format";

interface Pick {
  body: Body;
  target: string;
  challenge: string;
  site: string;
}

const domains = new Map<string, [number, number]>();

function domain(data: App, body: Body, trait: string): [number, number] {
  const key = `${body}/${trait}`;
  if (!domains.has(key)) {
    const vals = [
      ...data.sites.map((s) => s.values[body][trait]?.value),
      ...data.targets.filter((t) => t.body === body).map((t) => t.values[trait]?.value),
    ].filter((v): v is number => typeof v === "number");
    domains.set(key, [Math.min(...vals), Math.max(...vals)]);
  }
  return domains.get(key)!;
}

function earthSource(data: App, body: Body, t: Trait, v: Value): string {
  if (v.sample) return "sample value";
  const key = t.earth?.[0];
  if (key === "terrain") return `Copernicus DEM GLO-90, slopes at ${data.terrainScale[body]} m`;
  if (key === "noon_sun_deg") return "computed from latitude";
  return "NASA POWER climatology";
}

function sampleTag(v: Value): string {
  return v.sample ? ` <span class="tag sample">sample</span>` : "";
}

function ruler(lo: number, hi: number, e: Value, v: Value): string {
  const pad = (hi - lo) * 0.06 || 1;
  const x = (n: number) => ((n - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const xe = x(e.value);
  const xv = x(v.value);
  return `<div class="ruler" aria-hidden="true">
    <i class="axis"></i>
    <i class="gap" style="left:${Math.min(xe, xv)}%;width:${Math.abs(xe - xv)}%"></i>
    <i class="pt-e${e.sample ? " s" : ""}" style="left:${xe}%"></i>
    <i class="pt-t${v.sample ? " s" : ""}" style="left:${xv}%"></i>
  </div>`;
}

function traitRow(data: App, body: Body, id: string, site: Site, target: Target, rank: number): string {
  const t = data.traits[id];
  const e = site.values[body][id];
  const v = target.values[id];
  const [lo, hi] = domain(data, body, id);
  const gap = Math.abs(e.value - v.value);
  const gapText = gap * (t.scale ?? 1) < Math.pow(10, -t.digits) ? "same" : `${fmt(t, gap)} apart`;
  return `<div class="tr">
    <div class="tr-top">
      <span class="tr-name">${esc(t.label)}</span>
      <span class="tr-rank" title="Share of Earth's land further from ${esc(target.name)} on this trait">closer than <b>${pct(rank)}%</b> of land</span>
    </div>
    ${ruler(lo, hi, e, v)}
    <div class="tr-vals">
      <span><i class="key-e"></i>Here <b>${fmt(t, e.value)}</b>${sampleTag(e)}</span>
      <span><i class="key-t"></i>${esc(target.name)} <b>${fmt(t, v.value)}</b>${sampleTag(v)}</span>
      <span class="tr-gap">${gapText}</span>
    </div>
    <p class="tr-src">${esc(t.plain)} <span class="src">Earth: ${esc(earthSource(data, body, t, e))}. ${esc(target.name)}: ${v.sample ? "sample value" : link(v.source ?? "source", v.url)}${v.note ? ` (${esc(v.note.replace(/\.$/, ""))})` : ""}.</span></p>
  </div>`;
}

function breaks(data: App, body: Body, c: Challenge, site: Site, target: Target, ranks: Record<string, number>): string {
  const ids = Object.keys(ranks).sort((a, b) => ranks[a] - ranks[b]);
  const weak = ids.filter((id) => ranks[id] < 0.5);
  const list = (weak.length ? weak : ids.slice(0, 1)).map((id) => {
    const t = data.traits[id];
    const e = site.values[body][id];
    const v = target.values[id];
    const s = e.sample || v.sample ? ` <span class="tag sample">sample</span>` : "";
    return `<li><strong>${esc(t.label)}:</strong> ${fmt(t, e.value)} here against ${fmt(t, v.value)} at ${esc(target.name)}, ${fmt(t, Math.abs(e.value - v.value))} apart. ${
      ranks[id] < 0.5 ? `Closer than only ${pct(ranks[id])}% of Earth's land.` : `This is the weakest trait here, though still closer than ${pct(ranks[id])}% of land.`
    }${s}</li>`;
  });
  for (const u of c.unscored ?? []) {
    const x = target.extra[u.target_key];
    const val = x ? (u.target_key === "lit_share" ? `${num(x.value * 100, 0)}% of the time at its best-lit spot` : num(x.value, 3)) : "no data";
    list.push(`<li><strong>${esc(u.name)}:</strong> ${esc(target.name)} ${val}${x?.source ? ` (${link(x.source, x.url)})` : ""}; Earth: ${esc(u.earth_text)}. <span class="why">${esc(u.reason)}</span></li>`);
  }
  for (const l of c.labels ?? []) list.push(`<li><strong>${esc(l.name)}:</strong> <span class="why">${esc(l.reason)}</span></li>`);
  return `<ul class="breaks">${list.join("")}</ul>`;
}

function cantCopy(data: App, body: Body): string {
  const name = body === "moon" ? "Moon" : "Mars";
  return `<h4 class="cc-title">Earth can't copy</h4>
  <table class="cc">
    <thead><tr><th></th><th>Earth</th><th>${name}</th></tr></thead>
    <tbody>${data.cantCopy.map((r) => `<tr><th>${esc(r.name)}</th><td>${esc(r.earth)}</td><td>${esc(r[body])}</td></tr>`).join("")}</tbody>
  </table>
  <p class="tr-src">Every match on this site shares these limits. Sources: ${data.cantCopy.map((r) => link(r.source, r.url)).join("; ")}.</p>`;
}

export function renderMatch(el: HTMLElement, data: App, pick: Pick) {
  const site = data.sites.find((s) => s.id === pick.site)!;
  const target = data.targets.find((t) => t.id === pick.target)!;
  const c = data.challenges[pick.body].find((x) => x.id === pick.challenge)!;
  const rows = data.results[pick.target][pick.challenge] ?? [];
  const pos = rows.findIndex((r) => r.site === pick.site);
  const res = rows[pos];
  const scored = c.parts.length > 0 && res;

  const how = scored
    ? `<div class="score"><span class="big" data-testid="score">${pct(res.score)}</span><span class="of">out of 100</span></div>
       <p>For <strong>${esc(c.name.toLowerCase())}</strong> at <strong>${esc(target.name)}</strong>, this site is closer than ${pct(res.score)}% of Earth's land, averaged across the traits below. It ranks ${pos + 1} of ${rows.length} test sites.</p>
       ${res.sample ? `<p class="flag"><span class="tag sample">sample</span> Part of this score comes from sample values, so it is a placeholder until real data replaces them.</p>` : ""}
       <p class="test-here"><strong>Test here:</strong> ${c.parts.map((p) => esc(p.why)).join("; ")}.</p>`
    : `<p><span class="tag muted">not scored</span> ${esc(c.name)} has no data on both sides yet, so there is no score.</p>`;

  const similar = scored
    ? c.parts
        .map(
          (p) => `<div class="part">
          <h4>${esc(p.name)}</h4>
          ${p.traits.map((id) => traitRow(data, pick.body, id, site, target, res.ranks[id])).join("")}
        </div>`,
        )
        .join("") + (c.built_from ? `<p class="tr-src">${esc(c.built_from)}</p>` : "")
    : `<p>Nothing to compare yet. The reason is listed under "Best Earth test sites".</p>`;

  const about = `<h3>About ${esc(target.name)}</h3>
    <p class="m-meta">${num(target.lat, 2)}°, ${num(target.lon, 2)}° · ${pick.body === "moon" ? "Moon" : "Mars"}</p>
    ${target.anchorNote ? `<p class="tr-src"><strong>Where we placed it:</strong> ${esc(target.anchorNote)}${target.anchorUrl ? ` ${link("Gazetteer entry", target.anchorUrl)}` : ""}</p>` : ""}
    <ul class="facts">${target.facts.map((f) => `<li>${esc(f.text)} <span class="src">(${link(f.source, f.url)})</span></li>`).join("")}</ul>`;

  el.innerHTML = `
    <header class="m-head">
      <h2>${esc(site.name)}</h2>
      <p class="m-meta">${esc(site.country)} · ${num(site.lat, 2)}°, ${num(site.lon, 2)}°${site.coordsEstimate ? " (approximate)" : ""} · ${esc(groupLabel(site.groups))}</p>
      <p class="m-vs">compared with <strong>${esc(target.name)}</strong> for <strong>${esc(c.name.toLowerCase())}</strong></p>
    </header>
    <section class="m-sec"><h3>How similar</h3>${how}</section>
    <section class="m-sec"><h3>What's similar</h3>
      ${scored ? `<p class="legend"><span><i class="key-e"></i>this Earth site</span><span><i class="key-t"></i>${esc(target.name)}</span><span><i class="key-s"></i>sample value</span></p>` : ""}
      ${similar}
    </section>
    <section class="m-sec"><h3>Where it breaks</h3>
      ${scored ? breaks(data, pick.body, c, site, target, res.ranks) : ""}
      ${cantCopy(data, pick.body)}
    </section>
    <section class="m-sec">${about}</section>`;
}

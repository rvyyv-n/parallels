import type { App, Body, Challenge, Site, Target, Trait, Value } from "./types";
import { esc, fmt, groupLabel, link, num, pct } from "./format";

interface Pick {
  body: Body;
  target: string;
  challenge: string;
  site: string;
}

interface Side {
  name: string;
  values: Record<string, Value>;
}

const domains = new Map<string, [number, number]>();

const EARTH_SOURCES: Record<string, string> = {
  noon_sun_deg: "computed from latitude",
  ts_min_c: "NASA POWER ground-surface temperature",
  ts_seasonal_swing_c: "NASA POWER ground-surface temperature",
  ts_daily_range_c: "NASA POWER ground-surface temperature",
  frozen_months_surface: "NASA POWER ground-surface temperature",
  aod_550: "NASA POWER aerosol optical depth (MERRA-2)",
  bare_share: "NASA MODIS land cover (MCD12Q1, via GIBS)",
};

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
  if (v.missing) return "no data for this site";
  const key = t.earth?.[0] ?? "";
  if (key === "terrain") return `Copernicus DEM GLO-90, slopes at ${data.terrainScale[body]} m`;
  return EARTH_SOURCES[key] ?? "NASA POWER climatology";
}

function sampleTag(v: Value): string {
  return v.sample ? ` <span class="tag sample">sample</span>` : "";
}

function shown(t: Trait, v: Value): string {
  return v.value === null ? `<span class="nodata">no data</span>` : `<b>${fmt(t, v.value)}</b>`;
}

function ruler(lo: number, hi: number, e: Value, v: Value): string {
  const pad = (hi - lo) * 0.06 || 1;
  const x = (n: number) => ((n - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const xv = x(v.value!);
  const target = `<i class="pt-t${v.sample ? " s" : ""}" style="left:${xv}%"></i>`;
  if (e.value === null) return `<div class="ruler" aria-hidden="true"><i class="axis"></i>${target}</div>`;
  const xe = x(e.value);
  return `<div class="ruler" aria-hidden="true">
    <i class="axis"></i>
    <i class="gap" style="left:${Math.min(xe, xv)}%;width:${Math.abs(xe - xv)}%"></i>
    <i class="pt-e${e.sample ? " s" : ""}" style="left:${xe}%"></i>
    ${target}
  </div>`;
}

function traitRow(data: App, body: Body, id: string, site: Site, side: Side, rank: number | null, preview: boolean): string {
  const t = data.traits[id];
  const e = site.values[body][id];
  const v = side.values[id];
  const [lo, hi] = domain(data, body, id);
  const gap = e.value === null ? null : Math.abs(e.value - v.value!);
  const gapText = gap === null ? "" : gap * (t.scale ?? 1) < Math.pow(10, -t.digits) ? "same" : `${fmt(t, gap)} apart`;
  const rankText = preview ? "not ranked" : rank === null ? "no rank" : `closer than <b>${pct(rank)}%</b> of land`;
  const vSource = v.ideal ? "the ideal, not a measurement" : v.sample ? "sample value" : link(v.source ?? "source", v.url);
  return `<div class="tr">
    <div class="tr-top">
      <span class="tr-name">${esc(t.label)}</span>
      <span class="tr-rank" title="Share of Earth's land further from ${esc(side.name)} on this trait">${rankText}</span>
    </div>
    ${ruler(lo, hi, e, v)}
    <div class="tr-vals">
      <span><i class="key-e"></i>Here ${shown(t, e)}${sampleTag(e)}</span>
      <span><i class="key-t"></i>${esc(side.name)} ${shown(t, v)}${sampleTag(v)}</span>
      <span class="tr-gap">${gapText}</span>
    </div>
    <p class="tr-src">${esc(t.plain)} <span class="src">Earth: ${esc(earthSource(data, body, t, e))}. ${esc(side.name)}: ${vSource}${v.note ? ` (${esc(v.note.replace(/\.$/, ""))})` : ""}.</span></p>
  </div>`;
}

function breaks(data: App, body: Body, c: Challenge, site: Site, side: Side, target: Target, ranks: Record<string, number | null>): string {
  const ids = Object.keys(ranks)
    .filter((id) => ranks[id] !== null)
    .sort((a, b) => ranks[a]! - ranks[b]!);
  const weak = ids.filter((id) => ranks[id]! < 0.5);
  const list = (weak.length ? weak : ids.slice(0, 1)).map((id) => {
    const t = data.traits[id];
    const e = site.values[body][id];
    const v = side.values[id];
    const r = ranks[id]!;
    const s = e.sample || v.sample ? ` <span class="tag sample">sample</span>` : "";
    return `<li><strong>${esc(t.label)}:</strong> ${fmt(t, e.value!)} here against ${fmt(t, v.value!)} ${v.ideal ? "for ideal ground" : `at ${esc(side.name)}`}, ${fmt(t, Math.abs(e.value! - v.value!))} apart. ${
      r < 0.5 ? `Closer than only ${pct(r)}% of Earth's land.` : `This is the weakest trait here, though still closer than ${pct(r)}% of land.`
    }${s}</li>`;
  });
  for (const id of Object.keys(ranks).filter((k) => ranks[k] === null)) {
    list.push(`<li><strong>${esc(data.traits[id].label)}:</strong> no data for this site, so it counts as average and lowers our confidence.</li>`);
  }
  for (const u of c.unscored ?? []) {
    const x = target.extra[u.target_key];
    const val = x ? (u.target_key === "lit_share" ? `${num(x.value! * 100, 0)}% of the time at its best-lit spot` : num(x.value!, 3)) : "no data";
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

function about(target: Target, body: Body): string {
  return `<h3>About ${esc(target.name)}</h3>
    <p class="m-meta">${num(target.lat, 2)}°, ${num(target.lon, 2)}° · ${body === "moon" ? "Moon" : "Mars"}</p>
    ${target.anchorNote ? `<p class="tr-src"><strong>Where we placed it:</strong> ${esc(target.anchorNote)}${target.anchorUrl ? ` ${link("Gazetteer entry", target.anchorUrl)}` : ""}</p>` : ""}
    <ul class="facts">${target.facts.map((f) => `<li>${esc(f.text)} <span class="src">(${link(f.source, f.url)})</span></li>`).join("")}</ul>`;
}

function siteMeta(site: Site): string {
  const where = `${num(site.lat, 2)}°, ${num(site.lon, 2)}°${site.coordsEstimate ? " (approximate)" : ""}`;
  return `${esc(site.country)} · ${site.coordSource ? link(where, site.coordSource) : where} · ${esc(groupLabel(site.groups))}`;
}

export function renderMatch(el: HTMLElement, data: App, pick: Pick) {
  const site = data.sites.find((s) => s.id === pick.site)!;
  const target = data.targets.find((t) => t.id === pick.target)!;
  const c = data.challenges[pick.body].find((x) => x.id === pick.challenge)!;

  if (!c.parts.length) {
    el.innerHTML = `
      <header class="m-head">
        <h2>${esc(c.name)}</h2>
        <p class="m-meta"><span class="tag muted">not scored</span> ${esc(target.name)} · ${pick.body === "moon" ? "Moon" : "Mars"}</p>
      </header>
      <section class="m-sec"><h3>Why there is no ranking</h3>
        ${(c.labels ?? []).map((l) => `<p><strong>${esc(l.name)}.</strong> ${esc(l.reason)}</p>`).join("")}
      </section>
      <section class="m-sec"><h3>Where any match breaks</h3>${cantCopy(data, pick.body)}</section>
      <section class="m-sec">${about(target, pick.body)}</section>`;
    return;
  }

  const rows = data.results[pick.target][pick.challenge] ?? [];
  const pos = rows.findIndex((r) => r.site === pick.site);
  const res = rows[pos];
  const preview = data.previews[pick.target]?.includes(pick.challenge) ?? false;
  const ideal = Object.keys(c.ideal ?? {});
  const side: Side = {
    name: ideal.length ? "Ideal flat ground" : target.name,
    values: { ...target.values, ...Object.fromEntries(ideal.map((k) => [k, { value: c.ideal![k], sample: false, ideal: true }])) },
  };

  const how = !res
    ? `<p>This site has too little data for ${esc(c.name.toLowerCase())}, so it has no score.</p>`
    : preview
      ? `<p><span class="tag sample">sample</span> <strong>Preview, not ranked.</strong> Every value in this challenge is a sample for now, so any ranking would be noise. The traits below show what will be compared once real data is in.</p>`
      : `<div class="score"><span class="big" data-testid="score">${pct(res.score)}</span><span class="of">out of 100</span></div>
       <p>For <strong>${esc(c.name.toLowerCase())}</strong> at <strong>${esc(target.name)}</strong>, this site is closer than ${pct(res.score)}% of Earth's land, averaged across the traits below. It ranks ${pos + 1} of ${rows.length} test sites.</p>
       ${res.sample ? `<p class="flag"><span class="tag sample">sample</span> Part of this score comes from sample values, so it is a placeholder until real data replaces them.</p>` : ""}
       ${c.ideal_note ? `<p class="flag">${esc(c.ideal_note)}</p>` : ""}
       <p class="test-here"><strong>Test here:</strong> ${c.parts.map((p) => esc(p.why)).join("; ")}.</p>`;

  const similar = res
    ? c.parts
        .map(
          (p) => `<div class="part">
          <h4>${esc(p.name)}</h4>
          ${p.traits.map((id) => traitRow(data, pick.body, id, site, side, res.ranks[id] ?? null, preview)).join("")}
        </div>`,
        )
        .join("") + (c.built_from ? `<p class="tr-src">${esc(c.built_from)}</p>` : "")
    : "";

  el.innerHTML = `
    <header class="m-head">
      <h2>${esc(site.name)}</h2>
      <p class="m-meta">${siteMeta(site)}</p>
      <p class="m-vs">compared with <strong>${esc(target.name)}</strong> for <strong>${esc(c.name.toLowerCase())}</strong></p>
    </header>
    <section class="m-sec"><h3>How similar</h3>${how}</section>
    <section class="m-sec"><h3>What's similar</h3>
      ${res ? `<p class="legend"><span><i class="key-e"></i>this Earth site</span><span><i class="key-t"></i>${esc(side.name)}</span><span><i class="key-s"></i>sample value</span></p>` : ""}
      ${similar}
    </section>
    <section class="m-sec"><h3>Where it breaks</h3>
      ${res && !preview ? breaks(data, pick.body, c, site, side, target, res.ranks) : ""}
      ${cantCopy(data, pick.body)}
    </section>
    <section class="m-sec">${about(target, pick.body)}</section>`;
}

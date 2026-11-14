import type { App } from "./types";
import { esc, link } from "./format";

export function renderSources(el: HTMLElement, data: App) {
  const rows = data.sources
    .map(
      (s) => `<tr><th>${s.url ? link(s.name, s.url) : esc(s.name)}${s.partner ? ` <span class="tag">partner data</span>` : ""}</th><td>${esc(s.use)}</td><td>${s.kind === "real" ? `<span class="tag real">real</span>` : `<span class="tag sample">sample</span>`}</td></tr>`,
    )
    .join("");
  el.innerHTML = `<h2>Data used</h2>
    <p>Every number on this page comes from one of these sources or is marked <span class="tag sample">sample</span>. Published values link to their paper or NASA page where they appear.</p>
    <div class="table-scroll"><table class="src-table"><thead><tr><th>Source</th><th>What we use it for</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="tr-src">Data built ${esc(data.generated)}. Earth values are 10 km patches around each site's listed point; climate values are model output at about 50 km.</p>`;
}

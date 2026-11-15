import type { Page } from "../router";
import { checksPage } from "../sections";
import type { Ctx } from "./ctx";

export function checks(ctx: Ctx): Page {
  let ready: Promise<void> = Promise.resolve();
  return {
    title: () => "How we checked it",
    mount(el) {
      el.innerHTML = `<section id="checked" class="page-sec band" aria-labelledby="checked-h"><header class="sec-head"><p class="sec-k">Checks</p><h1 id="checked-h" tabindex="-1">How we checked it</h1></header><p class="muted" role="status">Loading the check results…</p></section>`;
      ready = ctx.validation().then((v) => {
        const focused = document.activeElement?.id === "checked-h";
        el.innerHTML = checksPage(ctx.m, v);
        if (focused) el.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
      });
    },
    show: () => ready,
  };
}

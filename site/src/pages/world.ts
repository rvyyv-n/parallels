import type { Body } from "../contract";
import { go, type Page } from "../router";
import { sitePage, wireSitePage, type SitePage } from "../sitepages";
import { TITLE } from "../worlds";
import type { Ctx } from "./ctx";

export function bodyPage(ctx: Ctx, b: Body): Page {
  let page: SitePage | null = null;
  return {
    title: () => TITLE[b],
    mount(el) {
      el.innerHTML = sitePage(ctx.m, b);
      page = wireSitePage(el, { m: ctx.m, body: b, labels: ctx.labels, pick: (id) => go(`#/find?t=${encodeURIComponent(id)}`) });
    },
    show() {
      page?.pause(false);
    },
    hide() {
      page?.pause(true);
    },
  };
}

import type { Body } from "../contract";
import { go, type Page } from "../router";
import { sitePage, wireSitePage } from "../sitepages";
import { TITLE } from "../worlds";
import type { Ctx } from "./ctx";

export function bodyPage(ctx: Ctx, b: Body): Page {
  return {
    title: () => TITLE[b],
    mount(el) {
      el.innerHTML = sitePage(ctx.m, b);
      wireSitePage(el, { m: ctx.m, body: b, labels: ctx.labels, pick: (id) => go(`#/find?t=${encodeURIComponent(id)}`) });
    },
    show() {},
  };
}

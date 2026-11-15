import type { Body } from "../contract";
import type { Page } from "../router";
import { fillAnalogs, thumb, TITLE, worldPage } from "../worlds";
import type { Ctx } from "./ctx";

export function bodyPage(ctx: Ctx, b: Body): Page {
  return {
    title: () => TITLE[b],
    mount(el) {
      el.innerHTML = worldPage(ctx.m, b);
      for (const t of ctx.m.targets.filter((x) => x.body === b)) {
        const cv = el.querySelector<HTMLCanvasElement>(`[data-thumb="${t.id}"]`);
        if (cv) thumb(cv, t);
      }
      void ctx.labels().then((ls) => fillAnalogs(el, ls));
    },
    show() {},
  };
}

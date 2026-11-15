import type { Body, LabelPoint, Manifest } from "./contract";
import { fillAnalogs, thumb, worldPage } from "./worlds";

export interface SiteHooks {
  m: Manifest;
  body: Body;
  labels(): Promise<LabelPoint[]>;
  pick(id: string): void;
}

export const sitePage = (m: Manifest, body: Body) => worldPage(m, body);

export function wireSitePage(el: HTMLElement, hooks: SiteHooks): void {
  for (const t of hooks.m.targets.filter((x) => x.body === hooks.body)) {
    const cv = el.querySelector<HTMLCanvasElement>(`[data-thumb="${t.id}"]`);
    if (cv) thumb(cv, t);
  }
  void hooks.labels().then((ls) => fillAnalogs(el, ls));
}

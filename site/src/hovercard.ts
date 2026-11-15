import { esc, latlon, score100 } from "./format";

export interface HoverInfo {
  rank: number;
  name: string;
  lat: number;
  lon: number;
  score: number;
  far: number;
}

export interface HoverHooks {
  info(i: number): HoverInfo | null;
  open(i: number): void;
}

export interface HoverCard {
  show(i: number, x: number, y: number): void;
  hide(): void;
}

export function createHoverCard(el: HTMLElement, hooks: HoverHooks): HoverCard {
  const card = document.createElement("div");
  card.className = "hovercard";
  card.hidden = true;
  el.append(card);
  return {
    show(i, x, y) {
      const p = hooks.info(i);
      if (!p) return;
      card.innerHTML = `<b>#${p.rank} ${esc(p.name)}</b><span>${latlon(p.lat, p.lon, 2)}</span><span>${score100(p.score)} / 100 match score</span>`;
      card.style.left = `${x + 16}px`;
      card.style.top = `${y + 16}px`;
      card.hidden = false;
    },
    hide() {
      card.hidden = true;
    },
  };
}

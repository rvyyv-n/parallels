import type { Body, Target } from "../../../dataset/contract";
import type { Disc, Layout } from "./scene";

export const CHAPTERS = ["intro", "find", "match", "breaks", "test", "base"] as const;
export type ChapterId = (typeof CHAPTERS)[number];

export const WIDE_FROM = 900;
const SITE_SIZE = { moon: 0.273, mars: 0.32 };

type Spot = Omit<Disc, "ax" | "ay">;

function aimed(spot: Spot, ax: number, ay: number, lat: number): Disc {
  const polar = lat < -70 ? -0.55 : lat > 70 ? 0.55 : 0;
  const y = ay + polar;
  const over = Math.hypot(ax, y) / 0.82;
  return { ...spot, ax: over > 1 ? ax / over : ax, ay: over > 1 ? y / over : y };
}

const other = (body: Body): Body => (body === "moon" ? "mars" : "moon");

function withSite(target: Target, earth: Disc, site: Disc, width: number, height: number): Layout {
  const away: Disc = { x: width + height * 0.6, y: height * -0.4, r: height * 0.12, ax: 0, ay: 0 };
  return { earth, [target.body]: site, [other(target.body)]: away } as Layout;
}

export function keyframe(id: ChapterId, width: number, height: number, target: Target): Layout {
  const lat = target.lat;
  const site = (spot: Spot, ax = 0, ay = 0, tilt = lat) => aimed(spot, ax, ay, tilt);
  const wide = width >= WIDE_FROM;

  if (id === "intro") {
    const r = wide ? Math.max(width * 0.95, height * 1.5) : width * 1.3;
    const horizon = height * (wide ? 0.78 : 0.62);
    const earth = { x: width * 0.5, y: horizon + r, r, ax: 0, ay: 1 - (height * 0.13) / r };
    const moon = { x: width * 0.72, y: height * 0.29, r: height * (wide ? 0.15 : 0.17) };
    const mars = { x: width * 0.9, y: height * (wide ? 0.15 : 0.2), r: height * 0.085 };
    return {
      earth,
      moon: aimed(moon, 0, 0, target.body === "moon" ? lat : 0),
      mars: aimed(mars, 0, 0, target.body === "mars" ? lat : 0),
    };
  }

  if (wide) {
    const r = height * 0.5;
    switch (id) {
      case "find": {
        const cr = r * SITE_SIZE[target.body];
        const earth = { x: Math.max(width * 0.69, 548 + r), y: height * 0.62, r, ax: 0, ay: 0.06 };
        const apart = r + cr + 26;
        return withSite(target, earth, site({ x: earth.x - apart * 0.669, y: earth.y - apart * 0.743, r: cr }), width, height);
      }
      case "match":
      case "breaks": {
        const big = Math.min(height * 0.7, (width * 1.2 - Math.min(560, width * 0.5)) / 2);
        const apart = id === "match" ? 0.1 : 0.19;
        const drift = id === "match" ? 0 : 0.04;
        return withSite(
          target,
          { x: width * -apart, y: height * (0.56 + drift), r: big, ax: 0.6, ay: 0.02 },
          site({ x: width * (1 + apart), y: height * (0.56 - drift), r: big }, -0.6, 0.02, lat * 0.35),
          width,
          height,
        );
      }
      case "test": {
        const big = height * 0.84;
        return withSite(
          target,
          { x: Math.max(width * 0.9, 580 + big), y: height * 0.64, r: big, ax: -0.5, ay: 0.12 },
          site({ x: width + big, y: height * -0.3, r: height * 0.2 }),
          width,
          height,
        );
      }
      case "base": {
        const whole = height * 0.43;
        const earth = { x: Math.max(width * 0.68, 600 + whole), y: height * 0.53, r: whole, ax: 0, ay: 0 };
        const cr = whole * SITE_SIZE[target.body];
        return withSite(target, earth, site({ x: earth.x + whole * 0.78, y: earth.y - whole * 0.86, r: cr }), width, height);
      }
    }
  }

  const r = Math.min(width * 0.4, height * 0.52);
  switch (id) {
    case "find":
    case "base": {
      const cr = r * Math.min(SITE_SIZE[target.body], 0.3);
      return withSite(target, { x: width * 0.43, y: 52 + r, r, ax: 0, ay: 0 }, site({ x: width - cr - 18, y: cr + 62, r: cr }), width, height);
    }
    case "match":
    case "breaks": {
      const big = height * 0.62;
      const apart = id === "match" ? 0.16 : 0.22;
      return withSite(
        target,
        { x: width * -apart, y: height * 0.56, r: big, ax: 0.55, ay: 0 },
        site({ x: width * (1 + apart), y: height * 0.56, r: big }, -0.55, 0, lat * 0.35),
        width,
        height,
      );
    }
    case "test":
      return withSite(
        target,
        { x: width * 0.5, y: height * 0.95, r: height * 0.9, ax: 0, ay: 0.45 },
        site({ x: width * 1.6, y: height * -0.4, r: height * 0.3 }),
        width,
        height,
      );
  }
}

export function entrance(to: Layout, height: number): Layout {
  const lower = (d: Disc, by: number): Disc => ({ ...d, y: d.y + height * by });
  return { earth: lower(to.earth, 0.22), moon: lower(to.moon, -0.1), mars: lower(to.mars, -0.16) };
}

export function mix(a: Layout, b: Layout, t: number): Layout {
  const disc = (p: Disc, q: Disc): Disc => ({
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
    r: p.r + (q.r - p.r) * t,
    ax: p.ax + (q.ax - p.ax) * t,
    ay: p.ay + (q.ay - p.ay) * t,
  });
  return { earth: disc(a.earth, b.earth), moon: disc(a.moon, b.moon), mars: disc(a.mars, b.mars) };
}

export const smooth = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

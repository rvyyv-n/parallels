import type { Target } from "../../../dataset/contract";
import type { Disc, Layout } from "./scene";

export const CHAPTERS = ["find", "match", "breaks", "test"] as const;
export type ChapterId = (typeof CHAPTERS)[number];

export const WIDE_FROM = 900;
const COMPANION_SIZE = { moon: 0.273, mars: 0.32 };

function aimed(disc: Omit<Disc, "ax" | "ay">, ax: number, ay: number, lat: number): Disc {
  const polar = lat < -70 ? -0.55 : lat > 70 ? 0.55 : 0;
  const y = ay + polar;
  const over = Math.hypot(ax, y) / 0.82;
  return { ...disc, ax: over > 1 ? ax / over : ax, ay: over > 1 ? y / over : y };
}

export function keyframe(id: ChapterId, width: number, height: number, target: Target): Layout {
  const size = COMPANION_SIZE[target.body];
  const lat = target.lat;
  if (width >= WIDE_FROM) {
    const r = height * 0.5;
    switch (id) {
      case "find": {
        const cr = r * size;
        const earth = { x: Math.max(width * 0.69, 548 + r), y: height * 0.62, r, ax: 0, ay: 0.06 };
        const apart = r + cr + 26;
        return {
          earth,
          companion: aimed({ x: earth.x - apart * 0.669, y: earth.y - apart * 0.743, r: cr }, 0, 0, lat),
        };
      }
      case "match": {
        const big = Math.min(height * 0.7, (width * 1.2 - Math.min(560, width * 0.5)) / 2);
        return {
          earth: { x: width * -0.1, y: height * 0.56, r: big, ax: 0.6, ay: 0.02 },
          companion: aimed({ x: width * 1.1, y: height * 0.56, r: big }, -0.6, 0.02, lat * 0.35),
        };
      }
      case "breaks": {
        const big = Math.min(height * 0.7, (width * 1.2 - Math.min(560, width * 0.5)) / 2);
        return {
          earth: { x: width * -0.19, y: height * 0.6, r: big, ax: 0.6, ay: 0.02 },
          companion: aimed({ x: width * 1.19, y: height * 0.52, r: big }, -0.6, 0.02, lat * 0.35),
        };
      }
      case "test": {
        const big = height * 0.84;
        return {
          earth: { x: Math.max(width * 0.9, 580 + big), y: height * 0.64, r: big, ax: -0.5, ay: 0.12 },
          companion: aimed({ x: width + big, y: height * -0.3, r: height * 0.2 }, 0, 0, lat),
        };
      }
    }
  }

  const r = Math.min(width * 0.4, height * 0.52);
  switch (id) {
    case "find": {
      const cr = r * Math.min(size, 0.3);
      return {
        earth: { x: width * 0.43, y: 52 + r, r, ax: 0, ay: 0 },
        companion: aimed({ x: width - cr - 18, y: cr + 62, r: cr }, 0, 0, lat),
      };
    }
    case "match":
    case "breaks": {
      const big = height * 0.62;
      const apart = id === "match" ? 0.16 : 0.27;
      return {
        earth: { x: width * -apart, y: height * 0.56, r: big, ax: 0.55, ay: 0 },
        companion: aimed({ x: width * (1 + apart), y: height * 0.56, r: big }, -0.55, 0, lat * 0.35),
      };
    }
    case "test":
      return {
        earth: { x: width * 0.5, y: height * 0.95, r: height * 0.9, ax: 0, ay: 0.45 },
        companion: aimed({ x: width * 1.6, y: height * -0.4, r: height * 0.3 }, 0, 0, lat),
      };
  }
}

export function entrance(to: Layout, height: number): Layout {
  return {
    earth: { ...to.earth, y: to.earth.y + height * 0.28, r: to.earth.r * 1.22 },
    companion: { ...to.companion, y: to.companion.y - height * 0.12, r: to.companion.r * 0.8 },
  };
}

export function mix(a: Layout, b: Layout, t: number): Layout {
  const disc = (p: Disc, q: Disc): Disc => ({
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
    r: p.r + (q.r - p.r) * t,
    ax: p.ax + (q.ax - p.ax) * t,
    ay: p.ay + (q.ay - p.ay) * t,
  });
  return { earth: disc(a.earth, b.earth), companion: disc(a.companion, b.companion) };
}

export const smooth = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

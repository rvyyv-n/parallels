import type { Body, Target } from "./contract";

export const TEXTURE = { moon: "img/moon.jpg", mars: "img/mars.jpg" };
export const SHARP = { moon: "img/moon-4k.jpg", mars: "img/mars-4k.jpg" };
export const NAME: Record<Body, string> = { moon: "the Moon", mars: "Mars" };
export const TITLE: Record<Body, string> = { moon: "The Moon", mars: "Mars" };
const SPAN = 8;

export function headline(text: string): [string, string] {
  const cut = [" (", ": ", ", "].map((k) => text.indexOf(k)).filter((n) => n > 0).sort((x, y) => x - y)[0];
  return cut ? [text.slice(0, cut), text.slice(cut).replace(/^[\s:(,]+/, "").replace(/\)$/, "")] : [text, ""];
}

const images = new Map<string, Promise<HTMLImageElement>>();
const image = (src: string) => {
  let p = images.get(src);
  if (!p) {
    p = new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = fail;
      img.src = src;
    });
    images.set(src, p);
  }
  return p;
};

function band(img: HTMLImageElement, top: number, bottom: number) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const y0 = Math.max(0, Math.floor(((90 - top) / 180) * h));
  const y1 = Math.min(h, Math.ceil(((90 - bottom) / 180) * h) + 1);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = y1 - y0;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, y0, w, y1 - y0, 0, 0, w, y1 - y0);
  const px = ctx.getImageData(0, 0, w, y1 - y0).data;
  return (lat: number, lon: number, out: Uint8ClampedArray, o: number) => {
    const x = ((((lon + 180) / 360) * w) % w + w) % w;
    const y = Math.max(0, Math.min(y1 - y0 - 1.001, ((90 - lat) / 180) * h - y0));
    const x0 = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - x0;
    const fy = y - yi;
    const a = (yi * w + x0) * 4;
    const b = (yi * w + ((x0 + 1) % w)) * 4;
    const c = a + w * 4;
    const d = b + w * 4;
    for (let k = 0; k < 3; k++)
      out[o + k] = (px[a + k] * (1 - fx) + px[b + k] * fx) * (1 - fy) + (px[c + k] * (1 - fx) + px[d + k] * fx) * fy;
    out[o + 3] = 255;
  };
}

function stretch(d: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[Math.round((d[i] + d[i + 1] + d[i + 2]) / 3)]++;
  const n = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let s = 0; lo < 255 && (s += hist[lo]) < n * 0.02; ) lo++;
  for (let s = 0; hi > 0 && (s += hist[hi]) < n * 0.02; ) hi--;
  const k = Math.max(1, Math.min(5, 180 / Math.max(1, hi - lo)));
  const mid = (lo + hi) / 2;
  for (let i = 0; i < d.length; i += 4) {
    const shift = ((d[i] + d[i + 1] + d[i + 2]) / 3 - mid) * (k - 1);
    for (let c = 0; c < 3; c++) d[i + c] += shift;
  }
}

export async function thumb(cv: HTMLCanvasElement, t: Target) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const img = await image(`${import.meta.env.BASE_URL}${SHARP[t.body]}`);
  const n = cv.width;
  const out = ctx.createImageData(n, n);
  const polar = Math.abs(t.lat) > 75;
  const s = Math.sign(t.lat) || 1;
  if (polar) {
    const at = band(img, s > 0 ? 90 : -90 + (90 - Math.abs(t.lat)) + SPAN, s > 0 ? Math.abs(t.lat) - SPAN : -90);
    const r0 = 90 - Math.abs(t.lat);
    const a0 = (t.lon * Math.PI) / 180;
    const x0 = r0 * Math.sin(a0);
    const y0 = -s * r0 * Math.cos(a0);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = x0 + (i / n - 0.5) * SPAN;
        const y = y0 - (j / n - 0.5) * SPAN;
        const r = Math.hypot(x, y);
        at(s * (90 - r), (Math.atan2(x, -s * y) * 180) / Math.PI, out.data, (j * n + i) * 4);
      }
  } else {
    const at = band(img, t.lat + SPAN, t.lat - SPAN);
    const wide = SPAN / Math.max(0.2, Math.cos((t.lat * Math.PI) / 180));
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) at(t.lat + (0.5 - j / n) * SPAN, t.lon + (i / n - 0.5) * wide, out.data, (j * n + i) * 4);
  }
  stretch(out.data);
  ctx.putImageData(out, 0, 0);
  ctx.save();
  // Subtle optical vignette gives each orbital crop clean instrument framing.
  const vig = ctx.createRadialGradient(n / 2, n / 2, n * 0.34, n / 2, n / 2, n * 0.74);
  vig.addColorStop(0, "rgba(2, 7, 10, 0)");
  vig.addColorStop(1, "rgba(2, 7, 10, 0.36)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, n, n);

  const cx = n / 2;
  const cy = n / 2;
  const r = n * 0.115;
  const t0 = r + n * 0.035;
  const t1 = r + n * 0.09;
  const trace = () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - t0);
    ctx.lineTo(cx, cy - t1);
    ctx.moveTo(cx, cy + t0);
    ctx.lineTo(cx, cy + t1);
    ctx.moveTo(cx - t0, cy);
    ctx.lineTo(cx - t1, cy);
    ctx.moveTo(cx + t0, cy);
    ctx.lineTo(cx + t1, cy);
    ctx.stroke();
  };
  ctx.lineCap = "round";
  ctx.lineWidth = n / 38;
  ctx.strokeStyle = "rgba(2, 7, 10, 0.76)";
  trace();
  ctx.lineWidth = n / 68;
  ctx.strokeStyle = "#5bbbe9";
  trace();
  ctx.restore();
}

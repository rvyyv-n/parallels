import * as THREE from "three";
import { reduced } from "./format";

export interface Spot {
  lat: number;
  lon: number;
}

export interface TargetGlobe {
  show(texture: string, site: Spot, others: Spot[]): void;
  point(): { x: number; y: number } | null;
  dispose(): void;
}

const R = 1;
const rad = (d: number) => (d * Math.PI) / 180;

function onSphere(lat: number, lon: number, r = R) {
  const a = rad(lat);
  const b = rad(lon);
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r);
}

function ring(lat: number, r: number) {
  const pts = Array.from({ length: 181 }, (_, i) => onSphere(lat, i * 2, r));
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function createTargetGlobe(el: HTMLElement, onMove: () => void): TargetGlobe {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 4.6);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 1.2, 2.2);
  scene.add(sun);

  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), mat));
  const lines = new THREE.Group();
  spin.add(lines);
  const signal = new THREE.LineBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.9 });
  const faint = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 });
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 48), new THREE.MeshBasicMaterial({ color: 0x4fd8ff, side: THREE.DoubleSide }));
  spin.add(marker);
  const dots = new THREE.Group();
  spin.add(dots);

  const loader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  let site: Spot = { lat: 0, lon: 0 };
  let cur = { x: 0, y: 0 };
  let goal = { x: 0, y: 0 };
  let from = { x: 0, y: 0 };
  let t0 = 0;
  let raf = 0;

  const size = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    render();
  };
  const render = () => {
    tilt.rotation.x = cur.x;
    spin.rotation.y = cur.y;
    renderer.render(scene, camera);
    onMove();
  };
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / 1200);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    cur = { x: from.x + (goal.x - from.x) * e, y: from.y + (goal.y - from.y) * e };
    render();
    if (t < 1) raf = requestAnimationFrame(step);
  };
  new ResizeObserver(size).observe(el);

  return {
    show(texture, s, others) {
      site = s;
      let tex = textures.get(texture);
      if (!tex) {
        tex = loader.load(texture, render);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        textures.set(texture, tex);
      }
      mat.map = tex;
      mat.needsUpdate = true;
      lines.clear();
      for (const lat of [-60, -30, 0, 30, 60]) lines.add(new THREE.Line(ring(lat, 1.002), faint));
      lines.add(new THREE.Line(ring(s.lat, 1.004), signal));
      dots.clear();
      for (const o of others) {
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        d.position.copy(onSphere(o.lat, o.lon, 1.003));
        d.lookAt(onSphere(o.lat, o.lon, 2));
        dots.add(d);
      }
      marker.position.copy(onSphere(s.lat, s.lon, 1.005));
      marker.lookAt(onSphere(s.lat, s.lon, 2));
      const lift = s.lat < -70 || s.lat > 70 ? Math.sign(s.lat) * 0.18 : 0;
      goal = { x: rad(s.lat) - lift, y: -Math.PI / 2 - rad(s.lon) };
      const turn = goal.y - cur.y;
      goal.y = cur.y + (((turn + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      cancelAnimationFrame(raf);
      if (reduced() || !t0) {
        cur = goal;
        t0 = 1;
        size();
        return;
      }
      from = { ...cur };
      t0 = performance.now();
      raf = requestAnimationFrame(step);
    },
    point() {
      const v = onSphere(site.lat, site.lon, 1.005);
      spin.updateMatrixWorld();
      v.applyMatrix4(spin.matrixWorld).project(camera);
      const r = el.getBoundingClientRect();
      if (!r.width) return null;
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
    },
  };
}

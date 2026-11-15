import * as THREE from "three";
import { reduced } from "./format";
import { onSphere, type Spot } from "./intro";

export interface Planet {
  sites(spots: Spot[]): void;
  focus(i: number): void;
  pause(on: boolean): void;
}

const SIGNAL = 0x5bbbe9;
const rad = (d: number) => (d * Math.PI) / 180;
const DIST = 1 / Math.sin(rad(15)) / 0.9;

const aim = (s: Spot) => ({ x: rad(s.lat) * (Math.abs(s.lat) > 60 ? 0.9 : 0.8), y: -Math.PI / 2 - rad(s.lon) });

function stick(mesh: THREE.Object3D, s: Spot, r: number) {
  const up = onSphere(s.lat, s.lon, 1);
  mesh.position.copy(up).multiplyScalar(r);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
  return mesh;
}

export function createPlanet(el: HTMLElement, textures: [string, string], flat: number): Planet {
  const still = reduced();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const big = renderer.capabilities.maxTextureSize;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, DIST);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));
  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(-4, 2.4, 5);
  scene.add(sun);

  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x000000, emissive: flat, emissiveIntensity: 0.5 });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat));
  const loader = new THREE.TextureLoader();
  const use = (tex: THREE.Texture) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const old = mat.map;
    mat.map = tex;
    mat.color.setScalar(1);
    mat.emissiveIntensity = 0;
    mat.needsUpdate = true;
    old?.dispose();
    run();
  };
  loader.load(textures[0], (tex) => {
    use(tex);
    if (big >= 8192 && memory >= 4) loader.load(textures[1], use, undefined, () => {});
  });

  const dots = new THREE.Group();
  spin.add(dots);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
  const dotGeo = new THREE.CircleGeometry(0.008, 16);
  const ringMat = new THREE.MeshBasicMaterial({ color: SIGNAL, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const haloMat = new THREE.MeshBasicMaterial({ color: SIGNAL, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.03, 48), ringMat);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.036, 0.039, 48), haloMat);
  spin.add(marker, halo);

  let spots: Spot[] = [];
  const cur = { x: 0, y: 0 };
  const goal = { x: 0, y: 0 };
  let lit = 0;
  let placed = false;
  let seen = true;
  let paused = false;
  let raf = 0;
  let last = 0;

  const size = () => {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w < h ? DIST / camera.aspect : DIST;
    camera.updateProjectionMatrix();
  };

  const frame = (now: number) => {
    raf = 0;
    if (!seen || paused) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const f = still ? 1 : 1 - Math.exp(-dt * 5);
    cur.x += (goal.x - cur.x) * f;
    cur.y += (goal.y - cur.y) * f;
    lit += (1 - lit) * (still ? 1 : 1 - Math.exp(-dt * 6));
    tilt.rotation.x = cur.x;
    spin.rotation.y = cur.y;
    ringMat.opacity = 0.95 * lit;
    haloMat.opacity = 0.5 * lit;
    renderer.render(scene, camera);
    if (Math.abs(goal.x - cur.x) + Math.abs(goal.y - cur.y) > 1e-4 || lit < 0.999) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  function run() {
    if (!raf && seen && !paused) raf = requestAnimationFrame(frame);
  }

  new ResizeObserver(() => {
    size();
    renderer.render(scene, camera);
    run();
  }).observe(el);
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    last = 0;
    run();
  }).observe(el);
  size();

  return {
    sites(list) {
      spots = list;
      dots.clear();
      for (const s of list) dots.add(stick(new THREE.Mesh(dotGeo, dotMat), s, 1.003));
    },
    focus(i) {
      const s = spots[i];
      if (!s) return;
      stick(marker, s, 1.005);
      stick(halo, s, 1.005);
      const to = aim(s);
      const d = to.y - cur.y;
      goal.x = to.x;
      goal.y = cur.y + ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
      if (!placed) {
        placed = true;
        cur.x = goal.x;
        cur.y = goal.y;
      }
      lit = 0;
      run();
    },
    pause(on) {
      paused = on;
      last = 0;
      run();
    },
  };
}

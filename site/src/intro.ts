import * as THREE from "three";
import { reduced } from "./format";

export interface Spot {
  lat: number;
  lon: number;
}

export type World = "moon" | "mars";

export interface Intro {
  target(world: World, site: Spot): void;
  matches(spots: Spot[]): void;
  enter(): Promise<void>;
}

interface Globe {
  tilt: THREE.Group;
  spin: THREE.Group;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  r: number;
  cur: { x: number; y: number };
  goal: { x: number; y: number };
  size: number;
  sizeGoal: number;
  light: number;
  lightGoal: number;
  sway: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const SIGNAL = 0x4fd8ff;
const ARC = 48;

function onSphere(lat: number, lon: number, r: number) {
  const a = rad(lat);
  const b = rad(lon);
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r);
}

function ring(lat: number, r: number) {
  return new THREE.BufferGeometry().setFromPoints(Array.from({ length: 181 }, (_, i) => onSphere(lat, i * 2, r)));
}

function facing(s: Spot, share: number) {
  const lift = Math.abs(s.lat) > 70 ? Math.sign(s.lat) * 0.2 : 0;
  return { x: (rad(s.lat) - lift) * share, y: -Math.PI / 2 - rad(s.lon) };
}

function stars() {
  const n = 1100;
  const pos = new Float32Array(n * 3);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const k = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * k * 60, u * 60, Math.sin(a) * k * 60], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0 }));
}

function glow(r: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { k: { value: 0 } },
    vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float k; varying vec3 n; void main(){ float i = pow(max(0.0, 0.74 - dot(n, vec3(0.0, 0.0, 1.0))), 3.0); gl_FragColor = vec4(0.31, 0.68, 1.0, 1.0) * i * k * 0.75; }",
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return { mesh: new THREE.Mesh(new THREE.SphereGeometry(r * 1.09, 64, 48), mat), mat };
}

export function createIntro(el: HTMLElement, textures: { earth: string; moon: string; mars: string }, on: { world(w: World): void; earth(): void }): Intro {
  const still = reduced();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(-5, 2.5, 6);
  scene.add(sun);
  const sky = stars();
  scene.add(sky);

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  const globe = (r: number, at: [number, number, number], flat: number, url: string): Globe => {
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    tilt.position.set(...at);
    scene.add(tilt);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x000000, emissive: flat, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 128, 96), mat);
    spin.add(mesh);
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex;
      mat.needsUpdate = true;
      loaded++;
    });
    return { tilt, spin, mesh, mat, r, cur: { x: 0.25, y: -2.2 }, goal: { x: 0.25, y: -2.2 }, size: 1, sizeGoal: 1, light: 1, lightGoal: 1, sway: 0.2 };
  };
  const earth = globe(1.5, [-1.7, 0, 0], 0x3f7fd6, textures.earth);
  const worlds: Record<World, Globe> = {
    moon: globe(0.56, [2.35, 1.08, 0], 0xd3d0c8, textures.moon),
    mars: globe(0.62, [2.35, -1.08, 0], 0xc4471f, textures.mars),
  };
  const air = glow(earth.r);
  earth.tilt.add(air.mesh);

  const line = new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.95 });
  const faint = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  for (const g of [earth, worlds.moon, worlds.mars]) for (const lat of [-60, -30, 0, 30, 60]) g.spin.add(new THREE.Line(ring(lat, g.r * 1.002), faint));
  const earthRing = new THREE.Line(ring(0, earth.r * 1.005), line);
  earth.spin.add(earthRing);
  const worldRing = new THREE.Line(ring(0, 1), line);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.075, 48), new THREE.MeshBasicMaterial({ color: SIGNAL, side: THREE.DoubleSide }));
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ARC + 1) * 3), 3));
  const arc = new THREE.Line(arcGeo, line);
  arc.frustumCulled = false;
  scene.add(arc);
  const dots = new THREE.Group();
  earth.spin.add(dots);

  let world: World = "moon";
  let site: Spot = { lat: 0, lon: 0 };
  let ringLat = 0;
  let drawn = 0;
  let hover: World | "earth" | null = null;
  let dive = 0;
  let diveGoal = 0;
  let px = 0;
  let py = 0;
  let seen = true;
  let t0 = 0;
  let last = 0;
  let raf = 0;
  let fit = 12;

  const size = () => {
    const w = el.clientWidth;
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const k = Math.tan(rad(15));
    fit = Math.max(2.25 / k, 3.75 / (k * camera.aspect));
    camera.updateProjectionMatrix();
  };

  const turn = (g: Globe, to: { x: number; y: number }) => {
    const d = to.y - g.cur.y;
    g.goal = { x: to.x, y: g.cur.y + ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI };
  };

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  const frame = (now: number) => {
    raf = 0;
    if (!seen) return;
    if (!t0) t0 = last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = still ? 99 : (now - t0) / 1000;
    const show = loaded >= 3 || t > 4 ? 1 : 0;
    const p = still ? show : ease(clamp((t - 0.5) / 1.5)) * show;
    const q = still ? 1 : ease(clamp((t - 1.5) / 1.1));
    const f = still ? 1 : 1 - Math.exp(-dt * 3.2);
    drawn += (q - drawn) * (still ? 1 : 1 - Math.exp(-dt * 5));
    dive += (diveGoal - dive) * (still ? 1 : 1 - Math.exp(-dt * 4));

    for (const [id, g] of [["earth", earth], ["moon", worlds.moon], ["mars", worlds.mars]] as const) {
      g.cur.x += (g.goal.x - g.cur.x) * f;
      g.cur.y += (g.goal.y - g.cur.y) * f;
      g.size += (g.sizeGoal * (hover === id && id !== "earth" ? 1.07 : 1) - g.size) * f;
      g.light += (g.lightGoal - g.light) * f;
      g.tilt.rotation.x = g.cur.x;
      g.spin.rotation.y = g.cur.y + (still ? 0 : Math.sin(t * 0.22 + g.r * 9) * g.sway);
      g.tilt.scale.setScalar(g.size);
      g.mat.color.setScalar(p * g.light);
      g.mat.emissiveIntensity = (1 - p) * (0.55 + 0.45 * g.light);
    }
    air.mat.uniforms.k.value = p;
    faint.opacity = 0.13 * p;
    (sky.material as THREE.PointsMaterial).opacity = 0.75 * p;
    line.opacity = 0.95 * (drawn > 0.01 ? 1 : 0);
    marker.visible = drawn > 0.9;
    dots.visible = p > 0.9;
    earthRing.geometry.setDrawRange(0, Math.round(181 * drawn));
    worldRing.geometry.setDrawRange(0, Math.round(181 * drawn));

    const g = worlds[world];
    earth.tilt.updateMatrixWorld();
    g.tilt.updateMatrixWorld();
    a.copy(onSphere(ringLat, -38, earth.r * 1.005)).applyMatrix4(earth.tilt.matrixWorld);
    b.copy(onSphere(site.lat, site.lon, g.r * 1.01)).applyMatrix4(g.spin.matrixWorld);
    c.copy(a).add(b).multiplyScalar(0.5);
    c.z += 1.6;
    c.y += (b.y - a.y) * 0.25;
    const pos = arcGeo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i <= ARC; i++) {
      const s = i / ARC;
      v.set(0, 0, 0)
        .addScaledVector(a, (1 - s) * (1 - s))
        .addScaledVector(c, 2 * s * (1 - s))
        .addScaledVector(b, s * s);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    arcGeo.setDrawRange(0, Math.round((ARC + 1) * clamp(drawn * 1.6 - 0.6)));

    const start = still ? 1 : 1 + 0.4 * (1 - ease(clamp(t / 2.2)));
    const d = fit * start * (1 - 0.62 * dive);
    const cx = 0.2 + (earth.tilt.position.x - 0.2) * dive;
    camera.position.set(cx + (still ? 0 : px * 0.5), still ? 0 : py * 0.35, d);
    camera.lookAt(cx, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (!raf && seen) raf = requestAnimationFrame(frame);
  };

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const hit = (e: PointerEvent | MouseEvent): World | "earth" | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects([earth.mesh, worlds.moon.mesh, worlds.mars.mesh], false)[0]?.object;
    return h === worlds.moon.mesh ? "moon" : h === worlds.mars.mesh ? "mars" : h === earth.mesh ? "earth" : null;
  };
  renderer.domElement.addEventListener("pointermove", (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
    hover = hit(e);
    renderer.domElement.style.cursor = hover ? "pointer" : "";
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    hover = null;
    px = py = 0;
  });
  renderer.domElement.addEventListener("click", (e) => {
    const h = hit(e);
    if (h === "earth") on.earth();
    else if (h) on.world(h);
  });

  new ResizeObserver(() => {
    size();
    run();
  }).observe(el);
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    if (!seen) diveGoal = dive = 0;
    last = performance.now();
    run();
  }).observe(el);
  size();
  run();

  return {
    target(w, s) {
      world = w;
      site = s;
      ringLat = Math.max(-80, Math.min(80, s.lat));
      const g = worlds[w];
      for (const id of ["moon", "mars"] as const) {
        worlds[id].sizeGoal = id === w ? 1 : 0.72;
        worlds[id].lightGoal = id === w ? 1 : 0.4;
        worlds[id].sway = id === w ? 0.1 : 0.5;
      }
      turn(g, facing(s, 0.8));
      earthRing.geometry.dispose();
      earthRing.geometry = ring(ringLat, earth.r * 1.005);
      worldRing.geometry.dispose();
      worldRing.geometry = ring(ringLat, g.r * 1.008);
      g.spin.add(worldRing);
      marker.scale.setScalar(g.r);
      marker.position.copy(onSphere(s.lat, s.lon, g.r * 1.012));
      marker.lookAt(onSphere(s.lat, s.lon, g.r * 3));
      g.spin.add(marker);
      drawn = 0;
      run();
    },
    matches(spots) {
      dots.clear();
      spots.forEach((s, i) => {
        const d = new THREE.Mesh(
          i ? new THREE.CircleGeometry(0.02, 20) : new THREE.RingGeometry(0.035, 0.055, 40),
          new THREE.MeshBasicMaterial({ color: i ? 0xffffff : SIGNAL, side: THREE.DoubleSide }),
        );
        d.position.copy(onSphere(s.lat, s.lon, earth.r * 1.008));
        d.lookAt(onSphere(s.lat, s.lon, earth.r * 3));
        dots.add(d);
      });
      if (spots[0]) turn(earth, facing({ lat: Math.max(-55, Math.min(55, spots[0].lat)), lon: spots[0].lon - 14 }, 0.6));
      run();
    },
    enter() {
      if (still) return Promise.resolve();
      diveGoal = 1;
      run();
      return new Promise((r) => setTimeout(r, 520));
    },
  };
}

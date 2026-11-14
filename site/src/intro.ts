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
  known(spots: Spot[]): void;
  chapter(at: number): void;
  enter(): Promise<void>;
  finish(): void;
}

type Body = "earth" | World;
type Place = [number, number, number];

interface Key {
  earth: Place;
  moon: Place;
  mars: Place;
  free: number;
  tilt: number;
  link: number;
  pins: number;
  known: number;
  dim: number;
}

interface Globe {
  tilt: THREE.Group;
  spin: THREE.Group;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  cur: { x: number; y: number };
  goal: { x: number; y: number };
  r: number;
  grow: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: number, b: number, s: number) => a + (b - a) * s;
const SIGNAL = 0x4fd8ff;
const ARC = 48;
const FAR = 10;

const WIDE: Key[] = [
  { earth: [0, -2.12, 2], moon: [-0.62, 0.66, 0.085], mars: [0.66, 0.5, 0.06], free: 1, tilt: -0.62, link: 0, pins: 0, known: 0, dim: 1 },
  { earth: [0, -0.04, 0.8], moon: [-0.8, 0.62, 0.07], mars: [0.82, 0.5, 0.055], free: 1, tilt: 0.3, link: 0, pins: 0, known: 1, dim: 0.34 },
  { earth: [-1.5, -1.6, 0.5], moon: [0.66, 0.12, 1.22], mars: [1.5, 1.4, 0.1], free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 1 },
  { earth: [1.6, -1.6, 0.5], moon: [1.6, 1.4, 0.1], mars: [-0.64, -0.02, 1.26], free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 1 },
  { earth: [0.5, -0.06, 0.72], moon: [0.86, 0.66, 0.15], mars: [0.86, 0.66, 0.15], free: 0, tilt: 0.3, link: 1, pins: 0, known: 0, dim: 1 },
  { earth: [0.44, -0.04, 0.9], moon: [0.9, 0.72, 0.13], mars: [0.9, 0.72, 0.13], free: 0, tilt: 0.3, link: 1, pins: 1, known: 0, dim: 1 },
];

const TALL: Key[] = [
  { earth: [0, -1.62, 1.1], moon: [-0.55, -0.12, 0.05], mars: [0.6, -0.2, 0.036], free: 1, tilt: -0.62, link: 0, pins: 0, known: 0, dim: 1 },
  { earth: [0, -0.5, 0.36], moon: [-0.7, -0.05, 0.04], mars: [0.72, -0.12, 0.03], free: 1, tilt: 0.3, link: 0, pins: 0, known: 1, dim: 0.7 },
  { earth: [-2, -1.6, 0.3], moon: [0.5, -0.62, 0.52], mars: [2, 1.4, 0.05], free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 0.75 },
  { earth: [2, -1.6, 0.3], moon: [2, 1.4, 0.05], mars: [-0.5, -0.62, 0.52], free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 0.75 },
  { earth: [0, -0.6, 0.34], moon: [0.66, -0.2, 0.07], mars: [0.66, -0.2, 0.07], free: 0, tilt: 0.3, link: 1, pins: 0, known: 0, dim: 0.8 },
  { earth: [0, -0.55, 0.4], moon: [0.68, -0.14, 0.06], mars: [0.68, -0.14, 0.06], free: 0, tilt: 0.3, link: 1, pins: 1, known: 0, dim: 1 },
];

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
  const n = 1400;
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

function glow(tint: [number, number, number], reach: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { k: { value: 0 }, c: { value: new THREE.Vector3(...tint) } },
    vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float k; uniform vec3 c; varying vec3 n; void main(){ float i = pow(max(0.0, 0.74 - dot(n, vec3(0.0, 0.0, 1.0))), 3.0); gl_FragColor = vec4(c, 1.0) * i * k; }",
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return { mesh: new THREE.Mesh(new THREE.SphereGeometry(reach, 64, 48), mat), mat };
}

export function createIntro(
  el: HTMLElement,
  textures: { earth: string; moon: string; mars: string },
  homes: Record<World, Spot>,
  on: { world(w: World): void; earth(): void },
): Intro {
  const still = reduced();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-5, 3.2, 5.5);
  scene.add(sun);
  const sky = stars();
  scene.add(sky);

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  const globe = (flat: number, url: string, face: { x: number; y: number }): Globe => {
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x000000, emissive: flat, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), mat);
    spin.add(mesh);
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = tex;
      mat.needsUpdate = true;
      loaded++;
    });
    return { tilt, spin, mesh, mat, cur: { ...face }, goal: { ...face }, r: 1, grow: 1 };
  };
  const earth = globe(0x3f7fd6, textures.earth, { x: 0.3, y: -2.2 });
  const worlds: Record<World, Globe> = {
    moon: globe(0xd3d0c8, textures.moon, facing(homes.moon, 0.8)),
    mars: globe(0xc4471f, textures.mars, facing(homes.mars, 0.8)),
  };
  const bodies: [Body, Globe][] = [
    ["earth", earth],
    ["moon", worlds.moon],
    ["mars", worlds.mars],
  ];
  const air = glow([0.31, 0.68, 1], 1.09);
  earth.tilt.add(air.mesh);
  const haze = glow([1, 0.42, 0.2], 1.05);
  worlds.mars.tilt.add(haze.mesh);

  const line = new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.95 });
  const join = new THREE.LineBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0 });
  const faint = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  for (const [, g] of bodies) for (const lat of [-60, -30, 0, 30, 60]) g.spin.add(new THREE.Line(ring(lat, 1.002), faint));
  const earthRing = new THREE.Line(ring(0, 1.004), line);
  earth.spin.add(earthRing);
  const worldRing = new THREE.Line(ring(0, 1.008), line);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.034, 0.046, 48), new THREE.MeshBasicMaterial({ color: SIGNAL, side: THREE.DoubleSide }));
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((ARC + 1) * 3), 3));
  const arc = new THREE.Line(arcGeo, join);
  arc.frustumCulled = false;
  scene.add(arc);
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const bestMat = new THREE.MeshBasicMaterial({ color: SIGNAL, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const knownMat = new THREE.MeshBasicMaterial({ color: 0xffc24a, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const pins = new THREE.Group();
  const olds = new THREE.Group();
  earth.spin.add(pins, olds);

  let world: World = "moon";
  let site: Spot = homes.moon;
  let ringLat = 0;
  let drawn = 0;
  let hover: Body | null = null;
  let dive = 0;
  let diveGoal = 0;
  let px = 0;
  let py = 0;
  let seen = true;
  let t0 = 0;
  let last = 0;
  let raf = 0;
  let hh = 1;
  let hw = 1;
  let keys = WIDE;
  let at = 0;
  let atGoal = 0;

  const size = () => {
    const w = el.clientWidth;
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    hh = FAR * Math.tan(rad(15));
    hw = hh * camera.aspect;
    keys = camera.aspect < 0.9 ? TALL : WIDE;
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
    const p = still ? show : ease(clamp((t - 0.3) / 1.4)) * show;
    const q = still ? 1 : ease(clamp((t - 1.2) / 1.1));
    const f = still ? 1 : 1 - Math.exp(-dt * 3.2);
    drawn += (q - drawn) * (still ? 1 : 1 - Math.exp(-dt * 5));
    dive += (diveGoal - dive) * (still ? 1 : 1 - Math.exp(-dt * 4));
    at = still ? Math.round(atGoal) : at + (atGoal - at) * (1 - Math.exp(-dt * 7));

    const i = Math.max(0, Math.min(keys.length - 2, Math.floor(at)));
    const s = ease(clamp((at - i - 0.18) / 0.64));
    const k0 = keys[i];
    const k1 = keys[i + 1];
    const val = (n: "free" | "tilt" | "link" | "pins" | "known" | "dim") => mix(k0[n], k1[n], s);
    const free = val("free");
    const dim = val("dim");
    const rise = still ? 0 : (1 - ease(clamp(t / 2.4))) * 0.5;

    for (const [id, g] of bodies) {
      const from = k0[id];
      const to = k1[id];
      g.cur.x += (g.goal.x - g.cur.x) * f;
      g.cur.y += (g.goal.y - g.cur.y) * f;
      g.grow += ((hover === id && id !== "earth" ? 1.06 : 1) - g.grow) * f;
      g.r = mix(from[2], to[2], s) * hh * g.grow;
      g.tilt.position.set(mix(from[0], to[0], s) * hw, mix(from[1], to[1], s) * hh - (id === "earth" ? rise * hh : 0), 0);
      g.tilt.scale.setScalar(g.r);
      const drift = still ? 0 : id === "earth" ? t * 0.035 * free : Math.sin(t * 0.2 + (id === "moon" ? 1 : 4)) * (id === world ? 0.06 : 0.3);
      g.tilt.rotation.x = id === "earth" ? mix(g.cur.x, val("tilt"), free) : g.cur.x;
      g.spin.rotation.y = g.cur.y + drift;
      const lit = id === "earth" ? dim : id === world || at < 3.5 ? 1 : 0.4;
      g.mat.color.setScalar(p * lit);
      g.mat.emissiveIntensity = (1 - p) * 0.8;
    }
    air.mat.uniforms.k.value = p * 0.75 * dim;
    haze.mat.uniforms.k.value = p * 0.35;
    faint.opacity = 0.12 * p;
    (sky.material as THREE.PointsMaterial).opacity = 0.75 * p;
    line.opacity = 0.95 * (drawn > 0.01 ? 1 : 0) * p;
    marker.visible = drawn > 0.9;
    earthRing.geometry.setDrawRange(0, Math.round(181 * drawn));
    worldRing.geometry.setDrawRange(0, Math.round(181 * drawn));
    pinMat.opacity = bestMat.opacity = val("pins") * p;
    knownMat.opacity = val("known") * p * 0.95;
    pins.visible = pinMat.opacity > 0.01;
    olds.visible = knownMat.opacity > 0.01;

    const g = worlds[world];
    const link = val("link") * p * clamp(drawn * 1.6 - 0.6);
    join.opacity = 0.95 * (link > 0.01 ? 1 : 0);
    arc.visible = link > 0.01;
    if (arc.visible) {
      earth.tilt.updateMatrixWorld();
      g.tilt.updateMatrixWorld();
      a.copy(onSphere(ringLat, -38, 1.004)).applyMatrix4(earth.tilt.matrixWorld);
      b.copy(onSphere(site.lat, site.lon, 1.01)).applyMatrix4(g.spin.matrixWorld);
      c.copy(a).add(b).multiplyScalar(0.5);
      c.z += 1.2;
      c.y += (b.y - a.y) * 0.25;
      const pos = arcGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let n = 0; n <= ARC; n++) {
        const u = n / ARC;
        v.set(0, 0, 0)
          .addScaledVector(a, (1 - u) * (1 - u))
          .addScaledVector(c, 2 * u * (1 - u))
          .addScaledVector(b, u * u);
        pos.setXYZ(n, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      arcGeo.setDrawRange(0, Math.round((ARC + 1) * link));
    }

    const e = earth.tilt.position;
    camera.position.set(e.x * dive + (still ? 0 : px * 0.18), e.y * dive + (still ? 0 : -py * 0.12), FAR * (1 - 0.5 * dive));
    camera.lookAt(e.x * dive, e.y * dive, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (!raf && seen) raf = requestAnimationFrame(frame);
  };

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const hit = (e: PointerEvent | MouseEvent): Body | null => {
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

  const dot = (s: Spot, shape: THREE.BufferGeometry, mat: THREE.Material) => {
    const d = new THREE.Mesh(shape, mat);
    d.position.copy(onSphere(s.lat, s.lon, 1.006));
    d.lookAt(onSphere(s.lat, s.lon, 3));
    return d;
  };
  const small = new THREE.CircleGeometry(0.012, 16);
  const mid = new THREE.CircleGeometry(0.016, 20);
  const best = new THREE.RingGeometry(0.03, 0.046, 40);

  return {
    target(w, s) {
      world = w;
      site = s;
      ringLat = Math.max(-80, Math.min(80, s.lat));
      const g = worlds[w];
      const side = w === "moon" ? 0.45 : -0.45;
      const to = facing(s, 0.8);
      turn(g, { x: to.x, y: to.y + side });
      earthRing.geometry.dispose();
      earthRing.geometry = ring(ringLat, 1.004);
      worldRing.geometry.dispose();
      worldRing.geometry = ring(ringLat, 1.008);
      g.spin.add(worldRing);
      marker.position.copy(onSphere(s.lat, s.lon, 1.012));
      marker.lookAt(onSphere(s.lat, s.lon, 3));
      g.spin.add(marker);
      drawn = 0;
      run();
    },
    matches(spots) {
      pins.clear();
      spots.forEach((s, n) => pins.add(dot(s, n ? mid : best, n ? pinMat : bestMat)));
      if (spots[0]) turn(earth, facing({ lat: Math.max(-55, Math.min(55, spots[0].lat)), lon: spots[0].lon - 8 }, 0.6));
      run();
    },
    known(spots) {
      olds.clear();
      for (const s of spots) olds.add(dot(s, small, knownMat));
      run();
    },
    chapter(n) {
      atGoal = Math.max(0, Math.min(keys.length - 1, n));
      run();
    },
    enter() {
      if (still) return Promise.resolve();
      diveGoal = 1;
      run();
      return new Promise((r) => setTimeout(r, 520));
    },
    finish() {
      const now = performance.now();
      t0 = now - 60000;
      last = now;
      drawn = 1;
      at = atGoal;
      for (const [, g] of bodies) g.cur = { ...g.goal };
      run();
    },
  };
}

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
// The Moon and Mars share one orbit, like two moons on a wheel facing the viewer: [x, y, front radius, turn, weight, distance].
// turn 0 puts the Moon in front, 1 puts Mars in front, -1 puts the chosen world in front. weight 0 ignores the orbit and uses the Place values.
type Orbit = [number, number, number, number, number, number];

interface Key {
  earth: Place;
  moon: Place;
  mars: Place;
  orb: Orbit;
  lon: number;
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

export interface Textures {
  earth: [string, string?];
  moon: [string, string?];
  mars: [string, string?];
}

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, s: number) => a + (b - a) * s;
// Palette: accent #0297DE. Thin lines drawn over the globes use a lighter tint of it so they stay visible on blue oceans.
const SIGNAL = 0x5bbbe9;
const MARS = 0xfc734d;
const ARC = 48;
const FAR = 10;
// Away from the orbit each body sits at its own depth, so overlapping bodies hide each other cleanly. Positions are corrected so the layout on screen is unchanged.
const DEPTH: Record<Body, number> = { earth: -3, moon: 0.8, mars: 0.4 };
const TAN = Math.tan(rad(15));
// Sharper textures need a GPU that can hold them comfortably; older GPUs keep the lighter copies.
const NEED: Record<Body, number> = { earth: 16384, moon: 8192, mars: 8192 };

// x and y are fractions of the half-width and half-height of the view; the third value is the radius as a fraction of the half-height.
// After the opening, chapter text sits on the left and the bodies on the right. Scrolling from the Moon to Mars turns the shared orbit, so the Moon
// swings up and back while Mars rises to the front. In the last two chapters the orbit shrinks into the corner with the chosen world in front.
// The Earth faces land (lon) while it turns freely.
const WIDE: Key[] = [
  { earth: [0, -2.24, 2], moon: [-0.62, 0.66, 0.085], mars: [0.66, 0.5, 0.06], orb: [0.58, 0.02, 0.94, 0, 0, 6], lon: 62, free: 1, tilt: -0.62, link: 0, pins: 0, known: 0, dim: 1 },
  { earth: [0, -0.04, 0.8], moon: [0.62, 0.7, 0.075], mars: [0.84, 0.52, 0.055], orb: [0.58, 0.02, 0.94, 0, 0, 6], lon: -72, free: 1, tilt: 0.3, link: 0, pins: 0, known: 1, dim: 0.34 },
  { earth: [0.95, -1.45, 0.5], moon: [0.58, 0.02, 0.94], mars: [0.58, 0.02, 0.6], orb: [0.58, 0.02, 0.94, 0, 1, 6], lon: -72, free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 0.8 },
  { earth: [0.95, -1.45, 0.5], moon: [0.58, 0.02, 0.6], mars: [0.58, 0.02, 0.94], orb: [0.58, 0.02, 0.94, 1, 1, 6], lon: -72, free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 0.8 },
  { earth: [0.5, -0.08, 0.7], moon: [0.9, 0.7, 0.14], mars: [0.9, 0.7, 0.14], orb: [0.9, 0.7, 0.14, -1, 1, 9], lon: -72, free: 0, tilt: 0.3, link: 1, pins: 0, known: 0, dim: 1 },
  { earth: [0.44, -0.06, 0.88], moon: [0.92, 0.74, 0.12], mars: [0.92, 0.74, 0.12], orb: [0.92, 0.74, 0.12, -1, 1, 9], lon: -72, free: 0, tilt: 0.3, link: 1, pins: 1, known: 0, dim: 1 },
];

const TALL: Key[] = [
  { earth: [0, -1.62, 1.1], moon: [-0.55, -0.12, 0.05], mars: [0.6, -0.2, 0.036], orb: [0, -0.6, 0.42, 0, 0, 6], lon: 62, free: 1, tilt: -0.62, link: 0, pins: 0, known: 0, dim: 1 },
  { earth: [0, -0.5, 0.36], moon: [-0.7, -0.05, 0.04], mars: [0.72, -0.12, 0.03], orb: [0, -0.6, 0.42, 0, 0, 6], lon: -72, free: 1, tilt: 0.3, link: 0, pins: 0, known: 1, dim: 0.7 },
  { earth: [1.2, -1.3, 0.36], moon: [0, -0.6, 0.42], mars: [0, -0.6, 0.3], orb: [0, -0.6, 0.42, 0, 1, 6], lon: -72, free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 0.8 },
  { earth: [1.2, -1.3, 0.36], moon: [0, -0.6, 0.3], mars: [0, -0.6, 0.42], orb: [0, -0.6, 0.42, 1, 1, 6], lon: -72, free: 1, tilt: 0.3, link: 0, pins: 0, known: 0, dim: 0.8 },
  { earth: [0, -0.6, 0.34], moon: [0.66, -0.2, 0.07], mars: [0.66, -0.2, 0.07], orb: [0.66, -0.2, 0.07, -1, 1, 9], lon: -72, free: 0, tilt: 0.3, link: 1, pins: 0, known: 0, dim: 0.8 },
  { earth: [0, -0.55, 0.4], moon: [0.68, -0.14, 0.06], mars: [0.68, -0.14, 0.06], orb: [0.68, -0.14, 0.06, -1, 1, 9], lon: -72, free: 0, tilt: 0.3, link: 1, pins: 1, known: 0, dim: 1 },
];

const wrap = (d: number) => ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

export function onSphere(lat: number, lon: number, r: number) {
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
  textures: Textures,
  homes: Record<World, Spot>,
  on: { world(w: World): void; earth(): void },
): Intro {
  const still = reduced();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const big = renderer.capabilities.maxTextureSize;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  let ratio = Math.min(devicePixelRatio, big >= 16384 ? 2 : 1.5);
  renderer.setPixelRatio(ratio);
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
  // Draw the light copy first so the globe appears quickly, then swap in the sharp copy when the GPU can hold it.
  const paint = (id: Body, mat: THREE.MeshStandardMaterial) => {
    const [lo, hi] = textures[id];
    const use = (tex: THREE.Texture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const old = mat.map;
      mat.map = tex;
      mat.needsUpdate = true;
      old?.dispose();
    };
    loader.load(
      lo,
      (tex) => {
        use(tex);
        loaded++;
        if (hi && big >= NEED[id] && memory >= 4) loader.load(hi, use, undefined, () => {});
      },
      undefined,
      () => loaded++,
    );
  };
  const globe = (id: Body, flat: number, face: { x: number; y: number }): Globe => {
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x000000, emissive: flat, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), mat);
    spin.add(mesh);
    paint(id, mat);
    return { tilt, spin, mesh, mat, cur: { ...face }, goal: { ...face }, r: 1, grow: 1 };
  };
  const earth = globe("earth", 0x0297de, { x: 0.3, y: -2.2 });
  const worlds: Record<World, Globe> = {
    moon: globe("moon", 0xd3d0c8, facing(homes.moon, 0.8)),
    mars: globe("mars", MARS, facing(homes.mars, 0.8)),
  };
  const bodies: [Body, Globe][] = [
    ["earth", earth],
    ["moon", worlds.moon],
    ["mars", worlds.mars],
  ];
  const haze = glow([0.99, 0.45, 0.3], 1.05);
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
  let frames = 0;
  let pick = 2;
  let spent = 0;

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
  const eye = new THREE.Vector3(0, 0, FAR);
  const ou = new THREE.Vector3();
  const ow = new THREE.Vector3();
  const op = new THREE.Vector3();
  // Place a world on the shared orbit. The orbit's axis runs along the line of sight to (x, y), so the world at the back hides exactly behind the one in front,
  // and the orbit radius is larger than the worlds, so the two never touch while they swap.
  const onOrbit = (o: number[], theta: number) => {
    const rho = o[2] * TAN * o[5];
    const R = rho * 1.3;
    ou.set(o[0] * hw, o[1] * hh, 0).sub(eye).normalize();
    ow.set(0, 1, 0).addScaledVector(ou, -ou.y).normalize();
    op.copy(eye)
      .addScaledVector(ou, o[5] + R - R * Math.cos(theta))
      .addScaledVector(ow, R * Math.sin(theta));
    return rho;
  };
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
    at = still ? Math.round(atGoal) : at + (atGoal - at) * (1 - Math.exp(-dt * 11));
    pick = still ? (world === "moon" ? 2 : 1) : pick + ((world === "moon" ? 2 : 1) - pick) * f;

    const i = Math.max(0, Math.min(keys.length - 2, Math.floor(at)));
    const s = smooth(clamp((at - i - 0.06) / 0.88));
    const k0 = keys[i];
    const k1 = keys[i + 1];
    const val = (n: "lon" | "free" | "tilt" | "link" | "pins" | "known" | "dim") => mix(k0[n], k1[n], s);
    const free = val("free");
    const dim = val("dim");
    const turn = (o: Orbit) => (o[3] < 0 ? pick : o[3]);
    const orb = k0.orb.map((n, j) => (j === 3 ? mix(turn(k0.orb), turn(k1.orb), s) : mix(n, k1.orb[j], s)));
    const rise = still ? 0 : (1 - ease(clamp(t / 2.4))) * 0.5;

    for (const [id, g] of bodies) {
      const from = k0[id];
      const to = k1[id];
      g.cur.x += (g.goal.x - g.cur.x) * f;
      g.cur.y += (g.goal.y - g.cur.y) * f;
      g.grow += ((hover === id && id !== "earth" ? 1.06 : 1) - g.grow) * f;
      const k = (FAR - DEPTH[id]) / FAR;
      const y = mix(from[1], to[1], s) - (id === "earth" ? rise : 0);
      g.tilt.position.set(mix(from[0], to[0], s) * hw * k, y * hh * k, DEPTH[id]);
      let size = mix(from[2], to[2], s) * hh * k;
      if (id !== "earth" && orb[4] > 0) {
        const rho = onOrbit(orb, Math.PI * (orb[3] + (id === "mars" ? 1 : 0)));
        g.tilt.position.lerp(op, orb[4]);
        size = mix(size, rho, orb[4]);
      }
      g.r = size * g.grow;
      g.tilt.scale.setScalar(g.r);
      g.tilt.rotation.x = id === "earth" ? mix(g.cur.x, val("tilt"), free) : g.cur.x;
      if (id === "earth") {
        // While the Earth turns freely it faces land, with a slow sway, instead of drifting onto the dark Pacific.
        const face = -Math.PI / 2 - rad(val("lon"));
        const sway = still ? 0 : Math.sin(t * 0.12) * 0.2;
        g.spin.rotation.y = mix(g.cur.y, g.cur.y + wrap(face - g.cur.y) + sway, free);
      } else g.spin.rotation.y = g.cur.y + (still ? 0 : Math.sin(t * 0.2 + (id === "moon" ? 1 : 4)) * (id === world ? 0.06 : 0.3));
      const lit = id === "earth" ? dim : id === world || at < 3.5 ? 1 : 0.4;
      g.mat.color.setScalar(p * lit);
      g.mat.emissiveIntensity = (1 - p) * 0.8;
    }
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
    camera.position.set(e.x * dive + (still ? 0 : px * 0.18), e.y * dive + (still ? 0 : -py * 0.12), mix(FAR, e.z + (FAR - e.z) * 0.5, dive));
    camera.lookAt(e.x * dive, e.y * dive, e.z * dive);
    renderer.render(scene, camera);
    // On a slow GPU, drop to one pixel per CSS pixel after the opening settles.
    if (p >= 1 && frames < 90) {
      frames++;
      spent += dt;
      if (frames === 90 && spent / 90 > 1 / 30 && ratio > 1) {
        ratio = 1;
        renderer.setPixelRatio(1);
        size();
      }
    }
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
      // Face the ring straight out from the surface in the globe's own frame. lookAt works in world space, so it tilted the ring edge-on after the first pick.
      const up = onSphere(s.lat, s.lon, 1);
      marker.position.copy(up).multiplyScalar(1.012);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
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

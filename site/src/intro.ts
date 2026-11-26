import * as THREE from "three";
import { reduced } from "./format";

export interface Spot {
  lat: number;
  lon: number;
}

export type World = "moon" | "mars";

export interface Intro {
  sites(world: World, spots: Spot[]): void;
  target(world: World, site: Spot): void;
  known(spots: Spot[]): void;
  place(site: Spot, name: string): void;
  chapter(at: number): void;
  pause(): void;
  resume(): void;
}

type Body = "earth" | World;
type Place = [number, number, number];
// The Moon and Mars share one orbit, like two moons on a wheel facing the viewer: [x, y, front radius, turn, weight, distance].
// turn 0 puts the Moon in front, 1 puts Mars in front. weight 0 ignores the orbit and uses the Place values.
type Orbit = [number, number, number, number, number, number];

interface Key {
  earth: Place;
  moon: Place;
  mars: Place;
  orb: Orbit;
  lon: number;
  free: number;
  tilt: number;
  spot: number;
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

interface Mark {
  group: THREE.Group;
  outer: THREE.Mesh;
  ring: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
  lit: number;
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
// Palette: Titanium & Oxide solar-gold marker accent (#e5aa4c) and Mars iron-oxide (#e0623e).
const SIGNAL = 0xe5aa4c;
const AMBER = 0xe5aa4c;
const MARS = 0xe0623e;
const FAR = 10;
// Away from the orbit each body sits at its own depth, so overlapping bodies hide each other cleanly. Positions are corrected so the layout on screen is unchanged.
const DEPTH: Record<Body, number> = { earth: -3, moon: 0.8, mars: 0.4 };
const TAN = Math.tan(rad(15));
// Sharper textures need a GPU that can hold them comfortably; older GPUs keep the lighter copies.
const NEED: Record<Body, number> = { earth: 16384, moon: 8192, mars: 8192 };
const OFF: Orbit = [1.3, 1.45, 0.16, 1, 1, 9];
const OFF_TALL: Orbit = [1.5, 1.6, 0.1, 1, 1, 9];

// x and y are fractions of the half-width and half-height of the view; the third value is the radius as a fraction of the half-height.
// Chapters: opening, all of Earth's land, the Moon, Mars, known analog places, the Finder. Scrolling from the Moon to Mars turns the shared orbit,
// so the Moon swings up and back while Mars rises to the front. Then both leave the view and the Earth takes the right side, then the bottom.
const WIDE: Key[] = [
  { earth: [0, -2.18, 1.9], moon: [-0.66, 0.6, 0.082], mars: [0.68, 0.46, 0.056], orb: [0.58, 0.02, 0.94, 0, 0, 6], lon: 62, free: 1, tilt: -0.62, spot: 0, known: 0, dim: 1 },
  { earth: [0, -0.04, 0.8], moon: [0.62, 0.7, 0.075], mars: [0.84, 0.52, 0.055], orb: [0.58, 0.02, 0.94, 0, 0, 6], lon: -72, free: 1, tilt: 0.3, spot: 0, known: 1, dim: 0.34 },
  { earth: [0.95, -1.45, 0.5], moon: [0.58, 0.02, 0.94], mars: [0.58, 0.02, 0.6], orb: [0.58, 0.02, 0.94, 0, 1, 6], lon: -72, free: 1, tilt: 0.3, spot: 0, known: 0, dim: 0.8 },
  { earth: [0.95, -1.45, 0.5], moon: [0.58, 0.02, 0.6], mars: [0.58, 0.02, 0.94], orb: [0.58, 0.02, 0.94, 1, 1, 6], lon: -72, free: 1, tilt: 0.3, spot: 0, known: 0, dim: 0.8 },
  { earth: [0.52, 0, 0.88], moon: [1.3, 1.45, 0.16], mars: [1.3, 1.45, 0.16], orb: OFF, lon: -72, free: 0, tilt: 0.3, spot: 1, known: 1, dim: 1 },
  { earth: [0, -2.18, 1.88], moon: [1.3, 1.45, 0.16], mars: [1.3, 1.45, 0.16], orb: OFF, lon: 20, free: 1, tilt: -0.5, spot: 0, known: 0, dim: 1 },
];

const TALL: Key[] = [
  { earth: [0, -1.62, 1.08], moon: [-0.55, -0.14, 0.048], mars: [0.6, -0.22, 0.034], orb: [0, 0.44, 0.4, 0, 0, 6], lon: 62, free: 1, tilt: -0.62, spot: 0, known: 0, dim: 1 },
  { earth: [0, -0.5, 0.36], moon: [-0.7, -0.05, 0.04], mars: [0.72, -0.12, 0.03], orb: [0, 0.44, 0.4, 0, 0, 6], lon: -72, free: 1, tilt: 0.3, spot: 0, known: 1, dim: 0.7 },
  { earth: [1.2, -1.3, 0.36], moon: [0, 0.44, 0.4], mars: [0, 0.44, 0.28], orb: [0, 0.44, 0.4, 0, 1, 6], lon: -72, free: 1, tilt: 0.3, spot: 0, known: 0, dim: 0.8 },
  { earth: [1.2, -1.3, 0.36], moon: [0, 0.44, 0.28], mars: [0, 0.44, 0.4], orb: [0, 0.44, 0.4, 1, 1, 6], lon: -72, free: 1, tilt: 0.3, spot: 0, known: 0, dim: 0.8 },
  { earth: [0, 0.44, 0.4], moon: [1.5, 1.6, 0.1], mars: [1.5, 1.6, 0.1], orb: OFF_TALL, lon: -72, free: 0, tilt: 0.3, spot: 1, known: 1, dim: 1 },
  { earth: [0, -1.66, 1.12], moon: [1.5, 1.6, 0.1], mars: [1.5, 1.6, 0.1], orb: OFF_TALL, lon: 20, free: 1, tilt: -0.5, spot: 0, known: 0, dim: 1 },
];

const wrap = (d: number) => ((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

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

function stick(obj: THREE.Object3D, s: Spot, r: number) {
  const up = onSphere(s.lat, s.lon, 1);
  obj.position.copy(up).multiplyScalar(r);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
  return obj;
}

function starSprite() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 16;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.85)");
    g.addColorStop(0.7, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function stars() {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const sprite = starSprite();
  const layer = (count: number, rMin: number, rSpan: number, lumMin: number, lumSpan: number, baseSize: number) => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const k = Math.sqrt(1 - u * u);
      const radDist = rMin + rnd() * rSpan;
      pos.set([Math.cos(a) * k * radDist, u * radDist, Math.sin(a) * k * radDist], i * 3);
      const lum = lumMin + Math.pow(rnd(), 1.8) * lumSpan;
      const tint = rnd();
      // Subtle warm-neutral stellar spread: chalk-white, bone, and pale amber.
      const r = tint < 0.25 ? 0.91 : tint > 0.78 ? 1.0 : 0.96;
      const g = tint < 0.25 ? 0.92 : tint > 0.78 ? 0.93 : 0.95;
      const b = tint < 0.25 ? 0.94 : tint > 0.78 ? 0.82 : 0.92;
      col.set([r * lum, g * lum, b * lum], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: baseSize,
      sizeAttenuation: false,
      vertexColors: true,
      map: sprite,
      alphaTest: 0.01,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return { points: new THREE.Points(geo, mat), mat, baseSize };
  };
  const dust = layer(1500, 62, 12, 0.24, 0.44, 2.0);
  const bright = layer(240, 56, 8, 0.68, 0.32, 3.4);
  const group = new THREE.Group();
  group.add(dust.points, bright.points);
  return {
    group,
    setOpacity(p: number) {
      dust.mat.opacity = 0.64 * p;
      bright.mat.opacity = 0.92 * p;
    },
    setScale(dpr: number) {
      dust.mat.size = dust.baseSize * dpr;
      bright.mat.size = bright.baseSize * dpr;
    },
  };
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

function earthAtmosphere() {
  // Outer BackSide shell computes exact line-of-sight impact parameter to Earth's center with a restrained Rayleigh limb tied to the grazing sun.
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { k: { value: 0 } },
    vertexShader: `
      varying vec3 vPos;
      varying vec3 vCenter;
      varying float vRadius;
      varying vec3 vSunDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vPos = mv.xyz;
        vCenter = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vRadius = length(modelViewMatrix[0].xyz);
        vSunDir = normalize((viewMatrix * vec4(-6.4, 2.9, 4.4, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float k;
      varying vec3 vPos;
      varying vec3 vCenter;
      varying float vRadius;
      varying vec3 vSunDir;
      void main() {
        vec3 rd = normalize(vPos);
        vec3 pClosest = rd * dot(vCenter, rd);
        vec3 radial = pClosest - vCenter;
        float b = length(radial) / max(vRadius, 1e-4);
        float h = max(0.0, b - 1.0);
        float scatter = exp(-h * 46.0) * 0.74 + exp(-h * 18.0) * 0.26;
        float edge = 1.0 - smoothstep(0.032, 0.068, h);
        vec3 limbDir = normalize(radial + vec3(0.0, 1e-5, 0.0));
        float sunLit = mix(0.14, 1.0, smoothstep(-0.35, 0.65, dot(limbDir, normalize(vSunDir))));
        vec3 col = mix(vec3(0.16, 0.28, 0.44), vec3(0.48, 0.59, 0.72), exp(-h * 55.0));
        float a = clamp(scatter * edge * sunLit * k, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  // Subtle FrontSide inner limb rim bridges Earth's surface edge cleanly into the horizon scatter.
  const rimMat = new THREE.ShaderMaterial({
    uniforms: { k: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vSunDir;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        vSunDir = normalize((viewMatrix * vec4(-6.4, 2.9, 4.4, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float k;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vSunDir;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float ndotv = clamp(dot(N, V), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 4.5);
        float sunLit = mix(0.12, 1.0, smoothstep(-0.3, 0.65, dot(N, normalize(vSunDir))));
        vec3 col = mix(vec3(0.18, 0.3, 0.46), vec3(0.54, 0.64, 0.76), pow(1.0 - ndotv, 5.0));
        float a = clamp(fresnel * sunLit * k, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
      }
    `,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.07, 128, 96), haloMat);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.003, 128, 96), rimMat);
  return {
    halo,
    rim,
    set(p: number, dim: number) {
      const s = p * dim;
      haloMat.uniforms.k.value = s * 0.3;
      rimMat.uniforms.k.value = s * 0.2;
    },
  };
}

function mark(color: number): Mark {
  const ring = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const halo = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const group = new THREE.Group();
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.032, 48), ring);
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.042, 0.046, 48), halo);
  group.add(inner, outer);
  group.visible = false;
  return { group, outer, ring, halo, lit: 0 };
}

export function createIntro(el: HTMLElement, textures: Textures, homes: Record<World, Spot>, on: { world(w: World): void }): Intro {
  const still = reduced();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const big = renderer.capabilities.maxTextureSize;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  let ratio = Math.min(devicePixelRatio, big >= 16384 ? 2 : 1.5);
  renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  el.append(renderer.domElement);
  const tag = document.createElement("span");
  tag.className = "intro-tag";
  el.append(tag);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  camera.position.set(0, 0, FAR);
  scene.add(new THREE.AmbientLight(0xebe6dc, 0.11));
  const sun = new THREE.DirectionalLight(0xfffaf0, 2.45);
  sun.position.set(-6.4, 2.9, 4.4);
  scene.add(sun);
  const sky = stars();
  scene.add(sky.group);

  const loader = new THREE.TextureLoader();
  let loaded = 0;
  let run = () => {};
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
      run();
    };
    loader.load(
      lo,
      (tex) => {
        loaded++;
        use(tex);
        if (hi && big >= NEED[id] && memory >= 4) loader.load(hi, use, undefined, () => {});
      },
      undefined,
      () => {
        loaded++;
        run();
      },
    );
  };
  const globe = (id: Body, flat: number, face: { x: number; y: number }): Globe => {
    const tilt = new THREE.Group();
    tilt.rotation.order = "YXZ";
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x000000, emissive: flat, emissiveIntensity: 1 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), mat);
    spin.add(mesh);
    paint(id, mat);
    return { tilt, spin, mesh, mat, cur: { ...face }, goal: { ...face }, r: 1, grow: 1 };
  };
  const earth = globe("earth", 0x25303d, { x: 0.3, y: -2.2 });
  const worlds: Record<World, Globe> = {
    moon: globe("moon", 0xd8d3c8, facing(homes.moon, 0.9)),
    mars: globe("mars", MARS, facing(homes.mars, 0.9)),
  };
  const bodies: [Body, Globe][] = [
    ["earth", earth],
    ["moon", worlds.moon],
    ["mars", worlds.mars],
  ];
  const atmo = earthAtmosphere();
  earth.tilt.add(atmo.halo, atmo.rim);
  const haze = glow([0.88, 0.38, 0.24], 1.04);
  worlds.mars.tilt.add(haze.mesh);

  const faint = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  for (const [, g] of bodies) for (const lat of [-60, -30, 0, 30, 60]) g.spin.add(new THREE.Line(ring(lat, 1.002), faint));
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const knownMat = new THREE.MeshBasicMaterial({ color: AMBER, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const dots: Record<World, THREE.Group> = { moon: new THREE.Group(), mars: new THREE.Group() };
  const marks: Record<Body, Mark> = { earth: mark(AMBER), moon: mark(SIGNAL), mars: mark(SIGNAL) };
  const olds = new THREE.Group();
  earth.spin.add(olds, marks.earth.group);
  for (const w of ["moon", "mars"] as const) worlds[w].spin.add(dots[w], marks[w].group);

  let hover: World | null = null;
  let px = 0;
  let py = 0;
  let seen = true;
  let active = true;
  let t0 = 0;
  let last = 0;
  let raf = 0;
  let hh = 1;
  let hw = 1;
  let vw = 1;
  let vh = 1;
  let keys = WIDE;
  let at = 0;
  let atGoal = 0;
  let frames = 0;
  let spent = 0;

  const canRun = () => active && seen && !document.hidden;
  const stop = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const size = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    vw = w;
    vh = h;
    renderer.setSize(vw, vh, false);
    sky.setScale(ratio);
    camera.aspect = vw / vh;
    hh = FAR * Math.tan(rad(15));
    hw = hh * camera.aspect;
    keys = camera.aspect < 0.9 ? TALL : WIDE;
    camera.updateProjectionMatrix();
  };

  const turn = (g: Globe, to: { x: number; y: number }) => {
    const d = to.y - g.cur.y;
    g.goal = { x: to.x, y: g.cur.y + wrap(d) };
  };

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
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
    if (!canRun()) return;
    if (!t0) t0 = last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = still ? 99 : (now - t0) / 1000;
    const show = loaded >= 3 || t > 4 ? 1 : 0;
    const p = still ? show : ease(clamp((t - 0.3) / 1.4)) * show;
    const f = still ? 1 : 1 - Math.exp(-dt * 3.2);
    at = still ? Math.round(atGoal) : at + (atGoal - at) * (1 - Math.exp(-dt * 11));

    const i = Math.max(0, Math.min(keys.length - 2, Math.floor(at)));
    const s = smooth(clamp((at - i - 0.06) / 0.88));
    const k0 = keys[i];
    const k1 = keys[i + 1];
    const val = (n: "lon" | "free" | "tilt" | "spot" | "known" | "dim") => mix(k0[n], k1[n], s);
    const free = val("free");
    const dim = val("dim");
    const orb = k0.orb.map((n, j) => mix(n, k1.orb[j], s));
    const rise = still ? 0 : (1 - ease(clamp(t / 2.4))) * 0.5;
    const pulse = still ? 0 : 0.5 + 0.5 * Math.sin(t * 2.1);

    for (const [id, g] of bodies) {
      const from = k0[id];
      const to = k1[id];
      g.cur.x += (g.goal.x - g.cur.x) * f;
      g.cur.y += (g.goal.y - g.cur.y) * f;
      g.grow += ((hover === id ? 1.04 : 1) - g.grow) * f;
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
      // Turn the chosen spot to face the camera, not the screen's depth axis, so it sits in the middle of a globe that is off to one side.
      const held = id === "earth" ? 1 - free : 1;
      const dz = camera.position.z - g.tilt.position.z;
      g.tilt.rotation.y = -Math.atan2(g.tilt.position.x - camera.position.x, dz) * held;
      g.tilt.rotation.x = (id === "earth" ? mix(g.cur.x, val("tilt"), free) : g.cur.x) + Math.atan2(g.tilt.position.y - camera.position.y, dz) * held;
      if (id === "earth") {
        // While the Earth turns freely it faces land, with a slow sway, instead of drifting onto the dark Pacific.
        const face = -Math.PI / 2 - rad(val("lon"));
        const sway = still ? 0 : Math.sin(t * 0.12) * 0.2;
        g.spin.rotation.y = mix(g.cur.y, g.cur.y + wrap(face - g.cur.y) + sway, free);
      } else g.spin.rotation.y = g.cur.y + (still ? 0 : Math.sin(t * 0.2 + (id === "moon" ? 1 : 4)) * 0.04);
      g.mat.color.setScalar(p * (id === "earth" ? dim * 0.9 : id === "moon" ? 0.92 : 0.9));
      g.mat.emissiveIntensity = (1 - p) * 0.7;
      const m = marks[id];
      m.lit += (1 - m.lit) * (still ? 1 : 1 - Math.exp(-dt * 6));
      const w = (id === "earth" ? val("spot") : 1) * p;
      m.outer.scale.setScalar(still ? 1 : 1 + pulse * 0.16);
      m.ring.opacity = 0.95 * m.lit * w;
      m.halo.opacity = (still ? 0.5 : 0.32 + 0.3 * (1 - pulse)) * m.lit * w;
    }
    atmo.set(p, dim);
    haze.mat.uniforms.k.value = p * 0.16;
    faint.opacity = 0.12 * p;
    dotMat.opacity = 0.8 * p;
    sky.setOpacity(p);
    knownMat.opacity = val("known") * p * 0.95;
    olds.visible = knownMat.opacity > 0.01;

    const e = earth.tilt.position;
    camera.position.set(still ? 0 : px * 0.18, still ? 0 : -py * 0.12, FAR);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const spot = val("spot") * p;
    const em = marks.earth;
    if (spot > 0.01 && em.group.visible) {
      earth.tilt.updateMatrixWorld();
      v.copy(em.group.position).applyMatrix4(earth.spin.matrixWorld);
      n.copy(v).sub(e).normalize();
      const front = n.dot(ou.copy(camera.position).sub(v).normalize());
      v.project(camera);
      const x = ((v.x + 1) / 2) * vw;
      const y = ((1 - v.y) / 2) * vh;
      const w = tag.offsetWidth || tag.getBoundingClientRect().width;
      const h = tag.offsetHeight || 30;
      const rightGutter = vw >= 900 ? 52 : 12;
      const leftMargin = 12;
      const topMargin = 16;
      const offset = 28;
      const left = x + offset + w > vw - rightGutter;
      const bothClip = left && x - offset - w < leftMargin;
      const rawX = bothClip ? x - w / 2 : left ? x - offset - w : x + offset;
      const maxX = Math.max(leftMargin, vw - rightGutter - w);
      const tx = Math.max(leftMargin, Math.min(maxX, rawX));
      const overlapsDot = bothClip || (tx < x + 12 && tx + w > x - 12);
      const rawY = overlapsDot ? (y - h - 18 >= topMargin ? y - h - 18 : y + 18) : y - h / 2;
      const maxY = Math.max(topMargin, Math.min(vh - 40, vh - h - 16));
      const ty = Math.max(topMargin, Math.min(maxY, rawY));
      tag.classList.toggle("left", left);
      tag.style.transform = `translate3d(${Math.round(tx)}px, ${Math.round(ty)}px, 0)`;
      tag.style.opacity = String(spot * clamp((front - 0.15) * 5));
    } else tag.style.opacity = "0";

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
    if (canRun() && !still) raf = requestAnimationFrame(frame);
  };
  run = () => {
    if (!raf && canRun()) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const hit = (e: PointerEvent | MouseEvent): World | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects([earth.mesh, worlds.moon.mesh, worlds.mars.mesh], false)[0]?.object;
    return h === worlds.moon.mesh ? "moon" : h === worlds.mars.mesh ? "mars" : null;
  };
  renderer.domElement.addEventListener("pointermove", (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width) * 2 - 1;
    py = ((e.clientY - r.top) / r.height) * 2 - 1;
    const next = hit(e);
    const changed = next !== hover;
    hover = next;
    renderer.domElement.style.cursor = hover ? "pointer" : "";
    if (still && changed) run();
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    const changed = hover !== null;
    hover = null;
    px = py = 0;
    if (still && changed) run();
  });
  renderer.domElement.addEventListener("click", (e) => {
    const h = hit(e);
    if (h) on.world(h);
  });

  new ResizeObserver(() => {
    size();
    run();
  }).observe(el);
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    if (!seen) stop();
    else run();
  }).observe(el);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else run();
  });
  size();
  run();

  const small = new THREE.CircleGeometry(0.012, 16);
  const pip = new THREE.CircleGeometry(0.007, 16);
  const pin = (g: Globe, m: Mark, s: Spot, share: number, aim = s) => {
    stick(m.group, s, 1.008);
    m.group.visible = true;
    m.lit = 0;
    turn(g, facing(aim, share));
    run();
  };

  return {
    sites(w, spots) {
      dots[w].clear();
      for (const s of spots) dots[w].add(stick(new THREE.Mesh(pip, dotMat), s, 1.004));
      run();
    },
    target(w, s) {
      pin(worlds[w], marks[w], s, 0.9);
    },
    known(spots) {
      olds.clear();
      for (const s of spots) olds.add(stick(new THREE.Mesh(small, knownMat), s, 1.006));
      run();
    },
    place(s, name) {
      tag.textContent = name;
      pin(earth, marks.earth, s, 0.9, { lat: Math.max(-70, Math.min(70, s.lat)), lon: s.lon });
    },
    chapter(c) {
      atGoal = Math.max(0, Math.min(keys.length - 1, c));
      run();
    },
    pause() {
      active = false;
      stop();
    },
    resume() {
      active = true;
      size();
      run();
    },
  };
}

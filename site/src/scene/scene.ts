import * as THREE from "three";
import type { Body } from "../../../dataset/contract";

export interface Disc {
  x: number;
  y: number;
  r: number;
  ax: number;
  ay: number;
}

export type World = "earth" | Body;
export type Layout = Record<World, Disc>;

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export const MATCH_W = 720;
const SPIN_DEG_PER_S = 7;
export const MATCH_H = 360;

const SUN = new THREE.Vector3(-0.55, 0.5, 0.67).normalize();
const DEG = Math.PI / 180;
const FRONT = new THREE.Vector3(0, 0, 1);
const WORLDS = ["earth", "moon", "mars"] as const;
const DISC_KEYS = ["x", "y", "r", "ax", "ay"] as const;
const DEPTH: Layout extends Record<infer K, unknown> ? Record<K & string, number> : never = { earth: 0, moon: -6000, mars: -12000 };
const HAZE = { moon: new THREE.Color(0.12, 0.12, 0.13), mars: new THREE.Color(0.55, 0.3, 0.16) };
const GLOW = { earth: new THREE.Color(0.36, 0.56, 0.95), moon: new THREE.Color(0, 0, 0), mars: new THREE.Color(0.42, 0.23, 0.11) };
const REST = { moon: { lat: -25, lon: 10 }, mars: { lat: 5, lon: 75 } };

const bodyVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D surface;
  uniform sampler2D matchMap;
  uniform vec3 sun;
  uniform float matchOn;
  uniform float fade;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 base = texture2D(surface, vUv).rgb;
    float sea = 1.0 - smoothstep(0.03, 0.10, max(base.r, base.g));
    base = mix(base, vec3(0.016, 0.050, 0.105) + base * 1.35, sea);
    float light = mix(0.30, 1.12, smoothstep(-0.35, 0.75, dot(n, sun)));
    vec3 col = base * light;

    vec4 m = texture2D(matchMap, vUv);
    float t = m.r * matchOn;
    vec3 warm = mix(vec3(1.0, 0.55, 0.10), vec3(1.0, 0.95, 0.72), m.r);
    col = mix(col, col * 0.7, m.a * matchOn * 0.5 * (1.0 - m.r));
    col = mix(col, warm, smoothstep(0.0, 0.85, t) * 0.94);

    float rim = pow(1.0 - max(n.z, 0.0), 3.4);
    col += vec3(0.42, 0.62, 0.95) * rim * 0.55 * light;
    gl_FragColor = vec4(col * fade, 1.0);
  }
`;

const bodyFragment = /* glsl */ `
  uniform sampler2D surface;
  uniform vec3 sun;
  uniform vec3 haze;
  uniform float fade;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 base = texture2D(surface, vUv).rgb;
    float light = mix(0.16, 1.15, smoothstep(-0.2, 0.8, dot(n, sun)));
    vec3 col = base * light;
    float rim = pow(1.0 - max(n.z, 0.0), 3.0);
    col += haze * rim * light;
    gl_FragColor = vec4(col * fade, 1.0);
  }
`;

const haloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 tint;
  uniform vec2 sun;
  uniform float inner;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p) / inner;
    float glow = exp(-(d - 1.0) * 70.0) * step(1.0, d) * 0.8;
    float lit = 0.35 + 0.65 * smoothstep(-0.6, 0.8, dot(normalize(p), normalize(sun)));
    gl_FragColor = vec4(tint * glow * lit, 1.0);
  }
`;

const HALO_REACH = 1.25;

function unit(lat: number, lon: number) {
  const c = Math.cos(lat * DEG);
  return new THREE.Vector3(c * Math.cos(lon * DEG), Math.sin(lat * DEG), -c * Math.sin(lon * DEG));
}

function facing(lat: number, lon: number, disc: Disc) {
  const centred = new THREE.Quaternion().setFromEuler(new THREE.Euler(lat * DEG, -Math.PI / 2 - lon * DEG, 0, "XYZ"));
  const aim = new THREE.Vector3(disc.ax, disc.ay, Math.sqrt(Math.max(0, 1 - disc.ax ** 2 - disc.ay ** 2)));
  return new THREE.Quaternion().setFromUnitVectors(FRONT, aim).multiply(centred);
}

function halo(tint: THREE.Color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: { tint: { value: tint }, sun: { value: new THREE.Vector2(SUN.x, SUN.y) }, inner: { value: 1 / HALO_REACH } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = -1;
  return mesh;
}

function stars(count: number) {
  let seed = 20261115;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(count * 3);
  const shade = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand();
    pos[i * 3 + 1] = rand();
    pos[i * 3 + 2] = -19000;
    const b = 0.12 + 0.5 * rand() ** 3;
    shade[i * 3] = b;
    shade[i * 3 + 1] = b;
    shade[i * 3 + 2] = b * 1.08;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }));
  points.renderOrder = -2;
  return points;
}

const still = (): Disc => ({ x: 0, y: 0, r: 1, ax: 0, ay: 0 });

interface Globe {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  glow: THREE.Mesh;
  loaded: number;
}

export class Scene {
  onFrame: (() => void) | undefined;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 1, 0, 1, 40000);
  private loader = new THREE.TextureLoader();
  private globes: Record<World, Globe>;
  private starfield = stars(900);
  private matchTexture: THREE.DataTexture;

  private layout: Layout = { earth: still(), moon: still(), mars: still() };
  private shown: Layout | undefined;
  private view = { lat: 20, lon: 0 };
  private goal = { lat: 20, lon: 0 };
  private body: Body = "moon";
  private site = { ...REST };
  private snap = new Set<Body>(["moon", "mars"]);
  private frame = 0;
  private last = 0;
  private dragging = false;
  private spin = false;
  private settled = false;
  private height = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private base: string,
    private reducedMotion: boolean,
    private small: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x050607);
    this.camera.position.z = 20000;

    this.matchTexture = new THREE.DataTexture(new Uint8Array(MATCH_W * MATCH_H * 4), MATCH_W, MATCH_H, THREE.RGBAFormat);
    this.matchTexture.magFilter = THREE.LinearFilter;
    this.matchTexture.minFilter = THREE.LinearFilter;
    this.matchTexture.needsUpdate = true;

    const sphere = new THREE.SphereGeometry(1, 128, 80);
    const globe = (world: World): Globe => {
      const uniforms: Record<string, THREE.IUniform> = { surface: { value: null }, sun: { value: SUN }, fade: { value: 0 } };
      if (world === "earth") Object.assign(uniforms, { matchMap: { value: this.matchTexture }, matchOn: { value: 0 } });
      else uniforms.haze = { value: HAZE[world] };
      const mesh = new THREE.Mesh(
        sphere,
        new THREE.ShaderMaterial({ vertexShader: bodyVertex, fragmentShader: world === "earth" ? earthFragment : bodyFragment, uniforms }),
      );
      return { mesh, glow: halo(GLOW[world]), loaded: 0 };
    };
    this.globes = { earth: globe("earth"), moon: globe("moon"), mars: globe("mars") };
    this.scene.add(this.starfield);
    for (const w of WORLDS) this.scene.add(this.globes[w].glow, this.globes[w].mesh);
    this.load("earth", small ? 1024 : 2048);

    canvas.addEventListener("pointerdown", this.pointerDown);
    this.kick();
  }

  private load(world: World, size: number) {
    const g = this.globes[world];
    if (g.loaded >= size) return;
    g.loaded = size;
    const t = this.loader.load(`${this.base}${world}-${size}.jpg`, () => {
      g.mesh.material.uniforms.surface.value = t;
      this.kick();
    });
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
  }

  sharpen() {
    if (this.small) {
      this.load("earth", 2048);
      return;
    }
    this.load("earth", 4096);
    this.load(this.body, 4096);
  }

  resize(width: number, height: number) {
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.right = width;
    this.camera.top = height;
    this.camera.updateProjectionMatrix();
    this.starfield.scale.set(width, height, 1);
    this.starfield.geometry.setDrawRange(0, Math.min(900, Math.round((width * height) / 2200)));
    this.kick();
  }

  setLayout(layout: Layout, from?: Layout) {
    this.layout = layout;
    if (from && !this.shown) this.shown = structuredClone(from);
    if (!this.shown || this.reducedMotion) this.shown = structuredClone(layout);
    for (const body of ["moon", "mars"] as const) {
      if (this.onScreen(layout[body])) this.load(body, this.small ? 1024 : 2048);
    }
    this.kick();
  }

  private onScreen(d: Disc) {
    return d.x + d.r > 0 && d.x - d.r < this.camera.right && d.y + d.r > 0 && d.y - d.r < this.height;
  }

  setSite(body: Body, lat: number, lon: number) {
    this.body = body;
    this.site = { ...REST, [body]: { lat, lon } };
    this.kick();
  }

  setMatch(pixels: Uint8Array) {
    (this.matchTexture.image.data as Uint8Array).set(pixels);
    this.matchTexture.needsUpdate = true;
    this.globes.earth.mesh.material.uniforms.matchOn.value = this.reducedMotion ? 1 : 0;
    this.kick();
  }

  setSpin(on: boolean) {
    on &&= !this.reducedMotion;
    if (this.spin === on) return;
    this.spin = on;
    if (on) this.goal = { lat: 0, lon: this.view.lon };
    this.kick();
  }

  lookAt(lat: number, lon: number, fromLonOffset = 0) {
    this.goal = { lat, lon };
    if (this.reducedMotion) this.view = { lat, lon };
    else if (fromLonOffset) this.view = { lat, lon: lon + fromLonOffset };
    this.kick();
  }

  project(world: World, lat: number, lon: number): ScreenPoint {
    const disc = (this.shown ?? this.layout)[world];
    const v = unit(lat, lon).applyQuaternion(this.globes[world].mesh.quaternion);
    return { x: disc.x + v.x * disc.r, y: disc.y - v.y * disc.r, visible: v.z > 0.12 };
  }

  private kick() {
    this.settled = false;
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = 0;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    let moving = false;

    if (!this.dragging) {
      if (this.spin) {
        this.goal.lon = ((this.goal.lon + dt * SPIN_DEG_PER_S + 540) % 360) - 180;
        moving = true;
      }
      const dLon = ((this.goal.lon - this.view.lon + 540) % 360) - 180;
      const dLat = this.goal.lat - this.view.lat;
      if (Math.abs(dLon) + Math.abs(dLat) > 0.01) {
        this.view.lon += dLon * ease(3.2);
        this.view.lat += dLat * ease(3.2);
        moving = true;
      } else {
        this.view = { ...this.goal };
      }
    }

    const shown = (this.shown ??= structuredClone(this.layout));
    for (const w of WORLDS) {
      for (const k of DISC_KEYS) {
        const d = this.layout[w][k] - shown[w][k];
        if (Math.abs(d) > (k === "ax" || k === "ay" ? 0.001 : 0.3)) {
          shown[w][k] += d * ease(4.5);
          moving = true;
        } else {
          shown[w][k] = this.layout[w][k];
        }
      }
      const { mesh, glow } = this.globes[w];
      const d = shown[w];
      mesh.position.set(d.x, this.height - d.y, DEPTH[w]);
      mesh.scale.setScalar(d.r);
      glow.position.set(d.x, this.height - d.y, DEPTH[w] - 3000);
      glow.scale.set(d.r * HALO_REACH, d.r * HALO_REACH, 1);

      const fade = mesh.material.uniforms.fade;
      if (mesh.material.uniforms.surface.value && fade.value < 0.999) {
        fade.value = this.reducedMotion ? 1 : Math.min(1, fade.value + dt * 1.8);
        moving = true;
      }
    }

    this.globes.earth.mesh.quaternion.copy(facing(this.view.lat, this.view.lon, shown.earth));
    for (const body of ["moon", "mars"] as const) {
      const mesh = this.globes[body].mesh;
      const to = facing(this.site[body].lat, this.site[body].lon, shown[body]);
      if (this.snap.has(body) || this.reducedMotion || !this.onScreen(shown[body])) {
        mesh.quaternion.copy(to);
        this.snap.delete(body);
      } else if (mesh.quaternion.angleTo(to) > 0.001) {
        mesh.quaternion.slerp(to, ease(5));
        moving = true;
      }
    }

    const matchOn = this.globes.earth.mesh.material.uniforms.matchOn;
    if (matchOn.value < 0.999) {
      matchOn.value = this.reducedMotion ? 1 : Math.min(1, matchOn.value + dt * 1.6);
      moving = true;
    }

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
    this.last = moving || this.dragging ? now : 0;
    if (moving || this.dragging || !this.settled) {
      this.settled = !moving && !this.dragging;
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private pointerDown = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const disc = (this.shown ?? this.layout).earth;
    if (Math.hypot(e.clientX - rect.left - disc.x, e.clientY - rect.top - disc.y) > disc.r) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.dragging = true;
    let lastX = e.clientX;
    let lastY = e.clientY;
    const move = (m: PointerEvent) => {
      const k = 62 / disc.r;
      this.view.lon -= (m.clientX - lastX) * k;
      this.view.lat = Math.max(-80, Math.min(80, this.view.lat + (m.clientY - lastY) * k));
      lastX = m.clientX;
      lastY = m.clientY;
      this.kick();
    };
    const up = () => {
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.dragging = false;
      this.view.lon = ((this.view.lon + 540) % 360) - 180;
      this.goal = { ...this.view };
      this.kick();
    };
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.renderer.dispose();
  }
}

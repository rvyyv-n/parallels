import * as THREE from "three";
import type { Body } from "../../../dataset/contract";

export interface Disc {
  x: number;
  y: number;
  r: number;
  ax: number;
  ay: number;
}

export interface Layout {
  earth: Disc;
  companion: Disc;
}

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export const MATCH_W = 720;
export const MATCH_H = 360;

const SUN = new THREE.Vector3(-0.55, 0.5, 0.67).normalize();
const DEG = Math.PI / 180;

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
    gl_FragColor = vec4(col, 1.0);
  }
`;

const companionFragment = /* glsl */ `
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

const haloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function unit(lat: number, lon: number) {
  const c = Math.cos(lat * DEG);
  return new THREE.Vector3(c * Math.cos(lon * DEG), Math.sin(lat * DEG), -c * Math.sin(lon * DEG));
}

const FRONT = new THREE.Vector3(0, 0, 1);
const DISC_KEYS = ["x", "y", "r", "ax", "ay"] as const;

function facing(lat: number, lon: number, disc: Disc) {
  const centred = new THREE.Quaternion().setFromEuler(new THREE.Euler(lat * DEG, -Math.PI / 2 - lon * DEG, 0, "XYZ"));
  const aim = new THREE.Vector3(disc.ax, disc.ay, Math.sqrt(Math.max(0, 1 - disc.ax ** 2 - disc.ay ** 2)));
  return new THREE.Quaternion().setFromUnitVectors(FRONT, aim).multiply(centred);
}

function halo(tint: THREE.Color, inner: number) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      uniforms: { tint: { value: tint }, sun: { value: new THREE.Vector2(SUN.x, SUN.y) }, inner: { value: inner } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    }),
  );
}

function stars(count: number) {
  let seed = 20261115;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(count * 3);
  const shade = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand();
    pos[i * 3 + 1] = rand();
    pos[i * 3 + 2] = -900;
    const b = 0.12 + 0.5 * rand() ** 3;
    shade[i * 3] = b;
    shade[i * 3 + 1] = b;
    shade[i * 3 + 2] = b * 1.08;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true }));
}

export class Scene {
  onFrame: (() => void) | undefined;
  onEarthClick: ((lat: number, lon: number) => void) | undefined;
  onDragEnd: (() => void) | undefined;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 1, 0, -2000, 2000);
  private loader = new THREE.TextureLoader();
  private earth: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private earthHalo: THREE.Mesh;
  private companion: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private companionHalo: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private starfield = stars(900);
  private matchTexture: THREE.DataTexture;

  private layout: Layout = { earth: { x: 0, y: 0, r: 1, ax: 0, ay: 0 }, companion: { x: 0, y: 0, r: 1, ax: 0, ay: 0 } };
  private shown: Layout | undefined;
  private view = { lat: 20, lon: 0 };
  private goal = { lat: 20, lon: 0 };
  private companionAt = { lat: 0, lon: 0 };
  private body: Body | undefined;
  private bodyTextures = new Map<Body, THREE.Texture>();
  private companionSettled = false;
  private frame = 0;
  private last = 0;
  private dragging = false;
  private still = false;
  private height = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private base: string,
    private reducedMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x050607);
    this.camera.position.z = 1000;

    this.matchTexture = new THREE.DataTexture(new Uint8Array(MATCH_W * MATCH_H * 4), MATCH_W, MATCH_H, THREE.RGBAFormat);
    this.matchTexture.magFilter = THREE.LinearFilter;
    this.matchTexture.minFilter = THREE.LinearFilter;
        this.matchTexture.needsUpdate = true;

    const sphere = new THREE.SphereGeometry(1, 96, 64);
    this.earth = new THREE.Mesh(
      sphere,
      new THREE.ShaderMaterial({
        vertexShader: bodyVertex,
        fragmentShader: earthFragment,
        uniforms: {
          surface: { value: this.texture("earth-2048.jpg") },
          matchMap: { value: this.matchTexture },
          sun: { value: SUN },
          matchOn: { value: 0 },
        },
      }),
    );
    this.earthHalo = halo(new THREE.Color(0.36, 0.56, 0.95), 1 / 1.25);
    this.companion = new THREE.Mesh(
      sphere,
      new THREE.ShaderMaterial({
        vertexShader: bodyVertex,
        fragmentShader: companionFragment,
        uniforms: {
          surface: { value: null },
          sun: { value: SUN },
          haze: { value: new THREE.Color(0, 0, 0) },
          fade: { value: 0 },
        },
      }),
    );
    this.companionHalo = halo(new THREE.Color(0, 0, 0), 1 / 1.25) as typeof this.companionHalo;
    this.starfield.renderOrder = -2;
    this.earthHalo.renderOrder = -1;
    this.companionHalo.renderOrder = -1;
    this.scene.add(this.starfield, this.earthHalo, this.companionHalo, this.earth, this.companion);

    canvas.addEventListener("pointerdown", this.pointerDown);
    this.kick();
  }

  private texture(name: string, onLoad?: () => void) {
    const t = this.loader.load(this.base + name, () => {
      onLoad?.();
      this.kick();
    });
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  sharpen() {
    const sharp = this.texture("earth-4096.jpg", () => {
      this.earth.material.uniforms.surface.value = sharp;
    });
  }

  resize(width: number, height: number) {
    this.height = height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.right = width;
    this.camera.top = height;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
    this.starfield.scale.set(width, height, 1);
    this.starfield.geometry.setDrawRange(0, Math.min(900, Math.round((width * height) / 2200)));
    this.kick();
  }

  setLayout(layout: Layout, from?: Layout) {
    this.layout = layout;
    if (from && !this.shown) this.shown = structuredClone(from);
    if (!this.shown || this.reducedMotion) this.shown = structuredClone(layout);
    this.kick();
  }

  setBody(body: Body, lat: number, lon: number) {
    this.companionAt = { lat, lon };
    if (this.body !== body) {
      this.body = body;
      this.companionSettled = false;
      const u = this.companion.material.uniforms;
      u.fade.value = 0;
      u.haze.value = body === "mars" ? new THREE.Color(0.55, 0.3, 0.16) : new THREE.Color(0.12, 0.12, 0.13);
      (this.companionHalo.material.uniforms.tint.value as THREE.Color).set(body === "mars" ? 0x6b3a1c : 0x000000);
      let tex = this.bodyTextures.get(body);
      if (!tex) {
        tex = this.texture(`${body}-2048.jpg`);
        this.bodyTextures.set(body, tex);
      }
      u.surface.value = tex;
    }
    this.kick();
  }

  setMatch(pixels: Uint8Array) {
    (this.matchTexture.image.data as Uint8Array).set(pixels);
    this.matchTexture.needsUpdate = true;
    this.earth.material.uniforms.matchOn.value = this.reducedMotion ? 1 : 0;
    this.kick();
  }

  lookAt(lat: number, lon: number, fromLonOffset = 0) {
    this.goal = { lat, lon };
    if (this.reducedMotion) this.view = { lat, lon };
    else if (fromLonOffset) this.view = { lat, lon: lon + fromLonOffset };
    this.kick();
  }

  projectEarth(lat: number, lon: number): ScreenPoint {
    return this.project(this.earth, this.shown?.earth ?? this.layout.earth, lat, lon);
  }

  projectCompanion(lat: number, lon: number): ScreenPoint {
    return this.project(this.companion, this.shown?.companion ?? this.layout.companion, lat, lon);
  }

  private project(mesh: THREE.Object3D, disc: Disc, lat: number, lon: number): ScreenPoint {
    const v = unit(lat, lon).applyQuaternion(mesh.quaternion);
    return { x: disc.x + v.x * disc.r, y: disc.y - v.y * disc.r, visible: v.z > 0.12 };
  }

  private kick() {
    this.still = false;
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = 0;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    const ease = (rate: number) => 1 - Math.exp(-dt * rate);
    let moving = false;

    if (!this.dragging) {
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
    for (const key of ["earth", "companion"] as const) {
      for (const k of DISC_KEYS) {
        const d = this.layout[key][k] - shown[key][k];
        if (Math.abs(d) > (k === "ax" || k === "ay" ? 0.001 : 0.3)) {
          shown[key][k] += d * ease(4.5);
          moving = true;
        } else {
          shown[key][k] = this.layout[key][k];
        }
      }
    }
    this.earth.quaternion.copy(facing(this.view.lat, this.view.lon, shown.earth));

    const companionGoal = facing(this.companionAt.lat, this.companionAt.lon, shown.companion);
    if (!this.companionSettled || this.reducedMotion) {
      this.companion.quaternion.copy(companionGoal);
      this.companionSettled = true;
    } else if (this.companion.quaternion.angleTo(companionGoal) > 0.001) {
      this.companion.quaternion.slerp(companionGoal, ease(5));
      moving = true;
    }
    this.place(this.earth, this.earthHalo, shown.earth);
    this.place(this.companion, this.companionHalo, shown.companion);

    for (const u of [this.earth.material.uniforms.matchOn, this.companion.material.uniforms.fade]) {
      if (u.value < 0.999) {
        u.value = this.reducedMotion ? 1 : Math.min(1, u.value + dt * 1.6);
        moving = true;
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
    this.last = moving || this.dragging ? now : 0;
    if (moving || this.dragging || !this.still) {
      this.still = !moving && !this.dragging;
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private place(mesh: THREE.Object3D, glow: THREE.Object3D, d: Disc) {
    mesh.position.set(d.x, this.height - d.y, 0);
    mesh.scale.setScalar(d.r);
    glow.position.set(d.x, this.height - d.y, -500);
    glow.scale.set(d.r * 1.25, d.r * 1.25, 1);
  }

  private pointerDown = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const disc = this.shown?.earth ?? this.layout.earth;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (Math.hypot(px - disc.x, py - disc.y) > disc.r) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.dragging = true;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let travelled = 0;
    const move = (m: PointerEvent) => {
      const k = 62 / disc.r;
      travelled += Math.abs(m.clientX - lastX) + Math.abs(m.clientY - lastY);
      this.view.lon -= (m.clientX - lastX) * k;
      this.view.lat = Math.max(-80, Math.min(80, this.view.lat + (m.clientY - lastY) * k));
      lastX = m.clientX;
      lastY = m.clientY;
      this.kick();
    };
    const up = (u: PointerEvent) => {
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
      this.dragging = false;
      this.view.lon = ((this.view.lon + 540) % 360) - 180;
      this.goal = { ...this.view };
      this.onDragEnd?.();
      if (travelled < 5 && this.onEarthClick) {
        const x = (u.clientX - rect.left - disc.x) / disc.r;
        const y = -(u.clientY - rect.top - disc.y) / disc.r;
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        const v = new THREE.Vector3(x, y, z).applyQuaternion(this.earth.quaternion.clone().invert());
        this.onEarthClick(Math.asin(v.y) / DEG, Math.atan2(-v.z, v.x) / DEG);
      }
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

import * as THREE from "three";
import type { Heights } from "./tiles";

const DEG = Math.PI / 180;
const SUN_AZIMUTH = 215 * DEG;
const PLAIN = new THREE.Color(0.55, 0.52, 0.48);

export function stretchFor(h: Heights) {
  return Math.min(4, Math.max(1, Math.round(1500 / Math.max(h.max - h.min, 1))));
}

export class TerrainView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.5, 1000);
  private light = new THREE.DirectionalLight(0xfff4e6, 3.4);
  private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial> | undefined;
  private observer: ResizeObserver;
  private yaw = 0.5;
  private pitch = 0.62;
  private size = 50;
  private sun = 20;
  private spin: boolean;
  private frame = 0;
  private last = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    reducedMotion: boolean,
  ) {
    this.spin = !reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0x050607);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const small = Math.min(innerWidth, innerHeight) < 600;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.04;
    this.scene.add(this.light, this.light.target, new THREE.HemisphereLight(0xc9d6ff, 0x2a241c, 0.55));

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("keydown", this.keyDown);
  }

  show(h: Heights, image: HTMLCanvasElement | undefined, stretch: number) {
    const n = h.n;
    this.size = ((n - 1) * h.metres) / 1000;
    const geometry = new THREE.PlaneGeometry(this.size, this.size, n - 1, n - 1).rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const mid = (h.min + h.max) / 2;
    for (let i = 0; i < n * n; i++) position.setY(i, ((h.data[i] - mid) / 1000) * stretch);
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({ color: image ? 0xffffff : PLAIN });
    if (image) {
      const texture = new THREE.CanvasTexture(image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      material.map = texture;
    }
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);

    const reach = this.size * 0.75;
    const cam = this.light.shadow.camera;
    cam.left = cam.bottom = -reach;
    cam.right = cam.top = reach;
    cam.near = 1;
    cam.far = reach * 4;
    this.setSun(this.sun);
    this.resize();
  }

  setSun(degrees: number) {
    this.sun = degrees;
    const e = degrees * DEG;
    const d = this.size * 1.5;
    this.light.position.set(Math.sin(SUN_AZIMUTH) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(SUN_AZIMUTH) * Math.cos(e) * d);
    this.light.shadow.camera.updateProjectionMatrix();
    this.kick();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.kick();
  }

  private place() {
    const fit = Math.max(1, 0.8 / this.camera.aspect);
    const d = this.size * 2.15 * fit;
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * d, Math.sin(this.pitch) * d, Math.cos(this.yaw) * Math.cos(this.pitch) * d);
    this.camera.lookAt(0, -this.size * (this.camera.aspect < 1 ? 0.32 : 0.1), 0);
  }

  private kick() {
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = 0;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    if (this.spin && this.mesh) this.yaw += dt * 0.05;
    this.place();
    this.renderer.render(this.scene, this.camera);
    this.last = this.spin ? now : 0;
    if (this.spin) this.kick();
  };

  private turn(dYaw: number, dPitch: number) {
    this.spin = false;
    this.yaw += dYaw;
    this.pitch = Math.max(0.12, Math.min(1.35, this.pitch + dPitch));
    this.kick();
  }

  private pointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    let x = e.clientX;
    let y = e.clientY;
    const move = (m: PointerEvent) => {
      this.turn(-(m.clientX - x) * 0.006, (m.clientY - y) * 0.004);
      x = m.clientX;
      y = m.clientY;
    };
    const up = () => {
      this.canvas.removeEventListener("pointermove", move);
      this.canvas.removeEventListener("pointerup", up);
      this.canvas.removeEventListener("pointercancel", up);
    };
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointercancel", up);
  };

  private keyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0], ArrowUp: [0, 0.06], ArrowDown: [0, -0.06] }[e.key];
    if (!step) return;
    e.preventDefault();
    this.turn(step[0], step[1]);
  };

  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("keydown", this.keyDown);
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.map?.dispose();
      this.mesh.material.dispose();
    }
    this.light.shadow.map?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// Cast for the Pisa pilot. The Pool / Actor / Fx / person / blob machinery is the
// skill template's (bridge cast.ts), kept as-is in behaviour; only the staging is
// new: Pisa builders, townsfolk and tourists placed per shot.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, SKINS, fxSplash, fxRing, fxArrow, fxShadow, fxContact,
  Outfit, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, SHOT_SEC, NAIL_T, BOWL_T, clamp01 } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

// ---------------- blinks ----------------
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

// ---------------- contact blobs ----------------
const CONTACT: [number, number, number] = [0.2, 0.21, 0.33];
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
export type Stage = { places: Place[]; fx: FxPlace[] };
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
  const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
  const tc = hexOf(TAIL, k);
  out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  const cc = hexOf(CONTACT, k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- harbour staging ----------------
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const SAILOR: Outfit = { jacket: "#274b73", pants: "#33475e", boots: "#f4f1ea", hat: "cap", cap: "#f4f1ea", skin: SKINS[1] };
const WORKER: Outfit = { jacket: "#d8722c", pants: "#4a3b2c", boots: "#3a2a1c", hat: "cap", cap: "#e8c33a", skin: SKINS[2] };

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  findSun(cam, SUN);
  const P = (who: Who, x: number, z: number, fo: FrontOpts, scale = 1) => {
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo, {}, scale));
    blob(out, x, 0, z, scale);
  };
  const folk = (v: number, i: number): Who => ({ i, o: FOLK[v % 6], okey: `f${v % 6}` });
  const sailor = (i: number): Who => ({ i, o: SAILOR, okey: "sailor" });
  const worker = (i: number): Who => ({ i, o: WORKER, okey: "worker" });
  const kid = (i: number): Who => ({ i, o: KID, okey: "kid" });
  switch (id) {
    case 1: { // hook: two tiny humans, one giant ship
      P(kid(301), 7.5, 8.0, { mode: "stand", expr: "shock", blink: lidAt(t, 301), look: 0 }, 0.72);
      P(sailor(302), 5.0, 10.8, { mode: "stand", expr: "smile", blink: lidAt(t, 302) });
      P(folk(2, 303), -1.0, 12.0, { mode: "stand", expr: "neutral", blink: lidAt(t, 303), look: 1 });
      break;
    }
    case 2: { // experiment 1: the nail sinks
      const lt = t - SHOT_SEC[1];
      P(kid(311), 2.5, 6.3, { mode: "stand", expr: lt < NAIL_T ? "nervous" : "shock", blink: lidAt(t, 311), look: 1 }, 0.8);
      P(sailor(312), 5.9, 6.2, { mode: "stand", expr: "neutral", blink: lidAt(t, 312), look: -1 });
      if (lt >= NAIL_T && lt < NAIL_T + 0.55) { // splash crown as the nail hits the water
        const u = q((lt - NAIL_T) / 0.55, 24);
        out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, u), x: 4.5, y: 1.5, z: 7.7, w: 1.7, h: 1.7 });
      }
      if (lt >= NAIL_T + 0.08 && lt < NAIL_T + 1.15) { // ripples spread on the tub water
        const u = q((lt - NAIL_T - 0.08) / 1.05, 24);
        out.fx.push({ key: `ring${u}`, cw: 600, ch: 600, draw: (p) => fxRing(p, u), x: 4.5, y: 1.34, z: 7.6, w: 2.0, h: 2.0, flat: true });
      }
      break;
    }
    case 3: { // experiment 2: the bowl floats
      const lt = t - SHOT_SEC[2];
      P(kid(321), 2.5, 6.3, { mode: "stand", expr: lt < BOWL_T ? "neutral" : "grin", blink: lidAt(t, 321), look: -1 }, 0.8);
      P(sailor(322), 5.9, 6.2, { mode: "stand", expr: "smile", blink: lidAt(t, 322), look: 1 });
      if (lt >= BOWL_T && lt < BOWL_T + 0.4) {
        const u = q((lt - BOWL_T) / 0.4, 24);
        out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, u), x: 3.85, y: 1.42, z: 7.5, w: 1.3, h: 1.3 });
      }
      const ru = q((t * 0.45) % 1, 24); // gentle continuous ripples under the bobbing bowl
      out.fx.push({ key: `ring${ru}`, cw: 600, ch: 600, draw: (p) => fxRing(p, ru), x: 3.85, y: 1.34, z: 7.35, w: 1.6, h: 1.6, flat: true });
      break;
    }
    case 4: { // the explanation: buoyancy (blue, up) vs gravity (red, down)
      P(sailor(331), -6.9, 6.6, { mode: "stand", expr: "stern", blink: lidAt(t, 331), look: 1 });
      P(kid(332), -2.1, 6.9, { mode: "stand", expr: "neutral", blink: lidAt(t, 332), look: -1 }, 0.8);
      const pulse = q(0.5 + 0.5 * Math.sin(t * 3.0), 16);
      out.fx.push({ key: `arrUp${pulse}`, cw: 300, ch: 600, draw: (p) => fxArrow(p, "#2f8fc4", 1, pulse), x: -5.95, y: 2.05, z: 6.4, w: 1.05, h: 2.1 });
      out.fx.push({ key: `arrDn${pulse}`, cw: 300, ch: 600, draw: (p) => fxArrow(p, "#d4483b", -1, pulse), x: -3.05, y: 2.05, z: 6.4, w: 1.05, h: 2.1 });
      break;
    }
    case 5: // loading day: no observers — the crane + sinking ship are the subject
      break;
    default: { // golden farewell: the kid waves the ship off
      P(kid(351), 10.2, 6.5, { mode: "stand", expr: "grin", blink: lidAt(t, 351), wave: q(0.5 + 0.35 * Math.sin(t * 3.0), 30) }, 0.72);
      P(sailor(352), 12.4, 9.0, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 352) });
    }
  }
  return out;
};
export { FPS };

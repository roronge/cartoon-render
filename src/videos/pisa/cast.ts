// Cast for the Pisa pilot. The Pool / Actor / Fx / person / blob machinery is the
// skill template's (bridge cast.ts), kept as-is in behaviour; only the staging is
// new: Pisa builders, townsfolk and tourists placed per shot.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, KID, SKINS, fxStars, fxCreak, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, HAMMER_T, smooth, clamp01 } from "./story";
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

// ---------------- Pisa staging ----------------
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const BUILDER = (v: number): Outfit => ({
  jacket: ["#b5653f", "#8c5a2e", "#6a7a4a"][v % 3], pants: "#4a3b2c", boots: "#3a2a1c",
  hat: v % 2 ? "cap" : "hair", cap: "#7a3b2e", hair: "#3a2a20", skin: SKINS[v % 4],
});
/** 0 = hammer up, 1 = struck (bridge officer timing: 4 f wind-up, hold, 1-frame strike) */
const hammerK = (t: number) => {
  let k = 1;
  for (const th of HAMMER_T) {
    const n = (t - th) * FPS;
    if (n >= -11 && n < -7) k = Math.min(k, 1 - smooth((n + 11) / 4));
    else if (n >= -7 && n < 0) k = 0;
  }
  return k;
};
const shotU = (id: number, t: number) => {
  const s = SHOTS[id - 1];
  return clamp01((t - s.a / FPS) / ((s.b - s.a) / FPS));
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  findSun(cam, SUN);
  const P = (who: Who, x: number, z: number, fo: FrontOpts, scale = 1) => {
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo, {}, scale));
    blob(out, x, 0, z, scale);
  };
  const folk = (v: number, i: number): Who => ({ i, o: FOLK[v % 6], okey: `f${v % 6}` });
  const builder = (v: number, i: number): Who => ({ i, o: BUILDER(v), okey: `b${v}` });
  switch (id) {
    case 1: { // present day: tourists under the leaning tower
      P(folk(0, 301), -2.7, -8.6, { mode: "stand", expr: "shock", blink: lidAt(t, 301), look: 0 });
      P(folk(3, 302), 0.5, -9.5, { mode: "stand", expr: "smile", blink: lidAt(t, 302), wave: q(0.55 + 0.3 * Math.sin(t * 2.2), 30) });
      P({ i: 303, o: KID, okey: "kid" }, 2.7, -8.2, { mode: "stand", expr: "grin", blink: lidAt(t, 303), wave: q(0.5 + 0.35 * Math.sin(t * 3.1 + 1), 30) }, 0.72);
      break;
    }
    case 2: { // 1173: builders at the fresh tower, townsfolk watching
      P(builder(0, 311), -3.5, -7.7, { mode: "stand", expr: "stern", blink: lidAt(t, 311) });
      P(builder(1, 312), 3.7, -7.3, { mode: "stand", expr: "neutral", blink: lidAt(t, 312), prop: ["hammer", 1] });
      P(folk(2, 313), -5.8, -10.6, { mode: "stand", expr: "smile", blink: lidAt(t, 313) });
      P(folk(5, 314), 6.0, -11.2, { mode: "stand", expr: "neutral", blink: lidAt(t, 314) });
      break;
    }
    case 3: { // the foundation: two builders study the soil chunk, worried
      P(builder(2, 321), 0.6, -7.2, { mode: "stand", expr: "nervous", blink: lidAt(t, 321), look: 1 });
      P(builder(1, 322), -2.9, -7.9, { mode: "stand", expr: "nervous", blink: lidAt(t, 322), prop: ["hammer", 1] });
      break;
    }
    case 4: { // the lean grows: nerves turn to shock
      const u = shotU(4, t);
      const e1: Expr = u > 0.72 ? "shock" : "nervous";
      P(builder(0, 331), -3.3, -8.9, { mode: "stand", expr: e1, blink: lidAt(t, 331), look: 1 });
      P(builder(2, 332), 3.5, -8.5, { mode: "stand", expr: "nervous", blink: lidAt(t, 332), look: -1 });
      if (u > 0.25) for (const [cx, cy, s] of [[3.1, 6.8, 0.55], [3.4, 9.6, 0.45]] as const) {
        const uu = q((t * 1.3 + cx) % 1, 30);
        out.fx.push({ key: `creak${uu}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, uu), x: cx, y: cy, z: -4, w: s, h: s, rot: cx });
      }
      break;
    }
    case 5: { // the correction: hammering the south side higher; it ends banana-shaped
      P(builder(1, 341), 1.1, -9.3, { mode: "stand", expr: "stern", blink: lidAt(t, 341), prop: ["hammer", q(hammerK(t), 30)], facing: 1 });
      const late = t > HAMMER_T[2] + 0.9;
      P(builder(0, 342), -1.5, -9.9, { mode: "stand", expr: late ? "dazed" : "stern", blink: lidAt(t, 342), look: 1 });
      if (late) {
        const u = (t * 0.9) % 1;
        out.fx.push({ key: `stars${q(u, 30)}`, cw: 420, ch: 210, draw: (p) => fxStars(p, q(u, 30)), x: -1.5, y: 2.35, z: -9.9, w: 0.75, h: 0.375 });
      }
      break;
    }
    default: { // present day again: happy tourists, one with an ice cream
      P({ i: 351, o: KID, okey: "kid" }, -1.9, -8.9, { mode: "stand", expr: "grin", blink: lidAt(t, 351), wave: q(0.5 + 0.35 * Math.sin(t * 3.0), 30) }, 0.72);
      P(folk(1, 352), 1.3, -9.7, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 352), prop: "icecream" });
      P(folk(4, 353), 3.9, -8.7, { mode: "stand", expr: "laugh", blink: lidAt(t, 353) });
      P(folk(2, 354), -4.5, -9.9, { mode: "stand", expr: "smile", blink: lidAt(t, 354) });
    }
  }
  return out;
};
export { FPS };

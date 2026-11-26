// Cast remake Persib: mesin Pool/Actor/Fx sama seperti template Pisa (cast.ts),
// staging BARU untuk sepak bola. Peta arah (checklist fakta): Persib (biru)
// menyerang gawang BALI di x=+38 (kiper HAUPTMEIJER, merah); Bali (merah)
// menyerang gawang PERSIB di x=-38 (kiper TEJA, biru). Label nama digambar
// sebagai kartu fx di atas pemain kunci.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, SKINS, fxStars, fxBurst, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, SHOTS, clamp01, smooth,
  S2_KICK_F, S2_POST_F, S2_VAR_F, S4_KICK_F, S4_SAVE_F, S4_GOAL_F,
  S5_PASS_F, S5_CHARGE_F, S5_SHOT_F, S6_SHOT_F, S6_DEFLECT_F, S6_GOAL_F,
  S8_CARD_F, S8_WHISTLE_F,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool (sama seperti template) ----------------
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

// ---------------- sprite meshes (sama seperti template) ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216;
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
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

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

// ---------------- kostum ----------------
const HAIRS = ["#241a12", "#3a2a1a", "#120e0c", "#4a3421", "#241a12", "#17110c"];
export const kitPersib = (v: number): Outfit => ({ jacket: "#1d4fa1", pants: "#1a3a6e", boots: "#15171d", hat: "hair", hair: HAIRS[v % 6], skin: SKINS[v % 4] });
export const kitBali = (v: number): Outfit => ({ jacket: "#c0272d", pants: "#7e1a20", boots: "#eef0f2", hat: "hair", hair: HAIRS[(v + 2) % 6], skin: SKINS[(v + 1) % 4] });
export const kitTeja = (): Outfit => ({ jacket: "#14418f", pants: "#122c5e", boots: "#15171d", hat: "hair", hair: "#120e0c", skin: SKINS[1] });
export const kitHaupt = (): Outfit => ({ jacket: "#d42b33", pants: "#7e1a20", boots: "#eef0f2", hat: "hair", hair: "#4a3421", skin: SKINS[0] });
export const kitRef = (): Outfit => ({ jacket: "#f2c14e", pants: "#2a2d38", boots: "#15171d", hat: "hair", hair: "#241a12", skin: SKINS[2] });

// ---------------- gambar fx khusus ----------------
const drawBall = (spin: number) => (p: Pen) => {
  const g = p.g;
  p.ell(150, 150, 128, 128, "#f7f8f5", 10);
  g.save(); g.translate(150, 150); g.rotate(spin); g.translate(-150, -150);
  p.ell(150, 150, 44, 44, "#22242c", 5);
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * Math.PI / 180;
    p.ell(150 + 102 * Math.cos(a), 150 + 102 * Math.sin(a), 30, 30, "#22242c", 4);
  }
  g.restore();
};
const drawFlame = (s: number) => (p: Pen) => {
  const fl = 0.9 + 0.25 * Math.sin(s * 39);
  p.ell(150, 175, 95 * fl, 115 * fl, "rgba(255,110,20,0.85)", 0);
  p.ell(150, 195, 62 * fl, 80 * fl, "rgba(255,180,30,0.9)", 0);
  p.ell(150, 215, 32 * fl, 44 * fl, "rgba(255,240,170,0.95)", 0);
};
const drawGlow = (col: string) => (p: Pen) => {
  const g = p.g, gr = g.createRadialGradient(150, 150, 8, 150, 150, 148);
  gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 300, 300);
};
const drawBolt = (p: Pen) => {
  p.poly([[168, 8], [86, 168], [138, 168], [104, 292], [216, 118], [158, 118]], "#ffe93d", 7);
};
const drawTag = (name: string, bg: string) => (p: Pen) => {
  const g = p.g;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(8, 22, 496, 84, 42); g.fill();
  g.lineWidth = 6; g.strokeStyle = "#f4f6ff"; g.stroke();
  g.fillStyle = "#ffffff"; g.font = "800 52px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(name, 256, 66);
};
const drawCardRed = (p: Pen) => { p.poly([[105, 30], [195, 30], [195, 270], [105, 270]], "#e02626", 8); };
const drawConfetti = (seed: number) => (p: Pen) => {
  const cols = ["#3f74d6", "#f2c14e", "#e8ecf4", "#d42b33", "#57c465"];
  for (let i = 0; i < 42; i++) {
    const x = 30 + hh(i, seed) * 440, y = 30 + hh(i, seed + 5) * 240, a = hh(i, seed + 9) * 3;
    p.poly([[x, y], [x + 16 * Math.cos(a), y + 16 * Math.sin(a)], [x + 16 * Math.cos(a) - 7 * Math.sin(a), y + 16 * Math.sin(a) + 7 * Math.cos(a)], [x - 7 * Math.sin(a), y + 7 * Math.cos(a)]], cols[i % 5], 2);
  }
};
const drawSpeed = (p: Pen) => {
  for (let i = 0; i < 7; i++) {
    const y = 30 + i * 38, x0 = 20 + (i % 3) * 60;
    p.stroke([[x0, y], [x0 + 190 - (i % 3) * 40, y]], 9 - (i % 3), "rgba(255,255,255,0.85)");
  }
};

// ---------------- helper staging ----------------
type V3 = [number, number, number];
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const path = (keys: [number, V3][], f: number): V3 => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (f <= keys[i][0]) {
      const [f0, p0] = keys[i - 1], [f1, p1] = keys[i];
      return lerp3(p0, p1, smooth((f - f0) / Math.max(1, f1 - f0)));
    }
  }
  return keys[keys.length - 1][1];
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  findSun(cam, SUN);
  const f = Math.round(t * FPS);
  const A = SHOTS.map((s) => s.a);
  const P = (who: Who, x: number, z: number, fo: FrontOpts, scale = 1, y = 0) => {
    out.places.push(person(cam, who, x, y, z, { side: false, mirror: false }, fo, {}, scale));
    if (y === 0) blob(out, x, 0, z, scale);
  };
  const S = (who: Who, x: number, z: number, so: SideOpts, mirror = false, scale = 1, y = 0, roll?: number) => {
    const pl = person(cam, who, x, y, z, { side: true, mirror }, {}, so, scale);
    if (roll !== undefined) pl.roll = roll;
    out.places.push(pl);
    if (y === 0) blob(out, x, 0, z, scale);
  };
  const persib = (v: number, i: number): Who => ({ i, o: kitPersib(v), okey: `pb${v}` });
  const bali = (v: number, i: number): Who => ({ i, o: kitBali(v), okey: `bu${v}` });
  const teja: Who = { i: 901, o: kitTeja(), okey: "teja" };
  const haupt: Who = { i: 902, o: kitHaupt(), okey: "haupt" };
  const ref: Who = { i: 903, o: kitRef(), okey: "ref" };
  const ball = (pos: V3, spin = 0) => {
    out.fx.push({ key: `ball${q(spin, 24)}`, cw: 300, ch: 300, draw: drawBall(q(spin, 24)), x: pos[0], y: pos[1], z: pos[2], w: 0.34, h: 0.34 });
    out.fx.push({ key: "blob|contact|#2c2e38", cw: 128, ch: 128, draw: (p) => fxContact(p, "#2c2e38"), x: pos[0], y: 0.02, z: pos[2], w: 0.3, h: 0.22, flat: true, rot: 0 });
  };
  const tag = (name: string, bg: string, x: number, y: number, z: number, w = 2.6) => {
    out.fx.push({ key: `tag|${name}`, cw: 512, ch: 128, draw: drawTag(name, bg), x, y, z, w, h: w / 4 });
  };
  const flame = (x: number, y: number, z: number, s: number, big = 1) => {
    out.fx.push({ key: `flame${q(s % 1, 12)}`, cw: 300, ch: 300, draw: drawFlame(q(s % 1, 12)), x, y, z, w: 0.85 * big, h: 0.85 * big, soft: true });
  };
  const burst = (x: number, y: number, z: number, u: number, col = "#fff3b0", s = 1.6) => {
    if (u < 0 || u > 1) return;
    out.fx.push({ key: `burst${q(u, 20)}${col}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 20), col), x, y, z, w: s, h: s });
  };

  switch (id) {
    case 1: { // pembuka: dua tim berbaris di tengah, wasit di tengah
      for (let i = 0; i < 5; i++) P(persib(i, 101 + i), -5.5 + i * 2.1, -2.5, { mode: "stand", expr: i % 2 ? "smile" : "neutral", blink: lidAt(t, 101 + i) });
      for (let i = 0; i < 5; i++) P(bali(i, 111 + i), 1.2 + i * 2.1, -2.5, { mode: "stand", expr: i % 2 ? "neutral" : "smile", blink: lidAt(t, 111 + i) });
      P(ref, -0.1, -4.6, { mode: "stand", expr: "stern", blink: lidAt(t, 121) });
      P(teja, -36.6, 0, { mode: "stand", expr: "neutral", blink: lidAt(t, 122) });
      P(haupt, 36.6, 0, { mode: "stand", expr: "neutral", blink: lidAt(t, 123) });
      tag("TEJA • PERSIB", "#14418f", -36.6, 2.9, 0, 3.4);
      tag("HAUPTMEIJER • BALI", "#a01d24", 36.6, 2.9, 0, 4.4);
      ball([0, 0.17, 0]);
      break;
    }
    case 2: { // Barros (biru) menembak ke gawang BALI (kanan) — tiang! lalu VAR
      const runU = clamp01((f - A[1]) / Math.max(1, S2_KICK_F - A[1]));
      const bx = 12.5 + 8 * smooth(runU);
      const kicking = f >= S2_KICK_F - 6 && f < S2_KICK_F + 8;
      S(persib(3, 201), bx, -0.6, { mode: f < S2_KICK_F ? "march" : "stand", phase: q(t * 1.9, 60), expr: f > S2_POST_F ? "shock" : "stern", blink: lidAt(t, 201), stride: 1.15, stomp: 1.25 }, false);
      if (f < S2_POST_F + 26) tag("BARROS", "#14418f", bx, 2.85, -0.6);
      // kiper BALI di gawang kanan
      const dive = f > S2_KICK_F ? clamp01((f - S2_KICK_F) / 12) : 0;
      const hz = 1.5 * smooth(dive), hy = -0.25 * Math.sin(smooth(dive) * Math.PI);
      const hp = person(cam, haupt, 37.1, Math.max(0, hy), hz, { side: false, mirror: false }, { mode: "stand", expr: f > S2_POST_F ? "relief" : "stern", blink: lidAt(t, 202) }, {});
      hp.roll = -0.38 * smooth(dive);
      out.places.push(hp); blob(out, 37.1, 0, 0);
      tag("HAUPTMEIJER", "#a01d24", 37.1, 3.0, 0, 3.6);
      P(bali(1, 203), 26.5, 2.8, { mode: "stand", expr: "nervous", blink: lidAt(t, 203) });
      P(bali(2, 204), 30, -3.4, { mode: "stand", expr: "nervous", blink: lidAt(t, 204) });
      P(persib(1, 205), 15.5, 3.4, { mode: "stand", expr: "stern", blink: lidAt(t, 205) });
      // bola: di kaki Barros -> terbang -> TIANG gawang Bali -> memantul jatuh
      const bp = f < S2_KICK_F ? [bx + 0.85, 0.17, -0.6] as V3
        : f < S2_POST_F ? lerp3([bx + 0.85, 0.17, -0.6], [37.85, 1.95, 0.35], (f - S2_KICK_F) / (S2_POST_F - S2_KICK_F))
        : f < S2_POST_F + 16 ? lerp3([37.85, 1.95, 0.35], [35.4, 0.17, 1.6], smooth((f - S2_POST_F) / 16))
        : [35.4, 0.17, 1.6] as V3;
      ball(bp, f * 0.35);
      if (f >= S2_POST_F && f < S2_POST_F + 14) burst(37.9, 2.0, 0.35, (f - S2_POST_F) / 14, "#ffe93d", 1.5);
      if (kicking) out.fx.push({ key: "speed2", cw: 500, ch: 300, draw: drawSpeed, x: bx - 1.6, y: 1.1, z: -0.6, w: 2.6, h: 1.5 });
      // momen VAR: wasit memberi isyarat layar VAR
      if (f >= S2_VAR_F - 16) {
        P(ref, 9, 3.2, { mode: "stand", expr: "stern", blink: lidAt(t, 206), wave: q(0.5 + 0.4 * Math.sin(t * 2.4), 30) });
        tag("WASIT • CEK VAR", "#8a6d1f", 9, 2.95, 3.2, 3.4);
      }
      break;
    }
    case 3: { // pergantian 62': Peralta, Menalo, Adam Alis (semua BIRU) masuk beraura
      const names: [string, number][] = [["PERALTA", 301], ["MENALO", 302], ["ADAM ALIS", 303]];
      names.forEach(([nm, ii], k) => {
        const start = A[2] + k * 26;
        const u = clamp01((f - start) / 120);
        const x = -9.5 + 7 * smooth(u), z = -7 + k * 1.7;
        S(persib(k + 2, ii), x, z, { mode: u < 1 ? "march" : "stand", phase: q(t * 1.8 + k * 0.3, 60), expr: "stern", blink: lidAt(t, ii), stride: 1.05, stomp: 1.2 }, false);
        if (u > 0.05) {
          out.fx.push({ key: `glow${k}`, cw: 300, ch: 300, draw: drawGlow("rgba(255,150,40,0.55)"), x, y: 1.15, z: z + 0.3, w: 2.6 + 0.3 * Math.sin(t * 6 + k), h: 2.9, soft: true });
          flame(x - 0.3, 0.45, z + 0.25, t * 2 + k * 0.7, 0.8);
          tag(nm, "#14418f", x, 2.9, z, 3.0);
        }
      });
      P(bali(0, 311), 0.5, 2.5, { mode: "stand", expr: "nervous", blink: lidAt(t, 311) });
      P(bali(3, 312), 2.2, 3.6, { mode: "stand", expr: "nervous", blink: lidAt(t, 312) });
      ball([-2, 0.17, 2]);
      break;
    }
    case 4: { // gol BALI: Yachida (merah) -> ditepis TEJA (biru) -> Dugandzic (merah) gol
      // Yachida menendang dari x=-15 ke kiri (gawang Persib)
      S(bali(4, 401), -15, 0.8, { mode: "stand", expr: "stern", blink: lidAt(t, 401) }, true);
      if (f < S4_GOAL_F) tag("YACHIDA", "#a01d24", -15, 2.85, 0.8);
      // Teja di gawang kiri, menepis ke kanan-atas bola
      const dive = f > S4_KICK_F ? clamp01((f - S4_KICK_F) / Math.max(1, S4_SAVE_F - S4_KICK_F)) : 0;
      const tz = -1.7 * smooth(dive), ty = 0.35 * Math.sin(smooth(dive) * Math.PI * 0.7);
      const tp = person(cam, teja, -37.2, ty, tz, { side: false, mirror: false }, { mode: "stand", expr: f > S4_GOAL_F ? "pained" : "stern", blink: lidAt(t, 402) }, {});
      tp.roll = 0.42 * smooth(dive);
      out.places.push(tp); blob(out, -37.2, 0, 0);
      tag("TEJA • PERSIB", "#14418f", -37.2, 3.05, 0, 3.6);
      // Dugandzic berlari menyambar
      const dRun = clamp01((f - (S4_SAVE_F - 26)) / Math.max(1, S4_GOAL_F - (S4_SAVE_F - 26)));
      const dx = -27.5 + -6.8 * smooth(dRun);
      S(bali(0, 403), dx, -0.5, { mode: f < S4_GOAL_F ? "march" : "stand", phase: q(t * 2.1, 60), expr: f > S4_GOAL_F ? "grin" : "stern", blink: lidAt(t, 403), stride: 1.2, stomp: 1.3 }, true);
      if (f >= S4_SAVE_F - 26) tag("DUGANDZIC", "#a01d24", dx, 2.9, -0.5, 3.2);
      P(persib(0, 404), -28.5, 5.5, { mode: "stand", expr: f > S4_GOAL_F ? "shock" : "nervous", blink: lidAt(t, 404) });
      P(persib(2, 405), -31.5, 4.5, { mode: "stand", expr: f > S4_GOAL_F ? "shock" : "nervous", blink: lidAt(t, 405) });
      // bola: kaki Yachida -> melambung -> ditepis Teja -> muntah -> disambar masuk
      const bp = f < S4_KICK_F ? [-15.85, 0.17, 0.8] as V3
        : f < S4_SAVE_F ? (() => { const u = (f - S4_KICK_F) / (S4_SAVE_F - S4_KICK_F); return [lerp3([-15.85, 0.17, 0.8], [-36.9, 1.5, -1.2], u)[0], 0.17 + Math.sin(u * Math.PI) * 0.9 + u * 1.3, lerp3([-15.85, 0.17, 0.8], [-36.9, 1.5, -1.2], u)[2]] as V3; })()
        : f < S4_GOAL_F ? lerp3([-36.9, 1.5, -1.2], [-35.2, 0.3, -0.4], smooth((f - S4_SAVE_F) / (S4_GOAL_F - S4_SAVE_F)))
        : f < S4_GOAL_F + 12 ? lerp3([-35.2, 0.3, -0.4], [-38.7, 0.85, -0.2], (f - S4_GOAL_F) / 12)
        : [-38.7, 0.85, -0.2] as V3;
      ball(bp, f * 0.3);
      if (f >= S4_GOAL_F && f < S4_GOAL_F + 14) burst(-38.4, 1.0, -0.2, (f - S4_GOAL_F) / 14, "#ffffff", 1.7);
      break;
    }
    case 5: { // gol PERSIB 1-1: umpan Menalo -> Peralta TENDANGAN MACAN ke gawang BALI
      const celeb = f > S5_SHOT_F + 22;
      // Menalo mengumpan dari x=7
      S(persib(4, 501), 13, 1.2, { mode: "stand", expr: "stern", blink: lidAt(t, 501) }, false);
      if (f < S5_PASS_F + 30) tag("MENALO", "#14418f", 13, 2.85, 1.2);
      // Peralta: menerima, charge jurus (slow-mo), menembak
      const charge = f >= S5_CHARGE_F && f < S5_SHOT_F;
      const slowPhase = charge ? q(S5_CHARGE_F / FPS * 2 + (f - S5_CHARGE_F) * 0.004, 60) : q(t * 2.0, 60);
      if (!celeb) {
        S(persib(2, 502), 20.5, -0.4, { mode: f < S5_PASS_F + 18 ? "stand" : "march", phase: slowPhase, expr: charge ? "stern" : "neutral", blink: lidAt(t, 502), stride: 0.9, stomp: 1.35 }, false);
      } else {
        P(persib(2, 502), 21.5, -0.4, { mode: "stand", expr: "grin", blink: lidAt(t, 502), wave: q(0.5 + 0.4 * Math.sin(t * 5), 30) });
        P(persib(4, 501), 17.8, 1.4, { mode: "stand", expr: "laugh", blink: lidAt(t, 501) });
      }
      tag("PERALTA", "#14418f", celeb ? 21.5 : 20.5, 2.9, -0.4);
      if (charge) { // aura api membesar + speed lines selama charge
        const cu = (f - S5_CHARGE_F) / Math.max(1, S5_SHOT_F - S5_CHARGE_F);
        flame(20.2, 0.5, -0.15, t * 3, 0.9 + cu * 0.9);
        flame(20.9, 0.4, -0.6, t * 3 + 0.5, 0.7 + cu * 0.7);
        out.fx.push({ key: "glowP", cw: 300, ch: 300, draw: drawGlow("rgba(255,120,20,0.6)"), x: 20.5, y: 1.1, z: -0.1, w: 2.4 + cu * 1.6, h: 2.8 + cu * 1.4, soft: true });
        out.fx.push({ key: "speed5", cw: 500, ch: 300, draw: drawSpeed, x: 18.4, y: 1.2, z: -0.4, w: 3.0, h: 1.8 });
      }
      // kiper BALI di gawang kanan, tertipu arah
      const dive = f > S5_SHOT_F ? clamp01((f - S5_SHOT_F) / 12) : 0;
      const hp = person(cam, haupt, 37.1, Math.max(0, -0.2 * Math.sin(smooth(dive) * Math.PI)), -1.6 * smooth(dive), { side: false, mirror: false }, { mode: "stand", expr: f > S5_SHOT_F + 10 ? "shock" : "stern", blink: lidAt(t, 503) }, {});
      hp.roll = 0.4 * smooth(dive);
      out.places.push(hp); blob(out, 37.1, 0, 0);
      tag("HAUPTMEIJER", "#a01d24", 37.1, 3.05, 0, 3.8);
      P(bali(1, 504), 29, 3.2, { mode: "stand", expr: f > S5_SHOT_F + 10 ? "shock" : "nervous", blink: lidAt(t, 504) });
      P(bali(2, 505), 27, -3.8, { mode: "stand", expr: f > S5_SHOT_F + 10 ? "shock" : "nervous", blink: lidAt(t, 505) });
      // bola: kaki Menalo -> umpan ke Peralta -> TEMBAKAN BERAPI ke gawang Bali
      const bp = f < S5_PASS_F ? [13.85, 0.17, 1.2] as V3
        : f < S5_SHOT_F ? lerp3([13.85, 0.17, 1.2], [21.3, 0.17, -0.4], smooth((f - S5_PASS_F) / Math.max(1, S5_SHOT_F - S5_PASS_F)))
        : f < S5_SHOT_F + 13 ? lerp3([21.3, 0.17, -0.4], [38.6, 1.5, 0.5], (f - S5_SHOT_F) / 13)
        : [38.6, 1.5, 0.5] as V3;
      ball(bp, f * 0.5);
      if (f >= S5_SHOT_F && f < S5_SHOT_F + 13) { // jejak api mengikuti bola
        for (let k = 1; k <= 3; k++) {
          const u = Math.max(0, (f - S5_SHOT_F) / 13 - k * 0.16);
          const tp2 = lerp3([21.3, 0.17, -0.4], [38.6, 1.5, 0.5], u);
          flame(tp2[0], tp2[1], tp2[2], t * 3 + k, 1.05 - k * 0.18);
        }
      }
      if (f >= S5_SHOT_F + 12 && f < S5_SHOT_F + 28) burst(38.5, 1.5, 0.5, (f - S5_SHOT_F - 12) / 16, "#ffb03a", 2.0);
      break;
    }
    case 6: { // gol PERSIB 2-1: tembakan Peralta disontek Menalo (PETIR) ke gawang BALI
      const celeb = f > S6_GOAL_F + 20;
      if (!celeb) {
        S(persib(2, 601), 19, 0.8, { mode: "stand", expr: "stern", blink: lidAt(t, 601) }, false);
        const mRun = clamp01((f - (S6_SHOT_F - 30)) / Math.max(1, S6_DEFLECT_F - (S6_SHOT_F - 30)));
        S(persib(4, 602), 20.5 + 6.8 * smooth(mRun), -0.8, { mode: f < S6_DEFLECT_F ? "march" : "stand", phase: q(t * 2.2, 60), expr: "stern", blink: lidAt(t, 602), stride: 1.25, stomp: 1.35 }, false);
      } else {
        P(persib(4, 602), 25.5, -0.6, { mode: "stand", expr: "laugh", blink: lidAt(t, 602), wave: q(0.5 + 0.4 * Math.sin(t * 5.4), 30) });
        P(persib(2, 601), 22, 1.2, { mode: "stand", expr: "grin", blink: lidAt(t, 601) });
      }
      tag("PERALTA", "#14418f", 19, 2.85, 0.8);
      tag("MENALO", "#14418f", celeb ? 25.5 : 20.5 + 6.8 * smooth(clamp01((f - (S6_SHOT_F - 30)) / Math.max(1, S6_DEFLECT_F - (S6_SHOT_F - 30)))) , 2.9, -0.8, 3.0);
      const dive = f > S6_DEFLECT_F ? clamp01((f - S6_DEFLECT_F) / 12) : 0;
      const hp = person(cam, haupt, 37.1, Math.max(0, -0.2 * Math.sin(smooth(dive) * Math.PI)), 1.5 * smooth(dive), { side: false, mirror: false }, { mode: "stand", expr: f > S6_GOAL_F + 8 ? "shock" : "stern", blink: lidAt(t, 603) }, {});
      hp.roll = -0.4 * smooth(dive);
      out.places.push(hp); blob(out, 37.1, 0, 0);
      tag("HAUPTMEIJER", "#a01d24", 37.1, 3.05, 0, 3.8);
      P(bali(0, 604), 31.5, 3.4, { mode: "stand", expr: f > S6_GOAL_F + 8 ? "shock" : "nervous", blink: lidAt(t, 604) });
      // bola: Peralta -> (disontek Menalo, PETIR) -> gawang Bali
      const bp = f < S6_SHOT_F ? [19.85, 0.17, 0.8] as V3
        : f < S6_DEFLECT_F ? lerp3([19.85, 0.17, 0.8], [27.5, 0.5, -0.7], (f - S6_SHOT_F) / (S6_DEFLECT_F - S6_SHOT_F))
        : f < S6_GOAL_F + 7 ? lerp3([27.5, 0.5, -0.7], [38.6, 1.1, 0.9], (f - S6_DEFLECT_F) / (S6_GOAL_F + 7 - S6_DEFLECT_F))
        : [38.6, 1.1, 0.9] as V3;
      ball(bp, f * 0.5);
      if (f >= S6_DEFLECT_F && f < S6_DEFLECT_F + 12) { // petir menyambar titik sontekan
        out.fx.push({ key: "bolt1", cw: 300, ch: 300, draw: drawBolt, x: 27.7, y: 1.5, z: -0.7, w: 1.5, h: 2.2 });
        out.fx.push({ key: "glowZ", cw: 300, ch: 300, draw: drawGlow("rgba(120,200,255,0.55)"), x: 27.6, y: 0.9, z: -0.7, w: 2.6, h: 2.6, soft: true });
        burst(27.6, 0.7, -0.7, (f - S6_DEFLECT_F) / 12, "#ffe93d", 1.6);
      }
      if (f >= S6_GOAL_F + 6 && f < S6_GOAL_F + 22) burst(38.5, 1.2, 0.9, (f - S6_GOAL_F - 6) / 16, "#ffe93d", 2.0);
      if (celeb) for (let k = 0; k < 3; k++)
        out.fx.push({ key: `conf6${k}${Math.floor(t * 2) % 4}`, cw: 500, ch: 300, draw: drawConfetti(Math.floor(t * 2) % 4 + k * 7), x: 20 + k * 6, y: 3.6, z: 0, w: 6, h: 3.6, soft: true });
      break;
    }
    case 7: { // komedi: Julio Cesar (BIRU) menggendong Queven (MERAH) keluar lapangan
      const walkU = clamp01((f - A[6]) / (SHOTS[6].b - A[6]));
      const jx = -3.5 + 8.5 * walkU;
      S({ i: 701, o: { ...kitPersib(5), build: "stout" }, okey: "julio" }, jx, -1, { mode: "march", phase: q(t * 1.7, 60), expr: "pained", blink: lidAt(t, 701), stride: 0.95, stomp: 1.1 }, false);
      tag("JULIO CESAR", "#14418f", jx, 3.0, -1, 3.6);
      // Queven terbaring horizontal di atas bahu Julio
      const qp = person(cam, bali(5, 702), jx - 0.85, 1.45, -0.9, { side: true, mirror: false }, {}, { mode: "stand", expr: "dazed", blink: 0, stride: 1 }, 0.96);
      qp.roll = 1.32;
      out.places.push(qp);
      tag("QUEVEN", "#a01d24", jx + 0.2, 3.6, -0.9, 2.8);
      const su = (t * 0.9) % 1;
      out.fx.push({ key: `stars${q(su, 30)}`, cw: 420, ch: 210, draw: (p) => fxStars(p, q(su, 30)), x: jx + 1.0, y: 2.6, z: -0.9, w: 1.1, h: 0.55 });
      P(persib(0, 703), -1, 3.6, { mode: "stand", expr: "laugh", blink: lidAt(t, 703) });
      P(bali(1, 704), 4.5, 3.8, { mode: "stand", expr: "laugh", blink: lidAt(t, 704) });
      ball([2, 0.17, 4.5]);
      break;
    }
    case 8: { // penutup: kartu merah Peralta (87'), bertahan 10 pemain, FT + perayaan
      if (f < A[7] + 150) {
        P(ref, 2.6, 0.4, { mode: "stand", expr: "stern", blink: lidAt(t, 801), armWave: f >= S8_CARD_F - 4 });
        if (f >= S8_CARD_F) out.fx.push({ key: "redcard", cw: 300, ch: 300, draw: drawCardRed, x: 3.3, y: 2.8, z: 0.4, w: 0.62, h: 0.62 });
        const px = f < S8_CARD_F + 18 ? 1.2 : 1.2 - 8.5 * smooth(clamp01((f - S8_CARD_F - 18) / 110));
        if (f < S8_CARD_F + 18) P(persib(2, 802), px, -0.6, { mode: "stand", expr: f >= S8_CARD_F ? "shock" : "neutral", blink: lidAt(t, 802) });
        else S(persib(2, 802), px, -0.6, { mode: "march", phase: q(t * 1.5, 60), expr: "pained", blink: lidAt(t, 802), stride: 0.8 }, true);
        tag("PERALTA", "#14418f", px, 2.9, -0.6);
        tag("KARTU MERAH!", "#a01d24", 2.7, 3.6, 0.4, 3.4);
      } else if (f < S8_WHISTLE_F) {
        // bertahan: barisan biru di depan gawang PERSIB + Teja; satu merah menembak, diblok
        for (let i = 0; i < 5; i++)
          P(persib(i, 811 + i), -29 + i * 2.0, -1.5 + (i % 2) * 2.6, { mode: "stand", expr: "stern", blink: lidAt(t, 811 + i) });
        S(bali(3, 817), -14.5, 0.5, { mode: "stand", expr: "stern", blink: lidAt(t, 817) }, true);
        const kF = A[7] + 200; // selaraskan kira-kira dengan event kick scene 8 (frac 0.55)
        const bp = f < kF ? [-15.35, 0.17, 0.5] as V3
          : f < kF + 11 ? lerp3([-15.35, 0.17, 0.5], [-23.5, 1.1, -0.6], (f - kF) / 11)
          : f < kF + 24 ? lerp3([-23.5, 1.1, -0.6], [-20, 0.17, 3.4], smooth((f - kF - 11) / 13))
          : [-20, 0.17, 3.4] as V3;
        ball(bp, f * 0.3);
        if (f >= kF + 10 && f < kF + 22) burst(-23.6, 1.2, -0.6, (f - kF - 10) / 12, "#ffffff", 1.4);
      } else {
        // perayaan FT: tim biru melompat kegirangan di tengah + konfeti
        for (let i = 0; i < 6; i++) {
          const jx = -6 + i * 2.4, jump = Math.abs(Math.sin(t * 5.2 + i * 0.9)) * 0.3;
          P(persib(i, 821 + i), jx, -1.5 + (i % 2) * 2.2, { mode: "stand", expr: i % 2 ? "laugh" : "grin", blink: lidAt(t, 821 + i), wave: q(0.5 + 0.4 * Math.sin(t * 5 + i), 30) }, 1, jump);
        }
        P(teja, -36.6, 0, { mode: "stand", expr: "grin", blink: lidAt(t, 827) });
        for (let k = 0; k < 4; k++)
          out.fx.push({ key: `conf8${k}${Math.floor(t * 2) % 4}`, cw: 500, ch: 300, draw: drawConfetti(Math.floor(t * 2) % 4 + k * 11), x: -8 + k * 6, y: 4.0, z: 0, w: 7, h: 4.2, soft: true });
        ball([1.5, 0.17, 2.5]);
      }
      break;
    }
  }
  return out;
};
export { FPS };

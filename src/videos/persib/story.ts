// Timeline remake cartoon-3D "Highlight Persib 2-1 Bali United" — 8 shot mengikuti
// PERSIS scene & timing versi stickman (captions.json dibuat dari data video
// stickman: frame per scene [212,299,294,297,317,341,242,364], total 2366 frame),
// supaya VO ArdiNeural + caption identik. Kamera: gaya skill (glide smootherstep,
// push-in, hard cut antar shot, kick 7 frame saat impact).
//
// PETA LAPANGAN (kunci fakta, JANGAN diubah tanpa cek checklist):
//   gawang PERSIB di x = -38 (kiper TEJA, biru) — gawang BALI UNITED di x = +38
//   (kiper HAUPTMEIJER, merah). Persib (biru) menyerang ke +x, Bali (merah) ke -x.
//   Kamera selalu dari sisi -Z sehingga gawang Persib di kiri layar, Bali di kanan.
import captionsData from "./captions.json";

export const FPS = 30;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

export const SCENE_FRAMES: number[] = captionsData.scenes.map((s) => s.frames);
export const SHOT_A: number[] = [];
{ let acc = 0; for (const n of SCENE_FRAMES) { SHOT_A.push(acc); acc += n; } }
export const TOTAL = SHOT_A[SHOT_A.length - 1] + SCENE_FRAMES[SCENE_FRAMES.length - 1];
export const SHOT_SEC = SHOT_A.map((a) => a / FPS);
export const FLASH_AT = TOTAL + 100; // tidak ada white flash di video ini

export type ShotDef = { id: number; a: number; b: number; light: "golden" };
export const SHOTS: ShotDef[] = SHOT_A.map((a, i) => ({ id: i + 1, a, b: a + SCENE_FRAMES[i], light: "golden" as const }));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
export const shotU = (id: number, f: number) => {
  const s = SHOTS[id - 1];
  return clamp01((f - s.a) / Math.max(1, s.b - s.a));
};

// ---------------- event frames (sinkron dengan trek SFX versi stickman) ----------------
const ev = (sceneIdx: number, frac: number) => SHOT_A[sceneIdx] + Math.round(frac * SCENE_FRAMES[sceneIdx]);
export const S2_KICK_F = ev(1, 0.38);   // Barros menendang
export const S2_POST_F = ev(1, 0.52);   // bola menghantam tiang gawang BALI
export const S2_VAR_F = ev(1, 0.72);    // peluit + momen VAR (penalti dianulir)
export const S4_KICK_F = ev(3, 0.30);   // tendangan bebas Yachida
export const S4_SAVE_F = ev(3, 0.48);   // Teja menepis
export const S4_GOAL_F = ev(3, 0.58);   // Dugandzic menyambar bola muntah -> gol Bali
export const S5_PASS_F = ev(4, 0.28);   // umpan Menalo
export const S5_CHARGE_F = ev(4, 0.44); // Peralta charge jurus
export const S5_SHOT_F = ev(4, 0.60);   // tembakan Peralta (boom) -> gol ke gawang Bali
export const S6_SHOT_F = ev(5, 0.34);   // tembakan Peralta
export const S6_DEFLECT_F = ev(5, 0.52);// sontekan Menalo (zap) -> gol ke gawang Bali
export const S6_GOAL_F = ev(5, 0.56);
export const S8_CARD_F = ev(7, 0.16);   // peluit + kartu merah Peralta
export const S8_WHISTLE_F = ev(7, 0.76);// peluit panjang FT

// ---------------- papan skor & label (dipakai Persib.tsx) ----------------
export const scoreAt = (f: number): string =>
  f < S4_GOAL_F + 6 ? "0 - 0" : f < S5_SHOT_F + 10 ? "0 - 1" : f < S6_GOAL_F + 8 ? "1 - 1" : "2 - 1";
export const MINUTE_LABEL = ["GBLA • MALAM INI", "BABAK 1", "MENIT 62'", "MENIT 66'", "MENIT 79'", "MENIT 81'", "MOMEN VIRAL", "MENIT 87'"];
// Kartu jurus hanya tampil di setup build-up; WAJIB hilang tepat saat cut ke
// kamera mulut gawang supaya momen gol tidak tertutup (temuan QC putaran 2).
export const JURUS1: [number, number] = [S5_CHARGE_F, S5_SHOT_F + 2];
export const JURUS2: [number, number] = [S6_DEFLECT_F - 42, S6_DEFLECT_F + 4];
export const VAR_CHIP: [number, number] = [S2_VAR_F, SHOT_A[1] + SCENE_FRAMES[1] - 6];
export const GOAL_BANNERS: { from: number; to: number; who: "bali" | "persib" }[] = [
  { from: S4_GOAL_F + 4, to: S4_GOAL_F + 55, who: "bali" },
  { from: S5_SHOT_F + 10, to: S5_SHOT_F + 62, who: "persib" },
  { from: S6_GOAL_F + 8, to: S6_GOAL_F + 62, who: "persib" },
];

// ---------------- geometri lapangan ----------------
export const GOAL_PERSIB_X = -38; // gawang Teja (biru)
export const GOAL_BALI_X = 38;    // gawang Hauptmeijer (merah)
export const POST_H = 2.44, GOAL_W = 7.32;

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number) => Math.exp(-rate * Math.max(0, f - f0));
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });

const A = SHOT_A;
// CATATAN FRAMING (hasil QC still putaran 1): potret 1080x1920 punya FOV
// horizontal hanya ~24 derajat — lebar tampak ~= 0.43 x jarak kamera. Karena itu
// tiap beat gol memakai DUA/TIGA setup kamera dengan CUT keras (gaya siaran bola):
// setup build-up dekat penendang, lalu cut ke kamera mulut gawang saat tembakan.
const CAMS: Record<number, Key[]> = {
  1: [ // pembuka: wide stadion malam meluncur masuk ke lapangan
    { f: A[0], s: (f) => dolly([-34, 17, -55], [0, 1, 0], pushK(f, A[0], 0.0012), { fov: 50 }) },
    { f: A[0] + 90, dur: 90, s: (f) => dolly([-16, 7.5, -34], [2, 1, 0], pushK(f, A[0] + 90, 0.0012), { fov: 46 }) },
  ],
  2: [ // babak 1: Barros -> cut mulut gawang Bali (tiang!) -> cut wasit VAR
    { f: A[1], s: (f) => dolly([9, 2.6, -13], [18.5, 1.2, -0.5], pushK(f, A[1], 0.0016), { fov: 42 }) },
    { f: S2_KICK_F + 2, cut: true, s: (f) => dolly([27.5, 2.8, -14.5], [36.8, 1.35, 0.2], pushK(f, S2_KICK_F + 2, 0.0012), { fov: 43 }) },
    { f: S2_VAR_F - 14, cut: true, s: (f) => dolly([3.5, 2.3, -9.5], [9, 1.35, 3], pushK(f, S2_VAR_F - 14, 0.0016), { fov: 40 }) },
  ],
  3: [ // pergantian: garis tepi dekat kamera (z negatif), pemain masuk berjalan
    { f: A[2], s: (f) => dolly([-5.5, 3.2, -20], [-4, 1.2, -6], pushK(f, A[2], 0.0014), { fov: 43 }) },
  ],
  4: [ // gol Bali: Yachida dekat -> cut mulut gawang Persib (Teja menepis, Dugandzic)
    { f: A[3], s: (f) => dolly([-20.5, 2.6, -12], [-15.5, 1.2, 0.6], pushK(f, A[3], 0.0016), { fov: 42 }) },
    { f: S4_KICK_F + 2, cut: true, s: (f) => dolly([-27, 3, -15.5], [-35.5, 1.3, -0.2], pushK(f, S4_KICK_F + 2, 0.0012), { fov: 43 }) },
  ],
  5: [ // gol Peralta: build-up + zoom slow-mo charge -> cut mulut gawang Bali -> cut perayaan
    { f: A[4], s: (f) => dolly([7.5, 2.8, -14], [17.5, 1.2, 0], pushK(f, A[4], 0.0016), { fov: 42 }) },
    { f: S5_CHARGE_F - 6, dur: 30, s: (f) => dolly([12.5, 2.3, -11.5], [20.8, 1.25, -0.2], pushK(f, S5_CHARGE_F - 6, 0.001), { fov: 36 }) },
    { f: S5_SHOT_F + 1, cut: true, s: (f) => dolly([27, 2.7, -13.5], [36.8, 1.4, 0.3], pushK(f, S5_SHOT_F + 1, 0.0012), { fov: 43 }) },
    { f: S5_SHOT_F + 26, cut: true, s: (f) => dolly([12, 2.4, -12], [19.5, 1.3, 0], pushK(f, S5_SHOT_F + 26, 0.0016), { fov: 41 }) },
  ],
  6: [ // gol Menalo: build-up -> cut mulut gawang Bali -> cut perayaan
    { f: A[5], s: (f) => dolly([14, 4.2, -24], [23, 1.2, 0], pushK(f, A[5], 0.0016), { fov: 46 }) },
    { f: S6_DEFLECT_F + 2, cut: true, s: (f) => dolly([28, 2.7, -13.5], [36.8, 1.35, 0.5], pushK(f, S6_DEFLECT_F + 2, 0.0012), { fov: 43 }) },
    { f: S6_GOAL_F + 24, cut: true, s: (f) => dolly([15, 2.4, -12], [23, 1.3, 0], pushK(f, S6_GOAL_F + 24, 0.0016), { fov: 41 }) },
  ],
  7: [ // gendong: kamera mengikuti Julio Cesar berjalan
    { f: A[6], s: (f) => dolly([-3.5, 2.6, -13.5], [-1, 1.4, -1], pushK(f, A[6], 0.0008), { fov: 42 }) },
    { f: A[6] + 50, dur: 140, s: (f) => dolly([5.5, 2.6, -13.5], [5.5, 1.4, -1], pushK(f, A[6] + 50, 0.0008), { fov: 42 }) },
  ],
  8: [ // penutup: kartu merah -> cut bertahan di depan gawang Persib -> wide perayaan
    { f: A[7], s: (f) => dolly([-1.5, 2.4, -11.5], [2.2, 1.35, 0], pushK(f, A[7], 0.0014), { fov: 41 }) },
    { f: A[7] + 150, cut: true, s: (f) => dolly([-16.5, 3.1, -16], [-25.5, 1.3, 0], pushK(f, A[7] + 150, 0.0014), { fov: 43 }) },
    { f: S8_WHISTLE_F - 8, dur: 55, s: (f) => dolly([-20, 9, -38], [0, 1, 0], pushK(f, S8_WHISTLE_F - 8, 0.001), { fov: 48 }) },
  ],
};

const KICKS: [number, number][] = [
  [S2_POST_F / FPS, 0.5], [S4_GOAL_F / FPS, 0.45], [S5_SHOT_F / FPS, 0.65], [S6_DEFLECT_F / FPS, 0.55],
];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; cInf: number; focus?: V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: A[1], cInf: 7, focus: [18.5, 1.2, -0.5] },
  { f: S2_KICK_F, cInf: 6, focus: [37, 1.35, 0.2] },
  { f: S2_VAR_F, cInf: 8, focus: [9, 1.35, 3] },
  { f: A[2], cInf: 8, focus: [-4, 1.2, -6] },
  { f: A[3], cInf: 7, focus: [-15.5, 1.2, 0.6] },
  { f: S4_KICK_F, cInf: 6, focus: [-36, 1.3, -0.2] },
  { f: A[4], cInf: 7, focus: [17.5, 1.2, 0] },
  { f: S5_SHOT_F, cInf: 6, focus: [37, 1.4, 0.3] },
  { f: A[5], cInf: 7, focus: [23, 1.2, 0] },
  { f: S6_DEFLECT_F, cInf: 6, focus: [37, 1.35, 0.5] },
  { f: A[6], cInf: 8, focus: [1, 1.4, -1] },
  { f: A[7], cInf: 7, focus: [2.2, 1.35, 0] },
  { f: A[7] + 150, cInf: 6, focus: [-25.5, 1.3, 0] },
  { f: S8_WHISTLE_F, cInf: 0 },
];
export const dofAt = (f: number) => {
  let d = DOF[0];
  for (const e of DOF) if (f >= e.f) d = e;
  return d;
};

// Timeline pilot "Kenapa Menara Pisa Bisa Miring?" — 6 shot, ±30 detik, Bahasa Indonesia.
// Shot boundaries are derived from the measured VO durations (timings.json, Edge TTS
// id-ID-GadisNeural) + a 0.22 s tail per shot, exactly like the cooking pipeline's
// scene timing. Camera grammar follows the skill: smootherstep glides, push-in holds,
// hard cuts on big reframes, 7-frame impact kicks, white flash after the hook.
import timings from "./timings.json";

export const FPS = 30;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };

const TAIL = 0.22;
const shotFrames = timings.sentences.map((s) => Math.round((s.durationSec + TAIL) * FPS));
export const SHOT_A: number[] = [];
{ let acc = 0; for (const n of shotFrames) { SHOT_A.push(acc); acc += n; } }
export const TOTAL = SHOT_A[SHOT_A.length - 1] + shotFrames[shotFrames.length - 1];
export const SHOT_SEC = SHOT_A.map((a) => a / FPS);
export const FLASH_AT = SHOT_A[1]; // white flash right after the hook (skill rule)

export type ShotDef = { id: number; a: number; b: number; light: "day" };
export const SHOTS: ShotDef[] = SHOT_A.map((a, i) => ({ id: i + 1, a, b: a + shotFrames[i], light: "day" as const }));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
export const sentenceAt = (f: number) => Math.min(6, shotAt(f).id);

/** tower lean in radians at shot id / global frame f. Lean grows as the story is told;
 *  banana = counter-tilt of the top levels from the builders' correction (shot 5+). */
export const leanAt = (id: number, f: number): { lean: number; banana: number; levels: number } => {
  const D = Math.PI / 180;
  const u = smooth((f - SHOTS[id - 1].a) / Math.max(1, SHOTS[id - 1].b - SHOTS[id - 1].a));
  switch (id) {
    case 1: return { lean: 7.0 * D, banana: 1.8 * D, levels: 6 };
    case 2: return { lean: 0, banana: 0, levels: 3 };
    case 3: return { lean: 0.4 * D, banana: 0, levels: 3 };
    case 4: return { lean: (0.4 + 4.1 * u) * D, banana: 0, levels: 3 + Math.floor(u * 3.99) };
    case 5: return { lean: (4.5 + 2.5 * u) * D, banana: 1.8 * D * u, levels: 6 };
    default: return { lean: 7.0 * D, banana: 1.8 * D, levels: 6 };
  }
};
/** hammer strike times (seconds, global) in shot 5 — the sound and the camera kick share these */
export const HAMMER_T = [0.7, 1.45, 2.2].map((s) => SHOT_SEC[4] + s);

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
// Cameras sit on the -X side so the +X lean reads toward screen RIGHT (the classic
// Pisa postcard direction) and cast.ts staging (+X = screen right) holds.
const CAMS: Record<number, Key[]> = {
  1: [ // hook, present day: wide 3/4 -> closer MS of the leaning tower
    { f: A[0], s: (f) => dolly([-14.5, 4.4, -30.5], [0, 6.6, -4], pushK(f, A[0], 0.0016), { fov: 46 }) },
    { f: A[0] + 70, dur: 34, s: (f) => dolly([-10.8, 3.4, -25.5], [0.3, 6.6, -4], pushK(f, A[0] + 70, 0.0016), { fov: 44, roll: 0.03 }) },
  ],
  2: [ // 1173: high wide over the pastel town, tower just started (scaffolding)
    { f: A[1], s: (f) => dolly([-17, 13.5, -33], [0, 3.0, -2], pushK(f, A[1], 0.0016), { fov: 44 }) },
  ],
  3: [ // foundation close-up: low lens on the soil cutaway diorama + shallow foundation
    { f: A[2], s: (f) => dolly([-8.6, 1.7, -18.5], [3.2, 1.0, -7.9], pushK(f, A[2], 0.002), { fov: 40 }) },
  ],
  4: [ // the lean grows: slow push, slight roll creeps in as it tips
    { f: A[3], s: (f) => dolly([-10.5, 3.0, -21.5], [0, 5.5, -4], pushK(f, A[3], 0.002), { fov: 42 }) },
    { f: A[4] - 40, dur: 30, s: (f) => dolly([-8.6, 2.7, -19.5], [0.4, 5.8, -4], pushK(f, A[4] - 40, 0.002), { fov: 40, roll: 0.045 }) },
  ],
  5: [ // correction: upper tower framing, hammer strikes land here
    { f: A[4], s: (f) => dolly([-10.5, 3.6, -24.5], [0.4, 5.8, -4], pushK(f, A[4], 0.002), { fov: 44 }) },
  ],
  6: [ // present day: crane/dolly out to the postcard wide
    { f: A[5], s: (f) => dolly([-8.5, 2.6, -20], [0, 6.2, -4], pushK(f, A[5], 0.0018), { fov: 42 }) },
    { f: A[5] + 40, dur: 120, s: (f) => dolly([-14.5, 6.0, -31], [0, 6.6, -4], 1, { fov: 44 }) },
  ],
};

const KICKS: [number, number][] = [...HAMMER_T.map((t) => [t, 0.45] as [number, number]), [SHOT_SEC[3] + (SHOT_SEC[4] - SHOT_SEC[3]) * 0.82, 0.6]];
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
  { f: 0, cInf: 6, focus: [0, 7, -4] },
  { f: A[1], cInf: 0 },
  { f: A[2], cInf: 12, focus: [4.6, 1.0, -8.2] },
  { f: A[3], cInf: 9, focus: [0, 5.5, -4] },
  { f: A[4], cInf: 10, focus: [0.4, 7.2, -4] },
  { f: A[5], cInf: 0 },
];
export const dofAt = (f: number) => {
  let d = DOF[0];
  for (const e of DOF) if (f >= e.f) d = e;
  return d;
};

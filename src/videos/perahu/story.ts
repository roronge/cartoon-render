// Timeline "Kenapa Perahu Besi Raksasa Bisa Mengapung?" — 6 shot, ±30 detik, Bahasa
// Indonesia. Shot boundaries derive from the measured VO durations (timings.json,
// Edge TTS id-ID-GadisNeural) + a 0.22 s tail per shot, exactly like the Pisa pilot.
// Camera grammar follows the skill: smootherstep glides, push-in holds, hard cuts on
// big reframes, 7-frame impact kicks, white flash after the hook.
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

export type ShotDef = { id: number; a: number; b: number; light: "day" | "golden" };
export const SHOTS: ShotDef[] = SHOT_A.map((a, i) => ({
  id: i + 1, a, b: a + shotFrames[i], light: (i === 5 ? "golden" : "day") as "day" | "golden",
}));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
export const sentenceAt = (f: number) => Math.min(6, shotAt(f).id);
const shotU = (id: number, f: number) => {
  const s = SHOTS[id - 1];
  return clamp01((f - s.a) / Math.max(1, s.b - s.a));
};

// ---------------- story beats (shared by world.ts, cast.ts, build_audio) ----------------
/** seconds into shot 2 when the nail hits the water; into shot 3 when the bowl lands */
export const NAIL_T = 1.55, BOWL_T = 1.05;
/** container landings in shot 5, as fractions of the shot (crane drops) */
export const LAND_U = [0.48, 0.82];
export const LAND_T = LAND_U.map((u) => SHOT_SEC[4] + u * (SHOTS[4].b - SHOTS[4].a) / FPS);

export type ShipPose = {
  x: number; z: number; sink: number; bobY: number; rotZ: number; rotX: number;
  extraStacks: number; craneY: [number, number]; craneOn: boolean;
};
/** the container ship: berthed in shots 1 & 5, sailing away at golden hour in shot 6.
 *  In shot 5 it sinks as containers land (LAND_U) and the extra deck stacks appear. */
export const shipAt = (id: number, f: number): ShipPose => {
  const t = f / FPS, u = shotU(id, f);
  const bobY = 0.07 * Math.sin(t * 0.9), rotZ = 0.008 * Math.sin(t * 0.9 + 0.6), rotX = 0.005 * Math.sin(t * 0.7 + 1.2);
  if (id === 6) {
    const e = glide(u);
    return { x: -4 + 20 * e, z: -34 - 38 * e, sink: 0.55, bobY, rotZ, rotX, extraStacks: 2, craneY: [99, 99], craneOn: false };
  }
  if (id === 5) {
    const landed = LAND_U.filter((lu) => u >= lu).length;
    const sink = 0.62 * smooth((u - 0.05) / 0.55);
    // crane container 1 descends u .12->.48, container 2 descends u .52->.82 (lands on deck stack)
    const cy = (u0: number, u1: number) => 13 - (13 - 6.6) * glide((u - u0) / (u1 - u0));
    return { x: 0, z: -13, sink, bobY, rotZ, rotX, extraStacks: landed, craneY: [cy(0.12, 0.48), cy(0.52, 0.82)], craneOn: true };
  }
  return { x: 0, z: -13, sink: 0, bobY, rotZ, rotX, extraStacks: 0, craneY: [99, 99], craneOn: false };
};

export type TubPose = { nailY: number; nailRot: number; nailOn: boolean; bowlY: number; bowlRot: number; bowlOn: boolean };
/** the experiment tub (shots 2-3): nail drops, splashes at NAIL_T, sinks and tips over
 *  on the tub floor; the steel bowl is set on the water at BOWL_T and bobs. */
export const tubAt = (id: number, f: number): TubPose => {
  const t = f / FPS;
  if (id === 2) {
    const lt = t - SHOTS[1].a / FPS; // seconds into shot 2
    const fall = smooth((lt - (NAIL_T - 0.45)) / 0.45);          // hand -> water
    const sink = smooth((lt - NAIL_T) / 0.8);                    // water -> floor
    const y = 2.75 - (2.75 - 1.3) * fall - (1.3 - 0.32) * sink;
    return { nailY: y, nailRot: sink * 1.25, nailOn: true, bowlY: 0, bowlRot: 0, bowlOn: false };
  }
  if (id === 3) {
    const lt = t - SHOTS[2].a / FPS;
    const set = smooth((lt - (BOWL_T - 0.5)) / 0.5);
    const y = 2.3 - (2.3 - 1.55) * set + (set >= 1 ? 0.045 * Math.sin(t * 2.1) : 0);
    return { nailY: 0.32, nailRot: 1.25, nailOn: true, bowlY: y, bowlRot: set >= 1 ? 0.05 * Math.sin(t * 1.7) : 0, bowlOn: true };
  }
  return { nailY: 0, nailRot: 0, nailOn: false, bowlY: 0, bowlRot: 0, bowlOn: false };
};

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
// Geography: quay deck top y=0 (z >= 4), sea surface y=-1.6 (z < 4), ship berthed at
// z=-13 along X. Cameras stand on the quay (+Z) looking out to sea (-Z).
const CAMS: Record<number, Key[]> = {
  1: [ // hook: wide hero — giant container ship behind two tiny humans on the quay
    { f: A[0], s: (f) => dolly([13.5, 3.6, 21.5], [0.5, 2.7, -13], pushK(f, A[0], 0.0016), { fov: 48 }) },
    { f: A[0] + 70, dur: 34, s: (f) => dolly([11.8, 3.2, 19.5], [0.8, 2.8, -13], pushK(f, A[0] + 70, 0.0016), { fov: 46, roll: 0.02 }) },
  ],
  2: [ // experiment 1: the tub, the nail drops in (pulled back so the kids flank it)
    { f: A[1], s: (f) => dolly([4.4, 3.5, 16.8], [4.2, 0.8, 7.5], pushK(f, A[1], 0.002), { fov: 42 }) },
  ],
  3: [ // experiment 2: same tub, other shoulder — the bowl floats (pulled back like shot 2)
    { f: A[2], s: (f) => dolly([7.4, 3.6, 17.4], [4.2, 0.9, 7.5], pushK(f, A[2], 0.002), { fov: 42 }) },
  ],
  4: [ // hull cross-section diorama with the two force arrows (wide enough for all of it)
    { f: A[3], s: (f) => dolly([-4.4, 3.6, 20.5], [-4.5, 1.9, 5], pushK(f, A[3], 0.002), { fov: 44 }) },
  ],
  5: [ // loading: crane drops containers, the ship sits deeper
    { f: A[4], s: (f) => dolly([-15, 5.4, 23.5], [3, 2.2, -13], pushK(f, A[4], 0.0016), { fov: 44 }) },
    { f: A[5] - 46, dur: 34, s: (f) => dolly([-13.2, 4.8, 21.5], [3.4, 2.0, -13], pushK(f, A[5] - 46, 0.0016), { fov: 42, roll: -0.02 }) },
  ],
  6: [ // golden: the ship sails away, kid waves from the quay (gentle push: the long
    // dolly distance turns a normal pushK into metres of travel that swallows the fg)
    { f: A[5], s: (f) => dolly([14, 3.4, 22], [2.5, 1.6, -42], pushK(f, A[5], 0.0004), { fov: 42 }) },
  ],
};

const KICKS: [number, number][] = [
  [SHOT_SEC[1] + NAIL_T, 0.4],
  [SHOT_SEC[2] + BOWL_T, 0.28],
  ...LAND_T.map((t) => [t, 0.5] as [number, number]),
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
  { f: 0, cInf: 2.5, focus: [0, 4, -13] },
  { f: A[1], cInf: 10, focus: [4.2, 1.0, 7.5] },
  { f: A[2], cInf: 10, focus: [4.2, 1.1, 7.5] },
  { f: A[3], cInf: 8, focus: [-4.5, 2.0, 5] },
  { f: A[4], cInf: 4, focus: [3, 3, -13] },
  { f: A[5], cInf: 0 },
];
export const dofAt = (f: number) => {
  let d = DOF[0];
  for (const e of DOF) if (f >= e.f) d = e;
  return d;
};

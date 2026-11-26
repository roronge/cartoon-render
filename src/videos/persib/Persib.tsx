// Remake cartoon-3D "Highlight Persib 2-1 Bali United" — rantai post mengikuti
// template skill (ink -> lens pre -> lens main -> bloom -> NEUTRAL -> grade,
// MSAA 4). Adaptasi user: narasi Bahasa Indonesia + subtitle dari data caption
// versi stickman (timing kata asli Edge TTS), papan skor animasi, kartu jurus,
// chip VAR, banner GOL — semuanya overlay DOM di atas dunia 3D.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { loadFont } from "@remotion/fonts";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { TOTAL, FLASH_AT, SHOTS, dofAt, shotAt, scoreAt, MINUTE_LABEL, JURUS1, JURUS2, VAR_CHIP, GOAL_BANNERS, S8_WHISTLE_F, FPS } from "./story";
import captionsData from "./captions.json";

export const PERSIB_FRAMES = TOTAL;

const POST = (getInputProps() as { post?: Record<string, boolean> }).post ?? {};

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = (b as unknown as { mipmapBlurPass?: { setSize: (w: number, h: number) => void } }).mipmapBlurPass;
  if (mip) {
    const setSize = mip.setSize.bind(mip);
    mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  }
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl, size } = useThree();
  const world = useMemo(() => new World(), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const on = POST;
  const composer = useMemo(() => {
    if (on.raw === false) return null;
    const c = new EffectComposer(gl, { multisampling: on.ms === false ? 0 : 4, frameBufferType: on.halffloat === false ? THREE.UnsignedByteType : THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    if (on.ink !== false) c.addPass(fx.ink);
    if (on.lens !== false) { c.addPass(new EffectPass(camera, fx.lens.pre)); c.addPass(new EffectPass(camera, fx.lens.main)); }
    if (on.bloom !== false) c.addPass(new EffectPass(camera, fx.bloom));
    c.addPass(new EffectPass(camera, fx.tone));
    if (on.grade !== false) c.addPass(new EffectPass(camera, fx.grade));
    return c;
  }, [gl, scene, camera, fx, on]);
  const lastSize = React.useRef({ w: 0, h: 0 });
  useEffect(() => {
    if (!composer) return;
    if (lastSize.current.w === size.width && lastSize.current.h === size.height) return;
    lastSize.current = { w: size.width, h: size.height };
    composer.setSize(size.width, size.height);
  }, [composer, size]);
  useMemo(() => { gl.shadowMap.autoUpdate = false; }, [gl]);
  useFrame(() => { gl.shadowMap.needsUpdate = true; composer?.render(); }, 1);
  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  return <primitive object={world.root} dispose={null} />;
};

const usePoppins = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("poppins"));
  useEffect(() => {
    loadFont({ family: "Poppins", url: staticFile("fonts/Poppins-Bold.ttf"), weight: "700" })
      .then(() => { setReady(true); continueRender(handle); })
      .catch(() => { setReady(true); continueRender(handle); });
  }, [handle]);
  return ready;
};

const OUTLINE = [
  "3px 0 0 #1c1420", "-3px 0 0 #1c1420", "0 3px 0 #1c1420", "0 -3px 0 #1c1420",
  "2px 2px 0 #1c1420", "-2px 2px 0 #1c1420", "2px -2px 0 #1c1420", "-2px -2px 0 #1c1420",
  "0 6px 14px rgba(0,0,0,0.45)",
].join(", ");

const popIn = (f: number, from: number, to: number) => {
  if (f < from || f > to) return 0;
  const inK = Math.min(1, (f - from) / 6), outK = Math.min(1, (to - f) / 6);
  return Math.min(inK, outK) * (0.85 + 0.15 * Math.sin(Math.min(1, (f - from) / 6) * Math.PI * 0.5));
};

export const PersibShort: React.FC = () => {
  const f = useCurrentFrame();
  const fontReady = usePoppins();
  if (!fontReady) return null;
  const id = shotAt(f).id;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  const tSec = f / FPS;
  const cap = captionsData.captions.find((c) => tSec >= c.start && tSec < c.end);
  const score = scoreAt(f);
  const ft = f >= S8_WHISTLE_F;
  const jurus1 = popIn(f, JURUS1[0], JURUS1[1]);
  const jurus2 = popIn(f, JURUS2[0], JURUS2[1]);
  const varChip = popIn(f, VAR_CHIP[0], VAR_CHIP[1]);
  const goal = GOAL_BANNERS.find((g) => f >= g.from && f <= g.to);
  const goalK = goal ? popIn(f, goal.from, goal.to) : 0;
  const titleK = id === 1 && f < 118 ? Math.min(1, f / 10, (118 - f) / 14) : 0;
  const endK = ft ? Math.min(1, (f - S8_WHISTLE_F) / 12) : 0;
  return (
    <AbsoluteFill style={{ background: "#101c38" }}>
      <AbsoluteFill>
        <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
          camera={{ fov: 40, near: 0.2, far: 1500 }}>
          <Inner id={id} />
        </ThreeCanvas>
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}

      {/* papan skor */}
      <div style={{ position: "absolute", top: 54, left: 40, fontFamily: "Poppins", fontWeight: 700 }}>
        <div style={{ display: "flex", alignItems: "stretch", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)", border: "3px solid rgba(255,255,255,0.85)" }}>
          <div style={{ background: "#14418f", color: "#fff", fontSize: 37, padding: "10px 18px" }}>PERSIB</div>
          <div style={{ background: "#0d1526", color: "#ffd94d", fontSize: 40, padding: "8px 20px", minWidth: 128, textAlign: "center" }}>{score}</div>
          <div style={{ background: "#a01d24", color: "#fff", fontSize: 37, padding: "10px 18px" }}>BALI UTD</div>
          {ft && <div style={{ background: "#ffd94d", color: "#0d1526", fontSize: 37, padding: "10px 16px" }}>FT</div>}
        </div>
        <div style={{ marginTop: 10, display: "inline-block", background: "rgba(10,16,30,0.78)", color: "#cfe0ff", fontSize: 27, padding: "6px 16px", borderRadius: 999 }}>
          {MINUTE_LABEL[id - 1]}
        </div>
      </div>

      {/* kartu judul pembuka */}
      {titleK > 0 && (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 300, opacity: titleK }}>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 40, color: "#ffd94d", textShadow: OUTLINE, letterSpacing: 2 }}>SUPER LEAGUE • PEKAN 10</div>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 92, color: "#ffffff", textShadow: OUTLINE, textAlign: "center", lineHeight: 1.12, marginTop: 14 }}>
            PERSIB vs<br />BALI UNITED
          </div>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 34, color: "#cfe0ff", textShadow: OUTLINE, marginTop: 16 }}>STADION GBLA • 22 NOV 2026</div>
        </AbsoluteFill>
      )}

      {/* chip VAR */}
      {varChip > 0 && (
        <div style={{ position: "absolute", top: 300, right: 44, transform: `scale(${0.7 + 0.3 * varChip})`, opacity: varChip, background: "#e02626", color: "#fff", fontFamily: "Poppins", fontWeight: 700, fontSize: 40, padding: "14px 26px", borderRadius: 18, border: "4px solid #fff", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          📺 PENALTI DIANULIR VAR!
        </div>
      )}

      {/* kartu jurus */}
      {jurus1 > 0 && (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 330, opacity: jurus1 }}>
          <div style={{ transform: `scale(${0.8 + 0.2 * jurus1}) rotate(-3deg)`, background: "linear-gradient(135deg,#ff7a1a,#e02626)", border: "6px solid #ffd94d", borderRadius: 26, padding: "22px 40px", boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 28, color: "#ffe9b0", textAlign: "center", letterSpacing: 3 }}>JURUS SPESIAL</div>
            <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 58, color: "#ffffff", textShadow: OUTLINE, textAlign: "center", lineHeight: 1.15 }}>TENDANGAN<br />MACAN GBLA!</div>
          </div>
        </AbsoluteFill>
      )}
      {jurus2 > 0 && (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 330, opacity: jurus2 }}>
          <div style={{ transform: `scale(${0.8 + 0.2 * jurus2}) rotate(3deg)`, background: "linear-gradient(135deg,#1a6aff,#12275e)", border: "6px solid #ffe93d", borderRadius: 26, padding: "22px 40px", boxShadow: "0 18px 50px rgba(0,0,0,0.6)" }}>
            <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 28, color: "#bfe0ff", textAlign: "center", letterSpacing: 3 }}>JURUS SPESIAL</div>
            <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 58, color: "#ffffff", textShadow: OUTLINE, textAlign: "center", lineHeight: 1.15 }}>SONTEKAN PETIR!</div>
          </div>
        </AbsoluteFill>
      )}

      {/* banner GOL */}
      {goal && (
        <div style={{ position: "absolute", top: 460, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: goalK }}>
          <div style={{ transform: `scale(${0.75 + 0.25 * goalK})`, fontFamily: "Poppins", fontWeight: 700, fontSize: 118, color: goal.who === "persib" ? "#ffd94d" : "#ff8a8a", textShadow: OUTLINE, letterSpacing: 2 }}>
            GOOOL!!!
          </div>
        </div>
      )}

      {/* kartu penutup */}
      {endK > 0 && (
        <div style={{ position: "absolute", top: 330, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: endK }}>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 66, color: "#ffffff", textShadow: OUTLINE, textAlign: "center", lineHeight: 1.15 }}>COMEBACK DRAMATIS<br />DI GBLA!</div>
          <div style={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 40, color: "#ffd94d", textShadow: OUTLINE, marginTop: 10 }}>PERSIB 2 - 1 BALI UNITED</div>
        </div>
      )}

      {/* subtitle narasi */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150 }}>
        <div style={{
          fontFamily: "Poppins", fontWeight: 700, fontSize: 47, lineHeight: 1.28, color: "#ffffff",
          textAlign: "center", maxWidth: "88%", textShadow: OUTLINE,
        }}>{cap?.text ?? ""}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

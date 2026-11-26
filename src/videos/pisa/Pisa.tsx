// "Kenapa Menara Pisa Bisa Miring?" — pilot cartoon-3d-short, Bahasa Indonesia.
// Post chain follows the skill template (Bridge.tsx): ink -> lens pre -> lens main ->
// bloom (emissive only) -> NEUTRAL tone map -> grade, MSAA 4. Adaptation for this
// user: Indonesian narration subtitles ARE shown (the original skill's "no captions"
// rule belongs to its author's channel), styled like the user's other series.
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
import { TOTAL, FLASH_AT, SHOTS, dofAt, shotAt } from "./story";
import timings from "./timings.json";

export const PISA_FRAMES = TOTAL;

// Read input props ONCE at module scope: getInputProps() returns a fresh object on
// every call, and using it inside the component made the composer useMemo rebuild
// the whole post chain (and leak its render targets) on every frame — the cause of
// the render OOM. Module scope keeps every memo dependency stable across frames.
const POST = (getInputProps() as { post?: Record<string, boolean> }).post ?? {};

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  // mipmapBlurPass exists at runtime in postprocessing 6.35 but is not in its public types
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
  const { camera, scene, gl, size, viewport } = useThree();
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
  // NOTE: @react-three/postprocessing 2.16.2 does not pick up raw effect instances
  // passed as <primitive> children (renders blank — verified by bisection), so the
  // composer is built imperatively from 'postprocessing' and driven via useFrame.
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
    // Guard by VALUE: useThree's size object changes identity between frames, and an
    // unguarded setSize makes the composer dispose + recreate every render target
    // every frame (the real cause of the ~16 s/frame render cost).
    if (lastSize.current.w === size.width && lastSize.current.h === size.height) return;
    lastSize.current = { w: size.width, h: size.height };
    composer.setSize(size.width, size.height);
  }, [composer, size]);
  // Shadow maps: the sun is frozen per shot and the scene is static within a frame,
  // but InkPass renders the scene several times per frame — render the shadow map
  // once per frame instead of once per pass (a large SwiftShader cost).
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

export const PisaShort: React.FC = () => {
  const f = useCurrentFrame();
  const fontReady = usePoppins();
  if (!fontReady) return null;
  const id = shotAt(f).id;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  const sentence = timings.sentences[id - 1]?.text ?? "";
  return (
    <AbsoluteFill style={{ background: "#b8d0ec" }}>
      <AbsoluteFill>
        <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
          camera={{ fov: 40, near: 0.2, far: 1500 }}>
          <Inner id={id} />
        </ThreeCanvas>
      </AbsoluteFill>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150 }}>
        <div style={{
          fontFamily: "Poppins", fontWeight: 700, fontSize: 47, lineHeight: 1.28, color: "#ffffff",
          textAlign: "center", maxWidth: "88%", textShadow: OUTLINE,
        }}>{sentence}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

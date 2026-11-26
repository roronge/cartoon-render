import React, { useMemo } from "react";
import { AbsoluteFill, getInputProps } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EffectComposer, BrightnessContrast } from "@react-three/postprocessing";
import { ToneMappingEffect, ToneMappingMode } from "postprocessing";

export const GlTest: React.FC = () => {
  const p = getInputProps() as { fx?: boolean; prim?: boolean };
  const tone = useMemo(() => new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), []);
  return (
    <AbsoluteFill style={{ background: "#202020" }}>
      <ThreeCanvas width={540} height={960} camera={{ fov: 50, position: [0, 0, 6] }}>
        <color attach="background" args={["#2255cc"]} />
        <ambientLight intensity={1.2} />
        <mesh rotation={[0.6, 0.8, 0]}>
          <boxGeometry args={[2.2, 2.2, 2.2]} />
          <meshStandardMaterial color="#e33" />
        </mesh>
        {p.fx === false ? null : (
          <EffectComposer>
            {p.prim ? <primitive object={tone} dispose={null} /> : <BrightnessContrast contrast={0.2} />}
          </EffectComposer>
        )}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

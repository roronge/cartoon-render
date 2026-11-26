import React from "react";
import { Composition } from "remotion";
import { PisaShort } from "./videos/pisa/Pisa";
import { TOTAL, FPS } from "./videos/pisa/story";
import { PerahuShort } from "./videos/perahu/Perahu";
import { TOTAL as PERAHU_TOTAL, FPS as PERAHU_FPS } from "./videos/perahu/story";
import { PersibShort } from "./videos/persib/Persib";
import { TOTAL as PERSIB_TOTAL, FPS as PERSIB_FPS } from "./videos/persib/story";

export const Root: React.FC = () => (
  <>
    <Composition id="PisaShort" component={PisaShort} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
    <Composition id="PerahuShort" component={PerahuShort} durationInFrames={PERAHU_TOTAL} fps={PERAHU_FPS} width={1080} height={1920} />
    <Composition id="PersibShort" component={PersibShort} durationInFrames={PERSIB_TOTAL} fps={PERSIB_FPS} width={1080} height={1920} />
  </>
);

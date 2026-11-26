// Perahu world geometry: a working harbour — sea, quay, a giant container ship
// (hull with painted waterline/draft marks, deck stacks, stern castle), a portal
// crane, the experiment tub (nail + steel bowl) and a hull cross-section diorama
// for the buoyancy explanation. Everything is procedural with painted Canvas2D
// textures (paint.ts) and two-tone materials (shade.ts) — no external assets.
import * as THREE from "three";
import { ctex, rep, cobbleHD, stoneHD, facadeHD, cloudHD, water } from "./paint";
import { twoTone } from "./shade";

const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const WATER_Y = -1.6;
/** ship deck bays (local x) the crane tops up in shot 5 */
export const LOAD_BAYS = [3.5, 10];

// ---------------- painted textures specific to the harbour ----------------
const INK = "#241726";
/** hull side: red below the waterline (38.5% from the bottom = y -1.6 of -4.6..3.2),
 *  deep navy above, white draft ticks at both ends, a Plimsoll circle amidships */
const hullSide = () => ctex("shipHullSide", 2048, 512, (g, r) => {
  g.fillStyle = "#a33327"; g.fillRect(0, 0, 2048, 512);
  const wl = 512 * (1 - 0.385); // canvas y of the waterline (canvas y grows downward)
  g.fillStyle = "#274b73"; g.fillRect(0, 0, 2048, wl);
  g.fillStyle = "#f4f1e6"; g.fillRect(0, wl - 7, 2048, 14); // boot-top stripe
  g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(0, 30, 2048, 60); // sheen band
  g.strokeStyle = "rgba(10,16,26,0.35)"; g.lineWidth = 4; // plate seams
  for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * 204.8, 12); g.lineTo(i * 204.8, wl - 12); g.stroke(); }
  g.fillStyle = "#f4f1e6"; // draft ticks near bow (right) and stern (left)
  for (const bx of [90, 1830]) for (let i = 0; i < 5; i++) g.fillRect(bx, wl - 26 - i * 44, i % 2 ? 44 : 74, 9);
  g.strokeStyle = "#f4f1e6"; g.lineWidth = 10; // Plimsoll mark amidships
  g.beginPath(); g.arc(1024, wl - 92, 52, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(950, wl - 92); g.lineTo(1098, wl - 92); g.stroke();
  g.fillStyle = "rgba(244,241,230,0.92)"; // name plate (abstract bars — no lettering)
  g.fillRect(1560, 66, 300, 40);
  void r;
});
/** corrugated container side in a given livery colour */
const containerSide = (key: string, base: string, dark: string) => ctex(key, 1024, 448, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 448);
  for (let x = 16; x < 1024; x += 42) { // corrugation ribs
    g.fillStyle = dark; g.fillRect(x, 0, 13, 448);
    g.fillStyle = "rgba(255,255,255,0.13)"; g.fillRect(x + 13, 0, 7, 448);
  }
  g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, 0, 1024, 20); g.fillRect(0, 428, 1024, 20);
  g.fillStyle = "rgba(244,241,230,0.85)"; g.fillRect(700, 60, 240, 34); // label plate (no lettering)
  void r;
});
const galvanized = () => ctex("tubGalv", 512, 256, (g, r) => {
  g.fillStyle = "#b9c2c9"; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,134,146,${0.05 + r() * 0.1})`; g.fillRect(r() * 512, r() * 256, 3 + r() * 9, 2 + r() * 5); }
  g.fillStyle = "rgba(70,84,96,0.5)"; g.fillRect(0, 118, 512, 8);
});

// ---------------- sea + quay ----------------
export const buildHarbor = (root: THREE.Group) => {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(560, 340), lam("sea", () => ({ map: rep(water(), 56, 34) })));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, WATER_Y, -150); sea.receiveShadow = true; root.add(sea);
  // quay: concrete deck, top at y=0, front edge at z=4
  const quay = new THREE.Mesh(new THREE.BoxGeometry(170, 2.2, 36),
    [lam("quaySide", () => ({ color: "#8d9299" })), lam("quaySide", () => ({ color: "#8d9299" })),
     lam("quayTop", () => ({ map: rep(cobbleHD(), 26, 6) })), lam("quaySide", () => ({ color: "#6e7278" })),
     lam("quaySide", () => ({ color: "#8d9299" })), lam("quaySide", () => ({ color: "#8d9299" }))]);
  quay.position.set(0, -1.1, 22); quay.receiveShadow = true; root.add(quay);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(170, 0.5, 0.7), lam("quayEdge", () => ({ color: "#565b61" })));
  edge.position.set(0, -0.45, 4.1); root.add(edge);
  // bollards + lamp posts along the edge
  const bol = lam("bollard", () => ({ color: "#2e3134" }));
  for (let x = -48; x <= 48; x += 12) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.62, 10), bol);
    b.position.set(x, 0.31, 5.1); root.add(b); // no shadow: thin props cast long unexplained streaks at golden hour
  }
  const poleM = lam("lampPole", () => ({ color: "#3c4147" }));
  for (const x of [-32, 0, 32]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.6, 8), poleM);
    p.position.set(x, 2.8, 6.4); root.add(p);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.4), poleM);
    head.position.set(x, 5.65, 6.1); root.add(head);
  }
};

// ---------------- the container ship ----------------
export type Ship = { group: THREE.Group };
const CONT_COLS: [string, string][] = [
  ["#b5502e", "#8f3d21"], ["#2e6da8", "#215380"], ["#3f8a52", "#2f6a3e"],
  ["#d08a2d", "#a96f22"], ["#7a8288", "#5d646a"], ["#8a4a7a", "#6d3a61"],
];
const container = (ci: number) => {
  const [base, dark] = CONT_COLS[ci % CONT_COLS.length];
  const side = lam(`cont${ci}`, () => ({ map: containerSide(`cont${ci}`, base, dark) }));
  const end = lam(`contEnd${ci}`, () => ({ color: dark }));
  const m = new THREE.Mesh(new THREE.BoxGeometry(6.06, 2.6, 2.44), [end, end, end, end, side, side]);
  m.castShadow = m.receiveShadow = true;
  return m;
};
export const buildShip = (): Ship => {
  const group = new THREE.Group();
  const navy = lam("shipNavy", () => ({ color: "#274b73" }));
  const red = lam("shipRed", () => ({ color: "#a33327" }));
  const hullSideM = lam("shipHull", () => ({ map: hullSide() }));
  const deckM = lam("shipDeck", () => ({ color: "#5d6d66" }));
  // main hull: y -4.6..3.2, x -20..20, beam 9.6
  const hull = new THREE.Mesh(new THREE.BoxGeometry(40, 7.8, 9.6), [navy, navy, deckM, red, hullSideM, hullSideM]);
  hull.position.y = -0.7; hull.castShadow = hull.receiveShadow = true; group.add(hull);
  // bow wedge (plan-view triangle extruded vertically), split at the waterline colours
  const bowShape = new THREE.Shape();
  bowShape.moveTo(0, -4.8); bowShape.lineTo(7.5, 0); bowShape.lineTo(0, 4.8); bowShape.closePath();
  const bowLow = new THREE.Mesh(new THREE.ExtrudeGeometry(bowShape, { depth: 3.0, bevelEnabled: false }), red);
  bowLow.rotation.x = -Math.PI / 2; bowLow.position.set(20, -4.6, 0); bowLow.castShadow = true; group.add(bowLow);
  const bowHigh = new THREE.Mesh(new THREE.ExtrudeGeometry(bowShape, { depth: 4.8, bevelEnabled: false }), navy);
  bowHigh.rotation.x = -Math.PI / 2; bowHigh.position.set(20, -1.6, 0); bowHigh.castShadow = true; group.add(bowHigh);
  // bulwark rails along the deck edge
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(40.4, 0.85, 0.18), navy);
    rail.position.set(0, 3.62, s * 4.72); rail.castShadow = true; group.add(rail);
  }
  // deck container stacks: bays x2-high, loading bays start 1-high (crane tops them up)
  const bays: [number, number][] = [[-16, 2], [-9.5, 2], [-3, 2], [LOAD_BAYS[0], 1], [LOAD_BAYS[1], 1], [16.5, 2]];
  bays.forEach(([bx, h], bi) => {
    for (let i = 0; i < h; i++) {
      const c = container(bi * 2 + i);
      c.position.set(bx, 3.2 + 1.3 + i * 2.6, 0); group.add(c);
    }
  });
  // a second row aft for depth
  for (const [bx, ci] of [[-9.5, 3], [16.5, 4]] as [number, number][]) {
    const c = container(ci);
    c.position.set(bx, 4.5, -2.7); group.add(c);
  }
  // stern castle: white accommodation block + window bands + funnel
  const castle = new THREE.Group(); castle.position.set(-16.8, 3.2, 0);
  const cwall = lam("castleWall", () => ({ color: "#eef0ea" }));
  const block = new THREE.Mesh(new THREE.BoxGeometry(5.6, 7.0, 8.2), cwall);
  block.position.y = 3.5; block.castShadow = block.receiveShadow = true; castle.add(block);
  const winM = lam("castleWin", () => ({ color: "#22384f" }));
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.62, 8.3), winM);
    band.position.y = 2.2 + i * 1.9; castle.add(band);
  }
  const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.5, 9.0), cwall);
  bridgeTop.position.y = 7.6; bridgeTop.castShadow = true; castle.add(bridgeTop);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 3.6, 14), lam("funnel", () => ({ color: "#c8502e" })));
  funnel.position.set(-2.2, 8.6, 0); castle.add(funnel); // no shadow: thin/tall parts rake unreadable streaks across the water at golden hour
  group.add(castle);
  // fore mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 8), navy);
  mast.position.set(23.5, 6.4, 0); group.add(mast);
  return { group };
};

// ---------------- portal crane (shot 5) ----------------
export type Crane = { group: THREE.Group; loads: THREE.Group[]; cables: THREE.Mesh[] };
export const buildCrane = (): Crane => {
  const group = new THREE.Group();
  const steel = lam("craneSteel", () => ({ color: "#d8722c" }));
  const dark = lam("craneDark", () => ({ color: "#4a4238" }));
  for (const lx of [-3.1, 3.1]) for (const lz of [3.5, 11.5]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 13.4, 0.55), steel);
    leg.position.set(lx, 6.7, lz); leg.castShadow = true; group.add(leg);
  }
  for (const lz of [3.5, 11.5]) { // cross beams on the quay side
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.55, 0.55), steel);
    beam.position.set(0, 13.1, lz); group.add(beam);
  }
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 34), steel); // reaches over the ship
  boom.position.set(0, 13.4, -3.5); boom.castShadow = true; group.add(boom);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 30), dark);
  tie.position.set(0, 14.6, -2); tie.rotation.x = 0.06; group.add(tie);
  // two hanging loads (container + spreader + cables), posed per frame from story.ts
  const loads: THREE.Group[] = [], cables: THREE.Mesh[] = [];
  [1, 4].forEach((ci, i) => {
    const lg = new THREE.Group();
    const c = container(ci); lg.add(c);
    const spreader = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.3, 1.2), dark);
    spreader.position.y = 1.45; lg.add(spreader);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), dark);
    cable.position.y = 1.6; lg.add(cable); cables.push(cable);
    lg.position.set(0, 99, -13);
    group.add(lg); loads.push(lg);
    void i;
  });
  group.visible = false;
  return { group, loads, cables };
};

// ---------------- experiment tub: nail + steel bowl ----------------
export type Tub = { group: THREE.Group; nail: THREE.Group; bowl: THREE.Mesh };
export const TUB_POS: [number, number] = [4.2, 7.5];
export const TUB_WATER_Y = 1.3;
export const buildTub = (): Tub => {
  const group = new THREE.Group();
  group.position.set(TUB_POS[0], 0, TUB_POS[1]);
  const galv = lam("tubGalv", () => ({ map: galvanized() }));
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.55, 1.5, 26, 1, true), galv);
  wall.position.y = 0.75; wall.castShadow = wall.receiveShadow = true; group.add(wall);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 8, 26), lam("tubRim", () => ({ color: "#8f9aa2" })));
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.5; group.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.56, 26), lam("tubFloor", () => ({ color: "#274b63" })));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.16; group.add(floor);
  const waterM = new THREE.Mesh(new THREE.CircleGeometry(1.56, 26),
    twoTone(new THREE.MeshLambertMaterial({ color: "#3f9fd8" }))); // opaque: translucent water ghosts the actors standing behind the tub
  waterM.rotation.x = -Math.PI / 2; waterM.position.y = TUB_WATER_Y; group.add(waterM);
  // the nail: shaft + head, origin at its centre
  const nail = new THREE.Group();
  const steel = lam("nailSteel", () => ({ color: "#9aa4ae" }));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.012, 0.52, 8), steel);
  nail.add(shaft);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 10), steel);
  head.position.y = 0.27; nail.add(head);
  nail.scale.setScalar(1.5); // oversized on purpose: a true-scale nail is unreadable at this camera distance
  nail.position.set(0.3, 2.75, 0.1); nail.visible = false; group.add(nail);
  // the steel bowl: a hemisphere shell, origin at its base centre
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48),
    lam("bowlSteel", () => ({ color: "#c7ced4", side: THREE.DoubleSide })));
  bowl.scale.y = 0.62; bowl.position.set(-0.35, 2.3, -0.15); bowl.visible = false; group.add(bowl);
  return { group, nail, bowl };
};

// ---------------- hull cross-section diorama (shot 4) ----------------
export type HullCut = { group: THREE.Group };
export const CUT_POS: [number, number] = [-4.5, 5];
export const buildHullCut = (): HullCut => {
  const group = new THREE.Group();
  group.position.set(CUT_POS[0], 0, CUT_POS[1]);
  // stand
  const standM = lam("cutStand", () => ({ map: rep(stoneHD("cutStandHD"), 2, 1) }));
  const base = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.35, 2.6), standM);
  base.position.y = 0.18; base.castShadow = base.receiveShadow = true; group.add(base);
  // hull profile with a hollow core (shape + hole), extruded 1.7 deep
  const outer = new THREE.Shape();
  outer.moveTo(-2.6, 3.9); outer.lineTo(2.6, 3.9); outer.lineTo(2.6, 2.2);
  outer.quadraticCurveTo(2.5, 0.7, 1.2, 0.35); outer.lineTo(-1.2, 0.35);
  outer.quadraticCurveTo(-2.5, 0.7, -2.6, 2.2); outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-2.2, 3.5); hole.lineTo(2.2, 3.5); hole.lineTo(2.2, 2.25);
  hole.quadraticCurveTo(2.12, 1.0, 1.05, 0.72); hole.lineTo(-1.05, 0.72);
  hole.quadraticCurveTo(-2.12, 1.0, -2.2, 2.25); hole.closePath();
  outer.holes.push(hole);
  const shell = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 1.7, bevelEnabled: false }),
    lam("cutHull", () => ({ color: "#274b73" })));
  shell.position.set(0, 0.32, -0.85); shell.castShadow = shell.receiveShadow = true; group.add(shell);
  // the trapped air inside: a warm bright core visible through the open front
  const air = new THREE.Mesh(new THREE.BoxGeometry(4.15, 2.6, 1.5),
    twoTone(new THREE.MeshLambertMaterial({ color: "#ffd98a" })));
  air.position.set(0, 2.35, 0); group.add(air);
  // water wrapping the lower hull, up to the waterline
  const waterM = new THREE.Mesh(new THREE.BoxGeometry(5.9, 1.5, 2.3),
    twoTone(new THREE.MeshLambertMaterial({ color: "#2f8fc4", transparent: true, opacity: 0.6 })));
  waterM.position.set(0, 1.05, 0); group.add(waterM);
  const wlStripe = new THREE.Mesh(new THREE.BoxGeometry(5.95, 0.12, 2.35), lam("cutStripe", () => ({ color: "#f4f1e6" })));
  wlStripe.position.y = 1.82; group.add(wlStripe);
  group.visible = false;
  return { group };
};

// ---------------- port backdrop: warehouses, quay stacks, lighthouse ----------------
export const buildPort = (root: THREE.Group) => {
  const spots: [number, number, string, string][] = [
    [-36, 31, "#c8cfd6", "#5a6a86"], [-4, 33, "#e3d3ae", "#8a5a34"], [30, 31, "#d8b8a4", "#7a4a3a"],
  ];
  spots.forEach(([x, z, wall, shut], i) => {
    const w = 26, h = 10.5, d = 11;
    const hg = new THREE.Group(); hg.position.set(x, 0, z);
    const front = lam(`whf${i}`, () => ({ map: facadeHD(`whf${i}`, w, h, { wall, shutter: shut, door: true }) }));
    const side = lam(`whs${i}`, () => ({ map: facadeHD(`whs${i}`, d, h, { wall, shutter: shut }) }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
    box.position.y = h / 2; box.castShadow = box.receiveShadow = true; hg.add(box);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), lam(`whr${i}`, () => ({ color: "#6e5546" })));
    roof.position.y = h + 0.25; roof.castShadow = true; hg.add(roof);
    root.add(hg);
  });
  // container stacks waiting on the quay: [x, z, colourIdx, level]
  const stackSpots: [number, number, number, number][] = [
    [-27, 12, 0, 0], [-27, 12, 1, 1], [-20.5, 12.5, 2, 0],
    [25, 13, 3, 0], [25, 13, 4, 1], [31.5, 13, 5, 0],
  ];
  for (const [x, z, ci, lv] of stackSpots) {
    const c = container(ci);
    c.rotation.y = Math.PI / 2;
    c.position.set(x, 1.3 + lv * 2.6, z);
    root.add(c);
  }
  // lighthouse on the quay corner
  const lh = new THREE.Group(); lh.position.set(-47, 0, 9);
  const white = lam("lhWhite", () => ({ color: "#f2efe6" }));
  const redM = lam("lhRed", () => ({ color: "#c03a2c" }));
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.6, 3.4, 14), white); seg1.position.y = 1.7; seg1.castShadow = true; lh.add(seg1);
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.3, 2.8, 14), redM); seg2.position.y = 4.8; seg2.castShadow = true; lh.add(seg2);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.3, 10), lam("lhLamp", () => ({ color: "#ffe9a8" }))); lamp.position.y = 6.85; lh.add(lamp);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.1, 12), lam("lhCap", () => ({ color: "#33383e" }))); cap.position.y = 8.05; lh.add(cap);
  root.add(lh);
};

export const makeClouds = (root: THREE.Group) => {
  const clouds: THREE.Mesh[] = [];
  const spots: [number, number, number, number][] = [
    [-40, 34, -70, 26], [30, 40, -80, 32], [0, 46, -95, 38], [-65, 30, -40, 20], [60, 36, -50, 24], [12, 30, -55, 18],
  ];
  spots.forEach(([x, y, z, w], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5),
      new THREE.MeshBasicMaterial({ map: cloudHD(i + 2), transparent: true, depthWrite: false, fog: false }));
    m.position.set(x, y, z); root.add(m); clouds.push(m);
  });
  return clouds;
};

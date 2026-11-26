// Pisa world geometry: the leaning tower (stacked gallery levels on a plinth), the
// cathedral + baptistery of the Piazza dei Miracoli, a ring of pastel houses, cypress
// trees, scaffolding for 1173 and a soil cutaway block for the foundation shot.
// Everything is procedural with painted Canvas2D textures (paint.ts) and two-tone
// materials (shade.ts) — no external assets.
import * as THREE from "three";
import { ctex, rep, grassHD, cobbleHD, stoneHD, roofHD, facadeHD, cloudHD } from "./paint";
import { twoTone } from "./shade";

const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- painted textures specific to Pisa ----------------
const INK = "#241726";
/** one gallery level of the tower: marble wall + a row of dark arches, painted in the
 *  skill's style (the world ink pass outlines the real geometry; the arches are texture) */
export const marbleLevel = (belfry = false) => ctex(belfry ? "pisaBelfry" : "pisaLevel", 1024, 512, (g, r) => {
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#f7f2e4"); grad.addColorStop(0.75, "#efe7d3"); grad.addColorStop(1, "#ddd2ba");
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = "rgba(120,110,90,0.18)"; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { // marble veins
    g.beginPath(); const y = r() * 512; g.moveTo(r() * 200, y);
    g.bezierCurveTo(300, y + 14 * (r() - 0.5), 700, y + 20 * (r() - 0.5), 1024, y + 10 * (r() - 0.5)); g.stroke();
  }
  const n = belfry ? 6 : 8, aw = 1024 / n;
  for (let i = 0; i < n; i++) {
    const x = i * aw + aw * 0.22, w = aw * 0.56, top = belfry ? 120 : 96, bot = 470;
    g.fillStyle = "#383145";
    g.beginPath();
    g.moveTo(x, bot); g.lineTo(x, top + w / 2); g.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, bot); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 7; g.stroke();
    g.fillStyle = "rgba(255,252,240,0.20)"; g.fillRect(x + 5, top + w / 2, 9, bot - top - w / 2); // inner light edge
    if (belfry && i % 2 === 0) { // bell silhouettes in some arches
      g.fillStyle = "#191423";
      g.beginPath(); g.ellipse(x + w / 2, top + w / 2 + 74, w * 0.21, 30, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(x + w / 2 - w * 0.21, top + w / 2 + 74, w * 0.42, 44);
      g.beginPath(); g.ellipse(x + w / 2, top + w / 2 + 122, w * 0.27, 12, 0, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = "rgba(90,80,60,0.35)"; g.fillRect(0, 478, 1024, 10); // seam shadow under the cornice
  g.fillStyle = "#fbf7ea"; g.fillRect(0, 0, 1024, 26); // cornice highlight band
  g.fillStyle = "rgba(90,80,60,0.25)"; g.fillRect(0, 26, 1024, 6);
});
const soilTex = (key: string, base: string, fleck: string) => ctex(key, 512, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  g.fillStyle = fleck;
  for (let i = 0; i < 900; i++) g.fillRect(r() * 512, r() * 256, 2 + r() * 5, 1.5 + r() * 3);
  g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(0, 0, 512, 7); // layer boundary shadow
});
const marblePlain = () => ctex("pisaMarblePlain", 512, 512, (g, r) => {
  g.fillStyle = "#f2ebda"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(120,110,90,0.16)"; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { g.beginPath(); const y = r() * 512; g.moveTo(0, y); g.bezierCurveTo(170, y + 12 * (r() - 0.5), 340, y + 16 * (r() - 0.5), 512, y); g.stroke(); }
  g.strokeStyle = "rgba(90,80,60,0.30)"; g.lineWidth = 4;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
});

// ---------------- tower ----------------
export const TOWER_Z = -4, PLINTH_TOP = 1.05, LEVEL_H = 1.92, LEVELS = 6, BELFRY_H = 2.7;
export const levelRadius = (i: number) => 2.38 - i * 0.085;

export type Tower = { group: THREE.Group; levels: THREE.Group[]; belfry: THREE.Group; scaffold: THREE.Group };
export const buildTower = (): Tower => {
  const group = new THREE.Group();
  group.position.set(0, 0, TOWER_Z);
  // steps + plinth
  const stone = lam("pisaStone", () => ({ map: rep(stoneHD("pisaStoneHD"), 3, 1) }));
  [[3.35, 0.26], [3.0, 0.27], [2.68, 0.27]].forEach(([r, h], i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.06, h, 36), stone);
    s.position.y = 0.13 + i * 0.26; s.castShadow = s.receiveShadow = true; group.add(s);
  });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.6, 0.3, 36), lam("pisaMarble", () => ({ map: rep(marblePlain(), 4, 1) })));
  plinth.position.y = 0.92; plinth.castShadow = plinth.receiveShadow = true; group.add(plinth);
  // gallery levels: core cylinder with painted arches + a real cornice ring per level
  const levels: THREE.Group[] = [];
  const marble = lam("pisaLevelMat", () => ({ map: marbleLevel() }));
  const cornice = lam("pisaCornice", () => ({ map: rep(marblePlain(), 6, 1) }));
  for (let i = 0; i < LEVELS; i++) {
    const lg = new THREE.Group();
    const r = levelRadius(i);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.07, r - 0.02, LEVEL_H, 36), marble);
    core.position.y = LEVEL_H / 2; core.castShadow = core.receiveShadow = true; lg.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.1, 10, 36), cornice);
    ring.rotation.x = Math.PI / 2; ring.position.y = LEVEL_H - 0.05; ring.castShadow = true; lg.add(ring);
    const sill = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.06, 8, 36), cornice);
    sill.rotation.x = Math.PI / 2; sill.position.y = 0.06; lg.add(sill);
    group.add(lg); levels.push(lg);
  }
  // belfry + pennant
  const belfry = new THREE.Group();
  const bf = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.86, BELFRY_H, 30), lam("pisaBelfryMat", () => ({ map: marbleLevel(true) })));
  bf.position.y = BELFRY_H / 2; bf.castShadow = bf.receiveShadow = true; belfry.add(bf);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.22, 30), cornice);
  cap.position.y = BELFRY_H + 0.08; cap.castShadow = true; belfry.add(cap);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), lam("woodDark", () => ({ color: "#5a4030" })));
  pole.position.y = BELFRY_H + 0.9; belfry.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), new THREE.MeshBasicMaterial({ color: "#fdfdf6", side: THREE.DoubleSide }));
  flag.position.set(0.5, BELFRY_H + 1.35, 0); flag.name = "pennant"; belfry.add(flag);
  group.add(belfry);
  // scaffolding (1173): wooden poles + two plank decks on the south side
  const scaffold = new THREE.Group();
  const wood = lam("scafWood", () => ({ color: "#8a6844" }));
  const plank = lam("scafPlank", () => ({ color: "#a07a4e" }));
  for (const [px, pz] of [[-3.1, 2.6], [3.1, 2.6], [-3.1, -2.6], [3.1, -2.6], [-3.3, 0], [3.3, 0]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.6, 8), wood);
    p.position.set(px, 3.8, pz); p.castShadow = true; scaffold.add(p);
  }
  for (const y of [2.1, 4.15]) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.12, 6.0), plank);
    deck.position.y = y; deck.castShadow = true; scaffold.add(deck);
    for (const pz of [-2.6, 2.6]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.07, 0.07), wood);
      rail.position.set(0, y + 0.95, pz); scaffold.add(rail);
    }
  }
  group.add(scaffold);
  return { group, levels, belfry, scaffold };
};

// ---------------- ground, piazza, soil cutaway ----------------
export const buildGround = (root: THREE.Group) => {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), lam("grass", () => ({ map: rep(grassHD(), 46, 46) })));
  grass.rotation.x = -Math.PI / 2; grass.position.z = -30; grass.receiveShadow = true; root.add(grass);
  const piazza = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 17.5, 0.14, 48), lam("cobble", () => ({ map: rep(cobbleHD(), 10, 10) })));
  piazza.position.set(0, 0.07, -2); piazza.receiveShadow = true; root.add(piazza);
};
/** diorama chunk of earth standing on the piazza by the tower base (shot 3-4): a
 *  cross-section "cut cake" of soil — strata stacked in order, a shallow stone
 *  foundation slab embedded near the top and a mini plinth on top to tie it to the
 *  tower. The soft layer's south (+x) half squishes: its geometry origin is at the
 *  layer's bottom edge, so world.ts can scale Y and it stays planted. */
export type Cutaway = { group: THREE.Group; softSouth: THREE.Mesh; found: THREE.Mesh };
export const buildCutaway = (): Cutaway => {
  const group = new THREE.Group();
  group.position.set(5.4, 0.14, -8.4);
  group.rotation.y = 0.42;
  const W = 6.8, D = 2.4;
  // bottom -> top
  const layers: [string, string, string, number][] = [
    ["soilDeep", "#7d6244", "#66502f", 0.62],
    ["soilSand", "#b59a6d", "#9c814f", 0.5],
    ["soilSoft", "#c9ad7c", "#b3945f", 0.55],
    ["soilClay", "#9a7a52", "#86683f", 0.55],
    ["soilTop", "#6d5136", "#59422c", 0.42],
  ];
  let y = 0;
  let softSouth: THREE.Mesh | null = null;
  for (const [key, base, fleck, h] of layers) {
    if (key === "soilSoft") {
      const north = new THREE.Mesh(new THREE.BoxGeometry(W / 2, h, D), lam(key, () => ({ map: soilTex(key, base, fleck) })));
      north.position.set(-W / 4, y + h / 2, 0); north.castShadow = north.receiveShadow = true; group.add(north);
      const geoS = new THREE.BoxGeometry(W / 2, h, D); geoS.translate(0, h / 2, 0);
      softSouth = new THREE.Mesh(geoS, lam(key + "S", () => ({ map: soilTex(key + "S", "#dec188", fleck) })));
      softSouth.position.set(W / 4, y, 0); softSouth.castShadow = softSouth.receiveShadow = true; group.add(softSouth);
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, h, D), lam(key, () => ({ map: soilTex(key, base, fleck) })));
      m.position.set(0, y + h / 2, 0); m.castShadow = m.receiveShadow = true; group.add(m);
    }
    y += h;
  }
  // grass cap on top of the chunk
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.15, 0.12, D + 0.15), lam("cutGrass", () => ({ map: rep(grassHD(), 3, 1) })));
  cap.position.y = y + 0.06; cap.castShadow = true; group.add(cap);
  // the shallow foundation slab, embedded across the top layers (only ~"3 m" deep)
  const found = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 2.75), lam("foundStone", () => ({ map: rep(stoneHD("foundHD"), 2, 1) })));
  found.position.set(-0.7, y - 0.62, 0); found.castShadow = true; group.add(found);
  // mini plinth on top, above the slab — "the tower stands on THIS"
  const mini = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.85, 20), lam("pisaMarble", () => ({ map: rep(marblePlain(), 3, 1) })));
  mini.position.set(-0.7, y + 0.55, 0); mini.castShadow = true; group.add(mini);
  group.visible = false;
  return { group, softSouth: softSouth!, found };
};

// ---------------- cathedral, baptistery, houses, trees ----------------
export const buildTown = (root: THREE.Group) => {
  const marble = lam("catMarble", () => ({ map: rep(marblePlain(), 5, 2) }));
  // cathedral: long marble block + gable + small dome, left-back (far side, +Z:
  // the cameras all sit at -Z looking toward +Z, so the town belongs at +Z)
  const cath = new THREE.Group(); cath.position.set(-17, 0, 22); cath.rotation.y = Math.PI - 0.5;
  const nave = new THREE.Mesh(new THREE.BoxGeometry(17, 6.4, 7.5), marble); nave.position.y = 3.2; nave.castShadow = nave.receiveShadow = true; cath.add(nave);
  const gable = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 17, 3, 1), lam("catRoof", () => ({ color: "#a34d38" })));
  gable.rotation.z = Math.PI / 2; gable.rotation.y = Math.PI / 2; gable.position.y = 7.6; gable.scale.set(1, 1, 0.62); gable.castShadow = true; cath.add(gable);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lam("domeMat", () => ({ color: "#93a5ab" })));
  dome.position.set(2.5, 6.4, 0); dome.castShadow = true; cath.add(dome);
  root.add(cath);
  // baptistery: round marble cylinder + cone roof, right-back
  const bap = new THREE.Group(); bap.position.set(13, 0, 19);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 5.2, 24), lam("bapMarble", () => ({ map: rep(marbleLevel(), 2, 1) })));
  drum.position.y = 2.6; drum.castShadow = drum.receiveShadow = true; bap.add(drum);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.9, 2.9, 24), lam("bapRoof", () => ({ map: roofHD("#a34d38") })));
  cone.position.y = 6.6; cone.castShadow = true; bap.add(cone);
  root.add(bap);
  // pastel houses ringing the back and sides
  const palette: [string, string][] = [
    ["#e8b4a0", "#7a4a3a"], ["#f0d9a8", "#8a5a34"], ["#dfe3ee", "#5a6a86"], ["#e6c9d4", "#7c5468"],
    ["#cfe0c0", "#5c7050"], ["#f2e3c8", "#96703e"], ["#e0b8b0", "#86544a"], ["#d8d2e8", "#5f5a80"],
  ];
  const spots: [number, number, number][] = [
    [-26, 30, 0.35 + Math.PI], [-13, 34, 0.15 + Math.PI], [2, 36, Math.PI], [17, 33, -0.2 + Math.PI], [29, 28, -0.4 + Math.PI],
    [-31, 14, 0.9 + Math.PI], [33, 12, -0.9 + Math.PI], [-30, 2, 1.2], [32, 4, -1.2], [24, 40, -0.1 + Math.PI], [-22, 42, 0.25 + Math.PI],
  ];
  spots.forEach(([x, z, ry], i) => {
    const [wall, shut] = palette[i % palette.length];
    const w = 7.5 + (i % 3), h = [7, 8.4, 9.8][i % 3], d = 7;
    const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = ry;
    const front = lam(`hf${i}`, () => ({ map: facadeHD(`hf${i}`, w, h, { wall, shutter: shut, door: true }) }));
    const side = lam(`hs${i}`, () => ({ map: facadeHD(`hs${i}`, d, h, { wall, shutter: shut }) }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
    box.position.y = h / 2; box.castShadow = box.receiveShadow = true; hg.add(box);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.02, 2.2, 4), lam(`hr${i}`, () => ({ map: roofHD("#9c4a34") })));
    roof.rotation.y = Math.PI / 4; roof.position.y = h + 1.05; roof.scale.set(1, 1, d / w); roof.castShadow = true; hg.add(roof);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), lam(`hc${i}`, () => ({ map: rep(stoneHD(`hc${i}`), 1, 1) })));
    chim.position.set(w * 0.28, h + 1.6, 0); chim.castShadow = true; hg.add(chim);
    root.add(hg);
  });
  // cypress trees: dark green spires
  const cy = lam("cypress", () => ({ color: "#2f5d33" }));
  const trunk = lam("cyTrunk", () => ({ color: "#5a4030" }));
  [[-9, 13], [9.5, 12], [-13, 6], [14, 5], [-7, 22], [8, 24], [-20, 10], [21, 16], [-4, 28], [5, 30]].forEach(([x, z], i) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.8, 6), trunk); tr.position.y = 0.4; tg.add(tr);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.6 + (i % 3) * 0.5, 10), cy);
    cone.position.y = 2.9 + (i % 3) * 0.25; cone.castShadow = true; tg.add(cone);
    root.add(tg);
  });
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

// Stadion GBLA versi kartun 3D: lapangan bergaris penuh, dua gawang (PERSIB di
// x=-38 dijaga Teja, BALI UNITED di x=+38 dijaga Hauptmeijer), tribun penonton
// bertekstur lukis, papan iklan, 4 tiang lampu sorot. Semua prosedural dengan
// tekstur Canvas2D (paint.ts) + material two-tone (shade.ts), tanpa aset luar.
import * as THREE from "three";
import { ctex, rep, grassHD, cloudHD } from "./paint";
import { twoTone } from "./shade";
import { GOAL_PERSIB_X, GOAL_BALI_X, GOAL_W, POST_H } from "./story";

const mats = new Map<string, THREE.MeshLambertMaterial>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const INK = "#241726";

// ---------------- tekstur lapangan: satu kanvas besar, garis dicat persis ----------------
export const PITCH_W = 116, PITCH_D = 76; // bidang rumput (garis lapangan di dalamnya)
const pitchTex = () => ctex("pitchGBLA", 2048, 1340, (g, r) => {
  const W = 2048, H = 1340;
  // belang rumput vertikal (searah sumbu x dunia)
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? "#3f9e4d" : "#359145";
    g.fillRect((W * i) / stripes, 0, W / stripes + 1, H);
  }
  // noise rumput halus
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${20 + r() * 40},${90 + r() * 60},${30 + r() * 30},0.12)`;
    g.fillRect(r() * W, r() * H, 3, 2);
  }
  // peta piksel: lapangan resmi 105 x 68 di tengah bidang 116 x 76
  const sx = W / PITCH_W, sy = H / PITCH_D;
  const X = (x: number) => (x + PITCH_W / 2) * sx, Z = (z: number) => (z + PITCH_D / 2) * sy;
  g.strokeStyle = "#f6f8f2"; g.lineWidth = 7; g.lineCap = "round";
  const line = (x0: number, z0: number, x1: number, z1: number) => { g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const L = -52.5, R = 52.5, T = -34, B = 34;
  line(L, T, R, T); line(R, T, R, B); line(R, B, L, B); line(L, B, L, T); // garis tepi
  line(0, T, 0, B); // garis tengah
  g.beginPath(); g.arc(X(0), Z(0), 9.15 * sx, 0, Math.PI * 2); g.stroke(); // lingkaran tengah
  g.fillStyle = "#f6f8f2"; g.beginPath(); g.arc(X(0), Z(0), 9, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) { // kotak penalti + kotak kecil + titik penalti kedua gawang
    const gx = s * 52.5;
    line(gx, -20.16, gx - s * 16.5, -20.16); line(gx - s * 16.5, -20.16, gx - s * 16.5, 20.16); line(gx - s * 16.5, 20.16, gx, 20.16);
    line(gx, -9.16, gx - s * 5.5, -9.16); line(gx - s * 5.5, -9.16, gx - s * 5.5, 9.16); line(gx - s * 5.5, 9.16, gx, 9.16);
    g.beginPath(); g.arc(X(gx - s * 11), Z(0), 8, 0, Math.PI * 2); g.fill();
  }
});

/** tekstur penonton: baris titik warna-warni di atas dasar tribun gelap */
const crowdTex = (key: string, base: string, dots: string[]) => ctex(key, 1024, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 256);
  for (let row = 0; row < 16; row++) {
    const y = 14 + row * 15;
    for (let x = 6; x < 1024; x += 11) {
      if (r() < 0.14) continue;
      g.fillStyle = dots[Math.floor(r() * dots.length)];
      g.beginPath(); g.arc(x + (row % 2) * 5, y, 3.6, 0, Math.PI * 2); g.fill();
      g.fillRect(x - 3, y + 3, 6, 5);
    }
  }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(0, 246, 1024, 10);
});

/** spanduk besar dengan teks (untuk label gawang + nama stadion) */
const bannerTex = (key: string, bg: string, fg: string, text: string, sub?: string) => ctex(key, 2048, 320, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 2048, 320);
  g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(18, 18, 2012, 284);
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "900 150px Arial, sans-serif";
  g.fillText(text, 1024, sub ? 128 : 160);
  if (sub) { g.font = "700 74px Arial, sans-serif"; g.fillText(sub, 1024, 248); }
});

/** jaring gawang transparan */
const netTex = () => ctex("goalNet", 256, 256, (g) => {
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(240,244,248,0.85)"; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
});

// ---------------- gawang ----------------
export type Goal = { group: THREE.Group; net: THREE.Mesh };
const buildGoal = (x: number, dirIn: 1 | -1): Goal => {
  // dirIn: arah bola masuk (+1 = bola bergerak +x masuk ke gawang ini dari kiri)
  const group = new THREE.Group();
  group.position.set(x, 0, 0);
  const postMat = lam("goalPost", () => ({ color: "#f4f6f8" }));
  const post = (py: number, pz: number, h: number, vert: boolean) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 10), postMat);
    if (vert) { m.position.set(0, h / 2, pz); } else { m.rotation.x = Math.PI / 2; m.position.set(0, py, 0); }
    m.castShadow = true; group.add(m); return m;
  };
  post(0, -GOAL_W / 2, POST_H, true); post(0, GOAL_W / 2, POST_H, true);
  post(POST_H, 0, GOAL_W, false); // mistar
  // rangka belakang + jaring (kotak terbuka ke arah lapangan)
  const depth = 1.6, backX = dirIn * depth;
  const netMat = new THREE.MeshBasicMaterial({ map: rep(netTex(), 6, 2), transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const mkNet = (w: number, h: number, px: number, py: number, pz: number, ry: number, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), netMat);
    m.position.set(px, py, pz); m.rotation.set(rx, ry, 0); m.renderOrder = 2; group.add(m); return m;
  };
  const back = mkNet(GOAL_W, POST_H, backX, POST_H / 2, 0, Math.PI / 2);
  mkNet(depth, POST_H, backX / 2, POST_H / 2, -GOAL_W / 2, 0); mkNet(depth, POST_H, backX / 2, POST_H / 2, GOAL_W / 2, 0);
  const top = mkNet(depth, GOAL_W, backX / 2, POST_H, 0, 0, Math.PI / 2); top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  // tiang belakang bawah
  const bp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, GOAL_W, 8), postMat);
  bp.rotation.x = Math.PI / 2; bp.position.set(backX, 0.06, 0); group.add(bp);
  return { group, net: back };
};

// ---------------- tribun + stadion ----------------
export type Stadium = { group: THREE.Group; goalPersib: Goal; goalBali: Goal; lampHeads: THREE.Mesh[] };
export const buildStadium = (): Stadium => {
  const group = new THREE.Group();
  // lapangan
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_W, PITCH_D), lam("pitch", () => ({ map: pitchTex() })));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; group.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(190, 140), lam("apron", () => ({ map: rep(grassHD(), 30, 22) })));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.06; apron.receiveShadow = true; group.add(apron);
  // gawang: Persib x=-38 (bola Bali masuk bergerak -x -> dirIn -1), Bali x=+38 (dirIn +1)
  const goalPersib = buildGoal(GOAL_PERSIB_X, -1); group.add(goalPersib.group);
  const goalBali = buildGoal(GOAL_BALI_X, 1); group.add(goalBali.group);
  // papan iklan sekeliling
  const ads: [string, string][] = [
    ["SUPER LEAGUE", "#123a7a"], ["PERSIB", "#1d4fa1"], ["BALI UNITED", "#a01d24"], ["GBLA", "#0d5c34"],
    ["BOBOTOH", "#123a7a"], ["SEMAKIN DI DEPAN", "#7a4a12"],
  ];
  const adMat = (i: number) => lam("ad" + i, () => ({ map: bannerTex("ad" + i, ads[i % ads.length][1], "#ffffff", ads[i % ads.length][0]) }));
  const adRun = (x0: number, z0: number, x1: number, z1: number, n: number, start: number) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, w = Math.hypot(x1 - x0, z1 - z0) / n;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.15, 1.0, 0.25), adMat(start + i));
      b.position.set(x0 + (x1 - x0) * t, 0.5, z0 + (z1 - z0) * t);
      b.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2; b.castShadow = true; group.add(b);
    }
  };
  adRun(-46, -40.5, 46, -40.5, 10, 0); adRun(-46, 40.5, 46, 40.5, 10, 3);
  adRun(-55.5, -30, -55.5, 30, 7, 1); adRun(55.5, -30, 55.5, 30, 7, 4);
  // tribun: 4 sisi, 3 tingkat miring ke belakang; sisi jauh (+Z) paling tinggi
  const crowdHome = lam("crowdHome", () => ({ map: rep(crowdTex("crowdHome", "#1b2b52", ["#2f5fb3", "#3f74d6", "#e8ecf4", "#2f5fb3", "#f2c14e", "#3f74d6"]), 3, 1) }));
  const crowdMix = lam("crowdMix", () => ({ map: rep(crowdTex("crowdMix", "#232038", ["#a03a42", "#2f5fb3", "#e8ecf4", "#c8ccd8", "#7a8494"]), 3, 1) }));
  const concrete = lam("standBase", () => ({ color: "#4a5468" }));
  const stand = (cx: number, cz: number, len: number, ry: number, mat: THREE.Material, high = 0) => {
    const sg = new THREE.Group(); sg.position.set(cx, 0, cz); sg.rotation.y = ry;
    for (let tierI = 0; tierI < 3; tierI++) {
      const w = len, h = 3.4, d = 4.6;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [concrete, concrete, mat, concrete, mat, concrete]);
      m.position.set(0, 1.6 + tierI * 3.1 + high, -tierI * 4.4);
      m.castShadow = m.receiveShadow = true; sg.add(m);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 3, 0.35, 17), lam("standRoof", () => ({ color: "#2c3648" })));
    roof.position.set(0, 12.4 + high, -6.4); roof.rotation.x = 0.1; roof.castShadow = true; sg.add(roof);
    group.add(sg);
  };
  stand(0, 52, 128, Math.PI, crowdHome, 2.5);        // tribun jauh (+Z): penonton tuan rumah
  stand(0, -52, 128, 0, crowdHome, 0);               // tribun dekat (-Z, belakang kamera)
  stand(-66, 0, 92, Math.PI / 2, crowdHome, 0);      // belakang gawang Persib
  stand(66, 0, 92, -Math.PI / 2, crowdMix, 0);       // belakang gawang Bali (ada suporter tamu)
  // spanduk label gawang di tribun belakang masing-masing gawang (teks lukis, selalu terbaca dari lapangan)
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(30, 4.7), new THREE.MeshBasicMaterial({ map: bannerTex("banPersib", "#14418f", "#ffffff", "GAWANG PERSIB", "TEJA PAKU ALAM") }));
  bp.position.set(-64.5, 7.6, 0); bp.rotation.y = Math.PI / 2; group.add(bp);
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(34, 4.7), new THREE.MeshBasicMaterial({ map: bannerTex("banBali", "#8f141c", "#ffffff", "GAWANG BALI UNITED", "HAUPTMEIJER") }));
  bb.position.set(64.5, 7.6, 0); bb.rotation.y = -Math.PI / 2; group.add(bb);
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(52, 5.6), new THREE.MeshBasicMaterial({ map: bannerTex("banGBLA", "#0e2c5c", "#ffd94d", "GELORA BANDUNG LAUTAN API", "PERSIB BANDUNG vs BALI UNITED") }));
  bg.position.set(0, 16.8, 59.5); bg.rotation.y = Math.PI; group.add(bg);
  // tiang lampu sorot 4 sudut
  const lampHeads: THREE.Mesh[] = [];
  const poleMat = lam("lampPole", () => ({ color: "#39424f" }));
  const lampTex = () => ctex("lampHead", 256, 160, (g) => {
    g.fillStyle = "#20262e"; g.fillRect(0, 0, 256, 160);
    g.fillStyle = "#fdf6d8";
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { g.beginPath(); g.arc(24 + x * 42, 22 + y * 38, 13, 0, Math.PI * 2); g.fill(); }
  });
  for (const [lx, lz] of [[-58, -46], [58, -46], [-58, 46], [58, 46]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 8), poleMat);
    pole.position.set(lx, 13, lz); pole.castShadow = true; group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.4, 0.4),
      new THREE.MeshBasicMaterial({ map: lampTex() }));
    head.position.set(lx * 0.96, 26.5, lz * 0.96); head.lookAt(0, 0, 0); group.add(head); lampHeads.push(head);
  }
  return { group, goalPersib, goalBali, lampHeads };
};

export const makeClouds = (root: THREE.Group) => {
  const clouds: THREE.Mesh[] = [];
  const spots: [number, number, number, number][] = [
    [-60, 48, -90, 40], [50, 54, -100, 48], [0, 60, -120, 55], [-90, 42, -60, 30], [85, 46, -70, 34],
  ];
  spots.forEach(([x, y, z, w], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5),
      new THREE.MeshBasicMaterial({ map: cloudHD(i + 3), transparent: true, depthWrite: false, fog: false, color: "#46587e" }));
    m.position.set(x, y, z); root.add(m); clouds.push(m);
  });
  return clouds;
};

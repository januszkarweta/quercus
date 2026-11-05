// Rysowanie sceny w stylu „Mgła i światło” (dimma och ljus).
// Miękkie przejścia, warstwy lasu ginące we mgle, światło i poświata, lekko świecące korzenie.
//
// Kamera: drzewo jest liczone w jednostkach „u”. Mały kiełek jest pokazany większy,
// duże drzewo mniejsze, ale tylko częściowo, żeby wzrost był widoczny.

import { rng, hashSeed } from "../rng.js";

// ---------- Kolory ----------
function hex(c) { const p = parseInt(c.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
export function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const A = hex(a), B = hex(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
export function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }

/** Paleta sceny. look: { season, light 0..1, dusk 0..1, snow } */
export function palette(look) {
  const { season, light, snow } = look;
  const dusk = look.dusk || 0;
  const D = {
    autumn: { skyTop: "#c3ccce", skyLow: "#ece2d0", l1: "#b4bcb7", l2: "#939f9a", l3: "#6c7873", field: "#a99070", ground: "#9d7f57", fog: "#f4efe6" },
    winter: { skyTop: "#c7d1d8", skyLow: "#eee9e1", l1: "#bcc6cc", l2: "#9eabb2", l3: "#77858c", field: "#dfe6ee", ground: "#eef3f9", fog: "#f3f4f4" },
    spring: { skyTop: "#bfd0d6", skyLow: "#eeeadb", l1: "#b1c0b3", l2: "#8ea392", l3: "#62786a", field: "#9fb07a", ground: "#8b9a5c", fog: "#f2f1e8" },
    summer: { skyTop: "#afc8d6", skyLow: "#f0e8d6", l1: "#a8bba8", l2: "#839c86", l3: "#566e5c", field: "#a3a866", ground: "#8a8a4c", fog: "#f3efe2" }
  }[season];
  const N = { skyTop: "#0c1324", skyLow: "#2c3a58", l1: "#46536f", l2: "#34405b", l3: "#232d44", field: "#4c5874", ground: "#55617d", fog: "#7d8db0" };
  const NS = { field: "#a7b6cf", ground: "#c9d4e4", l1: "#56637f", l2: "#46536e", l3: "#323d56" };
  const out = {};
  for (const k of Object.keys(D)) {
    const n = snow && NS[k] ? NS[k] : N[k];
    let d = D[k];
    if (snow && (k === "field" || k === "ground") && season !== "winter") d = mix(D[k], "#e9eef4", 0.85);
    if (!snow && season === "winter" && (k === "field" || k === "ground")) d = k === "field" ? "#a39a83" : "#8f8466";
    out[k] = mix(n, d, light);
  }
  if (dusk > 0) {
    out.skyLow = mix(out.skyLow, "#e7a77e", dusk * 0.65);
    out.skyTop = mix(out.skyTop, "#5d5f86", dusk * 0.35);
    out.fog = mix(out.fog, "#e9b896", dusk * 0.35);
  }
  out.soilTop = mix("#2c2724", "#5a4636", light);
  out.soilLow = mix("#120f0e", "#2b211b", light);
  out.trunk = mix("#161b27", "#3a3631", light);
  out.rim = light > 0.4 ? "#ffe2aa" : "#c8d7f0";
  out.snow = mix("#cbd6e6", "#f5f8fb", light);
  out.moss = mix("#26332b", "#6f8a4a", light);
  out.stone = mix("#3d4250", "#8f8a80", light);
  return out;
}

/** Zieleń i jesienne barwy liści zależą od genów. */
const GREENS = ["#8aa03e", "#5f8f3e", "#3f6e3a", "#4f7a62"];
const AUTUMN = {
  yellow: ["#e6c447", "#d9b23a", "#f0d66a"],
  gold: ["#d9a93a", "#e3bd4f", "#c99332"],
  orange: ["#e0902f", "#d47a2a", "#e8a84a"],
  red: ["#c4452e", "#a8342c", "#d9653a"],
  bronze: ["#b07a3a", "#9a6232", "#c79a52"]
};
function geneGreen(g) {
  const x = g.leafHue * (GREENS.length - 1), i = Math.floor(x);
  return mix(GREENS[i], GREENS[Math.min(GREENS.length - 1, i + 1)], x - i);
}
/** Kolor jednego liścia. look.autumn: 0 początek jesieni .. 1 późna jesień. */
export function leafColor(l, look, tree) {
  const g = tree.genes;
  const green = mix(geneGreen(g), "#3f8a3a", tree.lush * 0.35);
  const varied = mix(green, l.tone < 0.5 ? "#2f5a2e" : "#a8b84e", Math.abs(l.tone - 0.5) * 0.5);
  let c;
  if (look.season === "autumn") {
    const progress = look.autumn == null ? 0.75 : look.autumn;
    const turned = Math.max(0, Math.min(1, progress * 1.45 - 0.08 - l.keep * 0.5 + (l.tone - 0.5) * 0.3));
    const pal = AUTUMN[g.autumnTone] || AUTUMN.yellow;
    const fall = pal[Math.floor(l.tone * pal.length) % pal.length];
    c = mix(varied, mix(fall, "#e8cf6a", turned < 0.6 ? 0.25 : 0), turned * turned * (3 - 2 * turned));
  } else if (look.season === "winter") {
    c = mix(mix(varied, "#4d3c36", 0.55), "#3a4636", l.tone * 0.4);
  } else if (look.season === "spring") {
    c = mix(varied, "#b5cf6a", 0.3);
  } else c = varied;
  return mix(mix("#121826", c, 0.3), c, look.light);
}
/** Paleta do drobnych elementów (opadłe liście, liście niesione wiatrem). */
export function leafColors(look, tree) {
  const g = tree.genes;
  if (look.season === "autumn") return (AUTUMN[g.autumnTone] || AUTUMN.yellow).map((c) => mix(mix("#121826", c, 0.3), c, look.light));
  return [0.2, 0.5, 0.8].map((tone) => leafColor({ tone, keep: 0.5 }, look, tree));
}

// ---------- Kształty ----------
function hillFn(yBase, amp, freq, seed) {
  const r = rng(seed), p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  return (x) => yBase + amp * (Math.sin(x * freq + p1) * 0.6 + Math.sin(x * freq * 2.3 + p2) * 0.3 + Math.sin(x * freq * 5.1 + p3) * 0.1);
}
function hillPath(ctx, W, H, fn) {
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 4; x += 4) ctx.lineTo(x, fn(x));
  ctx.lineTo(W, H); ctx.closePath();
}
function spruce(ctx, x, y, h) {
  const w = h * 0.34;
  ctx.moveTo(x, y - h);
  for (let i = 1; i <= 4; i++) { const yy = y - h + (h * i) / 4.4, ww = (w * i) / 4; ctx.lineTo(x + ww, yy); ctx.lineTo(x + ww * 0.45, yy); }
  ctx.lineTo(x + w * 0.12, y); ctx.lineTo(x - w * 0.12, y);
  for (let k = 4; k >= 1; k--) { const y2 = y - h + (h * k) / 4.4, w2 = (w * k) / 4; ctx.lineTo(x - w2 * 0.45, y2); ctx.lineTo(x - w2, y2); }
  ctx.closePath();
}
export function leafPath(ctx, x, y, a, len, wide, pointy = 0.5, shape = "almond") {
  if (shape === "almond" || !shape) {
    const tx = x + Math.sin(a) * len, ty = y - Math.cos(a) * len;
    const nx = Math.cos(a) * len * wide, ny = Math.sin(a) * len * wide;
    const k = 0.45 + pointy * 0.2;
    const mx = x + (tx - x) * k, my = y + (ty - y) * k;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
    ctx.quadraticCurveTo(mx - nx, my - ny, x, y);
    ctx.closePath();
    return;
  }
  // pozostałe kształty rysowane w układzie liścia (czubek w górę), potem obracane
  const c = Math.cos(a), s = Math.sin(a);
  const P = (px, py) => [x + (px * c - py * s) * len, y + (px * s + py * c) * len];
  ctx.beginPath();
  if (shape === "lance") {
    const w = 0.13 + wide * 0.12;
    let p = P(0, 0); ctx.moveTo(p[0], p[1]);
    let c1 = P(w * 1.6, -0.45), e = P(0, -1); ctx.quadraticCurveTo(c1[0], c1[1], e[0], e[1]);
    c1 = P(-w * 1.6, -0.45); p = P(0, 0); ctx.quadraticCurveTo(c1[0], c1[1], p[0], p[1]);
  } else if (shape === "round") {
    const pts = []; for (let i = 0; i <= 24; i++) { const th = (i / 24) * Math.PI * 2; pts.push(P(Math.sin(th) * 0.42, -0.5 + Math.cos(th) * 0.48 - (Math.cos(th) > 0.9 ? 0.04 : 0))); }
    ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach((q) => ctx.lineTo(q[0], q[1]));
  } else if (shape === "heart") {
    let p = P(0, -0.12); ctx.moveTo(p[0], p[1]);
    let c1 = P(0.22, 0.05), c2 = P(0.55, -0.15), e = P(0.4, -0.5); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    c1 = P(0.3, -0.75); e = P(0, -1); ctx.quadraticCurveTo(c1[0], c1[1], e[0], e[1]);
    c1 = P(-0.3, -0.75); e = P(-0.4, -0.5); ctx.quadraticCurveTo(c1[0], c1[1], e[0], e[1]);
    c1 = P(-0.55, -0.15); c2 = P(-0.22, 0.05); p = P(0, -0.12); ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]);
  } else { // lobed: łagodnie klapowany
    const pts = [[0, 0], [0.18, -0.12], [0.42, -0.22], [0.3, -0.38], [0.48, -0.55], [0.26, -0.62], [0.24, -0.82], [0, -1], [-0.24, -0.82], [-0.26, -0.62], [-0.48, -0.55], [-0.3, -0.38], [-0.42, -0.22], [-0.18, -0.12], [0, 0]];
    const Q = pts.map(([px, py]) => P(px, py));
    ctx.moveTo(Q[0][0], Q[0][1]);
    for (let i = 1; i < Q.length; i++) { const m = [(Q[i - 1][0] + Q[i][0]) / 2, (Q[i - 1][1] + Q[i][1]) / 2]; ctx.quadraticCurveTo(Q[i - 1][0], Q[i - 1][1], m[0], m[1]); }
    ctx.lineTo(Q[Q.length - 1][0], Q[Q.length - 1][1]);
  }
  ctx.closePath();
}
function fogBand(ctx, W, y, h, color, a) {
  const g = ctx.createLinearGradient(0, y - h, 0, y + h);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.5, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(0, y - h, W, h * 2);
}

/** Odcinek gałęzi jako zwężający się kształt (szerokość w0 na początku, w1 na końcu). */
function taper(ctx, a, c, e, w0, w1) {
  const dx = e[0] - a[0], dy = e[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const wm = (w0 + w1) / 2;
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
  ctx.quadraticCurveTo(c[0] + nx * wm / 2, c[1] + ny * wm / 2, e[0] + nx * w1 / 2, e[1] + ny * w1 / 2);
  ctx.lineTo(e[0] - nx * w1 / 2, e[1] - ny * w1 / 2);
  ctx.quadraticCurveTo(c[0] - nx * wm / 2, c[1] - ny * wm / 2, a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  ctx.closePath();
}

// ---------- Kamera ----------
/** Ile pikseli na jednostkę u: mały kiełek powiększony, duże drzewo pomniejszone (częściowo). */
export function camera(W, H, tree) {
  const avail = H * 0.5;
  const h = Math.max(tree.height, 0.03);
  let ppu = (avail * 0.84) * Math.pow(h, -0.75);
  if (tree.width > 0) ppu = Math.min(ppu, (W * 0.44) / tree.width);
  ppu = Math.min(ppu, (avail * 0.95) / Math.max(tree.height, 0.02));
  return { gx: W * 0.5, gy: H * 0.66, ppu };
}

// ---------- Scena ----------
/**
 * look: { season, light, dusk, stars, sun {x,y}, moon {x,y,phase}, snow, frost, mist 0..1,
 *         wind 0..1, aurora 0..1, time (s) }
 * extras: { sky, ground, front } — dodatkowe warstwy (zdarzenia, pogoda)
 */
export function paintScene(ctx, W, H, tree, look, extras = {}) {
  const pal = palette(look);
  const cam = camera(W, H, tree);
  const { gx, gy, ppu } = cam;
  const t = look.time || 0;
  const M = (x, y) => [gx + x * ppu, gy + y * ppu];
  const night = look.light < 0.35;

  // niebo
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyLow);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy + 2);

  // zorza polarna
  if (look.aurora > 0) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 5; k++) {
      const g = ctx.createLinearGradient(0, H * 0.04, 0, H * 0.34);
      const a = (0.06 + k * 0.012) * look.aurora;
      g.addColorStop(0, "rgba(120,230,180,0)"); g.addColorStop(0.55, `rgba(110,220,170,${a})`); g.addColorStop(1, "rgba(110,220,170,0)");
      ctx.strokeStyle = g; ctx.lineWidth = H * (0.05 + k * 0.012);
      const wv = Math.sin(t * 0.05 + k) * H * 0.02;
      ctx.beginPath(); ctx.moveTo(-W * 0.1, H * (0.24 - k * 0.012) + wv);
      ctx.bezierCurveTo(W * 0.25, H * (0.1 + k * 0.01) - wv, W * 0.55, H * (0.3 - k * 0.015) + wv, W * 1.1, H * (0.12 + k * 0.01));
      ctx.stroke();
    }
    ctx.restore();
  }

  // gwiazdy
  if (look.stars > 0.02) {
    const rs = rng(hashSeed("stars"));
    ctx.fillStyle = "#ffffff";
    for (let s = 0; s < 130; s++) {
      const x = rs() * W, y = rs() * gy * 0.85, rr = rs() * 1.1 + 0.3, ph = rs() * 6, sp = 0.4 + rs();
      ctx.globalAlpha = look.stars * (0.3 + 0.7 * rs()) * (0.75 + 0.25 * Math.sin(t * sp + ph));
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // słońce: poświata
  if (look.sun) {
    const sx = look.sun.x * W, sy = look.sun.y * H;
    const warm = look.dusk > 0.3 ? "255,200,150" : "255,238,205";
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.38);
    glow.addColorStop(0, `rgba(${warm},${0.95 * Math.min(1, look.light + 0.2)})`);
    glow.addColorStop(0.12, `rgba(${warm},0.55)`);
    glow.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, gy);
  }
  // księżyc: tarcza z fazą i halo
  if (look.moon) {
    const mx = look.moon.x * W, my = look.moon.y * H, mr = H * 0.03;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 6);
    halo.addColorStop(0, `rgba(230,236,255,${0.35 * (1 - look.light)})`); halo.addColorStop(1, "rgba(230,236,255,0)");
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, mr * 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f3f1ea"; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    const ph = look.moon.phase == null ? 0.5 : look.moon.phase;
    const lit = 1 - Math.abs(ph - 0.5) * 2;
    if (lit < 0.97) {
      ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr + 0.5, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = mix(pal.skyTop, pal.skyLow, my / gy);
      const dir = ph < 0.5 ? 1 : -1;
      ctx.beginPath(); ctx.ellipse(mx - dir * mr * lit * 2, my, mr * 1.02, mr * 1.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  if (extras.sky) extras.sky(ctx, W, H, gy, pal);

  // warstwy lasu ginące we mgle
  const mist = look.mist == null ? 0.5 : look.mist;
  [[pal.l1, 0.17], [pal.l2, 0.12], [pal.l3, 0.07]].forEach((L, li) => {
    const fn = hillFn(gy - H * L[1], H * 0.02, (14 + li * 4) / W, 30 + li);
    ctx.fillStyle = L[0]; hillPath(ctx, W, H, fn); ctx.fill();
    const rt = rng(40 + li);
    ctx.beginPath();
    const trees = [];
    for (let k = 0; k < 34; k++) {
      const tx = rt() * W, th = H * (0.03 + rt() * 0.03 + li * 0.012);
      if (li === 2 && Math.abs(tx - gx) < W * 0.14) continue;
      spruce(ctx, tx, fn(tx) + H * 0.01, th); trees.push([tx, fn(tx) + H * 0.01, th]);
    }
    ctx.fill();
    if (look.snow) {
      ctx.fillStyle = rgba(pal.snow, 0.55 - li * 0.1);
      trees.forEach(([tx, ty, th]) => {
        for (let i = 1; i <= 3; i++) { const yy = ty - th + (th * i) / 4.4, ww = (th * 0.34 * i) / 4; ctx.beginPath(); ctx.ellipse(tx, yy - 1, ww * 0.8, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
      });
    }
    fogBand(ctx, W, gy - H * L[1] + H * 0.015, H * 0.035, pal.fog, (0.25 + mist * 0.5) * (night ? 0.6 : 1));
  });

  // pole przed lasem
  const field = hillFn(gy - H * 0.025, H * 0.008, 20 / W, 13);
  const fg = ctx.createLinearGradient(0, gy - H * 0.035, 0, gy);
  fg.addColorStop(0, mix(pal.field, pal.fog, 0.25)); fg.addColorStop(1, pal.field);
  ctx.fillStyle = fg; hillPath(ctx, W, H, field); ctx.fill();

  // ziemia: przekrój
  const ground = hillFn(gy, H * 0.004, 10 / W, 14);
  const groundAt = (x) => ground(x) - (ground(gx) - gy);
  const soil = ctx.createLinearGradient(0, gy, 0, H);
  soil.addColorStop(0, pal.soilTop); soil.addColorStop(1, pal.soilLow);
  ctx.fillStyle = soil; hillPath(ctx, W, H, groundAt); ctx.fill();
  const rsx = rng(31);
  for (let st = 0; st < 12; st++) {
    ctx.fillStyle = rgba(pal.stone, 0.3 + rsx() * 0.2);
    ctx.beginPath(); ctx.ellipse(rsx() * W, gy + H * (0.07 + rsx() * 0.26), H * (0.006 + rsx() * 0.01), H * (0.004 + rsx() * 0.006), rsx(), 0, Math.PI * 2); ctx.fill();
  }

  // korzenie: ciemne drewno z delikatnie świecącym rdzeniem; przy nasadzie przechodzą w pień
  const rootPaths = tree.roots.filter((r) => r.grown > 0.01).map((r) => [M(r.x0, r.y0), M(r.cx, r.cy), M(r.x1, r.y1), Math.max(1, r.w * ppu), Math.max(0.6, (r.wEnd || r.w) * ppu)]);
  ctx.fillStyle = mix(pal.trunk, pal.soilTop, 0.35);
  rootPaths.forEach(([a, c, e, w0, w1]) => { taper(ctx, a, c, e, w0, w1); ctx.fill(); });
  ctx.save();
  ctx.shadowColor = night ? "rgba(170,210,255,0.8)" : "rgba(240,205,140,0.75)"; ctx.shadowBlur = H * 0.008;
  ctx.fillStyle = night ? "rgba(185,215,240,0.55)" : "rgba(235,200,140,0.6)";
  rootPaths.forEach(([a, c, e, w0, w1]) => { taper(ctx, a, c, e, Math.max(0.6, w0 * 0.45), Math.max(0.4, w1 * 0.45)); ctx.fill(); });
  ctx.restore();
  // nasada pnia pod ziemią: łagodne przejście w korzenie
  if (tree.segments.length && tree.roots.length) {
    const bw = tree.segments[0].w * ppu;
    const cg = ctx.createLinearGradient(0, gy, 0, gy + bw * 0.9);
    cg.addColorStop(0, pal.trunk); cg.addColorStop(1, rgba(mix(pal.trunk, pal.soilTop, 0.35), 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(gx, gy, bw * 0.75, bw * 0.9, 0, 0, Math.PI); ctx.fill();
  }

  // nasionko, dopóki kiełek jest mały
  if (tree.P > 0 && tree.P < 9) {
    const sz = Math.max(H * 0.012, 0.006 * ppu) * (1 + tree.seed.swell * 0.25);
    const sx = gx, sy = gy + sz * 1.6;
    const sgr = ctx.createRadialGradient(sx - sz * 0.3, sy - sz * 0.4, sz * 0.1, sx, sy, sz);
    sgr.addColorStop(0, mix("#4a3a2e", "#9a7652", look.light)); sgr.addColorStop(1, mix("#2a201a", "#5e4430", look.light));
    ctx.save(); ctx.shadowColor = night ? "rgba(170,210,255,0.6)" : "rgba(255,220,160,0.7)"; ctx.shadowBlur = sz;
    ctx.fillStyle = sgr; ctx.beginPath(); ctx.ellipse(sx, sy, sz * 0.75, sz, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (tree.seed.cracked) {
      ctx.strokeStyle = mix("#140f0c", "#2e2119", look.light); ctx.lineWidth = Math.max(1, sz * 0.08);
      ctx.beginPath(); ctx.moveTo(sx - sz * 0.1, sy - sz * 0.9); ctx.quadraticCurveTo(sx + sz * 0.2, sy - sz * 0.2, sx - sz * 0.05, sy + sz * 0.5); ctx.stroke();
    }
  }

  // powierzchnia ziemi
  const sg = ctx.createLinearGradient(0, gy - H * 0.01, 0, gy + H * 0.02);
  sg.addColorStop(0, mix(pal.ground, "#ffffff", look.snow ? 0.2 : 0.05)); sg.addColorStop(1, mix(pal.ground, "#000000", 0.18));
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(0, groundAt(0) - H * 0.006);
  for (let x = 0; x <= W + 4; x += 4) ctx.lineTo(x, groundAt(x) - H * 0.006);
  for (let x = W; x >= -4; x -= 4) ctx.lineTo(x, groundAt(x) + H * 0.012);
  ctx.closePath(); ctx.fill();
  if (look.snow) {
    const rg = rng(71); ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 60; i++) { const x = rg() * W; ctx.globalAlpha = rg() * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i))); ctx.fillRect(x, groundAt(x) - H * 0.004 - rg() * H * 0.006, 1.3, 1.3); }
    ctx.globalAlpha = 1;
  }

  // kamienie i mech przy pniu (kamień, woda)
  if (tree.stones > 0 || tree.moss > 0.05) {
    const rs = rng(hashSeed("base", tree.genes.barkHue));
    for (let i = 0; i < tree.stones; i++) {
      const side = i % 2 ? 1 : -1, dx = side * (H * 0.018 + rs() * H * 0.03), r1 = H * (0.006 + rs() * 0.006);
      const gst = ctx.createLinearGradient(0, gy - r1, 0, gy);
      gst.addColorStop(0, mix(pal.stone, "#ffffff", 0.15)); gst.addColorStop(1, mix(pal.stone, "#000000", 0.25));
      ctx.fillStyle = gst; ctx.beginPath(); ctx.ellipse(gx + dx, gy + H * 0.002, r1 * 1.4, r1, 0, Math.PI, 0); ctx.fill();
      if (tree.moss > 0.1) { ctx.fillStyle = pal.moss; ctx.beginPath(); ctx.ellipse(gx + dx - r1 * 0.3, gy - r1 * 0.55, r1 * 0.8, r1 * 0.35, 0, Math.PI, 0); ctx.fill(); }
    }
    if (tree.moss > 0.05) {
      ctx.fillStyle = pal.moss;
      ctx.beginPath(); ctx.ellipse(gx, gy + 1, H * 0.02 * (0.5 + tree.moss), H * 0.004, 0, Math.PI, 0); ctx.fill();
    }
  }
  if (extras.ground) extras.ground(ctx, W, H, gy, groundAt, pal);

  // opadłe liście na ziemi
  const cols = leafColors(look, tree);
  if (tree.fallen > 0 && !look.snow) {
    const rl = rng(hashSeed("fallen", tree.genes.leafHue));
    for (let i = 0; i < tree.fallen; i++) {
      const lx = gx + (rl() - 0.5) * W * 0.5, ly = groundAt(lx) - rl() * H * 0.004;
      ctx.fillStyle = cols[Math.floor(rl() * cols.length) % cols.length];
      leafPath(ctx, lx, ly, 1.3 + rl() * 0.6, H * 0.01, 0.4, 0.5, tree.genes.leafShape); ctx.fill();
    }
  }

  // kołysanie (tylko wygląd)
  const windNow = look.wind == null ? 0.2 : look.wind;
  const swayAt = (s) => {
    const depthF = (s.depth + 1) * 0.6;
    return Math.sin(t * 0.9 + s.id * 0.37) * 0.012 * windNow * depthF + Math.sin(t * 0.37) * 0.01 * windNow;
  };
  const pos = new Map();
  tree.segments.forEach((s) => {
    const p = s.parent >= 0 ? pos.get(s.parent) : null;
    const base = p ? p.end : [0, 0];
    const rot = (p ? p.rot : 0) + swayAt(s);
    const L = s.len * s.grown;
    const a = s.angle + rot;
    const end = [base[0] + Math.sin(a) * L, base[1] - Math.cos(a) * L];
    const ctrl = [base[0] + Math.sin(a + s.bend) * L * 0.5, base[1] - Math.cos(a + s.bend) * L * 0.5];
    pos.set(s.id, { start: base, end, ctrl, rot, a });
  });

  const light = look.sun ? { x: look.sun.x * W, y: look.sun.y * H } : look.moon ? { x: look.moon.x * W, y: look.moon.y * H } : { x: W * 0.5, y: 0 };
  const rimA = night ? (look.moon ? 0.22 : 0.1) : 0.28;

  // pień i gałęzie
  ctx.fillStyle = pal.trunk; ctx.strokeStyle = pal.trunk; ctx.lineWidth = 1; ctx.lineJoin = "round";
  tree.segments.forEach((s) => {
    const p = pos.get(s.id);
    taper(ctx, M(...p.start), M(...p.ctrl), M(...p.end), Math.max(1, s.w * ppu), Math.max(0.7, (s.wEnd || s.w) * ppu));
    ctx.fill(); ctx.stroke();   // obrys zakrywa szczeliny między odcinkami
  });
  // obwódka światła po stronie słońca lub księżyca
  ctx.strokeStyle = rgba(pal.rim, rimA); ctx.lineCap = "butt";
  tree.segments.forEach((s) => {
    const w = s.w * ppu; if (w < 1.6) return;
    const p = pos.get(s.id), a = M(...p.start), c = M(...p.ctrl), e = M(...p.end);
    const dx = light.x > a[0] ? 1 : -1;
    ctx.lineWidth = Math.max(0.6, w * 0.16);
    ctx.beginPath(); ctx.moveTo(a[0] + dx * w * 0.36, a[1]); ctx.quadraticCurveTo(c[0] + dx * w * 0.34, c[1], e[0] + dx * (s.wEnd || s.w) * ppu * 0.32, e[1]); ctx.stroke();
  });

  // zgrubienia po dawnych gałęziach i ślady trudnych dni
  (tree.knots || []).forEach((kn) => {
    const p = pos.get(kn.seg); if (!p) return;
    const sg = tree.segments[kn.seg]; if (!sg) return;
    const u = kn.at, iu = 1 - u;
    const x = iu * iu * p.start[0] + 2 * iu * u * p.ctrl[0] + u * u * p.end[0];
    const y = iu * iu * p.start[1] + 2 * iu * u * p.ctrl[1] + u * u * p.end[1];
    const q = M(x, y), w = sg.w * ppu;
    if (w < 2) return;
    if (kn.kind === "node") {
      ctx.fillStyle = pal.trunk; ctx.beginPath(); ctx.ellipse(q[0], q[1], w * 0.56, w * 0.3, p.a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      const ox = (kn.side || 1) * w * 0.18;
      ctx.fillStyle = mix(pal.trunk, "#000000", 0.12); ctx.beginPath(); ctx.ellipse(q[0] + ox, q[1], w * 0.09 * (1 + kn.k), w * 0.15 * (1 + kn.k), p.a, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(pal.rim, rimA * 0.5); ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(q[0] + ox, q[1], w * 0.12 * (1 + kn.k), w * 0.18 * (1 + kn.k), p.a, -0.6, 1.2); ctx.stroke();
    }
  });

  // śnieg na gałęziach
  if (look.snow) {
    ctx.strokeStyle = rgba(pal.snow, 0.9);
    tree.segments.forEach((s) => {
      const w = s.w * ppu;
      if (s.depth > 2 || Math.abs(Math.sin(s.angle)) < 0.4 || w < 2) return;
      const p = pos.get(s.id), a = M(...p.start), e = M(...p.end);
      ctx.lineWidth = Math.max(1, w * 0.4);
      ctx.beginPath(); ctx.moveTo(a[0], a[1] - w * 0.5); ctx.lineTo(a[0] + (e[0] - a[0]) * 0.65, a[1] + (e[1] - a[1]) * 0.65 - w * 0.45); ctx.stroke();
    });
  }

  // liścienie kiełka
  if (tree.cotyledons && tree.cotyledons.size > 0.0005) {
    const c = tree.cotyledons, p = pos.get(0), at = p ? M(...p.end) : M(c.x, c.y), sz = c.size * ppu;
    [-1, 1].forEach((side) => {
      ctx.save(); ctx.translate(at[0], at[1]); ctx.rotate(side * 1.05 + Math.sin(t * 0.8) * 0.03);
      ctx.fillStyle = leafColor({ tone: 0.3, keep: 1 }, { ...look, season: look.season === "winter" ? "winter" : "summer" }, tree); ctx.beginPath(); ctx.ellipse(0, -sz * 0.9, sz * 0.55, sz, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(pal.rim, 0.25); ctx.beginPath(); ctx.ellipse(-sz * 0.12, -sz * 1.05, sz * 0.25, sz * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  // liście: miękkie kępy (im starsze drzewo, tym bardziej korona czyta się jako całość) i pojedyncze liście
  const segPoint = (segId, u) => {
    const p = pos.get(segId); if (!p) return null;
    const iu = 1 - u;
    return {
      x: iu * iu * p.start[0] + 2 * iu * u * p.ctrl[0] + u * u * p.end[0],
      y: iu * iu * p.start[1] + 2 * iu * u * p.ctrl[1] + u * u * p.end[1], a: p.a
    };
  };
  // grupy liści: lekki cień pod grupą daje głębię, światło przechodzi między grupami
  const leafPx = tree.genes.leafLen * ppu;
  const groupsSeen = new Set();
  const groupShade = Math.max(0, Math.min(1, (tree.P - 35) / 60));
  ctx.fillStyle = night ? `rgba(5,8,16,${0.16 * groupShade})` : `rgba(40,45,30,${0.1 * groupShade})`;
  tree.leaves.forEach((l) => {
    const key = l.seg + ":" + l.t; if (groupsSeen.has(key)) return; groupsSeen.add(key);
    const sp = segPoint(l.seg, l.t); if (!sp) return;
    const q = M(sp.x, sp.y);
    ctx.beginPath(); ctx.ellipse(q[0], q[1] + leafPx * 0.25, leafPx * 1.1 * l.grow, leafPx * 0.8 * l.grow, 0, 0, Math.PI * 2); ctx.fill();
  });
  const drawn = [];
  tree.leaves.forEach((l) => {
    const sp = segPoint(l.seg, l.t); if (!sp || l.grow <= 0.02) return;
    const size = Math.max(2.4, l.size * ppu * l.grow);
    const q0 = M(sp.x, sp.y);
    const flutter = Math.sin(t * 1.7 + l.tone * 20) * 0.08 * windNow;
    const ang = sp.a + l.spread + flutter;
    // ogonek: krótka łodyżka od gałązki do nasady liścia
    const st = size * l.stalk;
    const q = [q0[0] + Math.sin(ang) * st, q0[1] - Math.cos(ang) * st];
    ctx.globalAlpha = 0.9; ctx.strokeStyle = pal.trunk; ctx.lineWidth = Math.max(0.6, size * 0.06);
    ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    const col = leafColor(l, look, tree);
    const shape = tree.genes.leafShape;
    ctx.globalAlpha = 0.94; ctx.fillStyle = col;
    leafPath(ctx, q[0], q[1], ang, size, tree.genes.leafWide, tree.genes.leafPointy, shape); ctx.fill();
    // środkowy nerw i jaśniejsza strona od światła
    ctx.globalAlpha = 0.25; ctx.strokeStyle = night ? "#0b0f18" : "#2f3a1e"; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + Math.sin(ang) * size * 0.85, q[1] - Math.cos(ang) * size * 0.85); ctx.stroke();
    if ((light.x - q[0]) * Math.sin(ang) > 0) {
      ctx.globalAlpha = night ? 0.2 : 0.28; ctx.fillStyle = night ? "#dbe6f7" : "#fff0cc";
      leafPath(ctx, q[0], q[1], ang, size * 0.62, tree.genes.leafWide * 0.5, tree.genes.leafPointy, shape === "lobed" || shape === "round" || shape === "heart" ? "almond" : shape); ctx.fill();
    }
    drawn.push({ q, ang, size, l });
  });
  ctx.globalAlpha = 1;
  if (look.frost) {
    ctx.strokeStyle = rgba(pal.snow, 0.4); ctx.lineWidth = 0.6;
    drawn.forEach((d) => { if (d.l.keep > 0.3) return; leafPath(ctx, d.q[0], d.q[1], d.ang, d.size, tree.genes.leafWide, tree.genes.leafPointy, tree.genes.leafShape); ctx.stroke(); });
  }

  // pąki: zimą i wiosną wszystkie; nasiono daje świeże pąki o każdej porze
  {
    const showAll = look.season === "winter" || look.season === "spring";
    tree.buds.forEach((b) => {
      if (!showAll && !b.fresh) return;
      const p = pos.get(b.seg); if (!p) return;
      ctx.fillStyle = b.fresh && !showAll ? mix("#3e4a2a", "#9fb35a", look.light) : mix("#4a2a28", "#9a4a3a", look.light);
      const e = M(...p.end), sz = Math.max(2, 0.0035 * ppu);
      ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(p.a);
      ctx.beginPath(); ctx.moveTo(0, -sz * 1.6); ctx.quadraticCurveTo(sz * 0.8, -sz * 0.3, 0, 0); ctx.quadraticCurveTo(-sz * 0.8, -sz * 0.3, 0, -sz * 1.6); ctx.fill();
      ctx.restore();
    });
  }

  if (extras.front) extras.front(ctx, W, H, { M, pos, gy, groundAt, ppu, pal, tree });

  // mgła przy ziemi
  fogBand(ctx, W, gy - H * 0.01, H * 0.03, pal.fog, (0.2 + mist * 0.4) * (night ? 0.5 : 1));

  // winieta
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, night ? "rgba(0,0,10,0.3)" : "rgba(30,25,20,0.16)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  return { cam, pos, M, groundAt };
}

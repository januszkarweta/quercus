// Rysowanie sceny w stylu „Wycinanka” (pappersklipp).
// Płaskie warstwy jak z papieru, delikatny cień między warstwami, ziarno papieru.
//
// Kamera: drzewo jest liczone w jednostkach „u”. Mały kiełek jest pokazany większy,
// duże drzewo mniejsze, ale tylko częściowo — wzrost ma być widoczny.

import { rng, hashSeed } from "../rng.js";

// ---------- Kolory ----------
function hex(c) { const p = parseInt(c.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; }
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t), g = Math.round(A[1] + (B[1] - A[1]) * t), bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }

/** Paleta sceny zależna od pory roku (0..1 w obrębie roku) i od światła (0 noc .. 1 dzień). */
export function palette(look) {
  const { season, light, snow } = look;
  // podstawowe kolory dnia dla pór roku
  const day = {
    autumn: { sky: "#d6ddd8", sky2: "#e8e2d4", far: "#b8c2b6", mid: "#98a490", spruce: "#66755f", field: "#b9965e", ground: "#a47f4f" },
    winter: { sky: "#cfd8df", sky2: "#e6e8e6", far: "#b9c4cf", mid: "#d5dde5", spruce: "#4d5c58", field: "#e3e9ef", ground: "#eef2f6" },
    spring: { sky: "#cfdde0", sky2: "#e9ecdf", far: "#b2c3b0", mid: "#93ad86", spruce: "#5f7558", field: "#a7b878", ground: "#8f9d5c" },
    summer: { sky: "#c4d6df", sky2: "#e8ecdf", far: "#a9bba6", mid: "#7f9b72", spruce: "#53694d", field: "#a5ad62", ground: "#8a8a4c" }
  }[season];
  const night = {
    sky: "#18213a", sky2: "#2a3755", far: "#3b4766", mid: "#4a5675", spruce: "#1b2438", field: "#566180", ground: "#5d6886"
  };
  const nightSnow = { far: "#7f8cab", mid: "#a9b5cc", field: "#c4cee0", ground: "#d8e0ec" };
  const out = {};
  for (const k of Object.keys(day)) {
    const n = snow && nightSnow[k] ? nightSnow[k] : night[k];
    out[k] = mix(n, day[k], light);
  }
  out.soil = mix("#2c2420", "#6a4d37", 0.35 + light * 0.65);
  out.soil2 = mix("#1f1915", "#4f3a2b", 0.35 + light * 0.65);
  out.root = mix("#8a7560", "#c8a57d", light);
  out.stone = mix("#4a4038", "#8a7a6a", light);
  out.trunk = mix("#231d19", "#46372d", light);
  out.moss = mix("#2e3a2c", "#6f8a4a", light);
  out.snow = mix("#cdd7e6", "#f3f6fa", light);
  out.frost = mix("#c9d4e6", "#f4f7fb", light);
  return out;
}

/** Kolory liści: pierwszy rok jest chroniony — jesienią przebarwienie, zimą ciemniejsza, czerwonawa zieleń. */
function leafColors(look, tree) {
  const g = tree.genes;
  const greenA = mix("#6f8a3e", "#4f7a4a", g.leafHue);
  const greenB = mix("#8fa04a", "#6e9455", g.leafHue);
  const lushA = mix(greenA, "#4e8a3c", tree.lush * 0.5);
  let cols;
  if (look.season === "autumn") cols = [lushA, greenB, "#b49a3e", "#c08a3a", "#b5582e"];
  else if (look.season === "winter") cols = ["#3f4c37", "#4d3c36", "#563f3a", "#3b473a"];
  else cols = [lushA, greenB, mix(greenB, "#c8d27a", 0.3)];
  return cols.map((c) => mix(mix("#151a24", c, 0.25), c, look.light));
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
  ctx.beginPath(); ctx.moveTo(x, y - h);
  for (let i = 1; i <= 4; i++) { const yy = y - h + (h * i) / 4.4, ww = (w * i) / 4; ctx.lineTo(x + ww, yy); ctx.lineTo(x + ww * 0.45, yy); }
  ctx.lineTo(x + w * 0.12, y); ctx.lineTo(x - w * 0.12, y);
  for (let k = 4; k >= 1; k--) { const y2 = y - h + (h * k) / 4.4, w2 = (w * k) / 4; ctx.lineTo(x - w2 * 0.45, y2); ctx.lineTo(x - w2, y2); }
  ctx.closePath();
}
export function leafPath(ctx, x, y, a, len, wide, pointy = 0.5) {
  const tx = x + Math.sin(a) * len, ty = y - Math.cos(a) * len;
  const nx = Math.cos(a) * len * wide, ny = Math.sin(a) * len * wide;
  const k = 0.45 + pointy * 0.2;
  const mx = x + (tx - x) * k, my = y + (ty - y) * k;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
  ctx.quadraticCurveTo(mx - nx, my - ny, x, y);
  ctx.closePath();
}

let grainCanvas = null;
function grain(ctx) {
  if (!grainCanvas) {
    grainCanvas = document.createElement("canvas");
    grainCanvas.width = grainCanvas.height = 160;
    const g = grainCanvas.getContext("2d"), img = g.createImageData(160, 160), r = rng(7);
    for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = r() * 40; }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainCanvas, "repeat");
}

// ---------- Kamera ----------
/** Ile pikseli na jednostkę u: mały kiełek powiększony, duże drzewo pomniejszone (częściowo). */
export function camera(W, H, tree) {
  const avail = H * 0.5;                      // od linii ziemi do góry sceny pod tekstem
  const h = Math.max(tree.height, 0.03);
  let ppu = (avail * 0.84) * Math.pow(h, -0.75);
  // drzewo musi zmieścić się w szerokości
  if (tree.width > 0) ppu = Math.min(ppu, (W * 0.44) / tree.width);
  ppu = Math.min(ppu, (avail * 0.95) / Math.max(tree.height, 0.02));
  return { gx: W * 0.5, gy: H * 0.66, ppu };
}

// ---------- Scena ----------
/**
 * Rysuje całą scenę.
 * @param look { season, light (0..1), snow (bool), stars (0..1), sun {x,y} w ułamkach, moon {x,y,phase}, mist (0..1), time (s) }
 */
export function paintScene(ctx, W, H, tree, look, extras = {}) {
  const pal = palette(look);
  const cam = camera(W, H, tree);
  const { gx, gy, ppu } = cam;
  const t = look.time || 0;
  const M = (x, y) => [gx + x * ppu, gy + y * ppu];
  const night = look.light < 0.35;
  function layer(fill, fn, depth = 1) {
    ctx.save();
    ctx.shadowColor = night ? "rgba(0,0,0,0.35)" : "rgba(60,40,20,0.18)";
    ctx.shadowBlur = H * 0.012 * depth; ctx.shadowOffsetY = H * 0.004 * depth;
    ctx.fillStyle = fill; fn(); ctx.fill(); ctx.restore();
  }

  // niebo w pasach
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = mix(pal.sky, pal.sky2, i / (bands - 1));
    ctx.fillRect(0, (gy * i) / bands, W, gy / bands + 1);
  }
  if (look.stars > 0) {
    const rs = rng(hashSeed("stars"));
    ctx.fillStyle = "#f4efe2";
    for (let s = 0; s < 90; s++) {
      const x = rs() * W, y = rs() * gy * 0.8, rr = rs() * 1.3 + 0.4, tw = 0.6 + 0.4 * Math.sin(t * (0.5 + rs()) + rs() * 6);
      ctx.globalAlpha = look.stars * tw; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (look.sun && look.sun.y < 0.66) {
    layer(mix("#f2c98d", "#f1d7a3", look.light), () => { ctx.beginPath(); ctx.arc(look.sun.x * W, look.sun.y * H, H * 0.05, 0, Math.PI * 2); });
  }
  if (look.moon && look.moon.y < 0.66) {
    const mx = look.moon.x * W, my = look.moon.y * H, mr = H * 0.038;
    layer("#efe7d2", () => { ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); });
    // faza księżyca: cień z koloru nieba
    const ph = look.moon.phase == null ? 0.5 : look.moon.phase; // 0 nów, 0.5 pełnia
    const lit = 1 - Math.abs(ph - 0.5) * 2;
    if (lit < 0.97) {
      ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr + 0.5, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = mix(pal.sky, pal.sky2, my / gy);
      const dir = ph < 0.5 ? 1 : -1;
      ctx.beginPath(); ctx.ellipse(mx - dir * mr * lit * 2, my, mr * 1.02, mr * 1.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  if (look.light > 0.5 && !look.snowing && !look.raining) {
    const drift = (t * 2) % (W * 1.6);
    layer(rgba("#f4f5f1", 0.9), () => { ctx.beginPath(); ctx.ellipse(((W * 0.7 + drift) % (W * 1.4)) - W * 0.2, H * 0.3, W * 0.15, H * 0.02, 0, 0, Math.PI * 2); });
  }
  if (extras.sky) extras.sky(ctx, W, H, gy);

  const far = hillFn(gy - H * 0.13, H * 0.03, 12 / W, 11);
  layer(pal.far, () => hillPath(ctx, W, H, far));
  const mid = hillFn(gy - H * 0.07, H * 0.022, 17 / W * 1.0, 12);
  layer(pal.mid, () => hillPath(ctx, W, H, mid));
  const rt = rng(21);
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.2)"; ctx.shadowBlur = H * 0.008; ctx.fillStyle = pal.spruce;
  for (let k = 0; k < 28; k++) {
    const tx = rt() * W, th = H * (0.04 + rt() * 0.05);
    if (Math.abs(tx - gx) < W * 0.1) continue;
    spruce(ctx, tx, mid(tx) + H * 0.01, th); ctx.fill();
  }
  ctx.restore();
  if (look.snow) {
    // śnieg na świerkach
    const rs2 = rng(21); ctx.fillStyle = rgba(pal.snow, 0.85);
    for (let k = 0; k < 28; k++) {
      const tx = rs2() * W, th = H * (0.04 + rs2() * 0.05);
      if (Math.abs(tx - gx) < W * 0.1) continue;
      const y = mid(tx) + H * 0.01;
      for (let i = 1; i <= 3; i++) { const yy = y - th + (th * i) / 4.4, ww = (th * 0.34 * i) / 4; ctx.fillRect(tx - ww * 0.8, yy - 1.5, ww * 1.6, 2); }
    }
  }
  if (look.mist > 0) {
    const g = ctx.createLinearGradient(0, gy - H * 0.12, 0, gy - H * 0.02);
    g.addColorStop(0, rgba(mix(pal.sky2, "#ffffff", 0.3), 0)); g.addColorStop(0.5, rgba(mix(pal.sky2, "#ffffff", 0.3), 0.7 * look.mist)); g.addColorStop(1, rgba(pal.sky2, 0));
    ctx.fillStyle = g; ctx.fillRect(0, gy - H * 0.12, W, H * 0.1);
  }
  const field = hillFn(gy - H * 0.025, H * 0.008, 20 / W, 13);
  layer(pal.field, () => hillPath(ctx, W, H, field));

  // ziemia (przekrój)
  const ground = hillFn(gy, H * 0.004, 10 / W, 14);
  const groundAt = (x) => ground(x) - (ground(gx) - gy);
  layer(pal.soil, () => hillPath(ctx, W, H, groundAt));
  ctx.fillStyle = pal.soil2;
  hillPath(ctx, W, H, hillFn(gy + H * 0.2, H * 0.01, 20 / W, 15)); ctx.fill();
  const rsx = rng(31);
  ctx.fillStyle = pal.stone;
  for (let st = 0; st < 12; st++) {
    ctx.beginPath(); ctx.ellipse(rsx() * W, gy + H * (0.07 + rsx() * 0.26), H * (0.006 + rsx() * 0.01), H * (0.004 + rsx() * 0.006), rsx(), 0, Math.PI * 2); ctx.fill();
  }

  // korzenie
  ctx.strokeStyle = pal.root; ctx.lineCap = "round";
  tree.roots.forEach((s) => {
    if (s.grown <= 0.01) return;
    const a = M(s.x0, s.y0), c = M(s.cx, s.cy), e = M(s.x1, s.y1);
    ctx.lineWidth = Math.max(0.8, s.w * ppu);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]); ctx.stroke();
  });

  // nasionko (widoczne, dopóki kiełek jest mały)
  if (tree.P > 0 && tree.P < 9) {
    const sz = Math.max(H * 0.012, 0.006 * ppu) * (1 + tree.seed.swell * 0.25);
    const sx = gx, sy = gy + sz * 1.6;
    layer(mix("#3b2d24", "#7a5a3f", look.light), () => { ctx.beginPath(); ctx.ellipse(sx, sy, sz * 0.75, sz, 0.3, 0, Math.PI * 2); }, 0.5);
    if (tree.seed.cracked) {
      ctx.strokeStyle = mix("#1c1512", "#3a2a20", look.light); ctx.lineWidth = Math.max(1, sz * 0.08);
      ctx.beginPath(); ctx.moveTo(sx - sz * 0.1, sy - sz * 0.9); ctx.quadraticCurveTo(sx + sz * 0.2, sy - sz * 0.2, sx - sz * 0.05, sy + sz * 0.5); ctx.stroke();
    }
  }

  // powierzchnia ziemi (pas trawy/śniegu)
  layer(pal.ground, () => {
    ctx.beginPath(); ctx.moveTo(0, groundAt(0));
    for (let x = 0; x <= W + 4; x += 4) ctx.lineTo(x, groundAt(x));
    for (let x = W; x >= -4; x -= 4) ctx.lineTo(x, groundAt(x) + H * 0.016);
    ctx.closePath();
  });

  // kamienie i mech przy pniu (kamień, woda)
  if (tree.stones > 0 || tree.moss > 0.05) {
    const rs = rng(hashSeed("base", tree.genes.barkHue));
    for (let i = 0; i < tree.stones; i++) {
      const side = i % 2 ? 1 : -1, dx = side * (H * 0.018 + rs() * H * 0.03), r1 = H * (0.006 + rs() * 0.006);
      layer(pal.stone, () => { ctx.beginPath(); ctx.ellipse(gx + dx, gy + H * 0.002, r1 * 1.4, r1, 0, Math.PI, 0); }, 0.4);
      if (tree.moss > 0.1) { ctx.fillStyle = pal.moss; ctx.beginPath(); ctx.ellipse(gx + dx - r1 * 0.3, gy - r1 * 0.55, r1 * 0.8, r1 * 0.35, 0, Math.PI, 0); ctx.fill(); }
    }
    if (tree.moss > 0.05) {
      ctx.fillStyle = pal.moss;
      ctx.beginPath(); ctx.ellipse(gx, gy + 1, H * 0.02 * (0.5 + tree.moss), H * 0.004, 0, Math.PI, 0); ctx.fill();
    }
  }
  if (extras.ground) extras.ground(ctx, W, H, gy, groundAt);

  // opadłe liście
  if (tree.fallen > 0 && look.season !== "winter") {
    const cols = leafColors(look, tree);
    const rl = rng(hashSeed("fallen", tree.genes.leafHue));
    for (let i = 0; i < tree.fallen; i++) {
      const lx = gx + (rl() - 0.5) * W * 0.5, ly = groundAt(lx) + rl() * H * 0.008 - H * 0.002;
      ctx.fillStyle = cols[Math.min(cols.length - 1, 2 + Math.floor(rl() * (cols.length - 2)))];
      leafPath(ctx, lx, ly, 1.2 + rl() * 0.8, H * 0.011, 0.4); ctx.fill();
    }
  }

  // kołysanie na wietrze (tylko wizualne)
  const windNow = look.wind == null ? 0.2 : look.wind;
  const swayAt = (s) => {
    const depthF = (s.depth + 1) * 0.6;
    return Math.sin(t * 0.9 + s.id * 0.37) * 0.012 * windNow * depthF + Math.sin(t * 0.37) * 0.01 * windNow;
  };
  const pos = new Map();
  tree.segments.forEach((s) => {
    const p = s.parent >= 0 ? pos.get(s.parent) : null;
    const base = p ? p.end : [0, 0];
    const baseAng = p ? p.rot : 0;
    const rot = baseAng + swayAt(s);
    const L = s.len * s.grown;
    const a = s.angle + rot;
    const end = [base[0] + Math.sin(a) * L, base[1] - Math.cos(a) * L];
    const ctrl = [base[0] + Math.sin(a + s.bend) * L * 0.5, base[1] - Math.cos(a + s.bend) * L * 0.5];
    pos.set(s.id, { start: base, end, ctrl, rot, a });
  });

  // pień i gałęzie
  ctx.save();
  ctx.shadowColor = night ? "rgba(0,0,0,0.4)" : "rgba(60,40,20,0.22)"; ctx.shadowBlur = H * 0.01; ctx.shadowOffsetY = H * 0.004;
  ctx.strokeStyle = mix(pal.trunk, mix("#5a4434", "#3d3a36", tree.genes.barkHue), look.light * 0.5);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  tree.segments.forEach((s) => {
    const p = pos.get(s.id);
    const a = M(...p.start), c = M(...p.ctrl), e = M(...p.end);
    ctx.lineWidth = Math.max(1, s.w * ppu);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(c[0], c[1], e[0], e[1]); ctx.stroke();
  });
  ctx.restore();

  // śnieg na gałęziach
  if (look.snow) {
    ctx.strokeStyle = pal.snow; ctx.lineCap = "round";
    tree.segments.forEach((s) => {
      if (s.depth > 2 || Math.abs(Math.sin(s.angle)) < 0.4 || s.w * ppu < 2) return;
      const p = pos.get(s.id), a = M(...p.start), e = M(...p.end);
      ctx.lineWidth = Math.max(1, s.w * ppu * 0.45);
      const off = s.w * ppu * 0.55;
      ctx.beginPath(); ctx.moveTo(a[0], a[1] - off); ctx.lineTo(a[0] + (e[0] - a[0]) * 0.65, a[1] + (e[1] - a[1]) * 0.65 - off); ctx.stroke();
    });
  }

  // liścienie kiełka
  const cols = leafColors(look, tree);
  if (tree.cotyledons && tree.cotyledons.size > 0.0005) {
    const c = tree.cotyledons, p = M(c.x, c.y), sz = c.size * ppu;
    ctx.fillStyle = cols[0];
    [-1, 1].forEach((side) => {
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(side * 1.05 + Math.sin(t * 0.8) * 0.03);
      ctx.beginPath(); ctx.ellipse(0, -sz * 0.9, sz * 0.55, sz, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
  }

  // liście
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.18)"; ctx.shadowBlur = H * 0.004; ctx.shadowOffsetY = H * 0.002;
  const segPos = (l) => {
    const p = pos.get(l.seg); if (!p) return null;
    const u = l.t, iu = 1 - u;
    const x = iu * iu * p.start[0] + 2 * iu * u * p.ctrl[0] + u * u * p.end[0];
    const y = iu * iu * p.start[1] + 2 * iu * u * p.ctrl[1] + u * u * p.end[1];
    return { x, y, a: p.a };
  };
  const leafDraw = [];
  tree.leaves.forEach((l) => {
    const sp = segPos(l); if (!sp || l.size <= 0.0003) return;
    const q = M(sp.x, sp.y);
    const flutter = Math.sin(t * 1.7 + l.tone * 20) * 0.08 * windNow;
    const ang = sp.a + l.side * l.off + flutter;
    const col = look.season === "autumn"
      ? cols[Math.min(cols.length - 1, Math.floor(Math.min(0.999, l.tone * 0.6 + l.keep * 0.45) * cols.length))]
      : cols[Math.floor(l.tone * cols.length) % cols.length];
    leafDraw.push({ q, ang, size: Math.max(2.2, l.size * ppu), col, l });
    ctx.fillStyle = col;
    leafPath(ctx, q[0], q[1], ang, Math.max(2.2, l.size * ppu), tree.genes.leafWide, tree.genes.leafPointy); ctx.fill();
  });
  ctx.restore();
  if (look.frost) {
    ctx.strokeStyle = rgba(pal.frost, 0.45); ctx.lineWidth = 0.6;
    leafDraw.forEach((d) => { if (d.l.keep > 0.3) return; leafPath(ctx, d.q[0], d.q[1], d.ang, d.size, tree.genes.leafWide, tree.genes.leafPointy); ctx.stroke(); });
  }

  // pąki (zimą widoczne, czekają na wiosnę)
  if (look.season === "winter" || look.season === "spring") {
    ctx.fillStyle = mix("#5a2f2a", "#9a4a3a", look.light);
    tree.buds.forEach((b) => {
      const p = pos.get(b.seg); if (!p) return;
      const e = M(...p.end), sz = Math.max(2, 0.0035 * ppu);
      ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(p.a);
      ctx.beginPath(); ctx.moveTo(0, -sz * 1.6); ctx.quadraticCurveTo(sz * 0.8, -sz * 0.3, 0, 0); ctx.quadraticCurveTo(-sz * 0.8, -sz * 0.3, 0, -sz * 1.6); ctx.fill();
      ctx.restore();
    });
  }

  if (extras.front) extras.front(ctx, W, H, { M, pos, gy, groundAt, ppu });

  // ziarno papieru
  ctx.fillStyle = grain(ctx); ctx.globalAlpha = 0.45; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;

  return { cam, pos, M };
}

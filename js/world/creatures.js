// Rysowanie zdarzeń i pogody w stylu „Mgła i światło”.
// Zwierzęta to miękkie sylwetki z delikatną obwódką światła. Ruch jest spokojny i rzadki.

import { rng, hashSeed } from "../rng.js";
import { mix, rgba, leafPath } from "../tree/paint.js";

// ---------- Pomocnicze ----------
function sil(ctx, color, fn) { ctx.fillStyle = color; ctx.beginPath(); fn(); ctx.fill(); }

/** Wybiera gałąź do przysiadania: średnia wysokość, prawie pozioma. */
export function perchPoint(geo, seed) {
  const r = rng(seed);
  const cands = [];
  geo.tree.segments.forEach((s) => {
    if (s.depth < 1 || s.depth > 2 || s.grown < 0.9) return;
    if (Math.abs(Math.sin(s.angle)) < 0.45) return;
    cands.push(s);
  });
  if (!cands.length) return null;
  const s = cands[Math.floor(r() * cands.length)];
  const p = geo.pos.get(s.id);
  const u = 0.55 + r() * 0.3;
  const x = p.start[0] + (p.end[0] - p.start[0]) * u, y = p.start[1] + (p.end[1] - p.start[1]) * u;
  return { pt: geo.M(x, y), seg: s, w: s.w * geo.ppu };
}

// ---------- Ptaki ----------
const BIRD = {
  rodhake: { body: "#6b5a4c", breast: "#d9824a", size: 1 },
  talgoxe: { body: "#5d6b4a", breast: "#e6cf5a", head: "#1d1d1d", size: 0.9 },
  domherre: { body: "#5c5a62", breast: "#d4615a", head: "#1d1d1d", size: 1.05 },
  koltrast: { body: "#1f1c1a", breast: "#1f1c1a", beak: "#e0a13a", size: 1.25 }
};

export function drawBird(ctx, x, y, s, kind, light, t, hop = 0) {
  const b = BIRD[kind] || BIRD.rodhake;
  s *= b.size;
  const dim = (c) => mix("#151b28", c, 0.25 + light * 0.75);
  ctx.save();
  ctx.translate(x, y - hop * s * 2.2);
  const look = Math.sin(t * 0.7) > 0.6 ? -1 : 1; // od czasu do czasu odwraca głowę
  ctx.scale(look, 1);
  sil(ctx, dim(b.body), () => { ctx.moveTo(-s * 0.9, -s * 0.5); ctx.lineTo(-s * 1.7, -s * 0.15); ctx.lineTo(-s * 1.5, -s * 0.8); ctx.closePath(); });
  sil(ctx, dim(b.body), () => ctx.ellipse(-s * 0.2, -s * 0.75, s * 0.95, s * 0.7, -0.15, 0, Math.PI * 2));
  sil(ctx, dim(b.head || b.body), () => ctx.arc(s * 0.55, -s * 1.3, s * 0.5, 0, Math.PI * 2));
  if (b.breast !== b.body) sil(ctx, dim(b.breast), () => ctx.ellipse(s * 0.3, -s * 0.8, s * 0.5, s * 0.52, 0.2, 0, Math.PI * 2));
  if (kind === "rodhake") sil(ctx, dim(b.breast), () => ctx.arc(s * 0.62, -s * 1.2, s * 0.32, 0, Math.PI * 2));
  if (kind === "talgoxe") sil(ctx, dim("#f4f1e6"), () => ctx.ellipse(s * 0.62, -s * 1.28, s * 0.22, s * 0.16, 0, 0, Math.PI * 2));
  sil(ctx, b.beak || "#2a2420", () => { ctx.moveTo(s * 1.0, -s * 1.35); ctx.lineTo(s * 1.32, -s * 1.28); ctx.lineTo(s * 1.0, -s * 1.2); ctx.closePath(); });
  sil(ctx, "#111", () => ctx.arc(s * 0.72, -s * 1.42, s * 0.08, 0, Math.PI * 2));
  ctx.strokeStyle = "#2c2622"; ctx.lineWidth = Math.max(0.8, s * 0.08);
  ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.1); ctx.lineTo(-s * 0.15, s * 0.05); ctx.moveTo(s * 0.2, -s * 0.12); ctx.lineTo(s * 0.2, s * 0.05); ctx.stroke();
  ctx.restore();
}

function drawOwl(ctx, x, y, s, light, t) {
  const c = mix("#1a1f2b", "#7a6a58", 0.2 + light * 0.6);
  ctx.save(); ctx.translate(x, y);
  sil(ctx, c, () => ctx.ellipse(0, -s * 1.2, s * 0.85, s * 1.25, 0, 0, Math.PI * 2));
  sil(ctx, c, () => { ctx.moveTo(-s * 0.7, -s * 2.1); ctx.lineTo(-s * 0.45, -s * 2.6); ctx.lineTo(-s * 0.2, -s * 2.15); ctx.moveTo(s * 0.7, -s * 2.1); ctx.lineTo(s * 0.45, -s * 2.6); ctx.lineTo(s * 0.2, -s * 2.15); });
  const blink = Math.sin(t * 0.5) > 0.97 ? 0.15 : 1;
  ctx.fillStyle = "#f2d27a";
  [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * s * 0.32, -s * 1.75, s * 0.18, s * 0.18 * blink, 0, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

// ---------- Zwierzęta na ziemi ----------
function quad(ctx, x, y, s, spec, light, t, dir = 1) {
  const c = mix("#151b28", spec.color, 0.25 + light * 0.75);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  const L = spec.len * s, Hh = spec.height * s, legH = spec.legs * s;
  sil(ctx, c, () => ctx.ellipse(0, -legH - Hh * 0.5, L * 0.5, Hh * 0.5, 0, 0, Math.PI * 2));
  // nogi
  ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, s * spec.legW); ctx.lineCap = "round";
  ctx.beginPath();
  [-0.32, -0.22, 0.25, 0.34].forEach((k, i) => { const sw = Math.sin(t * 0.6 + i) * 0.02 * s; ctx.moveTo(k * L, -legH - Hh * 0.2); ctx.lineTo(k * L + sw, 0); });
  ctx.stroke();
  // szyja i głowa
  const hx = L * 0.5 + spec.neck * s * 0.6, hy = -legH - Hh * 0.7 - spec.neck * s;
  ctx.lineWidth = Math.max(1, s * spec.neckW);
  ctx.beginPath(); ctx.moveTo(L * 0.38, -legH - Hh * 0.6); ctx.lineTo(hx, hy); ctx.stroke();
  const lift = Math.sin(t * 0.25) > 0.5 ? -s * 0.25 : 0;
  sil(ctx, c, () => ctx.ellipse(hx + spec.head * s * 0.4, hy + lift, spec.head * s, spec.head * s * 0.6, 0.2, 0, Math.PI * 2));
  if (spec.ears) sil(ctx, c, () => { ctx.moveTo(hx, hy + lift - spec.head * s * 0.3); ctx.lineTo(hx - s * 0.1, hy + lift - spec.ears * s); ctx.lineTo(hx + s * 0.25, hy + lift - spec.head * s * 0.4); });
  if (spec.antlers) {
    ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath();
    ctx.moveTo(hx, hy + lift - spec.head * s * 0.4); ctx.quadraticCurveTo(hx - s * 0.8, hy + lift - s * 1.4, hx - s * 1.4, hy + lift - s * 1.0);
    ctx.moveTo(hx + s * 0.1, hy + lift - spec.head * s * 0.4); ctx.quadraticCurveTo(hx + s * 0.6, hy + lift - s * 1.5, hx + s * 1.2, hy + lift - s * 1.1);
    ctx.stroke();
  }
  if (spec.tail) {
    ctx.lineWidth = Math.max(1, s * spec.tailW);
    ctx.beginPath(); ctx.moveTo(-L * 0.48, -legH - Hh * 0.6); ctx.quadraticCurveTo(-L * 0.75, -legH - Hh * 0.2, -L * (0.5 + spec.tail), -legH - Hh * 0.1 + Math.sin(t) * s * 0.05); ctx.stroke();
    if (spec.tailTip) sil(ctx, mix(c, "#ffffff", 0.6 * light), () => ctx.arc(-L * (0.5 + spec.tail), -legH - Hh * 0.1, s * spec.tailW * 0.5, 0, Math.PI * 2));
  }
  ctx.restore();
}
const QUAD = {
  rav: { color: "#b8642e", len: 1.5, height: 0.55, legs: 0.45, legW: 0.1, neck: 0.25, neckW: 0.3, head: 0.3, ears: 0.55, tail: 0.7, tailW: 0.28, tailTip: true },
  radjur: { color: "#8a6142", len: 1.9, height: 0.75, legs: 1.1, legW: 0.1, neck: 0.8, neckW: 0.25, head: 0.32, ears: 0.6, tail: 0.1, tailW: 0.1 },
  alg: { color: "#3e3129", len: 2.8, height: 1.3, legs: 1.7, legW: 0.18, neck: 0.5, neckW: 0.55, head: 0.6, antlers: true },
  hare: { color: "#8c7a66", len: 0.9, height: 0.55, legs: 0.15, legW: 0.1, neck: 0.15, neckW: 0.3, head: 0.25, ears: 0.9 }
};

function drawHedgehog(ctx, x, y, s, light) {
  const c = mix("#151b28", "#6a5a48", 0.25 + light * 0.75);
  ctx.save(); ctx.translate(x, y);
  sil(ctx, c, () => ctx.ellipse(0, -s * 0.45, s * 0.9, s * 0.5, 0, Math.PI, 0));
  ctx.strokeStyle = c; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) { const a = Math.PI + (i / 13) * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.85, -s * 0.45 + Math.sin(a) * s * 0.45); ctx.lineTo(Math.cos(a) * s * 1.05, -s * 0.45 + Math.sin(a) * s * 0.62); ctx.stroke(); }
  sil(ctx, mix(c, "#c8b49a", 0.3), () => ctx.ellipse(s * 0.95, -s * 0.25, s * 0.3, s * 0.18, 0.3, 0, Math.PI * 2));
  ctx.restore();
}
function drawSquirrel(ctx, x, y, s, light, t) {
  const c = mix("#151b28", "#a5582e", 0.25 + light * 0.75);
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = c; ctx.lineWidth = s * 0.55; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.2); ctx.bezierCurveTo(-s * 1.4, -s * 0.4, -s * 1.3, -s * 1.6, -s * 0.7, -s * 1.7 + Math.sin(t) * s * 0.05); ctx.stroke();
  sil(ctx, c, () => ctx.ellipse(0, -s * 0.55, s * 0.4, s * 0.55, -0.2, 0, Math.PI * 2));
  sil(ctx, c, () => ctx.arc(s * 0.25, -s * 1.15, s * 0.28, 0, Math.PI * 2));
  sil(ctx, c, () => { ctx.moveTo(s * 0.15, -s * 1.35); ctx.lineTo(s * 0.12, -s * 1.65); ctx.lineTo(s * 0.3, -s * 1.38); });
  ctx.restore();
}

// ---------- Owady i drobiazgi ----------
function butterflies(ctx, geo, t, light) {
  const r = rng(5);
  for (let i = 0; i < 3; i++) {
    const cx = geo.M(0, -geo.tree.height * (0.4 + r() * 0.5));
    const x = cx[0] + Math.sin(t * 0.4 + i * 2) * geo.ppu * 0.25 * (0.5 + r()), y = cx[1] + Math.cos(t * 0.53 + i) * geo.ppu * 0.12;
    const flap = Math.abs(Math.sin(t * 8 + i)) * 0.8 + 0.2, s = 5 + r() * 2;
    ctx.fillStyle = rgba(["#f1d27a", "#e8e4dc", "#d98a5a"][i], 0.9 * (0.4 + light * 0.6));
    [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(x + d * s * 0.5 * flap, y, s * 0.6 * flap, s * 0.8, d * 0.4, 0, Math.PI * 2); ctx.fill(); });
  }
}
function bees(ctx, geo, t) {
  for (let i = 0; i < 3; i++) {
    const c = geo.M(0, -geo.tree.height * 0.6);
    const x = c[0] + Math.sin(t * 1.3 + i * 2.1) * geo.ppu * 0.2, y = c[1] + Math.sin(t * 2.1 + i) * geo.ppu * 0.1;
    ctx.fillStyle = "#e3b23c"; ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.ellipse(x, y - 2, 1.6, 1, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function fireflies(ctx, W, H, gy, t) {
  const r = rng(9);
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 24; i++) {
    const x = r() * W + Math.sin(t * 0.3 + i) * 12, y = gy - r() * H * 0.25 + Math.cos(t * 0.4 + i) * 8;
    const a = 0.3 + 0.7 * Math.max(0, Math.sin(t * (0.8 + r()) + i * 3));
    const g = ctx.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, `rgba(230,255,150,${a})`); g.addColorStop(1, "rgba(230,255,150,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function ants(ctx, gx, gy, H, t) {
  ctx.fillStyle = "#1c1612";
  for (let i = 0; i < 9; i++) { const x = gx + H * 0.03 + ((t * 6 + i * 9) % (H * 0.12)), y = gy - 1.5; ctx.beginPath(); ctx.ellipse(x, y, 1.6, 0.9, 0, 0, Math.PI * 2); ctx.fill(); }
}
function worm(ctx, gx, gy, H, t, light) {
  ctx.strokeStyle = mix("#3a2a2a", "#c47a74", light); ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath(); const x0 = gx - H * 0.06;
  for (let i = 0; i <= 10; i++) { const x = x0 + i * 2.2, y = gy - 1 + Math.sin(i * 0.9 + t * 1.5) * 1.6; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
}
function ladybug(ctx, geo, light) {
  const p = perchPoint(geo, 33); if (!p) return;
  const [x, y] = p.pt;
  ctx.fillStyle = mix("#3a1a1a", "#c8382e", light); ctx.beginPath(); ctx.arc(x, y - 3, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(x + 2.4, y - 3, 1.4, 0, Math.PI * 2); ctx.fill();
}
function dew(ctx, geo, t) {
  const r = rng(77);
  geo.tree.segments.forEach((s) => {
    if (r() > 0.25) return;
    const p = geo.pos.get(s.id), e = geo.M(...p.end);
    const a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.2 + s.id));
    ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`; ctx.beginPath(); ctx.arc(e[0], e[1] + 2, 1.4, 0, Math.PI * 2); ctx.fill();
  });
}
function mushrooms(ctx, gx, gy, H, light) {
  const r = rng(12);
  for (let i = 0; i < 3; i++) {
    const x = gx + (i - 1) * H * 0.035 + H * 0.06 * (r() - 0.2), h = H * (0.012 + r() * 0.008);
    ctx.fillStyle = mix("#3a3530", "#e8dcc8", light); ctx.fillRect(x - 1.5, gy - h, 3, h);
    ctx.fillStyle = mix("#3a2016", "#a5502e", light); ctx.beginPath(); ctx.ellipse(x, gy - h, h * 0.75, h * 0.45, 0, Math.PI, 0); ctx.fill();
  }
}
function icicles(ctx, geo) {
  const r = rng(44);
  ctx.fillStyle = "rgba(225,238,250,0.85)";
  geo.tree.segments.forEach((s) => {
    if (s.depth > 2 || Math.abs(Math.sin(s.angle)) < 0.5 || r() > 0.5) return;
    const p = geo.pos.get(s.id);
    for (let k = 1; k <= 3; k++) {
      const u = k / 4, x = p.start[0] + (p.end[0] - p.start[0]) * u, y = p.start[1] + (p.end[1] - p.start[1]) * u;
      const q = geo.M(x, y), len = 3 + r() * 6;
      ctx.beginPath(); ctx.moveTo(q[0] - 1.2, q[1]); ctx.lineTo(q[0], q[1] + len); ctx.lineTo(q[0] + 1.2, q[1]); ctx.fill();
    }
  });
}
function meadow(ctx, W, gy, groundAt, light) {
  const r = rng(55);
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = groundAt(x) - 2 - r() * 4;
    ctx.fillStyle = mix("#2a2a30", ["#f2efe4", "#e6c85a", "#b9a3d8", "#e08a8a"][i % 4], light);
    ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
  }
}
function footprints(ctx, W, gy, groundAt, color) {
  const r = rng(41);
  ctx.fillStyle = color;
  let x = W * 0.05;
  for (let i = 0; i < 18 && x < W * 0.4; i++) {
    x += W * 0.022 + r() * W * 0.006;
    const y = groundAt(x) - 1 + (i % 2 ? 2 : -1);
    ctx.beginPath(); ctx.ellipse(x, y, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function puddles(ctx, W, gy, groundAt, pal) {
  const r = rng(61);
  for (let i = 0; i < 4; i++) {
    const x = r() * W, w = 14 + r() * 26;
    if (Math.abs(x - W / 2) < 30) continue;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, rgba(pal.skyLow, 0)); g.addColorStop(0.5, rgba(pal.skyLow, 0.75)); g.addColorStop(1, rgba(pal.skyLow, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, groundAt(x) + 1, w, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- Niebo ----------
function migrating(ctx, W, H, t, light) {
  const x0 = ((t * 9) % (W * 1.6)) - W * 0.3, y0 = H * 0.2;
  ctx.strokeStyle = mix("#1a2030", "#3a3f48", light); ctx.lineWidth = 1.2;
  for (let i = -4; i <= 4; i++) {
    const x = x0 - Math.abs(i) * 14, y = y0 + i * 9, f = Math.sin(t * 5 + i) * 2;
    ctx.beginPath(); ctx.moveTo(x - 5, y - f); ctx.lineTo(x, y); ctx.lineTo(x + 5, y - f); ctx.stroke();
  }
}
function rainbow(ctx, W, H, gy) {
  const cx = W * 0.75, cy = gy, R = H * 0.42;
  ["255,90,90", "255,170,80", "255,235,120", "120,210,140", "110,160,230", "160,120,220"].forEach((c, i) => {
    ctx.strokeStyle = `rgba(${c},0.18)`; ctx.lineWidth = H * 0.008;
    ctx.beginPath(); ctx.arc(cx, cy, R - i * H * 0.008, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  });
}
function shootingStar(ctx, W, H, t) {
  const cyc = t % 9;
  if (cyc > 1.2) return;
  const k = cyc / 1.2, x = W * (0.2 + k * 0.45), y = H * (0.08 + k * 0.12);
  const g = ctx.createLinearGradient(x - 60, y - 16, x, y);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, `rgba(255,255,255,${1 - k})`);
  ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 60, y - 16); ctx.lineTo(x, y); ctx.stroke();
}

// ---------- Pogoda ----------
function rain(ctx, W, H, gy, t, heavy) {
  const r = rng(3);
  ctx.strokeStyle = "rgba(210,220,235,0.45)"; ctx.lineWidth = 1;
  const n = heavy ? 160 : 90;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (r() * W + t * 40) % W, sp = 300 + r() * 200, y = ((r() * H + t * sp) % (gy + 20));
    ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 9);
  }
  ctx.stroke();
}
function snowfall(ctx, W, H, t) {
  const r = rng(4);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let i = 0; i < 120; i++) {
    const sz = 0.8 + r() * 2, sp = 14 + r() * 20 + sz * 6;
    const x = (r() * W + Math.sin(t * 0.6 + i) * 14 + t * 6) % W, y = (r() * H + t * sp) % H;
    ctx.globalAlpha = 0.5 + sz / 4; ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function fallingLeaves(ctx, geo, W, H, t, cols) {
  const r = rng(8);
  for (let i = 0; i < 6; i++) {
    const start = geo.M((r() - 0.5) * geo.tree.width * 1.6, -geo.tree.height * (0.4 + r() * 0.5));
    const cyc = (t * 0.08 + r()) % 1;
    const x = start[0] + Math.sin(cyc * 9 + i) * 26 + cyc * 40, y = start[1] + cyc * (geo.gy - start[1]);
    ctx.fillStyle = cols[i % cols.length]; ctx.globalAlpha = 1 - cyc * 0.4;
    leafPath(ctx, x, y, cyc * 12 + i, 8, 0.4); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Zwraca warstwy do paintScene dla bieżącego świata.
 * world: { event, traces:Set, weather, light, season, time, reaction: {key, until} }
 */
export function worldLayers(world) {
  const { event, traces, weather, light, time: t } = world;
  const hop = world.reaction && world.reaction.until > t ? Math.sin((world.reaction.until - t) * 6) * 0.5 + 0.5 : 0;
  const hits = [];
  return {
    hits,
    sky(ctx, W, H, gy) {
      if (event === "flyttfaglar") migrating(ctx, W, H, t, light);
      if (event === "regnbage") rainbow(ctx, W, H, gy);
      if (event === "stjarnfall") shootingStar(ctx, W, H, t);
    },
    ground(ctx, W, H, gy, groundAt, pal) {
      if (traces.has("spar_i_snon") && weather.snowCover) footprints(ctx, W, gy, groundAt, rgba(mix("#56637f", "#9aaac4", light), 0.6));
      if (traces.has("vattenpolar") && !weather.snowCover) puddles(ctx, W, gy, groundAt, pal);
      if (event === "angsblommor") meadow(ctx, W, gy, groundAt, light);
      if (traces.has("svamp") || event === "svamp") mushrooms(ctx, W / 2, gy, H, light);
    },
    front(ctx, W, H, geo) {
      const gx = W / 2, gy = geo.gy;
      const s = H * 0.011;
      if (BIRD[event]) {
        const p = perchPoint(geo, hashSeed(event, Math.floor(t / 1e6)));
        if (p) { drawBird(ctx, p.pt[0], p.pt[1] - p.w * 0.4, s, event, light, t, hop); hits.push({ key: event, x: p.pt[0], y: p.pt[1] - s, r: s * 2.5 }); }
        else { const x = gx - H * 0.08; drawBird(ctx, x, gy - 1, s, event, light, t, hop); hits.push({ key: event, x, y: gy - s, r: s * 2.5 }); }
      }
      if (event === "uggla") { const p = perchPoint(geo, 17); if (p) { drawOwl(ctx, p.pt[0], p.pt[1] - p.w * 0.4, s * 1.1, light, t); hits.push({ key: event, x: p.pt[0], y: p.pt[1] - s * 1.5, r: s * 3 }); } }
      if (QUAD[event]) {
        const side = rng(hashSeed(event))() < 0.5 ? -1 : 1;
        const scale = event === "alg" ? H * 0.028 : event === "radjur" ? H * 0.024 : event === "rav" ? H * 0.02 : H * 0.016;
        const x = gx + side * W * (event === "alg" ? 0.33 : 0.28), y = geo.groundAt(x) - 1;
        quad(ctx, x - hop * side * 4, y, scale, QUAD[event], light, t, -side);
        hits.push({ key: event, x, y: y - scale, r: scale * 2 });
      }
      if (event === "igelkott") { const x = gx + W * 0.18; drawHedgehog(ctx, x - hop * 3, geo.groundAt(x), H * 0.012, light); hits.push({ key: event, x, y: gy - 8, r: 18 }); }
      if (event === "ekorre") {
        const p = perchPoint(geo, 23);
        const x = p ? p.pt[0] : gx - W * 0.2, y = p ? p.pt[1] - p.w * 0.4 : geo.groundAt(gx - W * 0.2);
        drawSquirrel(ctx, x, y - hop * 6, H * 0.012, light, t); hits.push({ key: event, x, y: y - 10, r: 20 });
      }
      if (event === "fjarilar") butterflies(ctx, geo, t, light);
      if (event === "bin") bees(ctx, geo, t);
      if (event === "eldflugor") fireflies(ctx, W, H, gy, t);
      if (event === "myror") ants(ctx, gx, gy, H, t);
      if (event === "daggmask") worm(ctx, gx, gy, H, t, light);
      if (event === "nyckelpiga") ladybug(ctx, geo, light);
      if (event === "dagg") dew(ctx, geo, t);
      if (event === "istappar") icicles(ctx, geo);
      // pogoda na pierwszym planie
      if (weather.kind === "rain" || weather.kind === "storm") rain(ctx, W, H, gy, t, weather.kind === "storm");
      if (weather.kind === "snow") snowfall(ctx, W, H, t);
      if (world.season === "autumn" && weather.wind > 0.25 && !weather.snowCover) fallingLeaves(ctx, geo, W, H, t, world.leafCols || ["#c98d42", "#b5603a"]);
    }
  };
}

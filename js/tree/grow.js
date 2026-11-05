// Wzrost drzewa.
//
// Drzewo jest w całości wyliczane z dwóch rzeczy: ukrytych genów (liczba) i historii rytuałów.
// Te same dane zawsze dają to samo drzewo, więc nic nie trzeba zapisywać poza historią.
//
// Dwie osie czasu:
//  - P („światło”): dni ze słowami. Napędza pień, gałęzie i liście.
//  - R („głębia”): wszystkie dni z rytuałem, także dni bez słów. Napędza korzenie.
//
// Każda część drzewa ma swój „dzień narodzin” na odpowiedniej osi. Cechy części (kąt, długość,
// grubość) zależą od żywiołu z dnia, w którym się narodziła. Dzięki temu nowe dni nigdy nie
// zmieniają starych części, a dotknięcie gałęzi może pokazać dzień, z którego pochodzi.
//
// Jednostka długości: „u”. Drzewo po roku ma ok. 1 u wysokości. Kamera przelicza u na piksele.

import { rng, hashSeed } from "../rng.js";

export const STAGES = { SEED: 0, SPROUT: 3, LEAVES: 7, BRANCH: 14, YOUNG: 30 };

/** Ukryte geny: wyliczane z liczby zapisanej przy posadzeniu. */
export function genes(genome) {
  const r = rng(hashSeed("genes", genome));
  const shapes = ["spreading", "slender", "weeping", "round"];
  return {
    shape: shapes[Math.floor(r() * shapes.length)],
    spread: 0.55 + r() * 0.45,          // kąt odejścia gałęzi
    lean: (r() - 0.5) * 0.12,           // lekkie pochylenie pnia
    sway: 0.04 + r() * 0.08,            // naturalna krzywizna
    branchEvery: r() < 0.5 ? 1 : 2,     // co ile odcinków pnia rośnie gałąź
    sideStart: r() < 0.5 ? -1 : 1,
    subBranch: 0.45 + r() * 0.35,       // skłonność do rozgałęzień bocznych
    leafLen: 0.016 + r() * 0.008,
    leafWide: 0.28 + r() * 0.3,         // smukły albo szeroki liść
    leafPointy: r(),                    // kształt czubka
    leafPerSeg: 2 + Math.floor(r() * 3),
    barkHue: r(),                       // odcień kory
    leafHue: r(),                       // odcień zieleni
    flowerHue: r(),                     // kolor kwiatów (ujawni się wiosną)
    rootSpread: 0.8 + r() * 0.4
  };
}

function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

/**
 * Zamienia wpisy (rytuały) na kroki wzrostu.
 * Pierwszy rytuał dnia daje krok. Kolejne rytuały tego dnia dodają tylko charakter (extras).
 * @param entries lista wpisów { id, day, element, skipped, extra }
 * @param seasonOf funkcja: klucz dnia -> "spring" | "summer" | "autumn" | "winter"
 */
export function stepsFrom(entries, seasonOf = () => "autumn") {
  const byDay = new Map();
  [...entries].sort((a, b) => (a.at < b.at ? -1 : 1)).forEach((e) => {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  });
  const days = [...byDay.keys()].sort();
  const steps = [];
  days.forEach((day) => {
    const list = byDay.get(day);
    const first = list[0];
    steps.push({
      day,
      element: first.element,
      words: !first.skipped,
      entryId: first.id,
      extras: list.slice(1).map((e) => ({ element: e.element, entryId: e.id })),
      season: seasonOf(day)
    });
  });
  return steps;
}

/**
 * Wylicza kształt drzewa.
 * @param genome liczba genów
 * @param steps kroki z stepsFrom()
 * @param opts { progress: 0..1 } płynne dorastanie ostatniego kroku (animacja po rytuale)
 */
export function growTree(genome, steps, opts = {}) {
  const G = genes(genome);
  const lastFrac = opts.progress == null ? 1 : opts.progress;

  // Osie czasu
  const P_steps = steps.filter((s) => s.words);
  const R_steps = steps;
  const P = Math.max(0, P_steps.length - 1 + (P_steps.length ? lastWordFrac() : 0));
  function lastWordFrac() { return steps.length && steps[steps.length - 1].words ? lastFrac : 1; }

  let R = 0;
  R_steps.forEach((s, i) => {
    const isLast = i === R_steps.length - 1;
    const base = s.season === "winter" ? 1.5 : 1;  // zimą więcej wzrostu idzie w korzenie
    R += (isLast ? lastFrac : 1) * base;
  });

  const atP = (t) => P_steps[Math.max(0, Math.min(P_steps.length - 1, Math.ceil(t) - 1))] || null;
  const atR = (t) => {
    // znajdź krok dla czasu korzeni t (uwzględnia zimowe wagi)
    let acc = 0;
    for (const s of R_steps) { acc += s.season === "winter" ? 1.5 : 1; if (acc >= t) return s; }
    return R_steps[R_steps.length - 1] || null;
  };

  // Liczniki żywiołów (cały czas i ostatnie dni) — charakter drzewa
  const count = { sun: 0, water: 0, seed: 0, leaf: 0, wind: 0, stone: 0 };
  const recent = { sun: 0, water: 0, seed: 0, leaf: 0, wind: 0, stone: 0 };
  const recentFrom = Math.max(0, steps.length - 14);
  steps.forEach((s, i) => {
    const els = [s.element, ...s.extras.map((x) => x.element)];
    els.forEach((el) => {
      if (count[el] != null) count[el]++;
      if (i >= recentFrom && recent[el] != null) recent[el]++;
    });
  });

  // P zaczyna się od 1 w pierwszym dniu (dzień 1 = nasionko)
  const Pv = P_steps.length ? P + 1 : 0;

  const segments = [];
  const leaves = [];
  const buds = [];
  let segId = 0;

  // ---------- Nad ziemią ----------
  function shapeTarget(depth, side, idx) {
    switch (G.shape) {
      case "slender": return side * (0.35 + 0.1 * depth);
      case "weeping": return side * (0.9 + 0.35 * depth + 0.08 * idx);
      case "round": return side * (0.95 - 0.06 * idx);
      default: return side * (1.05 + 0.08 * depth);
    }
  }

  function growAxis(opt) {
    const { parent, depth, startBirth, side, axisKey, startAngle } = opt;
    const maxSegs = depth === 0 ? 60 : depth === 1 ? 16 : depth === 2 ? 6 : 3;
    let birth = startBirth;
    let angle = startAngle;
    let prev = parent;
    for (let j = 0; j < maxSegs; j++) {
      if (birth > Pv) break;
      const step = atP(birth);
      const el = step ? step.element : null;
      const r = rng(hashSeed(genome, axisKey, j));

      // kierunek
      let target = depth === 0 ? G.lean : shapeTarget(depth, side, j);
      const pull = depth === 0 ? 0.35 : 0.18;
      angle += (target - angle) * pull + (r() - 0.5) * G.sway * 2;
      if (el === "wind") angle += (r() - 0.5) * 0.35;           // wiatr: powykręcany kształt
      if (depth === 0) angle = Math.max(-0.45, Math.min(0.45, angle));

      // długość
      let len;
      if (depth === 0) len = Math.min(0.012 + 0.0045 * j, 0.034) * (j > 14 ? Math.max(0.35, 1 - (j - 14) * 0.06) : 1);
      else len = 0.022 * Math.pow(0.78, depth - 1) * (1 + Math.min(birth, 150) / 150) * (0.85 + r() * 0.3);
      if (el === "leaf") len *= 0.85;                           // liść: lżejsza sylwetka
      if (el === "sun") len *= 1.06;

      const seg = {
        id: segId++, parent: prev ? prev.id : -1, depth, angle, len,
        birth, el, entryId: step ? step.entryId : null, day: step ? step.day : null,
        bend: (r() - 0.5) * (el === "wind" ? 0.5 : 0.18), kids: [], wind: el === "wind"
      };
      seg.grown = smooth((Pv - birth) / 2.5);
      if (prev) prev.kids.push(seg.id);
      segments.push(seg);

      // liście na tym odcinku
      // liście: na młodych częściach (pień tylko u góry, stare gałęzie od środka łysieją)
      const young = depth === 0 ? birth > Pv - 18 : (depth === 1 ? birth > Pv - 70 : true);
      const leafy = Pv >= STAGES.LEAVES && young && (depth >= 1 || j >= 1);
      if (leafy) {
        const n = G.leafPerSeg + 1 + (el === "sun" ? 1 : 0) + (depth === 0 ? -1 : 0);
        for (let k = 0; k < n; k++) {
          const lr = rng(hashSeed(genome, "leaf", seg.id, k));
          leaves.push({
            seg: seg.id, t: 0.25 + lr() * 0.7,
            side: lr() < 0.5 ? -1 : 1,
            off: 0.6 + lr() * 0.7,
            size: G.leafLen * (0.75 + lr() * 0.5) * (depth === 0 ? 0.8 : 1),
            keep: lr(),                 // próg widoczności (gęstość korony)
            tone: lr(),
            birth: birth + 0.5 + lr()
          });
        }
      }

      // boczne gałęzie
      const budget = segments.length < 520;
      if (budget && depth === 0 && birth + 1.5 >= STAGES.BRANCH - 0.01 && j >= 2 && (j % G.branchEvery === 0 || !firstBranchDone)) {
        firstBranchDone = true;
        const sideL = (Math.floor(j / G.branchEvery) % 2 === 0 ? 1 : -1) * G.sideStart;
        const spread = G.spread * (el === "sun" ? 1.25 : 1);
        growAxis({ parent: seg, depth: 1, startBirth: Math.max(birth + 0.5, STAGES.BRANCH - 1.5), side: sideL, axisKey: axisKey + "." + j, startAngle: angle + sideL * spread });
        if (el === "seed") {
          growAxis({ parent: seg, depth: 1, startBirth: Math.max(birth + 2, STAGES.BRANCH), side: -sideL, axisKey: axisKey + "." + j + "s", startAngle: angle - sideL * spread * 0.9 });
        }
      } else if (budget && depth >= 1 && depth < 3 && j >= 1 && (depth === 1 ? j % 2 === 1 || el === "seed" : j % 2 === 0)) {
        const chance = (depth === 1 ? G.subBranch : 0.3) + (el === "seed" ? 0.3 : 0);
        if (r() < chance) {
          const sideS = r() < 0.5 ? -1 : 1;
          growAxis({ parent: seg, depth: depth + 1, startBirth: birth + 2 + r() * 2, side: sideS * side, axisKey: axisKey + "." + j, startAngle: angle + sideS * G.spread * 0.7 });
        }
      }

      // następny odcinek osi
      prev = seg;
      const gap = depth === 0 ? 1.2 + 0.35 * j : 1.6 + 0.5 * j;
      birth += gap;
    }
    // pąk na końcu osi
    if (prev && prev.grown > 0.5) buds.push({ seg: prev.id, el: prev.el, entryId: prev.entryId, day: prev.day });
  }

  let firstBranchDone = false;
  if (Pv >= STAGES.SPROUT) {
    growAxis({ parent: null, depth: 0, startBirth: STAGES.SPROUT, side: 0, axisKey: "T", startAngle: G.lean });
  }

  // grubość: model rur (im więcej gałęzi wyżej, tym grubszy odcinek)
  const byId = new Map(segments.map((s) => [s.id, s]));
  const windFactor = 1 + 0.035 * Math.min(count.wind, 24);
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    let area = 0.0000018 * s.grown;
    s.kids.forEach((k) => { const c = byId.get(k); area += c.area || 0; });
    s.area = area;
  }
  segments.forEach((s) => {
    s.w = Math.max(0.0012, Math.sqrt(s.area) * 1.15) * (s.depth === 0 ? windFactor : 1 + (windFactor - 1) * 0.5);
  });

  // pozycje: każdy odcinek zaczyna się na końcu rodzica
  segments.forEach((s) => {
    const p = s.parent >= 0 ? byId.get(s.parent) : null;
    s.x0 = p ? p.x1 : 0; s.y0 = p ? p.y1 : 0;
    const L = s.len * s.grown;
    s.x1 = s.x0 + Math.sin(s.angle) * L;
    s.y1 = s.y0 - Math.cos(s.angle) * L;
    s.cx = s.x0 + Math.sin(s.angle + s.bend) * L * 0.5;
    s.cy = s.y0 - Math.cos(s.angle + s.bend) * L * 0.5;
  });

  // gęstość korony: słońce gęstnieje, liść przerzedza
  const density = Math.max(0.35, Math.min(1, 0.78 + 0.05 * recent.sun - 0.09 * recent.leaf + 0.02 * recent.water));
  const lush = Math.min(1, 0.3 + 0.08 * recent.water + 0.03 * count.water);
  const visibleLeaves = leaves.filter((l) => l.keep < density && Pv >= l.birth).map((l) => {
    const s = byId.get(l.seg);
    const x = s.x0 + (s.x1 - s.x0) * l.t, y = s.y0 + (s.y1 - s.y0) * l.t;
    return { ...l, x, y, angle: s.angle + l.side * l.off, size: l.size * smooth((Pv - l.birth) / 2) };
  });
  const fallen = Math.min(40, Math.round(recent.leaf * 6 + count.leaf * 0.5));

  // liścienie (pierwsze dwa okrągłe listki kiełka)
  let cotyledons = null;
  if (Pv >= STAGES.SPROUT && Pv < STAGES.BRANCH + 2 && segments.length) {
    const s0 = segments[0];
    const fade = 1 - smooth((Pv - STAGES.BRANCH + 1) / 3);
    cotyledons = { x: s0.x1, y: s0.y1, size: 0.009 * smooth((Pv - STAGES.SPROUT) / 1.5) * fade, angle: s0.angle };
  }

  // ---------- Pod ziemią ----------
  const roots = [];
  let rootId = 0;
  function rootAxis(opt) {
    const { parent, depth, startBirth, side, key, startAngle } = opt;
    const maxSegs = depth === 0 ? 30 : depth === 1 ? 7 : 3;
    let birth = startBirth, angle = startAngle, prev = parent;
    for (let j = 0; j < maxSegs; j++) {
      if (birth > R) break;
      const step = atR(birth);
      const el = step ? (step.words ? step.element : "silent") : null;
      const r = rng(hashSeed(genome, "root", key, j));
      let target = depth === 0 ? 0 : side * (1.05 * G.rootSpread + 0.1 * depth);
      if (el === "water") target *= 0.7;            // woda: w głąb
      if (el === "stone") target = side * 1.45;      // kamień: szerzej
      angle += (target - angle) * 0.3 + (r() - 0.5) * 0.25;
      let len = depth === 0 ? 0.006 + 0.001 * Math.min(j, 12) : 0.009 * Math.pow(0.75, depth - 1) * (0.8 + r() * 0.4);
      if (el === "water") len *= depth === 0 ? 1.35 : 1.15;
      if (el === "stone") len *= depth === 0 ? 0.8 : 1.3;
      if (el === "silent") len *= 1.1;
      const seg = { id: rootId++, parent: prev ? prev.id : -1, depth, angle, len, birth, el, entryId: step ? step.entryId : null, day: step ? step.day : null, kids: [] };
      seg.grown = smooth((R - birth) / 2);
      if (prev) prev.kids.push(seg.id);
      roots.push(seg);
      if (depth < 2 && j >= 1 && (depth === 0 ? r() < 0.55 : r() < 0.3)) {
        const sd = depth === 0 ? (j % 2 === 0 ? 1 : -1) : side;
        rootAxis({ parent: seg, depth: depth + 1, startBirth: birth + 1 + r() * 1.5, side: sd, key: key + "." + j, startAngle: angle + sd * 0.9 });
      }
      prev = seg;
      birth += depth === 0 ? 1.6 + 0.35 * j : 2.4 + 0.6 * j;
    }
  }
  if (R >= 1.5) rootAxis({ parent: null, depth: 0, startBirth: 1.5, side: 0, key: "R", startAngle: 0 });

  const rById = new Map(roots.map((s) => [s.id, s]));
  for (let i = roots.length - 1; i >= 0; i--) {
    const s = roots[i];
    let area = 0.0000006 * s.grown;
    s.kids.forEach((k) => { area += rById.get(k).area || 0; });
    s.area = area;
    s.w = Math.max(0.0007, Math.sqrt(area) * 1.0);
  }
  roots.forEach((s) => {
    const p = s.parent >= 0 ? rById.get(s.parent) : null;
    s.x0 = p ? p.x1 : 0; s.y0 = p ? p.y1 : 0.002;
    const L = s.len * s.grown;
    s.x1 = s.x0 + Math.sin(s.angle) * L;
    s.y1 = s.y0 + Math.cos(s.angle) * L;
    s.cx = (s.x0 + s.x1) / 2 + (Math.cos(s.angle) * L * 0.15);
    s.cy = (s.y0 + s.y1) / 2;
  });

  // wysokość (do kamery)
  let top = 0;
  segments.forEach((s) => { top = Math.min(top, s.y1); });
  visibleLeaves.forEach((l) => { top = Math.min(top, l.y - l.size); });
  let width = 0;
  segments.forEach((s) => { width = Math.max(width, Math.abs(s.x1)); });

  return {
    genes: G,
    P: Pv, R,
    stage: Pv >= STAGES.YOUNG ? "young" : Pv >= STAGES.BRANCH ? "branch" : Pv >= STAGES.LEAVES ? "leaves" : Pv >= STAGES.SPROUT ? "sprout" : Pv > 0 ? "seed" : "none",
    segments, leaves: visibleLeaves, buds: buds.filter((b) => byId.get(b.seg)), roots,
    cotyledons,
    seed: { cracked: R >= 1.5, swell: Math.min(1, Pv / 2 + R / 4) },
    height: Math.max(0.02, -top), width,
    count, recent, density, lush, fallen,
    stones: Math.min(8, count.stone), moss: Math.min(1, (count.water + count.stone) / 25)
  };
}

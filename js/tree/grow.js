// Wzrost drzewa.
//
// Drzewo jest w całości wyliczane z dwóch rzeczy: ukrytych genów (liczba) i historii rytuałów.
// Te same dane zawsze dają to samo drzewo, więc nic nie trzeba zapisywać poza historią.
//
// Dwie osie czasu:
//  - P („światło”): dni ze słowami. Napędza pień, konary i liście.
//  - R („głębia”): wszystkie dni z rytuałem, także dni bez słów. Napędza korzenie.
//
// Budowa jak u prawdziwego drzewa (wytyczne użytkownika, docs/USTALENIA.md):
//  1. pień: szeroka podstawa, delikatne falowanie, pochylenie od wiatru, zgrubienia po konarach,
//  2. 3–6 głównych konarów wyrastających stopniowo, każdy z własnym kierunkiem i długością,
//  3. nieliczne gałęzie boczne i gałązki, a na nich grupy liści (nie równomierne pokrycie),
//  4. korzenie: kilka głównych, wychodzących z nasady pnia, które najpierw biegną płytko, potem w głąb.
//
// Każda część ma swój „dzień narodzin”; jej cechy zależą od żywiołu z tego dnia, więc nowe dni nie
// zmieniają starych części, a dotknięcie gałęzi może pokazać dzień, z którego pochodzi.
//
// Jednostka długości: „u”. Drzewo po roku ma ok. 1 u wysokości.

import { rng, hashSeed } from "../rng.js";

export const STAGES = { SEED: 0, SPROUT: 3, LEAVES: 7, BRANCH: 14, YOUNG: 30 };

export const TEMPERAMENTS = {
  spreading: "daje przestrzeń innym",
  slender: "szuka światła",
  weeping: "nauczyło się elastyczności",
  round: "buduje stabilność"
};

/** Ukryte geny: wyliczane z liczby zapisanej przy posadzeniu. */
export function genes(genome) {
  const r = rng(hashSeed("genes", genome));
  const shapes = ["spreading", "slender", "weeping", "round"];
  const shape = shapes[Math.floor(r() * shapes.length)];
  return {
    shape,                                   // temperament
    windDir: r() < 0.5 ? -1 : 1,             // z której strony zwykle wieje (drzewo pochyla się w drugą)
    lean: (r() - 0.5) * 0.06,
    waveA: 0.035 + r() * 0.05,               // falowanie pnia
    wavePh: r() * 6.28, wavePh2: r() * 6.28,
    sideStart: r() < 0.5 ? -1 : 1,
    limbJitter: r() * 1000,
    maxLimbs: { spreading: 6, round: 5, weeping: 5, slender: 4 }[shape],
    leafLen: 0.02 + r() * 0.01,
    leafWide: 0.3 + r() * 0.28,
    leafPointy: r(),
    barkHue: r(),
    leafHue: r(),
    flowerHue: r(),
    rootSpread: 0.85 + r() * 0.35,
    // kształt liścia i jesienny kolor też zależą od genów
    leafShape: ["almond", "lance", "round", "heart", "lobed"][Math.floor(r() * 5)],
    autumnTone: ["yellow", "gold", "orange", "red", "bronze"][Math.floor(r() * 5)]
  };
}

function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

/**
 * Zamienia wpisy (rytuały) na kroki wzrostu.
 * Pierwszy rytuał dnia daje krok. Kolejne rytuały tego dnia dodają tylko charakter (extras).
 */
export function stepsFrom(entries, seasonOf = () => "autumn") {
  const byDay = new Map();
  [...entries].sort((a, b) => (a.at < b.at ? -1 : 1)).forEach((e) => {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  });
  return [...byDay.keys()].sort().map((day) => {
    const list = byDay.get(day);
    const first = list[0];
    return {
      day,
      element: first.element,
      words: !first.skipped,
      entryId: first.id,
      extras: list.slice(1).map((e) => ({ element: e.element, entryId: e.id })),
      season: seasonOf(day)
    };
  });
}

/**
 * Wylicza kształt drzewa.
 * @param opts { progress: 0..1 } płynne dorastanie ostatniego kroku (animacja po rytuale)
 */
export function growTree(genome, steps, opts = {}) {
  const G = genes(genome);
  const lastFrac = opts.progress == null ? 1 : opts.progress;

  // ---------- osie czasu ----------
  const P_steps = steps.filter((s) => s.words);
  const lastIsWords = steps.length && steps[steps.length - 1].words;
  const Pv = P_steps.length ? P_steps.length + (lastIsWords ? lastFrac - 1 : 0) + 0 : 0;
  // Pv: dzień 1 = 1 (nasionko), dzień 3 = 3 (kiełek) itd.

  const rootWeight = (s) => (s.season === "winter" ? 1.5 : 1); // zimą więcej wzrostu idzie w korzenie
  let R = 0;
  steps.forEach((s, i) => { R += (i === steps.length - 1 ? lastFrac : 1) * rootWeight(s); });

  const atP = (t) => P_steps[clamp(Math.ceil(t) - 1, 0, P_steps.length - 1)] || null;
  const atR = (t) => {
    let acc = 0;
    for (const s of steps) { acc += rootWeight(s); if (acc >= t) return s; }
    return steps[steps.length - 1] || null;
  };
  // ile razy żywioł wystąpił do danego momentu na osi P (historia „do tamtej chwili”)
  const prefix = { sun: [0], water: [0], seed: [0], leaf: [0], wind: [0], stone: [0] };
  P_steps.forEach((s) => {
    const els = [s.element, ...s.extras.map((x) => x.element)];
    Object.keys(prefix).forEach((k) => prefix[k].push(prefix[k][prefix[k].length - 1] + els.filter((e) => e === k).length));
  });
  const soFar = (el, t) => prefix[el][clamp(Math.floor(t), 0, prefix[el].length - 1)];

  // liczniki: cała historia i ostatnie dni
  const count = { sun: 0, water: 0, seed: 0, leaf: 0, wind: 0, stone: 0 };
  const recent = { sun: 0, water: 0, seed: 0, leaf: 0, wind: 0, stone: 0 };
  const recentFrom = Math.max(0, steps.length - 14);
  steps.forEach((s, i) => {
    [s.element, ...s.extras.map((x) => x.element)].forEach((el) => {
      if (count[el] != null) count[el]++;
      if (i >= recentFrom && recent[el] != null) recent[el]++;
    });
  });
  const total = Math.max(1, steps.length);
  const share = (el) => count[el] / total;

  const segments = [];
  const leafSpots = [];   // miejsca grup liści
  const buds = [];
  const knots = [];
  let segId = 0;

  function addSeg(o) {
    const seg = { id: segId++, kids: [], ...o };
    seg.grown = smooth((Pv - seg.birth) / 2.5);
    if (o.parentSeg) o.parentSeg.kids.push(seg.id);
    seg.parent = o.parentSeg ? o.parentSeg.id : -1;
    delete seg.parentSeg;
    segments.push(seg);
    return seg;
  }

  // ---------- pień ----------
  const trunk = [];
  if (Pv >= STAGES.SPROUT) {
    let birth = STAGES.SPROUT;
    for (let j = 0; j < 46 && birth <= Pv; j++) {
      const step = atP(birth), el = step ? step.element : null;
      const r = rng(hashSeed(genome, "trunk", j));
      // pochylenie od wiatru narasta z historią; falowanie: dwie łagodne fale
      const windLean = G.windDir * Math.min(0.09, soFar("wind", birth) * 0.0045);
      const wave = G.waveA * Math.sin(j * 0.5 + G.wavePh) + G.waveA * 0.5 * Math.sin(j * 0.19 + G.wavePh2);
      const angle = G.lean + windLean + wave * Math.min(1, j / 4) + (el === "wind" ? (r() - 0.5) * 0.06 : 0);
      let len = Math.min(0.011 + 0.0042 * j, 0.034) * (j > 12 ? Math.max(0.32, 1 - (j - 12) * 0.065) : 1);
      len *= el === "water" ? 1.06 : el === "sun" ? 1.04 : el === "leaf" ? 0.92 : el === "wind" ? 0.95 : 1;
      const seg = addSeg({ parentSeg: trunk[j - 1] || null, depth: 0, axis: "trunk", j, angle, len, birth, el, entryId: step && step.entryId, day: step && step.day, bend: (r() - 0.5) * 0.08 });
      trunk.push(seg);
      birth += 1.2 + 0.35 * j;
    }
  }

  // ---------- osie boczne: konary, gałęzie, gałązki ----------
  function axis(o) {
    // o: { parentSeg, depth, birth, side, angle, maxSegs, baseLen, key, curve(j, angle) }
    let prev = o.parentSeg, angle = o.angle, birth = o.birth;
    const made = [];
    for (let j = 0; j < o.maxSegs && birth <= Pv; j++) {
      const step = atP(birth), el = step ? step.element : null;
      const r = rng(hashSeed(genome, o.key, j));
      angle = o.curve(j, angle) + (r() - 0.5) * (el === "wind" ? 0.22 : 0.08);
      let len = o.baseLen * (0.88 + r() * 0.24) * Math.pow(0.93, j);
      len *= el === "sun" ? 1.12 : el === "water" ? 1.08 : el === "leaf" ? 0.85 : 1;
      if (o.lengthBias) len *= o.lengthBias;
      len *= 0.55 + 0.45 * smooth((birth - 14) / 50);   // młode drzewo: krótkie gałęzie, widoczny potencjał
      const seg = addSeg({ parentSeg: prev, depth: o.depth, axis: o.key, j, angle, len, birth, el, entryId: step && step.entryId, day: step && step.day, bend: (r() - 0.5) * (el === "wind" ? 0.35 : 0.15) });
      made.push(seg);
      prev = seg;
      birth += o.gap(j);
    }
    return made;
  }

  // temperament: kąt startowy i krzywizna konarów
  function limbCurve(side) {
    switch (G.shape) {
      case "slender": return (j, a) => a - side * 0.035;                      // szuka światła: do góry
      case "weeping": return (j, a) => (j >= 2 ? clamp(a + side * 0.15, -2.5, 2.5) : a - side * 0.02); // łuk, potem w dół
      case "round": return (j, a) => a - side * (j >= 3 ? 0.035 : 0.005);      // kopuła
      default: return (j, a) => a - side * 0.012;                              // szeroko, łagodnie
    }
  }
  const limbAngle = { spreading: 1.15, slender: 0.55, weeping: 0.95, round: 0.92 }[G.shape];

  // Kolejne konary wyrastają coraz wyżej. Z wiekiem drzewo samo zrzuca najniższe konary
  // (zostaje po nich zabliźniony ślad), a pień pod koroną się odsłania.
  const schedule = [14, 20, 28, 39, 55, 78, 105, 140, 185, 240, 300];
  const limbs = [];
  // wysokość węzłów pnia (bez kołysania) i wysokość odsłoniętego pnia
  const nodeH = [];
  { let h = 0; trunk.forEach((t) => { h += t.len * t.grown * Math.cos(t.angle); nodeH.push(h); }); }
  const trunkH = nodeH.length ? nodeH[nodeH.length - 1] : 0;
  const clearH = trunkH * Math.min(0.33, Math.max(0, (Pv - 40) / 380));
  if (trunk.length) {
    const usedJ = new Set();
    let kept = 0;
    const sideCount = { "1": 0, "-1": 0 };
    let lastSide = 0;
    for (let k = 0; k < schedule.length && kept < G.maxLimbs + 2; k++) {
      const r = rng(hashSeed(genome, "limb", k));
      const lb = schedule[k] + (r() - 0.5) * 3;
      if (lb > Pv) break;
      // konar wyrasta z miejsca, które było wtedy blisko wierzchołka
      let jAttach = 0;
      trunk.forEach((t) => { if (t.birth <= lb - 2.5) jAttach = t.j; });
      jAttach = Math.max(2, jAttach - (r() < 0.5 ? 1 : 0));
      while (usedJ.has(jAttach) && jAttach < trunk.length - 1) jAttach++;
      if (usedJ.has(jAttach)) continue;
      usedJ.add(jAttach);
      // konar poniżej odsłoniętej części pnia już opadł: zostaje tylko blizna
      if (nodeH[jAttach] < clearH) {
        knots.push({ seg: trunk[jAttach].id, at: 1, k: 0.4, kind: "scar", side: (k % 2 === 0 ? 1 : -1) * G.sideStart });
        continue;
      }
      kept++;
      // strona: równowaga bez symetrii. Nowy konar wyrasta po tej stronie, gdzie żywych konarów
      // jest mniej; przy remisie naprzemiennie, a po wietrznej historii po stronie zawietrznej.
      // Wiatr nie zabiera gałęzi jednej stronie: zmienia ich długość (lengthBias) i pochylenie pnia.
      const windy = soFar("wind", lb) / Math.max(1, lb);
      let side;
      if (sideCount[1] < sideCount[-1]) side = 1;
      else if (sideCount[-1] < sideCount[1]) side = -1;
      else side = windy > 0.2 && r() < 0.6 ? G.windDir : (lastSide ? -lastSide : G.sideStart);
      sideCount[side]++; lastSide = side;
      const lowFactor = 1 - Math.min(0.3, k * 0.06); // wyższe konary bardziej ku górze
      const startAngle = trunk[jAttach].angle + side * limbAngle * lowFactor * (0.85 + r() * 0.3);
      // pochylony pień drzewo równoważy dłuższymi konarami po przeciwnej stronie
      const counter = trunk[jAttach].angle * side < 0 ? 1 + Math.min(0.2, Math.abs(trunk[jAttach].angle) * 1.5) : 1;
      const lengthBias = (side === G.windDir ? 1 + windy * 0.35 : 1 - windy * 0.2) * counter * (0.85 + r() * 0.3);
      const limb = axis({
        parentSeg: trunk[jAttach], depth: 1, birth: lb, side, angle: startAngle,
        maxSegs: 14, baseLen: 0.042, key: "L" + k, curve: limbCurve(side), lengthBias,
        gap: (j) => 1.6 + 0.45 * j
      });
      limbs.push({ k, side, segs: limb, jAttach });
      // zgrubienie w miejscu wyrastania konara
      knots.push({ seg: trunk[jAttach].id, at: 1, k: 0.5, kind: "node" });

      // gałęzie boczne na konarze: nieliczne, naprzemiennie
      limb.forEach((ls, j) => {
        if (j < 1) return;
        const rr = rng(hashSeed(genome, "sec", k, j));
        const want = (j + k) % 2 === 0 || ls.el === "seed";
        if (!want || rr() > 0.75) return;
        const sSide = (j % 2 === 0 ? 1 : -1) * side * (rr() < 0.3 ? -1 : 1);
        const sec = axis({
          parentSeg: ls, depth: 2, birth: ls.birth + 2 + rr() * 2, side: sSide,
          angle: ls.angle + sSide * (0.5 + rr() * 0.35), maxSegs: 6, baseLen: 0.024,
          key: "S" + k + "." + j, curve: (jj, a) => (G.shape === "weeping" ? clamp(a + side * 0.12, -2.6, 2.6) : a - sSide * 0.04),
          gap: (jj) => 2 + 0.6 * jj
        });
        sec.forEach((ss, jj) => {
          if (jj < 1 || rr() > 0.4) return;
          const tSide = rr() < 0.5 ? -1 : 1;
          axis({
            parentSeg: ss, depth: 3, birth: ss.birth + 2, side: tSide, angle: ss.angle + tSide * 0.6,
            maxSegs: 2, baseLen: 0.011, key: "T" + k + "." + j + "." + jj, curve: (q, a) => a, gap: () => 2.5
          });
        });
      });
    }
    // gałązki na pniu: liście nigdy nie rosną wprost z pnia, tylko z gałązek.
    // U młodej roślinki gałązki są krótkie i rosną naprzemiennie; z wiekiem dolne opadają.
    const topLimbJ = limbs.length ? Math.max(...limbs.map((l) => l.jAttach)) : 0;
    trunk.forEach((t) => {
      if (t.j < 1) return;
      const age = Pv - t.birth;
      if (limbs.length && t.j <= topLimbJ && age > 26) return;   // dolne gałązki obumarły
      if (age > 45) return;
      const rr = rng(hashSeed(genome, "twig", t.j));
      const young = t.birth < STAGES.BRANCH;
      if (!young && rr() > 0.5) return;
      const sd = young ? (t.j % 2 === 0 ? 1 : -1) * G.sideStart : (rr() < 0.5 ? -1 : 1);
      axis({ parentSeg: t, depth: 2, birth: t.birth + 0.8, side: sd, angle: t.angle + sd * (0.6 + rr() * 0.35), maxSegs: young ? 1 : 3, baseLen: young ? 0.016 : 0.018, key: "W" + t.j, curve: (q, a) => a - sd * 0.05, gap: (q) => 2 + q });
    });
  }

  // ---------- grubość ----------
  const byId = new Map(segments.map((s) => [s.id, s]));
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    let n = s.grown;
    s.kids.forEach((k) => { n += byId.get(k).n || 0; });
    s.n = n;
  }
  const strength = 1 + 0.035 * Math.min(count.wind, 24) + 0.02 * Math.min(count.stone, 24); // trudności: mocniejsze drewno
  const trunkStrength = G.shape === "round" ? 1.12 : G.shape === "slender" ? 0.92 : 1;
  segments.forEach((s) => {
    let w = 0.0012 * Math.pow(Math.max(1, s.n), 0.52);
    if (s.depth === 0) {
      w *= strength * trunkStrength;
      // szeroka nasada pnia płynnie przechodząca w korzenie
      if (s.j === 0) w *= 1.75; else if (s.j === 1) w *= 1.3; else if (s.j === 2) w *= 1.1;
    } else w *= 1 + (strength - 1) * 0.5;
    s.w = w;
  });
  segments.forEach((s) => {
    let wEnd = s.w * 0.72;
    s.kids.forEach((k) => { const c = byId.get(k); if (c.depth === s.depth) wEnd = Math.max(wEnd, c.w); });
    s.wEnd = Math.min(s.w, wEnd);
  });

  // ---------- pozycje ----------
  segments.forEach((s) => {
    const p = s.parent >= 0 ? byId.get(s.parent) : null;
    s.x0 = p ? p.x1 : 0; s.y0 = p ? p.y1 : 0;
    const L = s.len * s.grown;
    s.x1 = s.x0 + Math.sin(s.angle) * L; s.y1 = s.y0 - Math.cos(s.angle) * L;
    s.cx = s.x0 + Math.sin(s.angle + s.bend) * L * 0.5; s.cy = s.y0 - Math.cos(s.angle + s.bend) * L * 0.5;
  });

  // ---------- zgrubienia i sęki (trudności zostawiają ślad) ----------
  const scars = Math.min(5, Math.floor((count.wind + count.stone) / 7));
  for (let i = 0; i < scars && trunk.length > 4; i++) {
    const r = rng(hashSeed(genome, "scar", i));
    const t = trunk[1 + Math.floor(r() * Math.min(trunk.length - 2, 10))];
    knots.push({ seg: t.id, at: 0.3 + r() * 0.5, k: 0.35 + r() * 0.25, kind: "scar", side: r() < 0.5 ? -1 : 1 });
  }

  // ---------- liście: grupy ----------
  const density = clamp(0.8 + 0.05 * recent.sun - 0.1 * recent.leaf + 0.03 * recent.water, 0.3, 1);
  const lush = clamp(0.25 + share("water") * 1.4 + 0.04 * recent.water, 0, 1);
  const leaves = [];
  function cluster(seg, u, sizeK, key) {
    const r = rng(hashSeed(genome, "cl", key));
    const n = 3 + Math.floor(r() * 4) + (seg.el === "sun" ? 2 : 0) + (seg.el === "water" ? 1 : 0);
    const big = 0.8 + r() * 0.6;
    for (let i = 0; i < n; i++) {
      leaves.push({
        seg: seg.id, t: u, spread: (r() - 0.5) * 2.2,
        stalk: 0.15 + r() * 0.35,   // ogonek liścia: liść zawsze wyrasta z gałązki
        size: G.leafLen * big * sizeK * (0.65 + r() * 0.7) * (1 + lush * 0.15) * (0.4 + 0.6 * smooth((Pv - 7) / 45)),
        keep: r(), tone: r(), birth: seg.birth + 0.8 + r() * 1.5
      });
    }
  }
  if (Pv >= STAGES.LEAVES) {
    segments.forEach((s) => {
      const age = Pv - s.birth;
      const tip = !s.kids.some((k) => byId.get(k).depth === s.depth);
      if (s.depth === 0) {
        // pień: liście tylko na samym wierzchołku przewodnika (pąk szczytowy), nigdy wzdłuż pnia
        if (tip && age < 12) cluster(s, 1, 0.7, "t" + s.id);
        return;
      }
      if (s.depth === 1 && age > 45 && !tip) return;        // stare części konarów łysieją od środka
      if (tip) cluster(s, 1, 1, "e" + s.id);
      else if (s.depth === 1 && s.j >= 1 && age <= 45) cluster(s, 0.6, 0.8, "m" + s.id);
      else if (s.depth >= 2 && s.j % 2 === 1) cluster(s, 0.6, 0.85, "m" + s.id);
    });
  }
  const visibleLeaves = leaves.filter((l) => l.keep < density && Pv >= l.birth).map((l) => ({ ...l, grow: smooth((Pv - l.birth) / 2) }));
  const fallen = Math.min(40, Math.round(recent.leaf * 6 + count.leaf * 0.5));

  // pąki na końcach osi
  segments.forEach((s) => {
    const tip = !s.kids.some((k) => byId.get(k).depth === s.depth);
    if (tip && s.grown > 0.5 && s.depth <= 2) buds.push({ seg: s.id, el: s.el, entryId: s.entryId, day: s.day, fresh: s.el === "seed" });
  });

  // liścienie kiełka
  let cotyledons = null;
  if (Pv >= STAGES.SPROUT && Pv < STAGES.BRANCH + 2 && segments.length) {
    const s0 = segments[0];
    const fade = 1 - smooth((Pv - STAGES.BRANCH + 1) / 3);
    cotyledons = { x: s0.x1, y: s0.y1, size: 0.009 * smooth((Pv - STAGES.SPROUT) / 1.5) * fade, angle: s0.angle };
  }

  // ---------- korzenie ----------
  // mało wody: głębiej; kamień i wiatr: mocniej i szerzej; dni bez słów: rosną w głąb
  const roots = [];
  let rootId = 0;
  const waterShare = share("water");
  const deep = clamp(1.25 - waterShare * 2.2, 0.55, 1.3);
  const baseHalf = (segments[0] ? segments[0].w : 0.004) * 0.45;
  function rootAxis(o) {
    let prev = o.parent, angle = o.angle, birth = o.birth;
    for (let j = 0; j < o.maxSegs && birth <= R; j++) {
      const step = atR(birth);
      const el = step ? (step.words ? step.element : "silent") : null;
      const r = rng(hashSeed(genome, "root", o.key, j));
      let target = o.target;
      if (el === "stone") target += Math.sign(target || o.side) * 0.25;
      if (el === "silent") target *= 0.85;
      angle += (target - angle) * o.pull + (r() - 0.5) * 0.3;
      let len = o.baseLen * (0.85 + r() * 0.3) * (o.depth === 0 ? 0.75 + Math.min(j, 8) * 0.07 : Math.pow(0.92, j));
      len *= 0.45 + 0.55 * smooth((Pv - 5) / 80);         // korzenie rosną w proporcji do drzewa
      if (el === "stone" || el === "wind") len *= 1.12;
      if (el === "silent") len *= 1.1;
      const seg = { id: rootId++, parent: prev ? prev.id : -1, depth: o.depth, angle, len, birth, el, entryId: step && step.entryId, day: step && step.day, kids: [], bend: (r() - 0.5) * 0.5 };
      seg.grown = smooth((R - birth) / 2);
      if (prev) prev.kids.push(seg.id);
      roots.push(seg);
      if (o.depth < 2 && j >= 1 && r() < (o.depth === 0 ? 0.4 : 0.25)) {
        const sd = r() < 0.5 ? -1 : 1;
        rootAxis({ parent: seg, depth: o.depth + 1, birth: birth + 1.5 + r() * 1.5, side: sd, angle: angle + sd * 0.7, target: angle + sd * 0.9, pull: 0.15, maxSegs: o.depth === 0 ? 5 : 2, baseLen: o.baseLen * 0.6, key: o.key + "." + j });
      }
      prev = seg;
      birth += o.depth === 0 ? 1.4 + 0.35 * j : 2.2 + 0.6 * j;
    }
  }
  if (R >= 1.5) {
    const stoneSoFar = count.stone;
    const mains = Math.min(6, 3 + (G.shape === "round" || G.shape === "spreading" ? 1 : 0) + (stoneSoFar >= 4 ? 1 : 0) + (count.wind >= 6 ? 1 : 0));
    const rr = rng(hashSeed(genome, "rootplan"));
    const sides = [];
    for (let i = 0; i < mains; i++) sides.push(i === 0 ? (rr() < 0.5 ? -1 : 1) : (i % 2 ? -sides[0] : sides[0]));
    for (let i = 0; i < mains; i++) {
      const side = sides[i];
      const tap = i === 0 && G.shape === "slender";
      // najpierw płytko i na boki, potem łagodnie w głąb
      const start = tap ? 0.2 * side : side * (1.25 + rr() * 0.2) * G.rootSpread;
      const target = tap ? 0.05 : side * (0.45 + rr() * 0.45) / deep;
      rootAxis({
        parent: null, depth: 0, birth: 1.5 + i * 2.6, side, angle: clamp(start, -1.5, 1.5), target: clamp(target, -1.3, 1.3), pull: 0.22,
        maxSegs: 16, baseLen: 0.02 * (0.85 + rr() * 0.35) * (i === 0 ? 1.15 : 1) * (tap ? deep : 1), key: "R" + i, startX: side * baseHalf * (0.4 + rr() * 0.6)
      });
      // zapamiętaj przesunięcie startu (nasada pnia)
      roots.filter((s) => s.parent === -1 && s.startX == null).forEach((s) => { s.startX = side * baseHalf * (0.3 + rr() * 0.6); });
    }
  }
  const rById = new Map(roots.map((s) => [s.id, s]));
  for (let i = roots.length - 1; i >= 0; i--) {
    const s = roots[i];
    let n = s.grown;
    s.kids.forEach((k) => { n += rById.get(k).n || 0; });
    s.n = n;
    s.w = 0.0011 * Math.pow(Math.max(1, n), 0.55) * (1 + (strength - 1) * 0.8);
  }
  roots.forEach((s) => {
    const p = s.parent >= 0 ? rById.get(s.parent) : null;
    s.x0 = p ? p.x1 : (s.startX || 0); s.y0 = p ? p.y1 : 0.002;
    const L = s.len * s.grown;
    s.x1 = s.x0 + Math.sin(s.angle) * L; s.y1 = s.y0 + Math.cos(s.angle) * L;
    s.cx = s.x0 + Math.sin(s.angle + s.bend) * L * 0.5; s.cy = s.y0 + Math.cos(s.angle + s.bend) * L * 0.5;
    let wEnd = s.w * 0.7;
    s.kids.forEach((k) => { const c = rById.get(k); if (c.depth === s.depth) wEnd = Math.max(wEnd, c.w); });
    s.wEnd = Math.min(s.w, wEnd);
  });

  // ---------- wymiary ----------
  let top = 0, width = 0;
  segments.forEach((s) => { top = Math.min(top, s.y1); width = Math.max(width, Math.abs(s.x1)); });

  return {
    genes: G, temperament: TEMPERAMENTS[G.shape],
    P: Pv, R,
    stage: Pv >= STAGES.YOUNG ? "young" : Pv >= STAGES.BRANCH ? "branch" : Pv >= STAGES.LEAVES ? "leaves" : Pv >= STAGES.SPROUT ? "sprout" : Pv > 0 ? "seed" : "none",
    segments, leaves: visibleLeaves, buds, roots, knots,
    cotyledons,
    seed: { cracked: R >= 1.5, swell: Math.min(1, Pv / 2 + R / 4) },
    height: Math.max(0.02, -top + G.leafLen), width: width + G.leafLen,
    count, recent, density, lush, fallen,
    stones: Math.min(8, count.stone), moss: Math.min(1, (count.water + count.stone) / 25)
  };
}

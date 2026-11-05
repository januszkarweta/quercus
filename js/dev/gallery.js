// Galeria przykładowych drzew (tryb deweloperski, punkt kontrolny etapu 3).
// Pokazuje obce drzewa z losowymi genami — nigdy prawdziwe drzewo użytkownika.

import { growTree, stepsFrom } from "../tree/grow.js";
import { paintScene } from "../tree/paint.js";
import { simulateEntries } from "../sim.js";
import { seasonOf } from "../world/season.js";
import { newGenome } from "../rng.js";

const LOOKS = {
  autumnDay: { season: "autumn", light: 1, snow: false, stars: 0, sun: { x: 0.22, y: 0.24 }, mist: 0.35, wind: 0.25 },
  winterNight: { season: "winter", light: 0.08, snow: true, frost: true, stars: 1, moon: { x: 0.78, y: 0.17, phase: 0.47 }, mist: 0, wind: 0.15 },
  winterDay: { season: "winter", light: 0.95, snow: true, frost: true, stars: 0, sun: { x: 0.3, y: 0.42 }, mist: 0.2, wind: 0.1 },
  summerDay: { season: "summer", light: 1, snow: false, stars: 0, sun: { x: 0.7, y: 0.16 }, mist: 0, wind: 0.3 }
};

const season = (k) => seasonOf(k, 59.3);

function card(container, title, note, genome, entries, look) {
  const fig = document.createElement("figure");
  fig.className = "card";
  const frame = document.createElement("div");
  frame.className = "frame";
  const cv = document.createElement("canvas");
  frame.appendChild(cv);
  const cap = document.createElement("figcaption");
  cap.innerHTML = `<strong>${title}</strong>${note ? `<span>${note}</span>` : ""}`;
  fig.append(frame, cap);
  container.appendChild(fig);
  const steps = stepsFrom(entries, season);
  const tree = growTree(genome, steps);
  const draw = () => {
    const rect = cv.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    if (!W || !H) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScene(ctx, W, H, tree, look);
  };
  return draw;
}

export function buildGallery(root) {
  const draws = [];
  const g0 = newGenome();
  const balanced = { sun: 1, water: 1, seed: 1, leaf: 1, wind: 1, stone: 1 };
  const base = { silentChance: 0.1, extraChance: 0.15, seed: 7 };

  const sections = [
    {
      title: "Jedno drzewo, kolejne etapy",
      text: "To samo przykładowe drzewo w dniach, które wyznaczają etapy wzrostu: nasionko, kiełek, pierwsze liście, pierwsza gałązka, młode drzewo.",
      items: [1, 3, 7, 14, 30].map((d) => ({ title: `Dzień ${d}`, note: { 1: "nasionko", 3: "kiełek", 7: "pierwsze liście", 14: "pierwsza gałązka", 30: "młode drzewo" }[d], genome: g0, entries: simulateEntries(d, balanced, { ...base, silentChance: 0 }), look: LOOKS.autumnDay }))
    },
    {
      title: "Różne geny, ten sam miesiąc",
      text: "Sześć różnych nasionek po 30 dniach, z takim samym rozkładem żywiołów. Różnice wynikają tylko z genów.",
      items: Array.from({ length: 6 }, (_, i) => ({ title: `Nasionko ${String.fromCharCode(65 + i)}`, note: "30 dni", genome: newGenome(), entries: simulateEntries(30, balanced, base), look: LOOKS.autumnDay }))
    },
    {
      title: "Te same geny, różne miesiące życia",
      text: "Jedno nasionko po 30 dniach, ale z różną historią. Każdy żywioł daje inny rodzaj piękna.",
      items: [
        ["Dużo wiatru", "trudne dni", { wind: 6 }],
        ["Dużo słońca", "energia", { sun: 6 }],
        ["Dużo wody", "wsparcie", { water: 6 }],
        ["Dużo nasion", "coś nowego", { seed: 6 }],
        ["Dużo liścia", "puszczanie", { leaf: 6 }],
        ["Dużo kamienia", "po prostu byłem", { stone: 6 }]
      ].map(([t, n, mix]) => ({ title: t, note: n, genome: g0, entries: simulateEntries(30, { ...balanced, ...mix }, base), look: LOOKS.autumnDay }))
    },
    {
      title: "Zima",
      text: "To samo drzewo zimą: śnieg na gałęziach, oszronione, ciemniejsze liście i pąki czekające na wiosnę. Zimą więcej wzrostu idzie w korzenie.",
      items: [
        { title: "Zimowy dzień", note: "30 dni", genome: g0, entries: simulateEntries(30, balanced, base), look: LOOKS.winterDay },
        { title: "Zimowa noc", note: "30 dni", genome: g0, entries: simulateEntries(30, balanced, base), look: LOOKS.winterNight }
      ]
    },
    {
      title: "Dalsza przyszłość",
      text: "Przykładowe drzewo po 90 dniach i po roku z przerwami. Wzrost zwalnia, rośnie charakter.",
      items: [
        { title: "90 dni", note: "jesień", genome: g0, entries: simulateEntries(90, balanced, { ...base, gapChance: 0.08 }), look: LOOKS.autumnDay },
        { title: "Rok", note: "lato (kwiaty w wersji 1.1)", genome: g0, entries: simulateEntries(240, balanced, { ...base, gapChance: 0.12 }), look: LOOKS.summerDay }
      ]
    }
  ];

  sections.forEach((s) => {
    const sec = document.createElement("section");
    sec.innerHTML = `<h2>${s.title}</h2><p>${s.text}</p>`;
    const grid = document.createElement("div");
    grid.className = "grid";
    sec.appendChild(grid);
    root.appendChild(sec);
    s.items.forEach((it) => draws.push(card(grid, it.title, it.note, it.genome, it.entries, it.look)));
  });

  const redraw = () => draws.forEach((d) => d());
  if ("ResizeObserver" in window) {
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(redraw); });
    ro.observe(root);
  }
  redraw();
  return redraw;
}

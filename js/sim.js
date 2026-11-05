// Symulacje historii do trybu deweloperskiego: generują wymyślone wpisy, żeby zobaczyć,
// jak drzewo wygląda po wielu dniach. Nigdy nie dotykają prawdziwego drzewa.

import { rng } from "./rng.js";

const ELEMENTS = ["sun", "water", "seed", "leaf", "wind", "stone"];

/**
 * @param days liczba dni z rytuałem
 * @param mix wagi żywiołów, np. { wind: 3, water: 2 }
 * @param opts { start: Date, gapChance, silentChance, extraChance, seed }
 */
export function simulateEntries(days, mix = {}, opts = {}) {
  const r = rng(opts.seed || 1);
  const weights = ELEMENTS.map((e) => (mix[e] != null ? mix[e] : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const pickEl = () => {
    let x = r() * total;
    for (let i = 0; i < ELEMENTS.length; i++) { x -= weights[i]; if (x <= 0) return ELEMENTS[i]; }
    return ELEMENTS[0];
  };
  const start = opts.start ? new Date(opts.start) : new Date(2026, 10, 5, 19);
  const entries = [];
  let d = new Date(start);
  for (let i = 0; i < days; i++) {
    if (opts.gapChance && r() < opts.gapChance) { d.setDate(d.getDate() + 1 + Math.floor(r() * 6)); }
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const skipped = opts.silentChance ? r() < opts.silentChance : false;
    const el = pickEl();
    entries.push({ id: "sim" + i, day, at: d.toISOString(), element: el, qid: null, text: skipped ? null : "(przykład)", skipped, extra: false });
    if (opts.extraChance && r() < opts.extraChance) {
      let el2 = pickEl(); if (el2 === el) el2 = ELEMENTS[(ELEMENTS.indexOf(el) + 1) % 6];
      entries.push({ id: "sim" + i + "x", day, at: new Date(d.getTime() + 3600e3).toISOString(), element: el2, qid: null, text: "(przykład)", skipped: false, extra: true });
    }
    d.setDate(d.getDate() + 1);
  }
  return entries;
}

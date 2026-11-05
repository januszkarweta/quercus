// Wybór pytania dnia.
// - Dwie pule: stała (wraca co 3–4 tygodnie, buduje echa) i wędrowna (wraca rzadko).
// - Pytanie pasuje do pory dnia; ten sam temat nie dwa dni z rzędu; rywalizacja rzadko.
// - Jedna zamiana dziennie. Pytanie pominięte („Inga ord idag”) nie jest zużyte.

import { rng, hashSeed } from "./rng.js";
import { daysBetween } from "./clock.js";

function timeOk(q, part) {
  if (q.time === "any") return true;
  if (part === "morning") return q.time === "morning";
  if (part === "evening" || part === "night") return q.time === "evening";
  return false; // w ciągu dnia (12–16) tylko pytania „o każdej porze”
}

/** Ostatni dzień, w którym na pytanie odpowiedziano słowami. */
function lastAnswered(state, qid) {
  let last = null;
  state.entries.forEach((e) => { if (e.qid === qid && e.text && !e.skipped && (!last || e.day > last)) last = e.day; });
  return last;
}

export function chooseQuestion(state, questions, day, part, exclude = []) {
  const answered = state.entries.filter((e) => e.text && !e.skipped && !e.extra).sort((a, b) => (a.day < b.day ? -1 : 1));
  const lastEntry = answered[answered.length - 1];
  const lastTheme = lastEntry ? (questions.find((q) => q.id === lastEntry.qid) || {}).theme : null;
  const lastCoreDay = (() => {
    let d = null;
    answered.forEach((e) => { const q = questions.find((x) => x.id === e.qid); if (q && q.pool === "core") d = e.day; });
    return d;
  })();
  const r = rng(hashSeed("question", day, exclude.join(",")));
  const base = questions.filter((q) => !exclude.includes(q.id) && timeOk(q, part) && q.theme !== lastTheme);
  const pool = base.length ? base : questions.filter((q) => !exclude.includes(q.id) && timeOk(q, part));
  const sinceCore = lastCoreDay ? daysBetween(lastCoreDay, day) : 99;

  const ageOf = (q) => { const l = lastAnswered(state, q.id); return l ? daysBetween(l, day) : 9999; };
  // pytanie stałe: co 3.–4. dzień, wybieramy to, które najdłużej czekało (min. 21 dni)
  if (sinceCore >= 3 && r() < 0.6) {
    const core = pool.filter((q) => q.pool === "core" && ageOf(q) >= 21).sort((a, b) => ageOf(b) - ageOf(a));
    if (core.length) return core[0];
  }
  let wand = pool.filter((q) => q.pool === "wandering" && ageOf(q) >= 60);
  if (!wand.length) wand = pool.filter((q) => q.pool === "wandering").sort((a, b) => ageOf(b) - ageOf(a)).slice(0, 5);
  if (!wand.length) wand = pool;
  // lekkie częściej niż głębokie (2:1), rywalizacja rzadko
  const weight = (q) => (q.weight === "light" ? 2 : 1) * (q.theme === "competition" ? 0.25 : 1);
  const total = wand.reduce((a, q) => a + weight(q), 0);
  let x = r() * total;
  for (const q of wand) { x -= weight(q); if (x <= 0) return q; }
  return wand[0];
}

/** Echo: wcześniejsza odpowiedź na to samo pytanie (najnowsza; przy rocznicy ta sprzed roku). */
export function echoFor(state, qid, day) {
  const prev = state.entries.filter((e) => e.qid === qid && e.text && !e.skipped && !e.deleted && e.day < day).sort((a, b) => (a.day < b.day ? 1 : -1));
  if (!prev.length) return null;
  const yearAgo = prev.find((e) => { const d = daysBetween(e.day, day); return d >= 330 && d <= 400; });
  if (yearAgo) return { entry: yearAgo, year: true };
  return { entry: prev[0], year: false };
}

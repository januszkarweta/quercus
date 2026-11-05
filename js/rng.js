// Deterministyczna losowość: to samo ziarno zawsze daje te same liczby.
// Dzięki temu drzewo, zdarzenia dnia i pogoda symulowana nie zmieniają się po odświeżeniu.

export function rng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Łączy dowolne wartości w jedno ziarno liczbowe (hash FNV-1a). */
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function newGenome() {
  if (globalThis.crypto && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967295);
}

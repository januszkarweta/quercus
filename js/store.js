// Zapis drzewa w pamięci przeglądarki (localStorage).
// - Prawdziwe drzewo i drzewa testowe (tryb deweloperski) mają osobne klucze i nigdy się nie mieszają.
// - Każdy zapis ma numer wersji schematu, żeby przyszłe aktualizacje mogły bezpiecznie przenieść dane.

import { newGenome } from "./rng.js";
import { now } from "./clock.js";

export const SCHEMA = 1;
const REAL_KEY = "mittrad:tree";

let storageKey = REAL_KEY;
let state = null;
const listeners = new Set();

/** Tryb deweloperski: osobny slot danych, np. „mittrad:dev:a”. */
export function useDevSlot(slot) { storageKey = `mittrad:dev:${slot}`; }
export function isDevStorage() { return storageKey !== REAL_KEY; }
export function currentKey() { return storageKey; }

export function freshState(genome = newGenome()) {
  return {
    schema: SCHEMA,
    createdAt: null,          // moment posadzenia (ISO); null = nasionko jeszcze nieposadzone
    genome,                   // ukryte geny drzewa
    place: null,              // { name, lat, lon, source }
    name: null,               // imię drzewa
    entries: [],              // rytuały: { id, day, at, element, qid, text, skipped, extra, deleted }
    marks: [],                // chwile w historii: { type, day, at, data }
    bags: {},                 // zużyte teksty: { pula: [id, ...] }
    lastTextDay: {},          // { id: dzień } — zakaz tego samego zdania dwa dni z rzędu
    question: null,           // { day, qid, swapped }
    draft: null,              // { day, qid, text }
    visits: { last: null, lastDay: null },
    weather: null,            // ostatnia pobrana pogoda
    settings: { sound: false, lastBackup: null, namingAsked: false }
  };
}

function migrate(s) {
  if (!s || typeof s !== "object") return null;
  // Miejsce na przyszłe migracje: if (s.schema === 1) { ...; s.schema = 2; }
  const base = freshState(s.genome);
  return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, visits: { ...base.visits, ...(s.visits || {}) } };
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(storageKey); } catch (e) { /* prywatne okno itp. */ }
  if (raw) {
    try { state = migrate(JSON.parse(raw)); } catch (e) { state = null; }
  }
  if (!state) state = freshState();
  return state;
}

export function get() { return state || load(); }

export function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn("Nie udało się zapisać drzewa", e);
    return false;
  }
}

/** Zmiana stanu: funkcja dostaje stan, zmienia go, potem zapis i powiadomienie widoków. */
export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => l(state));
}

export function replace(newState) {
  state = migrate(newState);
  save();
  listeners.forEach((l) => l(state));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function wipe() {
  try { localStorage.removeItem(storageKey); } catch (e) { /* nic */ }
  state = freshState();
}

/** Prośba do przeglądarki o trwałe przechowywanie (chroni dane przed automatycznym usunięciem). */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch (e) { /* brak wsparcia, trudno */ }
}

export function newId() {
  return now().getTime().toString(36) + Math.random().toString(36).slice(2, 6);
}

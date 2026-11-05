// Biblioteka tekstów: wczytanie, zmienne, wybór bez powtórek.
// - Zasada worka: tekst wraca dopiero, gdy cała pula została wykorzystana.
// - Ten sam tekst nigdy dwa dni z rzędu.

import { rng, hashSeed } from "./rng.js";
import { daysBetween } from "./clock.js";

let T = null;

export async function loadTexts() {
  const res = await fetch("texts/sv.json", { cache: "no-cache" });
  T = await res.json();
  return T;
}
export function texts() { return T; }

/** Dopełniacz szwedzki: imię + s (bez zmiany dla końcówek s, x, z). */
export function genitive(name) {
  if (!name) return "";
  return /[sxz]$/i.test(name) ? name : name + "s";
}

const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
export function formatDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** Podstawia zmienne {namn}, {namns}, {citat}, {datum}, {tema}, {händelse}, {plats}. */
export function fill(text, vars = {}) {
  return String(text).replace(/\{(namn|namns|citat|datum|tema|händelse|plats|fråga)\}/g, (m, k) => {
    if (k === "namns") return genitive(vars.namn);
    if (k === "citat") return vars.citat ? `»${vars.citat}«` : "";
    return vars[k] != null ? vars[k] : "";
  });
}

export function ui(key, vars) {
  const v = T && T.ui && T.ui[key];
  return v == null ? key : fill(v, vars);
}

/**
 * Wybiera tekst z puli bez powtórek. Zmienia state.bags i state.lastTextDay (zapis robi wywołujący).
 * @param state stan drzewa
 * @param poolKey nazwa puli (np. "responses.wind.general")
 * @param list lista { id, text }
 * @param day klucz dnia
 * @param salt dodatkowa losowość (ustalona, np. id wpisu)
 */
export function pick(state, poolKey, list, day, salt = "") {
  if (!list || !list.length) return null;
  state.bags = state.bags || {};
  state.lastTextDay = state.lastTextDay || {};
  let used = state.bags[poolKey] || [];
  let avail = list.filter((x) => !used.includes(x.id));
  if (!avail.length) { used = []; avail = list.slice(); }
  // zakaz tego samego tekstu w dniu poprzednim
  const notYesterday = avail.filter((x) => { const d = state.lastTextDay[x.id]; return !d || Math.abs(daysBetween(d, day)) > 1; });
  if (notYesterday.length) avail = notYesterday;
  const r = rng(hashSeed(poolKey, day, salt, used.length));
  const item = avail[Math.floor(r() * avail.length)];
  state.bags[poolKey] = [...used, item.id];
  state.lastTextDay[item.id] = day;
  return item;
}

/** Pierwsze zdanie odpowiedzi (do ech i historii), do ok. 140 znaków. */
export function firstSentence(text) {
  if (!text) return "";
  const t = text.trim().replace(/\s+/g, " ");
  const m = t.match(/^(.+?[.!?…])(\s|$)/);
  let s = m ? m[1] : t;
  if (s.length > 140) s = s.slice(0, 137).replace(/\s+\S*$/, "") + "…";
  return s;
}

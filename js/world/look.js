// Wygląd świata w danej chwili: pora roku, światło, pogoda, zdarzenie.

import { dayKey, daysBetween } from "../clock.js";
import { seasonOf, seasonProgress } from "./season.js";
import { lightFor } from "./sky.js";
import { weatherNow } from "./weather.js";
import { eventFor, tracesFrom } from "./events.js";
import { DEFAULT_PLACE } from "./places.js";

export function placeOf(state) { return state.place || DEFAULT_PLACE; }

export function partFromSun(date, sunAlt) {
  if (sunAlt < -6) return "night";
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 16) return "day";
  return "evening";
}

/**
 * @param state stan
 * @param date chwila
 * @param P etap drzewa (do warunków zdarzeń)
 * @param force (tryb deweloperski) nadpisania: { season, hour, weather, event }
 */
export function worldAt(state, date, P, force = {}) {
  const place = placeOf(state);
  const key = dayKey(date);
  const sOf = (k) => seasonOf(k, place.lat);
  let season = force.season || sOf(key);
  let d = date;
  if (force.hour != null) { d = new Date(date); d.setHours(force.hour, 0, 0, 0); }
  const sky = lightFor(d, place.lat, place.lon);
  const weather = weatherNow(state, d, sOf);
  if (force.weather) {
    weather.kind = force.weather;
    if (force.weather === "snow") weather.snowCover = true;
    if (force.weather === "storm") weather.wind = 0.9;
  }
  if (force.season === "winter") { weather.snowCover = force.weather !== "rain"; weather.frost = true; }
  if (force.season && force.season !== "winter") { weather.snowCover = force.weather === "snow"; weather.frost = false; }
  const part = partFromSun(d, sky.sunAlt);
  const genome = state.genome;
  const event = force.event !== undefined ? force.event : eventFor({ genome, day: key, part, season, weather, lat: place.lat, P });

  // ślady z ostatnich dni (zwierzęta na śniegu, grzyby, kałuże)
  const hist = [];
  for (let i = 4; i >= 0; i--) {
    const dd = new Date(d.getTime() - i * 86400000), k = dayKey(dd);
    const wPast = (weather.past || []).find((x) => x.day === k);
    ["morning", "evening", "night"].forEach((pp) => {
      const ev = eventFor({ genome, day: k, part: pp, season: sOf(k), weather: { ...weather, kind: wPast ? wPast.kind : weather.kind }, lat: place.lat, P });
      if (ev) hist.push({ dayIndex: -i, event: ev, snowCover: weather.snowCover, kind: wPast ? wPast.kind : null });
    });
    if (wPast) hist.push({ dayIndex: -i, event: null, kind: wPast.kind, snowCover: weather.snowCover });
  }
  const traces = tracesFrom(hist, 0);

  const mist = weather.kind === "fog" ? 0.95 : part === "morning" ? 0.55 : season === "autumn" ? 0.45 : 0.3;
  return {
    key, part, season, place,
    look: {
      season,
      autumn: season === "autumn" ? seasonProgress(key, place.lat) : null,
      light: sky.light * (weather.kind === "storm" ? 0.75 : weather.kind === "rain" || weather.kind === "snow" ? 0.88 : 1),
      dusk: sky.dusk, stars: weather.kind === "clear" || weather.kind === "cloudy" ? sky.stars * (weather.kind === "cloudy" ? 0.35 : 1) : 0,
      sun: weather.kind === "clear" || weather.kind === "cloudy" || weather.kind === "fog" ? sky.sun : null,
      moon: weather.kind === "clear" || weather.kind === "cloudy" ? sky.moon : null,
      snow: weather.snowCover, frost: weather.frost && (season === "winter" || (weather.temp != null && weather.temp < 0)),
      mist, wind: weather.wind, aurora: event === "norrsken" ? 1 : 0
    },
    weather, event, traces
  };
}

/** Zdarzenia podczas nieobecności: 1–2 najciekawsze (najrzadsze) z dni między wizytami. */
export function awayEvents(state, fromKey, toDate, P) {
  if (!fromKey) return [];
  const place = placeOf(state);
  const toKey = dayKey(toDate);
  const gap = Math.min(10, daysBetween(fromKey, toKey));
  const rank = { rare: 3, occasional: 2, common: 1 };
  const found = [];
  for (let i = 1; i < gap; i++) {
    const dd = new Date(toDate.getTime() - i * 86400000), k = dayKey(dd);
    const season = seasonOf(k, place.lat);
    const w = weatherNow(state, dd, (x) => seasonOf(x, place.lat));
    ["morning", "night"].forEach((pp) => {
      const ev = eventFor({ genome: state.genome, day: k, part: pp, season, weather: w, lat: place.lat, P });
      if (ev) found.push(ev);
    });
    if (w.kind === "snow") found.push("snofall");
    if (w.kind === "rain" || w.kind === "storm") found.push("regn");
  }
  return found;
}
export const RARITY_RANK = { rare: 3, occasional: 2, common: 1 };

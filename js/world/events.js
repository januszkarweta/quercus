// Zdarzenia w świecie drzewa: zwierzęta, przyroda, niebo.
// - Ustalane z góry dla dnia i pory dnia (odświeżenie niczego nie zmienia).
// - Trzy poziomy rzadkości. Mniej więcej co trzecia wizyta: nic szczególnego.
// - Każde zdarzenie ma warunki: pora roku, pogoda, pora dnia, szerokość geograficzna, etap drzewa.
// - Żadnej kolekcji ani licznika — to chwile życia, nie nagrody.

import { rng, hashSeed } from "../rng.js";

const W = { common: 10, occasional: 3, rare: 0.6 };

// parts: morning, day, evening, night. seasons: spring, summer, autumn, winter.
// needs: "branch" (gałęzie, P >= 14), "snow" (śnieg na ziemi), "clear" (bezchmurnie), "rainy", "north" (szer. > 62)
export const EVENTS = [
  { key: "rodhake", kind: "bird", rarity: "common", seasons: ["spring", "summer", "autumn"], parts: ["morning", "day", "evening"] },
  { key: "talgoxe", kind: "bird", rarity: "common", seasons: ["autumn", "winter", "spring"], parts: ["morning", "day"] },
  { key: "domherre", kind: "bird", rarity: "occasional", seasons: ["winter"], parts: ["morning", "day"] },
  { key: "koltrast", kind: "bird", rarity: "common", seasons: ["spring", "summer", "autumn"], parts: ["morning", "evening"] },
  { key: "ekorre", kind: "animal", rarity: "occasional", seasons: ["spring", "summer", "autumn", "winter"], parts: ["morning", "day"] },
  { key: "igelkott", kind: "animal", rarity: "occasional", seasons: ["spring", "summer", "autumn"], parts: ["evening", "night"] },
  { key: "hare", kind: "animal", rarity: "occasional", seasons: ["autumn", "winter", "spring"], parts: ["morning", "evening", "night"] },
  { key: "rav", kind: "animal", rarity: "occasional", seasons: ["autumn", "winter"], parts: ["evening", "night", "morning"] },
  { key: "radjur", kind: "animal", rarity: "occasional", seasons: ["spring", "summer", "autumn", "winter"], parts: ["morning", "evening"] },
  { key: "alg", kind: "animal", rarity: "rare", seasons: ["autumn", "winter", "spring"], parts: ["morning", "evening"] },
  { key: "uggla", kind: "bird", rarity: "rare", seasons: ["autumn", "winter", "spring"], parts: ["night"], needs: ["branch"] },
  { key: "flyttfaglar", kind: "sky", rarity: "occasional", seasons: ["autumn", "spring"], parts: ["morning", "day"] },
  { key: "fjarilar", kind: "insect", rarity: "common", seasons: ["summer"], parts: ["day"] },
  { key: "bin", kind: "insect", rarity: "common", seasons: ["summer", "spring"], parts: ["day"] },
  { key: "eldflugor", kind: "insect", rarity: "rare", seasons: ["summer"], parts: ["night", "evening"] },
  { key: "myror", kind: "small", rarity: "common", seasons: ["spring", "summer", "autumn"], parts: ["day"] },
  { key: "daggmask", kind: "small", rarity: "common", seasons: ["spring", "summer", "autumn"], parts: ["morning", "day"], needs: ["rainy"] },
  { key: "nyckelpiga", kind: "small", rarity: "occasional", seasons: ["spring", "summer"], parts: ["day"] },
  { key: "dagg", kind: "nature", rarity: "common", seasons: ["spring", "summer", "autumn"], parts: ["morning"] },
  { key: "svamp", kind: "nature", rarity: "occasional", seasons: ["autumn"], parts: ["morning", "day", "evening"] },
  { key: "istappar", kind: "nature", rarity: "occasional", seasons: ["winter"], parts: ["morning", "day"], needs: ["branch", "snow"] },
  { key: "regnbage", kind: "sky", rarity: "rare", seasons: ["spring", "summer", "autumn"], parts: ["day", "evening"], needs: ["rainy"] },
  { key: "norrsken", kind: "sky", rarity: "rare", seasons: ["autumn", "winter", "spring"], parts: ["night"], needs: ["clear"] },
  { key: "stjarnfall", kind: "sky", rarity: "rare", seasons: ["spring", "summer", "autumn", "winter"], parts: ["night"], needs: ["clear"] },
  { key: "angsblommor", kind: "nature", rarity: "common", seasons: ["summer"], parts: ["morning", "day", "evening"] }
];

const BY_KEY = new Map(EVENTS.map((e) => [e.key, e]));
export function eventInfo(key) { return BY_KEY.get(key); }

/**
 * Wybiera zdarzenie dla dnia i pory dnia albo null („nic szczególnego”).
 * ctx: { genome, day, part, season, weather, lat, P }
 */
export function eventFor(ctx) {
  const r = rng(hashSeed("event", ctx.genome, ctx.day, ctx.part));
  if (r() < 0.33) return null;
  const rainy = ctx.weather && (ctx.weather.kind === "rain" || ctx.weather.kind === "storm");
  const clear = ctx.weather && ctx.weather.kind === "clear";
  const ok = EVENTS.filter((e) => {
    if (!e.seasons.includes(ctx.season) || !e.parts.includes(ctx.part)) return false;
    const needs = e.needs || [];
    if (needs.includes("branch") && ctx.P < 14) return false;
    if (needs.includes("snow") && !(ctx.weather && ctx.weather.snowCover)) return false;
    if (needs.includes("rainy") && !rainy) return false;
    if (needs.includes("clear") && !clear) return false;
    if (e.kind === "bird" && e.key !== "uggla" && ctx.weather && ctx.weather.kind === "storm") return false;
    return true;
  });
  if (!ok.length) return null;
  const weight = (e) => {
    let w = W[e.rarity];
    if (e.key === "norrsken") w *= Math.max(0.1, (ctx.lat - 55) / 8); // częściej na północy
    if ((e.kind === "bird" || e.key === "ekorre") && ctx.P < 7) w *= 0.3; // ptaki rzadko przy samym nasionku
    if (e.kind === "small" && ctx.P < 14) w *= 2; // przy małej roślince: mrówki, dżdżownice
    return w;
  };
  const total = ok.reduce((a, e) => a + weight(e), 0);
  let x = r() * total;
  for (const e of ok) { x -= weight(e); if (x <= 0) return e.key; }
  return ok[0].key;
}

/** Ślady zostające po zdarzeniach na kilka dni. */
export function tracesFrom(history, todayIndex) {
  // history: [{ dayIndex, event, snowCover, kind }]
  const traces = new Set();
  history.forEach((h) => {
    const age = todayIndex - h.dayIndex;
    if (age < 0) return;
    if (h.snowCover && ["rav", "hare", "radjur", "alg", "ekorre"].includes(h.event) && age <= 3) traces.add("spar_i_snon");
    if (h.event === "svamp" && age <= 4) traces.add("svamp");
    if ((h.kind === "rain" || h.kind === "storm") && age <= 1) traces.add("vattenpolar");
  });
  return traces;
}

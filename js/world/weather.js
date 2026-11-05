// Pogoda: prawdziwa (Open-Meteo, gdy znamy miejsce i jest internet) albo symulowana.
// Symulacja jest ustalana raz na dzień, więc odświeżenie strony niczego nie zmienia.

import { rng, hashSeed } from "../rng.js";
import { dayKey } from "../clock.js";

const MAX_AGE_MS = 2 * 3600 * 1000;

function kindFromCode(code) {
  if (code == null) return "cloudy";
  if (code <= 1) return "clear";
  if (code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  if (code >= 51) return "rain";
  return "cloudy";
}

/** Pobiera pogodę. Zwraca obiekt do zapisania w stanie albo null przy braku sieci. */
export async function fetchWeather(place) {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=" + place.lat + "&longitude=" + place.lon +
    "&current=temperature_2m,weather_code,wind_speed_10m,cloud_cover" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum,wind_speed_10m_max" +
    "&past_days=7&forecast_days=1&timezone=auto";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    const days = (j.daily && j.daily.time || []).map((d, i) => ({
      day: d,
      kind: kindFromCode(j.daily.weather_code[i]),
      tmax: j.daily.temperature_2m_max[i], tmin: j.daily.temperature_2m_min[i],
      snow: j.daily.snowfall_sum[i] || 0, rain: j.daily.precipitation_sum[i] || 0,
      wind: j.daily.wind_speed_10m_max[i] || 0
    }));
    return {
      fetchedAt: Date.now(),
      lat: place.lat, lon: place.lon,
      current: {
        kind: kindFromCode(j.current.weather_code),
        temp: j.current.temperature_2m, wind: j.current.wind_speed_10m, cloud: j.current.cloud_cover
      },
      days
    };
  } catch (e) {
    return null;
  } finally { clearTimeout(timer); }
}

export function isFresh(w, place) {
  return w && place && Math.abs(w.lat - place.lat) < 0.01 && Math.abs(w.lon - place.lon) < 0.01 && Date.now() - w.fetchedAt < MAX_AGE_MS;
}

const CLIMATE = {
  winter: [["snow", 30], ["cloudy", 35], ["clear", 20], ["fog", 10], ["rain", 5]],
  autumn: [["rain", 30], ["cloudy", 30], ["fog", 20], ["clear", 20]],
  spring: [["clear", 35], ["cloudy", 30], ["rain", 25], ["fog", 10]],
  summer: [["clear", 50], ["cloudy", 25], ["rain", 20], ["storm", 5]]
};

/** Symulowana pogoda dla dnia (ustalona). */
export function simulatedDay(key, season, salt = 0) {
  const r = rng(hashSeed("weather", key, salt));
  const table = CLIMATE[season];
  const total = table.reduce((a, b) => a + b[1], 0);
  let x = r() * total, kind = table[0][0];
  for (const [k, w] of table) { x -= w; if (x <= 0) { kind = k; break; } }
  const base = { winter: -4, autumn: 6, spring: 8, summer: 18 }[season];
  const temp = base + (r() - 0.5) * 8 + (kind === "clear" && season === "winter" ? -4 : 0);
  return { day: key, kind, tmax: temp + 3, tmin: temp - 3, snow: kind === "snow" ? 2 + r() * 5 : 0, rain: kind === "rain" ? 2 + r() * 6 : 0, wind: kind === "storm" ? 45 : 8 + r() * 20 };
}

/**
 * Pogoda w danym momencie: { kind, temp, wind (0..1), snowCover, frost, source }.
 * @param seasonOf funkcja klucz -> pora roku
 */
export function weatherNow(state, date, seasonOf) {
  const key = dayKey(date);
  const season = seasonOf(key);
  const w = state.weather;
  const real = w && state.place && Math.abs(w.lat - state.place.lat) < 0.01 && Date.now() - w.fetchedAt < 12 * 3600 * 1000;
  let today, past;
  if (real) {
    today = { ...w.current, wind: w.current.wind };
    past = w.days;
  } else {
    const d = simulatedDay(key, season);
    today = { kind: d.kind, temp: (d.tmax + d.tmin) / 2, wind: d.wind };
    past = [];
    for (let i = 6; i >= 1; i--) {
      const dd = new Date(date.getTime() - i * 86400000);
      const k = dayKey(dd);
      past.push(simulatedDay(k, seasonOf(k)));
    }
    past.push(d);
  }
  // śnieg na ziemi: spadł w ostatnich dniach i od tego czasu nie było odwilży
  let snowCover = false;
  for (const d of past) {
    if (d.snow > 0.5) snowCover = true;
    else if (d.tmax > 4 || d.rain > 3) snowCover = false;
  }
  if (today.kind === "snow") snowCover = true;
  if (!real && season === "winter" && rng(hashSeed("cover", key.slice(0, 8)))() < 0.7) snowCover = true;
  const frost = (today.temp != null && today.temp < 0.5) || (season === "winter");
  return {
    kind: today.kind,
    temp: today.temp,
    wind: Math.min(1, (today.wind || 10) / 45),
    snowCover, frost,
    source: real ? "real" : "sim",
    past
  };
}

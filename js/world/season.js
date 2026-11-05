// Pory roku dla wybranego miejsca (półkula północna, Szwecja).
// Wersja podstawowa: granice pór roku przesuwają się z szerokością geograficzną
// (na północy zima zaczyna się wcześniej i kończy później). Płynne przejścia kolorów: etap 4.

import { keyToDate } from "../clock.js";

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d - start) / 86400000) + 1;
}

/** Zwraca porę roku dla klucza dnia i szerokości geograficznej. */
export function seasonOf(dayKeyStr, lat = 59.3) {
  const d = keyToDate(dayKeyStr);
  const n = dayOfYear(d);
  const shift = Math.round((lat - 59) * 2.2); // dni przesunięcia na stopień
  const winterStart = 320 - shift;   // ok. 16 listopada w Sztokholmie
  const springStart = 85 + shift;    // ok. 26 marca
  const summerStart = 152 + Math.round(shift / 2); // ok. 1 czerwca
  const autumnStart = 244 - Math.round(shift / 2); // ok. 1 września
  if (n >= winterStart || n < springStart) return "winter";
  if (n < summerStart) return "spring";
  if (n < autumnStart) return "summer";
  return "autumn";
}

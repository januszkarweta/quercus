// Czas aplikacji.
// - Doba zaczyna się o 4:00 rano (wpis o 1:00 w nocy należy do poprzedniego dnia).
// - W trybie deweloperskim czas można przesuwać (offset), żeby oglądać przyszłość drzewa.

export const DAY_START_HOUR = 4;

let offsetMs = 0;

export function setOffset(ms) { offsetMs = ms || 0; }
export function getOffset() { return offsetMs; }

/** Aktualny czas aplikacji (z uwzględnieniem przesunięcia w trybie deweloperskim). */
export function now() { return new Date(Date.now() + offsetMs); }

function pad(n) { return String(n).padStart(2, "0"); }

/** Klucz dnia „RRRR-MM-DD” liczony z granicą o 4:00, w czasie lokalnym. */
export function dayKey(date = now()) {
  const d = new Date(date.getTime() - DAY_START_HOUR * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Zamienia klucz dnia na datę o północy (czas lokalny). */
export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Liczba pełnych dni między dwoma kluczami dnia (b - a). */
export function daysBetween(a, b) {
  const ms = keyToDate(b) - keyToDate(a);
  return Math.round(ms / 86400000);
}

/** Pora dnia według zegara (nie według słońca): do wyboru pytań. */
export function partOfDay(date = now()) {
  const h = date.getHours();
  if (h >= 4 && h < 12) return "morning";
  if (h >= 12 && h < 16) return "day";
  if (h >= 16 && h < 23) return "evening";
  return "night";
}

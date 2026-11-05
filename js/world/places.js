// Wbudowana lista miejscowości w Szwecji (działa bez internetu).
// Wyszukiwanie online (Open-Meteo) uzupełnia ją o każde inne miejsce.

export const PLACES = [
  ["Stockholm", 59.33, 18.07], ["Göteborg", 57.71, 11.97], ["Malmö", 55.6, 13.0], ["Uppsala", 59.86, 17.64],
  ["Västerås", 59.61, 16.55], ["Örebro", 59.27, 15.21], ["Linköping", 58.41, 15.62], ["Helsingborg", 56.05, 12.69],
  ["Jönköping", 57.78, 14.16], ["Norrköping", 58.59, 16.19], ["Lund", 55.7, 13.19], ["Umeå", 63.83, 20.26],
  ["Gävle", 60.67, 17.14], ["Borås", 57.72, 12.94], ["Södertälje", 59.2, 17.63], ["Eskilstuna", 59.37, 16.51],
  ["Karlstad", 59.38, 13.5], ["Halmstad", 56.67, 12.86], ["Växjö", 56.88, 14.81], ["Sundsvall", 62.39, 17.31],
  ["Luleå", 65.58, 22.15], ["Trollhättan", 58.28, 12.29], ["Östersund", 63.18, 14.64], ["Borlänge", 60.48, 15.43],
  ["Falun", 60.61, 15.63], ["Kalmar", 56.66, 16.36], ["Kristianstad", 56.03, 14.16], ["Karlskrona", 56.16, 15.59],
  ["Skövde", 58.39, 13.85], ["Uddevalla", 58.35, 11.94], ["Visby", 57.64, 18.3], ["Kiruna", 67.86, 20.23],
  ["Skellefteå", 64.75, 20.95], ["Örnsköldsvik", 63.29, 18.72], ["Nyköping", 58.75, 17.01], ["Varberg", 57.11, 12.25],
  ["Härnösand", 62.63, 17.94], ["Mora", 61.0, 14.54], ["Abisko", 68.35, 18.83], ["Sigtuna", 59.62, 17.72],
  ["Norrtälje", 59.76, 18.7], ["Enköping", 59.64, 17.08], ["Motala", 58.54, 15.04], ["Lidköping", 58.5, 13.16],
  ["Piteå", 65.32, 21.48], ["Ystad", 55.43, 13.82], ["Strömstad", 58.94, 11.17], ["Hudiksvall", 61.73, 17.1]
].map(([name, lat, lon]) => ({ name, lat, lon }));

function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

export function searchLocal(q) {
  const n = norm(q.trim());
  if (!n) return [];
  return PLACES.filter((p) => norm(p.name).startsWith(n)).concat(PLACES.filter((p) => !norm(p.name).startsWith(n) && norm(p.name).includes(n))).slice(0, 6);
}

export async function searchOnline(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=sv&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("search");
  const data = await res.json();
  return (data.results || []).map((r) => ({ name: r.name, lat: r.latitude, lon: r.longitude, detail: [r.admin1, r.country].filter(Boolean).join(", ") }));
}

export function nearestName(lat, lon) {
  let best = null, bd = Infinity;
  PLACES.forEach((p) => { const d = (p.lat - lat) ** 2 + ((p.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2; if (d < bd) { bd = d; best = p; } });
  return best && bd < 0.6 ? best.name : null;
}

export const DEFAULT_PLACE = { name: "Stockholm", lat: 59.33, lon: 18.07, source: "default" };

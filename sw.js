// Service worker: aplikacja działa bez internetu.
// Najpierw sieć (świeża wersja po aktualizacji), przy braku sieci kopia z pamięci.
// Zapytania do innych serwisów (pogoda, wyszukiwanie miejsc) przechodzą bez zmian.
const CACHE = "mitt-trad-v1";
const SHELL = [
  "./", "index.html", "css/app.css", "manifest.webmanifest", "texts/sv.json",
  "js/main.js", "js/clock.js", "js/rng.js", "js/store.js", "js/seedfile.js", "js/texts.js", "js/questions.js",
  "js/story.js", "js/sound.js", "js/sim.js", "js/dev.js",
  "js/tree/grow.js", "js/tree/paint.js",
  "js/world/season.js", "js/world/sky.js", "js/world/weather.js", "js/world/places.js", "js/world/events.js", "js/world/creatures.js", "js/world/look.js",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});

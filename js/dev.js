// Tryb deweloperski (adres z ?dev). Osobne dane: nigdy nie dotyka prawdziwego drzewa.
// Przewijanie czasu, symulacja historii, wymuszanie pory roku, godziny, pogody i zdarzeń.

import { simulateEntries } from "./sim.js";
import { EVENTS } from "./world/events.js";

export function setupDev(api) {
  const bar = document.getElementById("devbar");
  bar.hidden = false;
  const slot = localStorage.getItem("mittrad:devslot") || "a";
  const clockKey = "mittrad:devclock:" + slot;

  const info = document.createElement("div"); info.className = "dev-info";
  const update = () => {
    const s = api.state(), t = api.treeNow();
    info.textContent = `DEV ${slot} · ${api.clock.now().toLocaleString("sv-SE")} · dni ze słowami ${Math.round(t.P)} · korzenie ${Math.round(t.R)} · ${t.stage} · ${t.genes.shape} (${t.temperament}) · liść ${t.genes.leafShape}/${t.genes.autumnTone} · wpisy ${s.entries.length}`;
  };
  const btn = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.addEventListener("click", () => { fn(); update(); }); bar.appendChild(b); return b; };
  const shift = (ms) => {
    const v = Number(localStorage.getItem(clockKey) || 0) + ms;
    localStorage.setItem(clockKey, String(v)); api.clock.setOffset(v); api.refreshWorld();
  };
  bar.appendChild(info);
  btn("+1h", () => shift(3600e3));
  btn("+6h", () => shift(6 * 3600e3));
  btn("+1d", () => api.rerun(shift(86400e3)));
  btn("+7d", () => api.rerun(shift(7 * 86400e3)));
  btn("+30d", () => api.rerun(shift(30 * 86400e3)));
  btn("teraz", () => { localStorage.setItem(clockKey, "0"); api.rerun(); });
  const sim = (n, mix) => api.save((s) => {
    const start = new Date(api.clock.now().getTime() - n * 86400e3);
    s.entries = simulateEntries(n, mix, { start, silentChance: 0.1, extraChance: 0.12, seed: Date.now() % 1e6 });
    s.createdAt = s.createdAt || start.toISOString();
    if (new Date(s.createdAt) > start) s.createdAt = start.toISOString();
    s.visits.lastDay = null;
  });
  btn("sym 7", () => { sim(7, {}); api.rerun(); });
  btn("sym 30", () => { sim(30, {}); api.rerun(); });
  btn("sym 90", () => { sim(90, {}); api.rerun(); });
  btn("sym 30 wiatr", () => { sim(30, { wind: 5 }); api.rerun(); });
  btn("nowe nasionko", () => { api.store.wipe(); localStorage.setItem(clockKey, "0"); api.rerun(); });
  btn("slot " + (slot === "a" ? "b" : "a"), () => { localStorage.setItem("mittrad:devslot", slot === "a" ? "b" : "a"); api.rerun(); });

  const sel = (label, opts, key, cast = (v) => v) => {
    const s = document.createElement("select");
    opts.forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; s.appendChild(o); });
    s.addEventListener("change", () => { if (s.value === "") delete api.force[key]; else api.force[key] = cast(s.value); api.refreshWorld(); update(); });
    s.title = label; bar.appendChild(s);
  };
  sel("pora roku", [["", "pora roku: auto"], ["autumn", "jesień"], ["winter", "zima"], ["spring", "wiosna"], ["summer", "lato"]], "season");
  sel("godzina", [["", "godzina: teraz"], ...[6, 9, 12, 15, 17, 19, 22, 1].map((h) => [String(h), h + ":00"])], "hour", Number);
  sel("pogoda", [["", "pogoda: auto"], ["clear", "pogodnie"], ["cloudy", "pochmurno"], ["fog", "mgła"], ["rain", "deszcz"], ["snow", "śnieg"], ["storm", "wichura"]], "weather");
  sel("zdarzenie", [["", "zdarzenie: auto"], ["none", "brak"], ...EVENTS.map((e) => [e.key, e.key])], "event", (v) => (v === "none" ? null : v));
  const a = document.createElement("a"); a.href = "docs/przykladowe-drzewa.html"; a.textContent = "galeria"; a.style.color = "#cfe3a8"; bar.appendChild(a);
  const hide = document.createElement("button"); hide.type = "button"; hide.textContent = "×"; hide.addEventListener("click", () => { bar.hidden = true; }); bar.appendChild(hide);
  update();
  setInterval(update, 5000);
}

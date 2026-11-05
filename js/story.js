// Historia drzewa: znaczące chwile i ciche linijki zwykłych dni, pogrupowane po porach roku.
// Wszystko wyliczane z wpisów i znaczników (marks), bez liczb na ekranie.

import { seasonOf } from "./world/season.js";
import { daysBetween } from "./clock.js";
import { firstSentence, fill, formatDate, ui, texts } from "./texts.js";
import { STAGES } from "./tree/grow.js";

const STAGE_KEYS = [["sprout", STAGES.SPROUT], ["leaves", STAGES.LEAVES], ["branch", STAGES.BRANCH], ["young", STAGES.YOUNG]];

function moodText(m) {
  if (!m) return "";
  const t = ui("time_" + (m.part === "day" ? "day" : m.part));
  const w = { clear: "mood_clear", cloudy: "mood_cloudy", rain: "mood_rain", snow: "mood_snow", fog: "mood_fog", storm: "mood_wind" }[m.kind];
  return w ? `${ui(w)} ${t}` : t;
}

/** Ustalony wybór tekstu z listy (historia nie zużywa tekstów z worka). */
function stable(list, seed) {
  if (!list || !list.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function buildStory(state, lat, questions) {
  const T = texts();
  const M = T.memories;
  const items = []; // { day, at, kind: "moment"|"day", text, sub, entryId }
  const entries = state.entries.slice().sort((a, b) => (a.at < b.at ? -1 : 1));

  // zwykłe dni
  const firstByDay = new Map();
  entries.forEach((e) => { if (!firstByDay.has(e.day)) firstByDay.set(e.day, e); });
  entries.forEach((e) => {
    const q = questions.find((x) => x.id === e.qid);
    items.push({ day: e.day, at: e.at, kind: "day", entry: e, question: q ? q.text : null, mood: moodText(e.mood) });
  });

  // pierwsze razy żywiołów
  const seenEl = new Set();
  entries.forEach((e) => {
    if (seenEl.has(e.element)) return;
    seenEl.add(e.element);
    const t = M.first_element[e.element];
    if (t) items.push({ day: e.day, at: e.at + "~1", kind: "moment", text: t.text });
  });

  // etapy wzrostu (n-ty dzień ze słowami)
  const wordDays = [...firstByDay.values()].filter((e) => !e.skipped);
  STAGE_KEYS.forEach(([k, n]) => {
    const e = wordDays[n - 1];
    if (e) { const t = stable(M.stage[k], k); if (t) items.push({ day: e.day, at: e.at + "~2", kind: "moment", text: t.text }); }
  });

  // wzorce żywiołów: 3+ razy w 7 dniach, nie częściej niż co 21 dni dla żywiołu
  const lastPattern = {};
  const days = [...firstByDay.keys()];
  days.forEach((day) => {
    const win = entries.filter((e) => daysBetween(e.day, day) >= 0 && daysBetween(e.day, day) < 7);
    const cnt = {};
    win.forEach((e) => { cnt[e.element] = (cnt[e.element] || 0) + 1; });
    Object.entries(cnt).forEach(([el, c]) => {
      if (c < 3) return;
      if (lastPattern[el] && daysBetween(lastPattern[el], day) < 21) return;
      lastPattern[el] = day;
      const t = stable(M.pattern_element[el], el + day);
      if (t) items.push({ day, at: firstByDay.get(day).at + "~3", kind: "moment", text: t.text });
    });
  });

  // wzorce tematów: 3+ odpowiedzi na ten sam temat w 14 dniach, nie częściej niż co 30 dni
  const lastTheme = {};
  wordDays.forEach((e0) => {
    const day = e0.day;
    const win = entries.filter((e) => e.text && !e.skipped && daysBetween(e.day, day) >= 0 && daysBetween(e.day, day) < 14);
    const cnt = {};
    win.forEach((e) => { const q = questions.find((x) => x.id === e.qid); if (q) cnt[q.theme] = (cnt[q.theme] || 0) + 1; });
    Object.entries(cnt).forEach(([th, c]) => {
      if (c < 3 || (lastTheme[th] && daysBetween(lastTheme[th], day) < 30)) return;
      lastTheme[th] = day;
      const t = stable(M.pattern_theme, th + day);
      if (t) items.push({ day, at: e0.at + "~4", kind: "moment", text: fill(t.text, { tema: T.themes[th] }) });
    });
  });

  // znaczniki: imię, przesadzenie, progi, rzadkie zdarzenia, pierwszy śnieg
  (state.marks || []).forEach((m) => {
    let t = null, vars = {};
    if (m.type === "named") { t = stable(M.named, m.at); vars.namn = m.data.name; }
    else if (m.type === "renamed") { t = stable(M.renamed, m.at); vars.namn = m.data.name; }
    else if (m.type === "transplanted") { t = stable(M.transplanted, m.at); vars.plats = m.data.name; }
    else if (m.type === "milestone30") t = M.milestone_30.entry;
    else if (m.type === "milestone90") t = M.milestone_90.entry;
    else if (m.type === "anniversary") t = stable(M.anniversary.entries, m.at);
    else if (m.type === "rare") { t = stable(M.rare_event, m.at); const ev = T.events[m.data.event]; vars["händelse"] = ev ? ev.name.charAt(0).toUpperCase() + ev.name.slice(1) : ""; }
    else if (m.type === "firstsnow") t = stable(M.first_snow, m.at);
    if (t) items.push({ day: m.day, at: m.at, kind: "moment", text: fill(t.text, vars), special: m.type.startsWith("milestone") || m.type === "anniversary" });
  });

  items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // grupy po porach roku: „Första hösten”, „Första vintern”…
  const groups = [];
  const seasonCount = {};
  let current = null;
  items.forEach((it) => {
    const s = seasonOf(it.day, lat);
    if (!current || current.season !== s || (current.lastDay && daysBetween(current.lastDay, it.day) > 200)) {
      seasonCount[s] = (seasonCount[s] || 0) + 1;
      const ord = ui("ordinal_" + Math.min(5, seasonCount[s]));
      const name = ui("season_" + s);
      current = { season: s, title: ord.charAt(0).toUpperCase() + ord.slice(1) + " " + name, items: [] };
      groups.push(current);
    }
    current.lastDay = it.day;
    current.items.push({ ...it, date: formatDate(it.day) });
  });
  return groups.reverse().map((g) => ({ ...g, items: g.items.reverse() }));
}

export { firstSentence };

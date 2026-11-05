// Mitt träd — główny moduł: scena, wizyta, rytuał, historia, ustawienia.

import * as clock from "./clock.js";
import * as store from "./store.js";
import { loadTexts, texts, ui, fill, pick, formatDate, firstSentence, genitive } from "./texts.js";
import { chooseQuestion, echoFor } from "./questions.js";
import { growTree, stepsFrom } from "./tree/grow.js";
import { paintScene, leafColors } from "./tree/paint.js";
import { worldAt, awayEvents, placeOf } from "./world/look.js";
import { worldLayers } from "./world/creatures.js";
import { seasonOf } from "./world/season.js";
import { eventInfo } from "./world/events.js";
import { fetchWeather, isFresh } from "./world/weather.js";
import { searchLocal, searchOnline, nearestName } from "./world/places.js";
import { buildStory } from "./story.js";
import { collectSeed, readSeed, plantSeed } from "./seedfile.js";
import { startSound, stopSound, setAmbience, elementSound } from "./sound.js";
import { rng, hashSeed } from "./rng.js";

const $ = (id) => document.getElementById(id);
const DEV = new URLSearchParams(location.search).has("dev");
const ELEMENTS = ["sun", "water", "seed", "leaf", "wind", "stone"];
const ICONS = {
  sun: '<circle cx="16" cy="16" r="5.5"/><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2.1 2.1M22.4 22.4l2.1 2.1M7.5 24.5l2.1-2.1M22.4 9.6l2.1-2.1"/>',
  water: '<path d="M16 4c4 6 8 10 8 15a8 8 0 0 1-16 0c0-5 4-9 8-15z"/>',
  seed: '<path d="M16 27V15M16 15c0-5 4-8 9-8 0 5-4 8-9 8zM16 19c0-4-3-6-7-6 0 4 3 6 7 6z"/>',
  leaf: '<path d="M8 25c0-10 6-17 17-18 0 11-7 17-17 18zM8 25l9-9"/>',
  wind: '<path d="M4 12h15a4 4 0 1 0-4-4M4 18h20a4 4 0 1 1-4 4M4 24h9"/>',
  stone: '<path d="M6 22c0-5 4-9 10-9s10 4 10 9c0 2-2 3-4 3H10c-2 0-4-1-4-3z"/>'
};

// ---------- stan ----------
if (DEV) {
  const slot = localStorage.getItem("mittrad:devslot") || "a";
  store.useDevSlot(slot);
  clock.setOffset(Number(localStorage.getItem("mittrad:devclock:" + slot) || 0));
}
let state = store.load();
const force = {};               // nadpisania świata (tryb deweloperski)

// ---------- scena ----------
const canvas = $("scene");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
}
window.addEventListener("resize", resize);
resize();

const seasonFn = (k) => seasonOf(k, placeOf(state).lat);
let treeCache = null, treeVersion = -1, version = 0;
function bump() { version++; }
function treeNow(progress = 1) {
  if (progress < 1) return growTree(state.genome, stepsFrom(state.entries, seasonFn), { progress });
  if (treeVersion !== version || !treeCache) { treeCache = growTree(state.genome, stepsFrom(state.entries, seasonFn)); treeVersion = version; }
  return treeCache;
}

let world = null, worldAtMs = 0;
function refreshWorld() {
  world = worldAt(state, clock.now(), treeNow().P, force);
  worldAtMs = Date.now();
}

const anim = { grow: null, sleep: 0, sleepFrom: null, reaction: null };
let lastPaint = null, hits = [];

function frame(ts) {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  if (frame.last && ts - frame.last < 30) return;   // ok. 30 klatek: lekko dla baterii
  frame.last = ts;
  const t = ts / 1000;
  if (!world || Date.now() - worldAtMs > 60000) refreshWorld();
  let progress = 1;
  if (anim.grow) {
    progress = Math.min(1, (performance.now() - anim.grow.start) / anim.grow.dur);
    if (progress >= 1) { const done = anim.grow.done; anim.grow = null; done && done(); }
  }
  if (anim.sleepFrom != null) {
    const k = Math.min(1, (performance.now() - anim.sleepFrom) / 4000);
    anim.sleep = 1 - k * k * (3 - 2 * k);
    if (k >= 1) anim.sleepFrom = null;
  }
  const tree = anim.grow ? treeNow(progress) : treeNow();
  const look = { ...world.look, time: t, sleep: anim.sleep, milestoneStone: state.marks.some((m) => m.type === "milestone30") };
  const layers = worldLayers({ event: world.event, traces: world.traces, weather: world.weather, light: look.light, season: look.season, time: t, reaction: anim.reaction, leafCols: leafColors(look, tree) });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lastPaint = paintScene(ctx, W, H, tree, look, layers);
  lastPaint.tree = tree;
  hits = layers.hits;
  document.documentElement.classList.toggle("night", look.light < 0.42);
  setAmbience(look.wind, world.weather.kind === "rain" || world.weather.kind === "storm", t);
}

// ---------- tekst nad sceną ----------
const voice = $("voice");
let voiceTimers = [];
function say(lines, opts = {}) {
  voiceTimers.forEach(clearTimeout); voiceTimers = [];
  voice.innerHTML = "";
  const all = [];
  lines.filter(Boolean).forEach((l) => {
    const small = typeof l === "object" && l.small;
    const text = typeof l === "object" ? l.text : l;
    String(text).split("\n").forEach((part) => all.push({ part, small }));
  });
  all.forEach((x, i) => {
    const d = document.createElement("div");
    d.className = "line" + (x.small ? " small" : "");
    d.textContent = x.part;
    voice.appendChild(d);
    voiceTimers.push(setTimeout(() => d.classList.add("on"), (opts.delay || 0) + i * (opts.step || 900)));
  });
  return (opts.delay || 0) + all.length * (opts.step || 900);
}
function clearVoice() { voice.innerHTML = ""; }

// ---------- pomocnicze ----------
const T = () => texts();
const today = () => clock.dayKey(clock.now());
const todays = () => state.entries.filter((e) => e.day === today());
function save(fn) { store.update(fn); state = store.get(); bump(); }
function stepsCount() { return stepsFrom(state.entries, seasonFn).length; }
function hasMark(type, data) { return state.marks.some((m) => m.type === type && (!data || JSON.stringify(m.data) === JSON.stringify(data))); }
function addMark(type, data = {}) { save((s) => { s.marks.push({ type, day: today(), at: clock.now().toISOString(), data }); }); }
function elementName(el) { return ui("element_" + el); }

// ---------- wizyta ----------
function visit() {
  const now = clock.now(), d = today();
  const lastDay = state.visits.lastDay;
  const gap = lastDay ? clock.daysBetween(lastDay, d) : 0;
  const P = treeNow().P;
  refreshWorld();
  const G = T().greetings;
  const lines = [];

  // progi i rocznice: wyjątkowe powitanie, wpis w historii, ślad w świecie
  const steps = stepsCount();
  let milestone = null;
  if (steps >= 30 && !hasMark("milestone30")) { addMark("milestone30"); milestone = T().memories.milestone_30.greetings; }
  else if (steps >= 90 && !hasMark("milestone90")) { addMark("milestone90"); milestone = T().memories.milestone_90.greetings; }
  if (state.createdAt) {
    const years = Math.floor(clock.daysBetween(clock.dayKey(new Date(state.createdAt)), d) / 365);
    if (years >= 1 && !hasMark("anniversary", { year: years })) { addMark("anniversary", { year: years }); milestone = T().memories.anniversary.greetings; }
  }

  let g;
  if (milestone) g = pick(state, "milestone", milestone, d);
  else if (gap >= 4) { g = pick(state, "greetings.awakening", G.awakening, d); anim.sleep = 1; anim.sleepFrom = performance.now() + 1500; }
  else if (gap >= 2) g = pick(state, "greetings.return_few_days", G.return_few_days, d);
  else if (gap === 0 && lastDay === d) g = pick(state, "greetings.same_day", G.same_day, d, String(state.entries.length));
  else {
    const r = rng(hashSeed("greet", d))();
    if (state.name && r < 0.25) g = pick(state, "greetings.named", G.named, d);
    else if (r < 0.6) g = pick(state, "greetings.return_next_day", G.return_next_day, d);
    else {
      const part = world.part === "day" ? "evening" : world.part;
      g = pick(state, "greetings." + part, G[part] || G.return_next_day, d);
    }
  }
  if (g) lines.push(fill(g.text, { namn: state.name }));

  // obserwacja: co działo się pod nieobecność albo teraz
  const E = T().events;
  if (gap >= 2) {
    const away = awayEvents(state, lastDay, now, P);
    const rank = (k) => { const info = eventInfo(k); return info ? { rare: 3, occasional: 2, common: 1 }[info.rarity] : 1; };
    away.sort((a, b) => rank(b) - rank(a));
    const keys = [...new Set(away)].slice(0, rank(away[0]) >= 2 ? 2 : 1);
    keys.forEach((k) => { const ev = E[k]; if (ev && ev.away && ev.away.length) { const it = pick(state, "events." + k + ".away", ev.away, d); lines.push({ text: it.text, small: true }); } });
    if (world.traces.has("spar_i_snon") && E.spar_i_snon) lines.push({ text: pick(state, "events.spar.away", E.spar_i_snon.away, d).text, small: true });
  } else if (world.event && E[world.event] && E[world.event].now.length && rng(hashSeed("obs", d, world.part))() < 0.7) {
    lines.push({ text: pick(state, "events." + world.event + ".now", E[world.event].now, d, world.part).text, small: true });
  }
  // rzadkie chwile i pierwszy śnieg trafiają do historii
  if (world.event && eventInfo(world.event) && eventInfo(world.event).rarity === "rare") {
    const recent = state.marks.find((m) => m.type === "rare" && m.data.event === world.event && clock.daysBetween(m.day, d) < 30);
    if (!recent) addMark("rare", { event: world.event });
  }
  if (world.weather.snowCover && !hasMark("firstsnow")) addMark("firstsnow");

  save((s) => { s.visits.last = now.toISOString(); s.visits.lastDay = d; });
  const t = say(lines, { delay: 1400, step: 1100 });
  setTimeout(nextStep, t + 1600);
}

/** Co dalej po powitaniu albo po rytuale. */
function nextStep() {
  hide("writer", "elements", "prompt", "another", "naming");
  const done = todays();
  if (!done.length) { showQuestion(); return; }
  const P = treeNow().P;
  if (P >= 7 && !state.name && !state.settings.namingAsked) { showNaming(); return; }
  const used = new Set(done.map((e) => e.element));
  if (used.size < ELEMENTS.length) { const a = $("another"); a.textContent = ui("another_ritual"); a.hidden = false; }
}
function hide(...ids) { ids.forEach((id) => { $(id).hidden = true; }); }

// ---------- rytuał ----------
let ritual = null; // { qid, extra, skipped, text }

function currentQuestion() {
  const d = today();
  const Q = T().questions;
  if (state.question && state.question.day === d) return Q.find((q) => q.id === state.question.qid) || Q[0];
  const q = chooseQuestion(state, Q, d, world.part === "day" ? "day" : world.part);
  save((s) => { s.question = { day: d, qid: q.id, swapped: false }; });
  return q;
}

function showQuestion() {
  const q = currentQuestion();
  ritual = { qid: q.id, extra: false };
  const echo = echoFor(state, q.id, today());
  const echoEl = $("echo");
  if (echo) {
    const list = echo.year ? T().greetings.echo_year : T().greetings.echo;
    const it = pick(state, echo.year ? "greetings.echo_year" : "greetings.echo", list, today(), q.id);
    echoEl.textContent = fill(it.text, { citat: firstSentence(echo.entry.text), datum: formatDate(echo.entry.day) });
    echoEl.hidden = false;
  } else echoEl.hidden = true;
  $("question").textContent = q.text;
  $("prompt").hidden = false;
}

$("question").addEventListener("click", () => openWriter());
$("another").addEventListener("click", () => {
  ritual = { qid: null, extra: true };
  $("another").hidden = true;
  openWriter();
});

function openWriter() {
  hide("prompt", "elements");
  clearVoice();
  const d = today();
  const q = ritual.extra ? null : T().questions.find((x) => x.id === ritual.qid);
  $("writer-question").textContent = q ? q.text : ui("another_ritual");
  const ta = $("answer");
  ta.placeholder = ui("answer_placeholder");
  const key = ritual.extra ? "extra" : ritual.qid;
  ta.value = state.draft && state.draft.day === d && state.draft.qid === key ? state.draft.text : "";
  $("done").textContent = ui("answer_done");
  $("skip").textContent = ui("skip_words");
  const other = $("other");
  other.textContent = ui("other_question");
  other.hidden = ritual.extra || (state.question && state.question.swapped);
  $("writer").hidden = false;
  setTimeout(() => ta.focus({ preventScroll: true }), 350);
}
let draftTimer = null;
$("answer").addEventListener("input", () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const text = $("answer").value;
    save((s) => { s.draft = { day: today(), qid: ritual.extra ? "extra" : ritual.qid, text }; });
  }, 500);
});
$("done").addEventListener("click", () => {
  const text = $("answer").value.trim();
  if (!text) { $("answer").focus(); return; }
  ritual.text = text; ritual.skipped = false;
  showElements();
});
$("skip").addEventListener("click", () => { ritual.text = null; ritual.skipped = true; showElements(); });
$("other").addEventListener("click", () => {
  const d = today();
  const q = chooseQuestion(state, T().questions, d, world.part === "day" ? "day" : world.part, [ritual.qid]);
  save((s) => { s.question = { day: d, qid: q.id, swapped: true }; });
  ritual.qid = q.id;
  $("writer").hidden = true;
  showQuestion();
});

function showElements() {
  $("answer").blur();
  $("writer").hidden = true;
  $("elements-title").textContent = ui("choose_element");
  const used = new Set(todays().map((e) => e.element));
  const grid = $("element-grid");
  grid.innerHTML = "";
  ELEMENTS.forEach((el) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "el-btn";
    b.disabled = ritual.extra && used.has(el);
    b.innerHTML = `<svg viewBox="0 0 32 32" aria-hidden="true">${ICONS[el]}</svg><span class="el-name">${ui("element_" + el)}</span><span class="el-meaning">${ui("element_" + el + "_meaning")}</span>`;
    b.addEventListener("click", () => chooseElement(el));
    grid.appendChild(b);
  });
  $("elements").hidden = false;
}

function responseFor(el) {
  const R = T().responses;
  const d = today();
  if (ritual.skipped) return pick(state, "responses.no_words", R.no_words, d);
  if (ritual.extra) return pick(state, "responses.combined", R.combined, d, el);
  const steps = stepsFrom(state.entries, seasonFn);
  const wordDays = steps.filter((s) => s.words).length;
  if (wordDays + 1 < 3) return pick(state, "responses.seed_stage", R.seed_stage, d);
  const pool = R[el];
  const prior = state.entries.filter((e) => e.element === el);
  let kind = "general";
  if (!prior.length) kind = "first";
  else if (steps.length >= 2 && steps[steps.length - 1].element === el && steps[steps.length - 2].element === el) kind = "repeat";
  else if (clock.daysBetween(prior[prior.length - 1].day, d) > 21) kind = "rare";
  const list = pool[kind] && pool[kind].length ? pool[kind] : pool.general;
  return pick(state, "responses." + el + "." + kind, list, d);
}

function chooseElement(el) {
  $("elements").hidden = true;
  elementSound(el);
  const resp = responseFor(el);
  const now = clock.now();
  const entry = {
    id: store.newId(), day: today(), at: now.toISOString(), element: el,
    qid: ritual.extra ? null : ritual.qid, text: ritual.skipped ? null : ritual.text,
    skipped: !!ritual.skipped, extra: !!ritual.extra,
    mood: { part: world.part, kind: world.weather.kind }
  };
  const first = !ritual.extra;
  save((s) => { s.entries.push(entry); s.draft = null; });
  // najpierw widoczna zmiana na drzewie, potem słowa
  anim.grow = { start: performance.now(), dur: first ? 4500 : 2200, done: () => {
    say([resp && resp.text], { step: 1200 });
    respondUntil = performance.now() + 1500;
  } };
  ritual = null;
}
let respondUntil = 0;

// ---------- imię ----------
function showNaming() {
  $("naming-text").textContent = ui("naming_invite");
  $("naming-input").placeholder = ui("naming_placeholder");
  $("naming-save").textContent = ui("naming_save");
  $("naming-later").textContent = ui("naming_later");
  $("naming").hidden = false;
}
$("naming-save").addEventListener("click", () => {
  const name = $("naming-input").value.trim();
  if (!name) return;
  save((s) => { s.name = name; s.settings.namingAsked = true; });
  addMark("named", { name });
  $("naming").hidden = true;
  say([fill(pick(state, "greetings.named", T().greetings.named, today()).text, { namn: name })]);
  setTimeout(nextStep, 3500);
});
$("naming-later").addEventListener("click", () => { save((s) => { s.settings.namingAsked = true; }); $("naming").hidden = true; nextStep(); });

// ---------- dotyk: drzewo, zwierzęta, przyspieszanie animacji ----------
const tip = $("tip");
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
  const x = e.clientX, y = e.clientY;
  if (anim.grow) { anim.grow.start = -1e9; return; }            // dotyk kończy animację od razu
  if (voiceTimers.length) { voice.querySelectorAll(".line").forEach((l) => l.classList.add("on")); }
  if (soundWanted && !soundStarted) { soundStarted = startSound(); }
  for (const h of hits) {
    if (Math.hypot(h.x - x, h.y - y) < h.r) { anim.reaction = { key: h.key, until: performance.now() / 1000 + 0.8 }; tip.hidden = true; return; }
  }
  const part = hitTree(x, y);
  if (part) showTip(part, x, y); else tip.hidden = true;
});

function distToSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
  let u = ((px - a[0]) * dx + (py - a[1]) * dy) / L; u = Math.max(0, Math.min(1, u));
  return Math.hypot(px - (a[0] + u * dx), py - (a[1] + u * dy));
}
function hitTree(x, y) {
  if (!lastPaint) return null;
  const { pos, M, tree } = lastPaint;
  let best = null, bd = Infinity;
  tree.segments.forEach((s) => {
    if (!s.day) return;
    const p = pos.get(s.id); if (!p) return;
    const d = distToSeg(x, y, M(...p.start), M(...p.end));
    const tol = Math.max(10, s.w * lastPaint.cam.ppu * 0.6);
    if (d < tol && d < bd) { bd = d; best = { kind: s.depth === 0 ? "branch" : "branch", seg: s }; }
  });
  tree.roots.forEach((s) => {
    if (!s.day) return;
    const d = distToSeg(x, y, M(s.x0, s.y0), M(s.x1, s.y1));
    if (d < 9 && d < bd) { bd = d; best = { kind: "root", seg: s }; }
  });
  tree.buds.forEach((b) => {
    const p = pos.get(b.seg); if (!p || !b.day) return;
    const e = M(...p.end);
    if (Math.hypot(e[0] - x, e[1] - y) < 12) { best = { kind: "bud", seg: b }; bd = 0; }
  });
  return best;
}
function showTip(part, x, y) {
  const s = part.seg;
  const entry = state.entries.find((e) => e.id === s.entryId);
  const key = part.kind === "root" ? "touch_root" : part.kind === "bud" ? "touch_bud" : "touch_branch";
  const quote = entry && entry.text && !entry.deleted ? firstSentence(entry.text) : ui("touch_no_words");
  tip.innerHTML = "";
  const a = document.createElement("div"); a.className = "tip-date"; a.textContent = `${formatDate(s.day)} · ${elementName(s.el || (entry && entry.element) || "stone")}`;
  const b = document.createElement("div"); b.textContent = ui(key, { datum: formatDate(s.day) });
  const c = document.createElement("div"); c.className = "tip-quote"; c.textContent = quote;
  tip.append(a, b, c);
  tip.hidden = false;
  const w = Math.min(320, W - 32);
  tip.style.left = Math.max(16, Math.min(W - w - 16, x - w / 2)) + "px";
  tip.style.top = Math.max(16, Math.min(H - 180, y - 150)) + "px";
  clearTimeout(showTip.t); showTip.t = setTimeout(() => { tip.hidden = true; }, 6000);
}

// ---------- historia ----------
function openSheet(title, build) {
  $("sheet-title").textContent = title;
  const body = $("sheet-body");
  body.innerHTML = "";
  const inner = document.createElement("div");
  inner.className = "sheet-inner";
  body.appendChild(inner);
  build(inner);
  $("sheet").hidden = false;
}
$("sheet-close").addEventListener("click", () => { $("sheet").hidden = true; bump(); });

function iconFor(el) { return `<svg viewBox="0 0 32 32">${ICONS[el] || ""}</svg>`; }

function renderHistory(inner) {
  const groups = buildStory(state, placeOf(state).lat, T().questions);
  if (!groups.length) { const p = document.createElement("p"); p.textContent = ui("history_empty"); inner.appendChild(p); return; }
  groups.forEach((g) => {
    const sec = document.createElement("section"); sec.className = "season-group";
    const h = document.createElement("h3"); h.className = "season-title"; h.textContent = g.title; sec.appendChild(h);
    g.items.forEach((it) => {
      if (it.kind === "moment") {
        const m = document.createElement("div"); m.className = "moment" + (it.special ? " special" : "");
        m.innerHTML = `<div class="m-date"></div><div class="m-text"></div>`;
        m.querySelector(".m-date").textContent = it.date;
        m.querySelector(".m-text").textContent = it.text;
        sec.appendChild(m);
      } else sec.appendChild(dayRow(it));
    });
    inner.appendChild(sec);
  });
}
function dayRow(it) {
  const e = it.entry;
  const row = document.createElement("div"); row.className = "day"; row.setAttribute("role", "button"); row.tabIndex = 0;
  const words = e.deleted ? "…" : e.text ? firstSentence(e.text) : ui("touch_no_words");
  row.innerHTML = `<span class="d-icon">${iconFor(e.element)}</span><div class="d-main"><div class="d-date"></div><div class="d-text"></div><div class="d-full"></div></div>`;
  row.querySelector(".d-date").textContent = it.date + (it.mood ? " · " + it.mood : "");
  row.querySelector(".d-text").textContent = words;
  const full = row.querySelector(".d-full");
  if (it.question) { const q = document.createElement("div"); q.className = "d-q"; q.textContent = it.question; full.appendChild(q); }
  if (e.text && !e.deleted) {
    const t = document.createElement("div"); t.className = "d-text"; t.style.whiteSpace = "pre-wrap"; t.textContent = e.text; full.appendChild(t);
    const act = document.createElement("div"); act.className = "d-actions";
    if (e.day === today()) {
      const ed = document.createElement("button"); ed.type = "button"; ed.textContent = ui("edit");
      ed.addEventListener("click", (ev) => { ev.stopPropagation(); editEntry(full, e); });
      act.appendChild(ed);
    }
    const del = document.createElement("button"); del.type = "button"; del.textContent = ui("delete");
    del.addEventListener("click", (ev) => { ev.stopPropagation(); confirmDelete(full, e); });
    act.appendChild(del);
    full.appendChild(act);
  }
  row.addEventListener("click", () => row.classList.toggle("open"));
  return row;
}
function editEntry(full, e) {
  full.innerHTML = "";
  const ta = document.createElement("textarea"); ta.value = e.text; full.appendChild(ta);
  const b = document.createElement("button"); b.className = "pill"; b.type = "button"; b.textContent = ui("naming_save");
  b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    save((s) => { const x = s.entries.find((y) => y.id === e.id); if (x && ta.value.trim()) x.text = ta.value.trim(); });
    openSheet($("sheet-title").textContent, renderHistory);
  });
  ta.addEventListener("click", (ev) => ev.stopPropagation());
  full.appendChild(b);
  ta.focus();
}
function confirmDelete(full, e) {
  const c = document.createElement("div"); c.className = "confirm";
  c.innerHTML = `<p></p><div class="row"></div>`;
  c.querySelector("p").textContent = ui("delete_confirm");
  const yes = document.createElement("button"); yes.className = "pill"; yes.type = "button"; yes.textContent = ui("confirm");
  const no = document.createElement("button"); no.className = "ghost"; no.type = "button"; no.textContent = ui("cancel");
  yes.addEventListener("click", (ev) => { ev.stopPropagation(); save((s) => { const x = s.entries.find((y) => y.id === e.id); if (x) { x.text = null; x.deleted = true; } }); openSheet($("sheet-title").textContent, renderHistory); });
  no.addEventListener("click", (ev) => { ev.stopPropagation(); c.remove(); });
  c.querySelector(".row").append(yes, no);
  c.addEventListener("click", (ev) => ev.stopPropagation());
  full.appendChild(c);
}
$("history-btn").addEventListener("click", () => {
  openSheet(state.name ? ui("history_title_named", { namn: state.name }) : ui("history_title"), renderHistory);
});

// ---------- ustawienia ----------
function backupDue() {
  if (!state.createdAt) return false;
  const age = clock.daysBetween(clock.dayKey(new Date(state.createdAt)), today());
  if (age < 30) return false;
  if (!state.settings.lastBackup) return true;
  return clock.daysBetween(clock.dayKey(new Date(state.settings.lastBackup)), today()) >= 30;
}
function refreshDot() { $("settings-dot").hidden = !backupDue(); }

function renderSettings(inner) {
  const sec = (label) => { const d = document.createElement("div"); d.className = "setting"; const l = document.createElement("span"); l.className = "s-label"; l.textContent = label; d.appendChild(l); inner.appendChild(d); return d; };

  // imię
  const sName = sec(ui("settings_name"));
  const row = document.createElement("div"); row.className = "row";
  const inp = document.createElement("input"); inp.type = "text"; inp.id = "set-name"; inp.value = state.name || ""; inp.placeholder = ui("naming_placeholder"); inp.maxLength = 24;
  const sv = document.createElement("button"); sv.className = "ghost"; sv.type = "button"; sv.textContent = ui("naming_save");
  sv.addEventListener("click", () => {
    const n = inp.value.trim(); if (!n || n === state.name) return;
    const had = !!state.name;
    save((s) => { s.name = n; s.settings.namingAsked = true; });
    addMark(had ? "renamed" : "named", { name: n });
    sv.textContent = "✓";
  });
  row.append(inp, sv); sName.appendChild(row);

  // miejsce
  const sPlace = sec(ui("settings_place"));
  const cur = document.createElement("p"); cur.textContent = placeOf(state).name; sPlace.appendChild(cur);
  sPlace.appendChild(placePicker((p) => {
    const changed = !state.place || state.place.name !== p.name;
    save((s) => { s.place = p; s.weather = null; });
    if (changed && state.createdAt) addMark("transplanted", { name: p.name });
    cur.textContent = p.name; refreshWorld(); updateWeather();
  }));

  // dźwięk
  const sSound = sec(soundWanted ? ui("settings_sound_on") : ui("settings_sound_off"));
  const tb = document.createElement("button"); tb.className = "ghost"; tb.type = "button";
  tb.textContent = soundWanted ? ui("settings_sound_off") : ui("settings_sound_on");
  tb.addEventListener("click", () => { toggleSound(); openSheet(ui("settings_title"), renderSettings); });
  sSound.appendChild(tb);

  // nasiono
  const sSeed = sec(ui("settings_collect_seed"));
  if (backupDue()) { const r = document.createElement("p"); r.textContent = ui("backup_reminder"); sSeed.appendChild(r); }
  const hint = document.createElement("p"); hint.textContent = ui("settings_collect_seed_hint"); sSeed.appendChild(hint);
  const cb = document.createElement("button"); cb.className = "pill"; cb.type = "button"; cb.textContent = ui("settings_collect_seed");
  cb.addEventListener("click", async () => { const ok = await collectSeed(); state = store.get(); if (ok) { cb.textContent = "✓"; refreshDot(); } });
  sSeed.appendChild(cb);

  const sPlant = sec(ui("settings_plant_seed"));
  const file = document.createElement("input"); file.type = "file"; file.accept = ".json,application/json"; file.hidden = true; file.id = "seed-file";
  const pb = document.createElement("button"); pb.className = "ghost"; pb.type = "button"; pb.textContent = ui("settings_plant_seed");
  pb.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const data = await readSeed(f);
      const c = document.createElement("div"); c.className = "confirm";
      const p = document.createElement("p"); p.textContent = ui("settings_plant_seed_confirm"); c.appendChild(p);
      const r = document.createElement("div"); r.className = "row";
      const yes = document.createElement("button"); yes.className = "pill"; yes.type = "button"; yes.textContent = ui("confirm");
      const no = document.createElement("button"); no.className = "ghost"; no.type = "button"; no.textContent = ui("cancel");
      yes.addEventListener("click", () => { plantSeed(data); location.reload(); });
      no.addEventListener("click", () => c.remove());
      r.append(yes, no); c.appendChild(r); sPlant.appendChild(c);
    } catch (e) {
      const p = document.createElement("p"); p.textContent = ui("settings_plant_seed_error"); sPlant.appendChild(p);
    }
    file.value = "";
  });
  sPlant.append(pb, file);

  // instalacja
  const standalone = navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  if (!standalone) { const sIn = sec(ui("app_name")); const p = document.createElement("p"); p.textContent = ui("install_hint"); sIn.appendChild(p); }
}
$("settings-btn").addEventListener("click", () => openSheet(ui("settings_title"), renderSettings));

function placePicker(onPick) {
  const wrap = document.createElement("div"); wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.gap = "8px";
  const row = document.createElement("div"); row.className = "row";
  const loc = document.createElement("button"); loc.className = "ghost"; loc.type = "button"; loc.textContent = ui("first_place_use_location");
  const input = document.createElement("input"); input.type = "text"; input.placeholder = ui("first_place_search_placeholder"); input.autocomplete = "off";
  const results = document.createElement("div"); results.className = "results";
  const show = (list) => {
    results.innerHTML = "";
    list.forEach((p) => {
      const b = document.createElement("button"); b.type = "button";
      b.textContent = p.name;
      if (p.detail) { const s = document.createElement("small"); s.textContent = p.detail; b.appendChild(s); }
      b.addEventListener("click", () => { results.innerHTML = ""; input.value = p.name; onPick({ name: p.name, lat: p.lat, lon: p.lon, source: "search" }); });
      results.appendChild(b);
    });
  };
  let tmr = null;
  input.addEventListener("input", () => {
    const q = input.value.trim();
    show(searchLocal(q));
    clearTimeout(tmr);
    if (q.length >= 2 && navigator.onLine) tmr = setTimeout(async () => {
      try { const online = await searchOnline(q); const local = searchLocal(q); const names = new Set(local.map((x) => x.name)); show([...local, ...online.filter((x) => !names.has(x.name))].slice(0, 7)); } catch (e) { /* offline: zostaje lista lokalna */ }
    }, 450);
  });
  loc.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    loc.textContent = "…";
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = p.coords.latitude, lon = p.coords.longitude;
      const name = nearestName(lat, lon) || "Min plats";
      loc.textContent = name;
      onPick({ name, lat, lon, source: "gps" });
    }, () => { loc.textContent = ui("first_place_use_location"); }, { timeout: 10000, maximumAge: 3600e3 });
  });
  row.append(loc);
  wrap.append(row, input, results);
  return wrap;
}

// ---------- dźwięk ----------
let soundWanted = !!state.settings.sound, soundStarted = false;
function toggleSound() {
  soundWanted = !soundWanted;
  save((s) => { s.settings.sound = soundWanted; });
  if (soundWanted) soundStarted = startSound(); else { stopSound(); soundStarted = false; }
  $("sound-btn").classList.toggle("on", soundWanted);
}
$("sound-btn").addEventListener("click", toggleSound);
$("sound-btn").classList.toggle("on", soundWanted);

// ---------- pogoda ----------
async function updateWeather() {
  if (!state.place || !navigator.onLine) return;
  if (isFresh(state.weather, state.place)) return;
  const w = await fetchWeather(state.place);
  if (w) { save((s) => { s.weather = w; }); refreshWorld(); }
}

// ---------- pierwsze doświadczenie ----------
function firstExperience() {
  const el = $("first");
  el.innerHTML = "";
  el.hidden = false;
  const lines = [ui("first_seed_1"), ui("first_seed_2"), ui("first_seed_3")];
  lines.forEach((t, i) => {
    const p = document.createElement("p"); p.className = "voice-line"; p.textContent = t; el.appendChild(p);
    setTimeout(() => p.classList.add("on"), 1200 + i * 2600);
  });
  const place = document.createElement("div"); place.className = "place";
  const q = document.createElement("p"); q.className = "voice-line on"; q.textContent = ui("first_place_question");
  let chosen = null;
  const plant = document.createElement("button"); plant.className = "pill"; plant.type = "button"; plant.textContent = ui("first_place_plant"); plant.hidden = true;
  const picker = placePicker((p) => { chosen = p; plant.hidden = false; });
  place.append(q, picker, plant);
  el.appendChild(place);
  setTimeout(() => place.classList.add("on"), 1200 + lines.length * 2600 + 600);
  plant.addEventListener("click", () => {
    if (!chosen) return;
    save((s) => { s.place = chosen; s.createdAt = clock.now().toISOString(); s.visits = { last: null, lastDay: null }; });
    store.requestPersistence();
    el.hidden = true;
    refreshWorld();
    updateWeather();
    say([ui("first_planted", { plats: chosen.name })]);
    save((s) => { s.visits.last = clock.now().toISOString(); s.visits.lastDay = today(); });
    setTimeout(nextStep, 4200);
  });
}

// ---------- tryb deweloperski ----------
async function devBar() {
  const { setupDev } = await import("./dev.js");
  setupDev({ state: () => state, save, bump, refreshWorld, force, treeNow, clock, store, rerun: () => location.reload() });
}

// ---------- start ----------
async function boot() {
  try { await loadTexts(); } catch (e) { console.error("Brak tekstów", e); }
  requestAnimationFrame(frame);
  setTimeout(() => $("fade").classList.add("gone"), 300);
  refreshDot();
  if (DEV) devBar();
  if (!state.createdAt) firstExperience();
  else { visit(); updateWeather(); }
  setInterval(updateWeather, 30 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.createdAt && state.visits.lastDay !== today() && !anim.grow && !ritual) { $("fade").classList.remove("gone"); setTimeout(() => { $("fade").classList.add("gone"); visit(); }, 400); }
  });
  if ("serviceWorker" in navigator && !DEV) navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();

export { genitive };

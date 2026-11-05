// Dźwięk: tylko przyroda, domyślnie wyłączony, bardzo cicho.
// Wiatr i deszcz generowane w przeglądarce (bez plików). Ptaki: na razie cisza
// (lepsza cisza niż sztuczny ptak; nagrania na wolnej licencji można dodać później).

let ctx = null, master = null, windGain = null, rainGain = null, windFilter = null, started = false;

function noiseBuffer(ac, seconds = 2, brown = false) {
  const len = ac.sampleRate * seconds, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return buf;
}

export function soundOn() { return started && master && master.gain.value > 0; }

/** Musi być wywołane z dotknięcia (iPad nie pozwala inaczej). */
export function startSound() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // wiatr: szum brązowy przez filtr, którego częstotliwość płynie powoli
    const wSrc = ctx.createBufferSource(); wSrc.buffer = noiseBuffer(ctx, 4, true); wSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = "lowpass"; windFilter.frequency.value = 500;
    windGain = ctx.createGain(); windGain.gain.value = 0.0;
    wSrc.connect(windFilter).connect(windGain).connect(master); wSrc.start();
    // deszcz: szum biały, pasmowo
    const rSrc = ctx.createBufferSource(); rSrc.buffer = noiseBuffer(ctx, 2); rSrc.loop = true;
    const rf = ctx.createBiquadFilter(); rf.type = "bandpass"; rf.frequency.value = 2400; rf.Q.value = 0.6;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rSrc.connect(rf).connect(rainGain).connect(master); rSrc.start();
  }
  if (ctx.state === "suspended") ctx.resume();
  started = true;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
  return true;
}

export function stopSound() {
  if (!ctx) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  started = false;
}

/** Dopasowuje tło do pogody: wiatr 0..1, deszcz bool. */
export function setAmbience(wind, raining, t) {
  if (!ctx || !started) return;
  const now = ctx.currentTime;
  const gust = 0.5 + 0.5 * Math.sin(t * 0.13) * Math.sin(t * 0.07 + 1);
  windGain.gain.setTargetAtTime(0.04 + wind * 0.22 * (0.6 + 0.4 * gust), now, 1.5);
  windFilter.frequency.setTargetAtTime(300 + wind * 700 * gust, now, 2);
  rainGain.gain.setTargetAtTime(raining ? 0.12 : 0, now, 2);
}

/** Cichy, naturalny dźwięk przy wyborze żywiołu. */
export function elementSound(el) {
  if (!ctx || !started) return;
  const now = ctx.currentTime, g = ctx.createGain(); g.connect(master);
  if (el === "water") {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(900, now); o.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.12, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    o.connect(g); o.start(now); o.stop(now + 0.45);
    return;
  }
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 1.6, el === "wind" || el === "stone");
  const f = ctx.createBiquadFilter();
  f.type = el === "leaf" || el === "seed" ? "highpass" : "lowpass";
  f.frequency.value = { wind: 700, leaf: 3000, seed: 2500, sun: 1200, stone: 220 }[el] || 1000;
  const peak = { wind: 0.3, leaf: 0.08, seed: 0.06, sun: 0.05, stone: 0.12 }[el] || 0.08;
  const dur = { wind: 1.5, leaf: 0.6, seed: 0.4, sun: 1.2, stone: 0.5 }[el] || 0.6;
  g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(peak, now + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f).connect(g); src.start(now); src.stop(now + dur + 0.05);
}

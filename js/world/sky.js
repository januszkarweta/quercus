// Słońce i księżyc liczone lokalnie z daty i współrzędnych (bez internetu).
// Wystarczająco dokładne do wyglądu sceny: wschód, zachód, zmierzch, białe noce, noc polarna.

const RAD = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);

function eclipticToHorizontal(d, L, lat, lon) {
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const lst = (gmst * 15 + lon) * RAD;
  const ha = lst - ra;
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  let az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  az = (az / RAD + 360) % 360; // 0 = północ, 90 = wschód, 180 = południe
  return { alt: alt / RAD, az };
}

function sunLongitude(d) {
  const g = ((357.529 + 0.98560028 * d) % 360) * RAD;
  const q = (280.459 + 0.98564736 * d) % 360;
  return (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
}

export function sunPosition(date, lat, lon) {
  const d = (date.getTime() - J2000) / 86400000;
  return eclipticToHorizontal(d, sunLongitude(d), lat, lon);
}

/** Faza księżyca: 0 = nów, 0.5 = pełnia. */
export function moonPhase(date) {
  const days = (date.getTime() - NEW_MOON_REF) / 86400000;
  return (((days % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
}

/** Przybliżona pozycja księżyca (leży na ekliptyce, przesunięty względem słońca o fazę). */
export function moonPosition(date, lat, lon) {
  const d = (date.getTime() - J2000) / 86400000;
  const L = sunLongitude(d) + moonPhase(date) * 2 * Math.PI;
  return eclipticToHorizontal(d, L, lat, lon);
}

function smooth(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

/** Pozycja ciała niebieskiego na ekranie (patrzymy na południe). Ułamki szerokości/wysokości. */
export function skyToScreen(pos) {
  let az = pos.az;
  if (az < 60) az = 60; if (az > 300) az = 300;
  const x = 0.06 + ((az - 60) / 240) * 0.88;
  const y = 0.53 - (pos.alt / 55) * 0.42;
  return { x, y };
}

/** Światło sceny: 0 noc, 1 pełny dzień; zmierzch (0..1) do ciepłego nieba. */
export function lightFor(date, lat, lon) {
  const sun = sunPosition(date, lat, lon);
  const light = 0.06 + 0.94 * smooth(-9, 7, sun.alt);
  const dusk = Math.max(0, 1 - Math.abs(sun.alt - 1) / 9) * (sun.alt > -10 ? 1 : 0);
  const stars = 1 - smooth(-12, -4, sun.alt);
  const moonPos = moonPosition(date, lat, lon);
  return {
    sunAlt: sun.alt,
    light, dusk: Math.min(1, dusk), stars,
    sun: sun.alt > -2 ? skyToScreen(sun) : null,
    moon: moonPos.alt > 0 && light < 0.85 ? { ...skyToScreen(moonPos), phase: moonPhase(date) } : null,
    night: sun.alt < -6
  };
}

// Nasiono drzewa: kopia zapasowa całego drzewa w jednym pliku.
// „Samla frö” zapisuje plik (na iPadzie przez arkusz udostępniania, np. do iCloud Drive).
// „Plantera från frö” odtwarza drzewo z pliku.

import { get, replace, update, SCHEMA } from "./store.js";
import { now, dayKey } from "./clock.js";

const MAGIC = "mitt-trad-fro";

export function seedFileName() {
  return `mitt-trad-${dayKey()}.json`;
}

export function buildSeed() {
  return JSON.stringify({ format: MAGIC, version: SCHEMA, savedAt: now().toISOString(), tree: get() }, null, 1);
}

/** Zapisuje nasiono. Zwraca true, jeśli użytkownik je zapisał (albo pobranie się rozpoczęło). */
export async function collectSeed() {
  const text = buildSeed();
  const name = seedFileName();
  const file = new File([text], name, { type: "application/json" });
  let ok = false;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Mitt träd" });
      ok = true;
    } catch (e) {
      if (e && e.name === "AbortError") return false;
    }
  }
  if (!ok) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    ok = true;
  }
  if (ok) update((s) => { s.settings.lastBackup = now().toISOString(); });
  return ok;
}

/** Odczytuje plik nasiona. Rzuca błąd, jeśli plik nie jest nasionem drzewa. */
export async function readSeed(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("not-json"); }
  if (!data || data.format !== MAGIC || !data.tree || typeof data.tree.genome !== "number") {
    throw new Error("not-seed");
  }
  return data;
}

export function plantSeed(data) {
  replace(data.tree);
}

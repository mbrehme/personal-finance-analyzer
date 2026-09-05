/**
 * @file storageUtils.ts
 * @description Sichere LocalStorage Serialisierungs- und Fehlerbehandlungs-Hilfsfunktionen.
 * Fängt QuotaExceededError und Parsing-Fehler defensiv ab.
 * @module repository/utils/storageUtils
 */

/**
 * Liest und parst ein Element typsicher aus dem LocalStorage.
 *
 * @template T
 * @param {string} key - Der Speicherschlüssel
 * @param {T} fallback - Rückgabewert bei Fehlen oder Parsing-Fehlern
 * @returns {T} Das deserialisierte Objekt oder der Fallback
 */
export function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[LocalStorage] Fehler beim Lesen von '${key}':`, err);
    return fallback;
  }
}

/**
 * Serialisiert und schreibt ein Element defensiv in den LocalStorage.
 *
 * @template T
 * @param {string} key - Der Speicherschlüssel
 * @param {T} value - Der zu speichernde Wert
 * @returns {boolean} True bei Erfolg, false bei QuotaExceededError oder Serialisierungsfehlern
 */
export function safeSetItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (err: unknown) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)
    ) {
      console.error(
        `[LocalStorage] Speicherkontingent überschritten beim Schreiben von '${key}'.`,
        err
      );
    } else {
      console.error(`[LocalStorage] Unerwarteter Fehler beim Schreiben von '${key}':`, err);
    }
    return false;
  }
}

/**
 * Entfernt einen Schlüssel sicher aus dem LocalStorage.
 *
 * @param {string} key - Der zu entfernende Schlüssel
 */
export function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.error(`[LocalStorage] Fehler beim Löschen von '${key}':`, err);
  }
}

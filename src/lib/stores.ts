import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { PinnedSite, Settings } from '$lib/types';

const LOCAL_KEY_SETTINGS = 'lt:settings:v1';

function readJson<T>(key: string, fallback: T): T {
  if (!browser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    console.error('readJson error', e);
    return fallback;
  }
}

function writeJson(key: string, data: unknown) {
  if (!browser) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('writeJson error', e);
  }
}

const defaultSettings: Settings = {
  pinned: [],
  customCss: '',
  colors: undefined
};

// ensure history present
if (!defaultSettings.history) defaultSettings.history = [];

export const settings = writable<Settings>(readJson<Settings>(LOCAL_KEY_SETTINGS, defaultSettings));
settings.subscribe((v) => writeJson(LOCAL_KEY_SETTINGS, v));

// Convenience helpers for compatibility
export function getPinned() {
  let s: Settings;
  settings.subscribe((v) => (s = v))();
  return s!.pinned;
}

export function addPinned(site: PinnedSite) {
  settings.update((s) => ({ ...s, pinned: [site, ...s.pinned] }));
}

export function updatePinned(id: string, patch: Partial<PinnedSite>) {
  settings.update((s) => ({ ...s, pinned: s.pinned.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function removePinned(id: string) {
  settings.update((s) => ({ ...s, pinned: s.pinned.filter((p) => p.id !== id) }));
}

export function setCustomCss(css: string) {
  settings.update((s) => ({ ...s, customCss: css }));
}

// History helpers
export function addHistory(entry: Partial<import('$lib/types').HistoryEntry>) {
  const MAX_HISTORY = 200; // keep only this many recent entries
  const MAX_FIELD_CHARS = 2000; // truncate very long fields to avoid huge localStorage entries

  const id = (typeof crypto !== 'undefined' && 'getRandomValues' in crypto)
    ? crypto.getRandomValues(new Uint32Array(2)).join('-')
    : String(Date.now());

  // shallow copy + sanitize large fields
  const eFull = { id, time: Date.now(), ...entry } as import('$lib/types').HistoryEntry;
  if (typeof eFull.query === 'string' && eFull.query.length > MAX_FIELD_CHARS) eFull.query = eFull.query.slice(0, MAX_FIELD_CHARS) + '…';
  if (typeof eFull.result === 'string' && eFull.result.length > MAX_FIELD_CHARS) eFull.result = eFull.result.slice(0, MAX_FIELD_CHARS) + '…';

  // avoid storing the same entry twice in a row (simple dedupe)
  settings.update((s) => {
    const list = s.history || [];
    const last = list[0];
    if (last && last.type === eFull.type && last.query === eFull.query && last.url === eFull.url) {
      // update time for the latest instead of pushing duplicate
      const updated = [{ ...last, time: eFull.time }, ...list.slice(1)];
      return { ...s, history: updated.slice(0, MAX_HISTORY) };
    }
    const updated = [eFull, ...list].slice(0, MAX_HISTORY);
    return { ...s, history: updated };
  });
}

export function clearHistory() {
  settings.update((s) => ({ ...s, history: [] }));
}

export function clearAllSettings() {
  if (browser) {
    localStorage.removeItem(LOCAL_KEY_SETTINGS);
  }
  settings.set(defaultSettings);
}

// storage.local cache for the professor list. `ext` is the WebExtension API
// object (`browser` on Firefox, `chrome` on Chrome) — passed in rather than
// read from globals so this stays testable. See .claude-docs/plan.md §4.1.

import { fetchProfessors } from './api.js';

const SCHEMA_VERSION = 1;
const CACHE_KEY = 'polyratingsCache';
const TTL_MS = 24 * 60 * 60 * 1000;

export async function readCache(ext) {
  const stored = await ext.storage.local.get(CACHE_KEY);
  const cache = stored[CACHE_KEY];
  if (!cache || cache.schemaVersion !== SCHEMA_VERSION) return null;
  return cache;
}

export async function writeCache(ext, professors) {
  const cache = { schemaVersion: SCHEMA_VERSION, fetchedAt: Date.now(), professors };
  await ext.storage.local.set({ [CACHE_KEY]: cache });
  return cache;
}

export function isStale(cache, now = Date.now()) {
  return !cache || now - cache.fetchedAt > TTL_MS;
}

// Returns cached professors if fresh, otherwise fetches, caches, and returns
// the new list. Safe to call from both the background script and the content
// script — neither should assume the other has already primed the cache.
export async function ensureFreshProfessors(ext, { fetchImpl } = {}) {
  const cache = await readCache(ext);
  if (!isStale(cache)) return cache.professors;

  const professors = await fetchProfessors(fetchImpl);
  await writeCache(ext, professors);
  return professors;
}

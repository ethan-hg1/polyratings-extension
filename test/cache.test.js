import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCache, writeCache, isStale, ensureFreshProfessors } from '../src/lib/cache.js';

function fakeExt() {
  const store = new Map();
  return {
    storage: {
      local: {
        async get(key) {
          return store.has(key) ? { [key]: store.get(key) } : {};
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) store.set(k, v);
        },
      },
    },
  };
}

test('readCache: null when nothing stored', async () => {
  assert.equal(await readCache(fakeExt()), null);
});

test('writeCache/readCache: round-trips professors', async () => {
  const ext = fakeExt();
  await writeCache(ext, [{ id: '1' }]);
  const cache = await readCache(ext);
  assert.deepEqual(cache.professors, [{ id: '1' }]);
});

test('readCache: null when schemaVersion mismatches', async () => {
  const ext = fakeExt();
  await ext.storage.local.set({
    polyratingsCache: { schemaVersion: 999, fetchedAt: Date.now(), professors: [] },
  });
  assert.equal(await readCache(ext), null);
});

test('isStale: true when missing, false when within TTL, true past TTL', () => {
  const now = Date.now();
  assert.equal(isStale(null, now), true);
  assert.equal(isStale({ fetchedAt: now - 1000 }, now), false);
  assert.equal(isStale({ fetchedAt: now - 25 * 60 * 60 * 1000 }, now), true);
});

test('ensureFreshProfessors: fetches and caches when empty', async () => {
  const ext = fakeExt();
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    return { ok: true, json: async () => ({ result: { data: [{ id: '1', firstName: 'A', lastName: 'B' }] } }) };
  };
  const professors = await ensureFreshProfessors(ext, { fetchImpl });
  assert.equal(fetchCalls, 1);
  assert.equal(professors.length, 1);
  const cache = await readCache(ext);
  assert.equal(cache.professors.length, 1);
});

test('ensureFreshProfessors: skips fetch when cache is fresh', async () => {
  const ext = fakeExt();
  await writeCache(ext, [{ id: 'cached' }]);
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls++;
    throw new Error('should not be called');
  };
  const professors = await ensureFreshProfessors(ext, { fetchImpl });
  assert.equal(fetchCalls, 0);
  assert.deepEqual(professors, [{ id: 'cached' }]);
});

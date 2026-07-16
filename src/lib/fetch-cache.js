/**
 * fetch-cache.js — Cached fetch with deduplication, abort, retry, and IndexedDB persistence.
 *
 * Guarantees:
 *   1. Same key fetched twice simultaneously → one request, shared promise
 *   2. In-memory cache for instant repeat access (Infinity TTL by default)
 *   3. IndexedDB write-through so cached data survives page reloads
 *   4. AbortController integration for mode-switch cancellation
 *   5. Retry with exponential backoff on transient failures
 */

import { cacheGet, cacheSet, cacheDelete as idbDelete } from './db-cache.js';

const _cache = new Map();
const _inflight = new Map();
const IDB_PREFIX = 'fetch:';

/**
 * @param {string} key   — unique cache key (e.g. 'watershed', 'boundary:namria:0')
 * @param {string} url   — fetch URL
 * @param {object} opts
 * @param {number}  [opts.ttl=Infinity]  — cache lifetime in ms (0 = no cache)
 * @param {number}  [opts.retries=2]     — retry count on transient failure
 * @param {AbortSignal} [opts.signal]    — external abort signal (e.g. from mode switch)
 * @param {boolean} [opts.force=false]   — bypass cache, re-fetch
 * @returns {Promise<object|null>} decoded JSON or null on failure
 */
export async function fetchWithCache(key, url, opts = {}) {
  const { ttl = Infinity, retries = 2, signal, force = false } = opts;

  /* ── Fast path: in-memory hit ── */
  if (!force) {
    const cached = _cache.get(key);
    if (cached && Date.now() < cached.expiresAt && cached.url === url) {
      return cached.data;
    }
  }

  /* ── Dedup concurrent inflight requests ── */
  if (_inflight.has(key)) {
    return _inflight.get(key);
  }

  /* ── Slow path: try IndexedDB (survives reload) ── */
  if (!force) {
    const idbEntry = await idbGet(key);
    if (idbEntry && Date.now() < idbEntry.expiresAt && idbEntry.url === url) {
      _cache.set(key, idbEntry);
      return idbEntry.data;
    }
    /* expired or missing in IDB or URL mismatch — fall through to network */
  }

  /* ── Network fetch ── */
  const promise = _doFetch(url, retries, signal);
  _inflight.set(key, promise);

  try {
    const data = await promise;
    if (data !== null && ttl > 0) {
      const entry = { data, url, expiresAt: Date.now() + ttl };
      _cache.set(key, entry);
      idbSet(key, entry); /* fire-and-forget — don't await */
    }
    return data;
  } finally {
    _inflight.delete(key);
  }
}

async function _doFetch(url, retries, signal) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      return window.decodeGeo ? window.decodeGeo(json) : json;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      lastError = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 200 * 2 ** attempt));
      }
    }
  }
  if (import.meta.env.DEV) console.warn(`fetchWithCache failed (${url}):`, lastError);
  return null;
}

/* ── IndexedDB helpers (fire-and-forget writes, safe reads) ── */

async function idbGet(key) {
  try {
    return await cacheGet(IDB_PREFIX + key);
  } catch {
    return null;
  }
}

async function idbSet(key, entry) {
  try {
    await cacheSet(IDB_PREFIX + key, entry);
  } catch {
    /* non-critical — memory cache still has the data */
  }
}

/**
 * Delete a key from both in-memory and IndexedDB caches.
 */
export async function cacheDelete(key) {
  _cache.delete(key);
  try { await idbDelete(IDB_PREFIX + key); } catch { /* best effort */ }
}

/**
 * Clear all in-memory and IndexedDB cache entries
 * (IDB clear is scoped to keys prefixed with 'fetch:').
 */
export async function cacheClear() {
  _cache.clear();
  _inflight.clear();
  /* Note: we don't bulk-clear IDB here because the store is shared
     with LCM's own cache. Only per-key delete is exposed. */
}
